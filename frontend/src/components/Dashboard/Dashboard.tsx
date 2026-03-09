import { useEffect, useState } from 'react'
import {
  Activity,
  Cpu,
  HardDrive,
  Play,
  RefreshCcw,
  Square,
  Terminal,
  Timer,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAppStore } from '@/stores/useAppStore'
import { useServiceStore } from '@/stores/useServiceStore'
import { envApi, serviceApi } from '@/utils/api'
import { usePolling } from '@/hooks/usePolling'
import { useSSE } from '@/hooks/useSSE'
import type { EnvCheckResult, ServiceStatus } from '@/types'

interface GatewayLogEntry {
  timestamp?: string
  level?: 'info' | 'warn' | 'error'
  message?: string
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(1)} ${units[index]}`
}

function formatUptime(ms: number | null): string {
  if (ms === null) return '-'
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const hours = Math.floor(mins / 60)
  if (hours > 0) return `${hours}h ${mins % 60}m`
  if (mins > 0) return `${mins}m ${seconds % 60}s`
  return `${seconds}s`
}

function formatLogLine(entry: GatewayLogEntry): string {
  const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '--:--:--'
  const level = (entry.level ?? 'info').toUpperCase()
  return `${time} [${level}] ${entry.message ?? ''}`
}

export function Dashboard() {
  const [envInfo, setEnvInfo] = useState<EnvCheckResult | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const { addToast } = useAppStore()
  const {
    status,
    setStatus,
    logs,
    setLogs,
    addLog,
    isLoading,
    setIsLoading,
  } = useServiceStore()

  const refresh = async () => {
    setIsLoading(true)
    try {
      const [serviceResult, envResult] = await Promise.all([
        serviceApi.getStatus(),
        envApi.check(),
      ])

      if (serviceResult.ok && serviceResult.data) {
        setStatus(serviceResult.data)
      }
      if (envResult.ok && envResult.data) {
        setEnvInfo(envResult.data)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  usePolling(
    () => {
      void refresh()
    },
    {
      interval: 5000,
      enabled: true,
      immediate: false,
    }
  )

  const { isConnected: logConnected } = useSSE('/api/service/logs', {
    onMessage: (raw) => {
      try {
        const payload = JSON.parse(raw) as {
          type?: string
          message?: string
          timestamp?: string
          level?: 'info' | 'warn' | 'error'
          logs?: GatewayLogEntry[]
          running?: boolean
          pid?: number | null
          memory?: number | null
          uptime?: number | null
          port?: number | null
          gatewayUrl?: string | null
        }

        if (payload.type === 'history' && Array.isArray(payload.logs)) {
          setLogs(payload.logs.map((entry) => formatLogLine(entry)))
          return
        }

        if (payload.type === 'log') {
          addLog(
            formatLogLine({
              timestamp: payload.timestamp,
              level: payload.level,
              message: payload.message,
            })
          )
          return
        }

        if (payload.type === 'status') {
          const current = useServiceStore.getState().status
          const next: ServiceStatus = {
            ...current,
            running: Boolean(payload.running),
            pid: payload.pid ?? current.pid,
            memory: payload.memory ?? current.memory,
            uptime: payload.uptime ?? current.uptime,
            port: payload.port ?? current.port,
            gatewayUrl: payload.gatewayUrl ?? current.gatewayUrl,
          }
          useServiceStore.getState().setStatus(next)
          return
        }

        if (payload.type === 'info' && payload.message) {
          addLog(
            formatLogLine({
              timestamp: new Date().toISOString(),
              level: 'info',
              message: payload.message,
            })
          )
        }
      } catch {
        addLog(raw)
      }
    },
  })

  const runAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(true)
    try {
      const result =
        action === 'start'
          ? await serviceApi.start()
          : action === 'stop'
          ? await serviceApi.stop()
          : await serviceApi.restart()

      if (!result.ok || !result.data) {
        addToast({ type: 'error', message: result.error || '操作失败' })
        return
      }

      if (!result.data.ok) {
        addToast({ type: 'error', message: result.data.error || '服务操作失败' })
        return
      }

      addToast({ type: 'success', message: `服务${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}成功` })
      await refresh()
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">运行概览</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">查看 OpenClaw 服务状态与环境信息</p>
        </div>
        <Button
          onClick={() => void refresh()}
          variant="secondary"
          loading={isLoading}
          icon={!isLoading ? <RefreshCcw className="h-4 w-4" /> : undefined}
        >
          刷新
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-gray-500">
              <Activity className="h-4 w-4" />
              服务状态
            </div>
            <StatusBadge status={status.running ? 'success' : 'pending'}>
              {status.running ? '运行中' : '未运行'}
            </StatusBadge>
            <p className="text-xs text-gray-500 dark:text-gray-400">PID: {status.pid ?? '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-gray-500">
              <Timer className="h-4 w-4" />
              运行时长
            </div>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatUptime(status.uptime)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">端口: {status.port ?? '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-gray-500">
              <HardDrive className="h-4 w-4" />
              内存占用
            </div>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatBytes(status.memory)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">网关: {status.gatewayUrl ? '可访问' : '不可访问'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-gray-500">
              <Cpu className="h-4 w-4" />
              运行环境
            </div>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{envInfo?.node.version ?? '-'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              OpenClaw:{' '}
              {!envInfo
                ? '-'
                : envInfo.openclaw.installed
                ? envInfo.openclaw.version || '已安装'
                : '未安装'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="快捷操作" description="常用服务管理操作" />
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => void runAction('start')} loading={actionLoading} icon={<Play className="h-4 w-4" />}>
            启动
          </Button>
          <Button onClick={() => void runAction('stop')} loading={actionLoading} variant="danger" icon={<Square className="h-4 w-4" />}>
            停止
          </Button>
          <Button onClick={() => void runAction('restart')} loading={actionLoading} variant="secondary" icon={<RefreshCcw className="h-4 w-4" />}>
            重启
          </Button>
          {status.gatewayUrl && (
            <a
              href={status.gatewayUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Terminal className="h-4 w-4" />
              打开 Gateway
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="控制台日志"
          description={logConnected ? '已连接实时日志流' : '日志流连接中断'}
        />
        <CardContent>
          <pre className="h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-950 p-3 text-xs leading-5 text-green-300 dark:border-gray-700">
            {logs.length > 0 ? logs.slice(-120).join('\n') : '暂无日志输出'}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
