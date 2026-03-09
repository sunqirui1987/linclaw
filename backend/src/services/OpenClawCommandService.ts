import { spawn } from 'node:child_process'
import type {
  OpenClawCommandDefinition,
  OpenClawCommandExecutionResult,
  OpenClawCommandParameter,
} from '../types/index.js'
import { findOpenClawExecutable } from './EnvironmentService.js'

interface ExecuteOptions {
  commandId: string
  parameters?: Record<string, unknown>
  timeoutMs?: number
}

const COMMANDS: OpenClawCommandDefinition[] = [
  {
    id: 'onboard',
    category: '初始化与安装',
    title: 'openclaw onboard',
    description: '交互式向导（配置模型、通道、网关、工作区）。',
    argsTemplate: ['onboard'],
    parameters: [],
    runnable: false,
    disabledReason: '该命令需要交互式终端（TTY），请在系统终端执行。',
  },
  {
    id: 'setup',
    category: '初始化与安装',
    title: 'openclaw setup',
    description: '初始化配置与工作区（非交互版）。',
    argsTemplate: ['setup'],
    parameters: [],
    runnable: true,
    timeoutMs: 60000,
  },
  {
    id: 'configure',
    category: '初始化与安装',
    title: 'openclaw configure',
    description: '交互式配置向导（模型、通道、技能）。',
    argsTemplate: ['configure'],
    parameters: [],
    runnable: false,
    disabledReason: '该命令需要交互式终端（TTY），请在系统终端执行。',
  },
  {
    id: 'gateway-status',
    category: '网关管理',
    title: 'openclaw gateway status',
    description: '查看网关服务状态与探活结果。',
    argsTemplate: ['gateway', 'status'],
    parameters: [],
    runnable: true,
  },
  {
    id: 'gateway-start',
    category: '网关管理',
    title: 'openclaw gateway start',
    description: '启动网关服务。',
    argsTemplate: ['gateway', 'start'],
    parameters: [],
    runnable: true,
    timeoutMs: 60000,
  },
  {
    id: 'gateway-stop',
    category: '网关管理',
    title: 'openclaw gateway stop',
    description: '停止网关服务。',
    argsTemplate: ['gateway', 'stop'],
    parameters: [],
    runnable: true,
    timeoutMs: 60000,
  },
  {
    id: 'gateway-restart',
    category: '网关管理',
    title: 'openclaw gateway restart',
    description: '重启网关服务。',
    argsTemplate: ['gateway', 'restart'],
    parameters: [],
    runnable: true,
    timeoutMs: 90000,
    followupHint: '改完配置后建议执行此命令使变更生效。',
  },
  {
    id: 'gateway-run',
    category: '网关管理',
    title: 'openclaw gateway run',
    description: '前台运行网关（调试用，持续输出）。',
    argsTemplate: ['gateway', 'run'],
    parameters: [],
    runnable: true,
    longRunning: true,
    timeoutMs: 15000,
  },
  {
    id: 'gateway-health',
    category: '网关管理',
    title: 'openclaw gateway health',
    description: '读取网关健康信息。',
    argsTemplate: ['gateway', 'health'],
    parameters: [],
    runnable: true,
  },
  {
    id: 'config-file',
    category: '配置管理',
    title: 'openclaw config file',
    description: '显示当前配置文件路径。',
    argsTemplate: ['config', 'file'],
    parameters: [],
    runnable: true,
  },
  {
    id: 'config-get',
    category: '配置管理',
    title: 'openclaw config get <path>',
    description: '读取指定配置项。',
    argsTemplate: ['config', 'get', '{path}'],
    parameters: [
      { key: 'path', label: '配置路径', required: true, placeholder: 'channels.feishu.appId' },
    ],
    runnable: true,
  },
  {
    id: 'config-set',
    category: '配置管理',
    title: 'openclaw config set <path> <value>',
    description: '修改指定配置项。',
    argsTemplate: ['config', 'set', '{path}', '{value}'],
    parameters: [
      { key: 'path', label: '配置路径', required: true, placeholder: 'channels.feishu.enabled' },
      { key: 'value', label: '配置值', required: true, placeholder: 'true' },
    ],
    runnable: true,
    followupHint: '执行后建议运行 openclaw gateway restart。',
  },
  {
    id: 'config-validate',
    category: '配置管理',
    title: 'openclaw config validate',
    description: '校验配置合法性。',
    argsTemplate: ['config', 'validate'],
    parameters: [],
    runnable: true,
  },
  {
    id: 'doctor',
    category: '诊断与状态',
    title: 'openclaw doctor',
    description: '一键健康检查与自动修复。',
    argsTemplate: ['doctor'],
    parameters: [],
    runnable: true,
    timeoutMs: 120000,
  },
  {
    id: 'status',
    category: '诊断与状态',
    title: 'openclaw status',
    description: '显示会话健康状态和最近联系人。',
    argsTemplate: ['status'],
    parameters: [],
    runnable: true,
  },
  {
    id: 'health',
    category: '诊断与状态',
    title: 'openclaw health',
    description: '从运行中的网关拉取健康数据。',
    argsTemplate: ['health'],
    parameters: [],
    runnable: true,
  },
  {
    id: 'logs',
    category: '诊断与状态',
    title: 'openclaw logs',
    description: '实时查看网关日志（持续输出）。',
    argsTemplate: ['logs'],
    parameters: [],
    runnable: true,
    longRunning: true,
    timeoutMs: 15000,
  },
  {
    id: 'dashboard',
    category: '其他高频操作',
    title: 'openclaw dashboard',
    description: '打开网页控制面板。',
    argsTemplate: ['dashboard'],
    parameters: [],
    runnable: false,
    disabledReason: '该命令会调用系统 GUI，请在本机终端执行。',
  },
  {
    id: 'channels-status',
    category: '其他高频操作',
    title: 'openclaw channels status',
    description: '查看已连接聊天通道。',
    argsTemplate: ['channels', 'status'],
    parameters: [],
    runnable: true,
  },
  {
    id: 'agent-run',
    category: '其他高频操作',
    title: 'openclaw agent run',
    description: '手动触发一次代理运行。',
    argsTemplate: ['agent', 'run'],
    parameters: [],
    runnable: true,
    timeoutMs: 120000,
  },
  {
    id: 'channels-login',
    category: '通道管理',
    title: 'openclaw channels login',
    description: '通道登录流程（如 WhatsApp 扫码）。',
    argsTemplate: ['channels', 'login'],
    parameters: [],
    runnable: false,
    disabledReason: '该命令通常需要扫码/交互，请在本机终端执行。',
  },
  {
    id: 'channels-add',
    category: '通道管理',
    title: 'openclaw channels add --channel <channel>',
    description: '添加指定通道（telegram/discord/slack 等）。',
    argsTemplate: ['channels', 'add', '--channel', '{channel}'],
    parameters: [
      { key: 'channel', label: '通道名称', required: true, placeholder: 'telegram' },
    ],
    runnable: true,
    timeoutMs: 60000,
  },
  {
    id: 'hooks-list',
    category: 'Hooks 与技能',
    title: 'openclaw hooks list',
    description: '查看 Hook 列表。',
    argsTemplate: ['hooks', 'list'],
    parameters: [],
    runnable: true,
  },
  {
    id: 'memory-search',
    category: '内存与模型',
    title: 'openclaw memory search "X"',
    description: '执行向量记忆搜索。',
    argsTemplate: ['memory', 'search', '{query}'],
    parameters: [
      { key: 'query', label: '搜索关键词', required: true, placeholder: '支付回调' },
    ],
    runnable: true,
  },
  {
    id: 'models-set',
    category: '内存与模型',
    title: 'openclaw models set <model>',
    description: '切换当前模型。',
    argsTemplate: ['models', 'set', '{model}'],
    parameters: [
      { key: 'model', label: '模型名称', required: true, placeholder: 'qnaigc/deepseek-chat' },
    ],
    runnable: true,
    followupHint: '模型切换后建议执行 openclaw gateway restart。',
  },
  {
    id: 'models-auth-setup',
    category: '内存与模型',
    title: 'openclaw models auth setup',
    description: '模型认证设置。',
    argsTemplate: ['models', 'auth', 'setup'],
    parameters: [],
    runnable: false,
    disabledReason: '该命令通常需要交互式输入，请在本机终端执行。',
  },
  {
    id: 'browser-start',
    category: '自动化与研究',
    title: 'openclaw browser start',
    description: '启动浏览器自动化能力。',
    argsTemplate: ['browser', 'start'],
    parameters: [],
    runnable: true,
    timeoutMs: 60000,
  },
  {
    id: 'browser-screenshot',
    category: '自动化与研究',
    title: 'openclaw browser screenshot',
    description: '执行截图流程。',
    argsTemplate: ['browser', 'screenshot'],
    parameters: [],
    runnable: true,
    timeoutMs: 60000,
  },
  {
    id: 'cron-list',
    category: '自动化与研究',
    title: 'openclaw cron list',
    description: '查看定时任务列表。',
    argsTemplate: ['cron', 'list'],
    parameters: [],
    runnable: true,
  },
  {
    id: 'cron-run',
    category: '自动化与研究',
    title: 'openclaw cron run <cid>',
    description: '手动触发指定定时任务。',
    argsTemplate: ['cron', 'run', '{cid}'],
    parameters: [
      { key: 'cid', label: '任务 ID', required: true, placeholder: 'daily-report' },
    ],
    runnable: true,
    timeoutMs: 120000,
  },
]

const OUTPUT_LIMIT = 120_000
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 180_000

function quoteArg(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value
}

function normalizeParameterValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function resolveTemplateArgs(
  command: OpenClawCommandDefinition,
  parameters: Record<string, unknown>
): string[] {
  const normalized: Record<string, string> = {}
  for (const item of command.parameters) {
    const raw = parameters[item.key]
    const value = raw === undefined ? item.defaultValue ?? '' : normalizeParameterValue(raw)
    normalized[item.key] = value

    if (item.required && !value) {
      throw new Error(`缺少必填参数: ${item.label}`)
    }
  }

  const args: string[] = []
  for (const token of command.argsTemplate) {
    const matched = token.match(/^\{([a-zA-Z0-9_-]+)\}$/)
    if (!matched) {
      args.push(token)
      continue
    }

    const key = matched[1]
    const value = normalized[key] ?? ''
    if (!value) {
      throw new Error(`命令参数未填写: ${key}`)
    }
    args.push(value)
  }

  return args
}

function trimOutput(text: string, currentTruncated: boolean): { output: string; truncated: boolean } {
  if (text.length <= OUTPUT_LIMIT) {
    return { output: text, truncated: currentTruncated }
  }
  return {
    output: `${text.slice(0, OUTPUT_LIMIT)}\n... output truncated ...`,
    truncated: true,
  }
}

export function getOpenClawCommands(): OpenClawCommandDefinition[] {
  return COMMANDS.map((item) => ({
    ...item,
    parameters: item.parameters.map((param: OpenClawCommandParameter) => ({ ...param })),
  }))
}

export function getOpenClawCommandById(id: string): OpenClawCommandDefinition | null {
  return COMMANDS.find((item) => item.id === id) ?? null
}

export async function executeOpenClawCommand(
  options: ExecuteOptions
): Promise<OpenClawCommandExecutionResult> {
  const command = getOpenClawCommandById(options.commandId)
  if (!command) {
    return {
      ok: false,
      commandId: options.commandId,
      commandLine: `openclaw <unknown:${options.commandId}>`,
      exitCode: null,
      stdout: '',
      stderr: '',
      durationMs: 0,
      timedOut: false,
      truncated: false,
      message: `未知命令: ${options.commandId}`,
    }
  }

  if (!command.runnable) {
    return {
      ok: false,
      commandId: command.id,
      commandLine: `openclaw ${command.argsTemplate.join(' ')}`,
      exitCode: null,
      stdout: '',
      stderr: '',
      durationMs: 0,
      timedOut: false,
      truncated: false,
      message: command.disabledReason || '该命令不支持在当前页面执行。',
    }
  }

  const executable = findOpenClawExecutable()
  if (!executable) {
    return {
      ok: false,
      commandId: command.id,
      commandLine: `openclaw ${command.argsTemplate.join(' ')}`,
      exitCode: null,
      stdout: '',
      stderr: '',
      durationMs: 0,
      timedOut: false,
      truncated: false,
      message: '未检测到 OpenClaw/OpenClaw-China CLI，请先安装。',
    }
  }

  let args: string[]
  try {
    args = resolveTemplateArgs(command, options.parameters ?? {})
  } catch (error) {
    const message = error instanceof Error ? error.message : '参数校验失败'
    return {
      ok: false,
      commandId: command.id,
      commandLine: `${executable} ${command.argsTemplate.join(' ')}`,
      exitCode: null,
      stdout: '',
      stderr: '',
      durationMs: 0,
      timedOut: false,
      truncated: false,
      message,
    }
  }

  const timeoutMs = Math.min(
    Math.max(options.timeoutMs ?? command.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1000),
    MAX_TIMEOUT_MS
  )
  const commandLine = `${executable} ${args.map(quoteArg).join(' ')}`

  const startAt = Date.now()
  let stdout = ''
  let stderr = ''
  let truncated = false
  let timedOut = false
  let exitCode: number | null = null

  return await new Promise((resolve) => {
    const child = spawn(executable, args, {
      shell: process.platform === 'win32' && executable.endsWith('.cmd'),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL')
        }
      }, 1000)
    }, timeoutMs)

    child.stdout?.on('data', (buffer: Buffer) => {
      const next = trimOutput(stdout + buffer.toString(), truncated)
      stdout = next.output
      truncated = next.truncated
    })

    child.stderr?.on('data', (buffer: Buffer) => {
      const next = trimOutput(stderr + buffer.toString(), truncated)
      stderr = next.output
      truncated = next.truncated
    })

    child.on('close', (code) => {
      clearTimeout(timeout)
      exitCode = code
      const durationMs = Date.now() - startAt
      const ok = !timedOut && code === 0
      const message = timedOut
        ? `命令执行超时（>${Math.floor(timeoutMs / 1000)}s）`
        : code === 0
        ? '命令执行成功'
        : `命令执行失败，退出码 ${code ?? 'null'}`

      resolve({
        ok,
        commandId: command.id,
        commandLine,
        exitCode: code,
        stdout,
        stderr,
        durationMs,
        timedOut,
        truncated,
        message,
      })
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      resolve({
        ok: false,
        commandId: command.id,
        commandLine,
        exitCode,
        stdout,
        stderr: stderr ? `${stderr}\n${error.message}` : error.message,
        durationMs: Date.now() - startAt,
        timedOut,
        truncated,
        message: error.message,
      })
    })
  })
}
