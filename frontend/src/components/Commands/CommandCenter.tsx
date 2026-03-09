import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Copy, Play, RefreshCcw, TerminalSquare } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAppStore } from '@/stores/useAppStore'
import { commandApi } from '@/utils/api'
import type { OpenClawCommandDefinition, OpenClawCommandExecutionResult } from '@/types'

const WORKSPACE_ANATOMY = [
  'AGENTS.md: 指令说明',
  'USER.md: 偏好设置',
  'MEMORY.md: 长期记忆',
  'HEARTBEAT.md: 检查清单',
  'SOUL.md: 人格/语气',
  'IDENTITY.md: 名称/主题',
  'BOOT.md: 启动配置',
]

const ESSENTIAL_PATHS = [
  '主配置: ~/.openclaw/openclaw.json',
  '默认工作区: ~/.openclaw/workspace/',
  '智能体状态目录: ~/.openclaw/agents/<cid>/',
  'OAuth & API 密钥: ~/.openclaw/agents/<agentId>/agent/auth-profiles.json',
  '旧版本凭证目录: ~/.openclaw/credentials/',
  '向量索引: ~/.openclaw/memory/<cid>.sqlite',
  '全局共享技能: ~/.openclaw/skills/',
  '网关日志: /tmp/openclaw/*.log',
]

const CHAT_SLASH_COMMANDS = [
  '/status',
  '/context list',
  '/model <m>',
  '/compact',
  '/new',
  '/stop',
  '/tts on|off',
  '/think',
]

const TROUBLESHOOTING = [
  '无 DM 回复: 检查配对列表并批准',
  '群组中静音: 检查提及模式配置',
  '认证过期: models auth setup-token',
  '网关关闭: doctor --deep',
  '内存 Bug: 重建内存索引',
]

const EXTRA_COMMANDS = ['clawhub install <slug>']

function toPreviewCommand(command: OpenClawCommandDefinition, values: Record<string, string>): string {
  const args = command.argsTemplate.map((token) => {
    const matched = token.match(/^\{([a-zA-Z0-9_-]+)\}$/)
    if (!matched) return token
    const key = matched[1]
    const value = values[key]?.trim()
    return value || `<${key}>`
  })
  return `openclaw ${args.join(' ')}`
}

function groupedCommands(commands: OpenClawCommandDefinition[]): Array<[string, OpenClawCommandDefinition[]]> {
  const map = new Map<string, OpenClawCommandDefinition[]>()
  for (const command of commands) {
    const list = map.get(command.category) ?? []
    list.push(command)
    map.set(command.category, list)
  }
  return Array.from(map.entries())
}

export function CommandCenter() {
  const { addToast } = useAppStore()
  const [commands, setCommands] = useState<OpenClawCommandDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({})
  const [lastResult, setLastResult] = useState<OpenClawCommandExecutionResult | null>(null)

  const grouped = useMemo(() => groupedCommands(commands), [commands])
  const selectedCommand = useMemo(
    () => commands.find((command) => command.id === selectedId) ?? null,
    [commands, selectedId]
  )

  const previewCommand = useMemo(() => {
    if (!selectedCommand) return ''
    return toPreviewCommand(selectedCommand, parameterValues)
  }, [selectedCommand, parameterValues])

  const loadCommands = async () => {
    setLoading(true)
    try {
      const result = await commandApi.list()
      if (!result.ok || !result.data) {
        addToast({ type: 'error', message: result.error || '命令列表加载失败' })
        return
      }

      setCommands(result.data)
      if (!selectedId && result.data.length > 0) {
        setSelectedId(result.data[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCommands()
  }, [])

  useEffect(() => {
    if (!selectedCommand) return
    setParameterValues((prev) => {
      const next: Record<string, string> = {}
      for (const item of selectedCommand.parameters) {
        next[item.key] = prev[item.key] ?? item.defaultValue ?? ''
      }
      return next
    })
  }, [selectedCommand])

  const runSelected = async () => {
    if (!selectedCommand) return

    setExecuting(true)
    try {
      const payload = {
        commandId: selectedCommand.id,
        parameters: parameterValues,
      }
      const result = await commandApi.execute(payload)
      if (!result.ok || !result.data) {
        addToast({ type: 'error', message: result.error || '命令执行失败' })
        return
      }

      setLastResult(result.data)
      if (result.data.ok) {
        addToast({ type: 'success', message: `${selectedCommand.title} 执行成功` })
      } else {
        addToast({ type: 'error', message: result.data.message || '命令执行失败' })
      }
    } finally {
      setExecuting(false)
    }
  }

  const copyCommand = async () => {
    if (!previewCommand) return
    try {
      await navigator.clipboard.writeText(previewCommand)
      addToast({ type: 'success', message: '命令已复制到剪贴板' })
    } catch {
      addToast({ type: 'error', message: '复制失败，请手动复制' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">OpenClaw 命令中心</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">命令可视化执行与输出回显，方便客户做安装/诊断/运维</p>
        </div>
        <Button
          onClick={() => void loadCommands()}
          variant="secondary"
          loading={loading}
          icon={!loading ? <RefreshCcw className="h-4 w-4" /> : undefined}
        >
          刷新命令
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader title="命令列表" description="按分类选择命令" />
          <CardContent className="space-y-4">
            {grouped.map(([category, list]) => (
              <section key={category} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {category}
                </h4>
                <div className="space-y-2">
                  {list.map((command) => {
                    const active = selectedId === command.id
                    return (
                      <button
                        key={command.id}
                        type="button"
                        onClick={() => setSelectedId(command.id)}
                        className={
                          active
                            ? 'w-full rounded-lg border border-primary-500 bg-primary-50 px-3 py-2 text-left dark:border-primary-400 dark:bg-primary-900/20'
                            : 'w-full rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900'
                        }
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="font-medium text-gray-900 dark:text-white">{command.title}</p>
                          <StatusBadge status={command.runnable ? 'success' : 'warning'} size="sm">
                            {command.runnable ? '可执行' : '终端执行'}
                          </StatusBadge>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{command.description}</p>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}

            {commands.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{loading ? '加载中...' : '暂无命令'}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="命令执行" description="填写参数并执行，右侧显示完整输出" />
          <CardContent className="space-y-4">
            {selectedCommand ? (
              <>
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
                  <p className="font-medium text-gray-900 dark:text-white">{selectedCommand.title}</p>
                  <p className="mt-1">{selectedCommand.description}</p>
                  {selectedCommand.followupHint && (
                    <p className="mt-2 text-amber-700 dark:text-amber-400">{selectedCommand.followupHint}</p>
                  )}
                </div>

                {!selectedCommand.runnable && (
                  <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{selectedCommand.disabledReason || '该命令不支持在页面内执行。'}</span>
                  </div>
                )}

                {selectedCommand.longRunning && selectedCommand.runnable && (
                  <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                    <Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>该命令为持续型命令，页面执行会自动超时截断输出。</span>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {selectedCommand.parameters.map((item) => (
                    <Input
                      key={item.key}
                      label={item.required ? `${item.label} *` : item.label}
                      value={parameterValues[item.key] ?? ''}
                      onChange={(event) => {
                        const next = event.target.value
                        setParameterValues((prev) => ({ ...prev, [item.key]: next }))
                      }}
                      placeholder={item.placeholder}
                    />
                  ))}
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
                  <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">即将执行</div>
                  <code className="block whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{previewCommand}</code>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <Button
                    onClick={() => void runSelected()}
                    loading={executing}
                    disabled={!selectedCommand.runnable}
                    icon={<Play className="h-4 w-4" />}
                  >
                    执行命令
                  </Button>
                  <Button onClick={() => void copyCommand()} variant="outline" icon={<Copy className="h-4 w-4" />}>
                    复制命令
                  </Button>
                </div>

                {lastResult && (
                  <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={lastResult.ok ? 'success' : 'error'}>
                        {lastResult.ok ? '执行成功' : '执行失败'}
                      </StatusBadge>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        退出码: {lastResult.exitCode ?? 'null'} | 耗时: {(lastResult.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-950 p-3 dark:border-gray-700">
                      <div className="mb-2 flex items-center gap-2 text-xs text-gray-300">
                        <TerminalSquare className="h-4 w-4" />
                        输出日志
                      </div>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-green-300">
                        {[
                          `$ ${lastResult.commandLine}`,
                          '',
                          lastResult.stdout ? `STDOUT:\n${lastResult.stdout}` : '',
                          lastResult.stderr ? `STDERR:\n${lastResult.stderr}` : '',
                          lastResult.message ? `\nMessage: ${lastResult.message}` : '',
                        ]
                          .filter(Boolean)
                          .join('\n')}
                      </pre>
                    </div>

                    {lastResult.ok && (
                      <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>命令执行成功。</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">请选择左侧命令</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="工作区结构" description="Workspace Anatomy" />
          <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            {WORKSPACE_ANATOMY.map((item) => (
              <p key={item}>{item}</p>
            ))}
            <p className="pt-1 text-xs text-gray-500 dark:text-gray-400">根目录: ~/.openclaw/workspace</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="关键路径映射" description="Essential Path Map" />
          <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            {ESSENTIAL_PATHS.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="聊天内斜杠命令" description="在聊天会话中执行" />
          <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            {CHAT_SLASH_COMMANDS.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="故障排除清单" description="快速排查建议" />
          <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            {TROUBLESHOOTING.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="补充命令" description="非 openclaw 前缀命令" />
          <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            {EXTRA_COMMANDS.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
