import type { IncomingMessage, ServerResponse } from 'node:http'
import { checkEnvironment } from '../services/EnvironmentService.js'
import { getServiceStatus } from '../services/GatewayService.js'
import { getChannels, isValidChannelId } from '../services/ConfigService.js'
import { executeOpenClawCommand } from '../services/OpenClawCommandService.js'
import { sendJson, readJsonBody, parseUrl } from '../utils/helpers.js'

function isConfiguredValue(value: unknown): boolean {
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  return value !== null && value !== undefined
}

function analyzeChannelStatus(
  channelId: string,
  output: string
): { ok: boolean; reason?: string; matchedLines: string[] } {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const key = channelId.toLowerCase()
  const matchedLines = lines.filter((line) => line.toLowerCase().includes(key))

  if (matchedLines.length === 0) {
    return {
      ok: false,
      reason: `未在 channels status 输出中发现渠道 ${channelId}，请确认已添加并登录该渠道。`,
      matchedLines,
    }
  }

  const badKeywords = [
    'failed',
    'error',
    'offline',
    'disconnected',
    'not configured',
    'not reachable',
    '未连接',
    '失败',
    '错误',
    '离线',
    '未配置',
  ]
  const goodKeywords = ['connected', 'online', 'enabled', 'ready', 'running', '已连接', '在线', '已启用', '正常']

  const hasBad = matchedLines.some((line) => {
    const lower = line.toLowerCase()
    return badKeywords.some((keyword) => lower.includes(keyword))
  })
  if (hasBad) {
    return {
      ok: false,
      reason: `渠道 ${channelId} 状态异常，请检查输出中的错误行。`,
      matchedLines,
    }
  }

  const hasGood = matchedLines.some((line) => {
    const lower = line.toLowerCase()
    return goodKeywords.some((keyword) => lower.includes(keyword))
  })
  if (!hasGood) {
    return {
      ok: false,
      reason: `已找到渠道 ${channelId}，但未检测到“已连接/在线”状态。`,
      matchedLines,
    }
  }

  return { ok: true, matchedLines }
}

export async function handleDiagnosticsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  host: string,
  port: number
): Promise<boolean> {
  const method = req.method?.toUpperCase() ?? 'GET'
  const url = parseUrl(req, host, port)

  if (method === 'POST' && url.pathname === '/api/diagnostics/test-ai') {
    const start = Date.now()
    try {
      const response = await fetch('https://api.qnaigc.com/v1/models', {
        signal: AbortSignal.timeout(10000),
      })
      const latency = Date.now() - start
      sendJson(res, 200, { ok: response.ok, latency })
    } catch (error) {
      sendJson(res, 200, { 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
    return true
  }

  const channelTestMatch = url.pathname.match(/^\/api\/diagnostics\/test-channel\/([a-z-]+)$/)
  if (method === 'POST' && channelTestMatch) {
    const channelId = channelTestMatch[1]
    if (!isValidChannelId(channelId)) {
      sendJson(res, 400, { ok: false, error: 'Invalid channel id' })
      return true
    }

    const channel = getChannels().find((item) => item.id === channelId)
    if (!channel) {
      sendJson(res, 404, { ok: false, error: 'Channel not found' })
      return true
    }

    if (!channel.enabled) {
      sendJson(res, 200, {
        ok: false,
        channelId,
        error: `渠道 ${channel.name} 当前未启用，请先启用后再测试。`,
      })
      return true
    }

    const missingFields = channel.fields
      .filter((field) => field.required)
      .filter((field) => !isConfiguredValue(channel.config[field.key]))
      .map((field) => field.label)

    if (missingFields.length > 0) {
      sendJson(res, 200, {
        ok: false,
        channelId,
        error: `缺少必填字段：${missingFields.join('、')}`,
      })
      return true
    }

    const validateResult = await executeOpenClawCommand({
      commandId: 'config-validate',
      timeoutMs: 15000,
    })
    if (!validateResult.ok) {
      sendJson(res, 200, {
        ok: false,
        channelId,
        error: `配置校验失败：${validateResult.message}`,
        stdout: validateResult.stdout,
        stderr: validateResult.stderr,
      })
      return true
    }

    const statusCheckResult = await executeOpenClawCommand({
      commandId: 'status',
      timeoutMs: 15000,
    })
    const statusText = [statusCheckResult.stdout, statusCheckResult.stderr].filter(Boolean).join('\n')
    const statusLower = statusText.toLowerCase()
    if (
      statusLower.includes('unknown model') ||
      statusLower.includes('model not found') ||
      statusText.includes('模型不存在')
    ) {
      sendJson(res, 200, {
        ok: false,
        channelId,
        error: '检测到模型配置异常（Unknown model），请先修复模型配置后再测渠道连通性。',
        stdout: statusCheckResult.stdout,
        stderr: statusCheckResult.stderr,
      })
      return true
    }

    const statusResult = await executeOpenClawCommand({
      commandId: 'channels-status',
      timeoutMs: 20000,
    })
    const combinedOutput = [statusResult.stdout, statusResult.stderr].filter(Boolean).join('\n')

    if (!statusResult.ok) {
      sendJson(res, 200, {
        ok: false,
        channelId,
        error: `渠道状态检查失败：${statusResult.message}`,
        stdout: statusResult.stdout,
        stderr: statusResult.stderr,
      })
      return true
    }

    const analysis = analyzeChannelStatus(channelId, combinedOutput)
    if (!analysis.ok) {
      sendJson(res, 200, {
        ok: false,
        channelId,
        error: analysis.reason,
        matchedLines: analysis.matchedLines,
        stdout: statusResult.stdout,
        stderr: statusResult.stderr,
      })
      return true
    }

    sendJson(res, 200, {
      ok: true,
      channelId,
      message: `${channel.name} 连通性测试通过。改完配置后建议执行 openclaw gateway restart。`,
      matchedLines: analysis.matchedLines,
    })
    return true
  }

  if (method === 'GET' && url.pathname === '/api/diagnostics/system') {
    const env = checkEnvironment()
    const service = await getServiceStatus()
    sendJson(res, 200, {
      environment: env,
      service,
      timestamp: new Date().toISOString(),
    })
    return true
  }

  return false
}
