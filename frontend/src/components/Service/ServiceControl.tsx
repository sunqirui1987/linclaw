import { useEffect, useState } from 'react'
import { Play, RefreshCcw, Square } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAppStore } from '@/stores/useAppStore'
import { useServiceStore } from '@/stores/useServiceStore'
import { serviceApi } from '@/utils/api'
import { usePolling } from '@/hooks/usePolling'
import { useSSE } from '@/hooks/useSSE'
import type { ServiceStatus } from '@/types'
import { LogViewer } from './LogViewer'

interface GatewayLogEntry {
  timestamp?: string
  level?: 'info' | 'warn' | 'error'
  message?: string
}

function formatUptime(ms: number | null): string {
  if (ms === null) return '-'
  const sec = Math.floor(ms / 1000)
  const min = Math.floor(sec / 60)
  const hour = Math.floor(min / 60)
  if (hour > 0) return `${hour}h ${min % 60}m ${sec % 60}s`
  if (min > 0) return `${min}m ${sec % 60}s`
  return `${sec}s`
}

function formatLogLine(entry: GatewayLogEntry): string {
  const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '--:--:--'
  const level = (entry.level ?? 'info').toUpperCase()
  return `${time} [${level}] ${entry.message ?? ''}`
}

export function ServiceControl() {
  const { addToast } = useAppStore()
  const {
    status,
    setStatus,
    logs,
    setLogs,
    addLog,
    clearLogs,
    isLoading,
    setIsLoading,
  } = useServiceStore()

  const [actionLoading, setActionLoading] = useState(false)

  const refreshStatus = async () => {
    setIsLoading(true)
    try {
      const result = await serviceApi.getStatus()
      if (!result.ok || !result.data) {
        addToast({ type: 'error', message: result.error || '服务状态获取失败' })
        return
      }
      setStatus(result.data)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshStatus()
  }, [])

  usePolling(
    () => {
      void refreshStatus()
    },
    {
      interval: 5000,
      immediate: false,
      enabled: true,
    }
  )

  const { isConnected, connect } = useSSE('/api/service/logs', {
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
    onError: () => {
      addLog('[ERROR] 日志流连接失败')
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
      await refreshStatus()
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Gateway 服务" description="控制服务启停并查看运行状态" />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={status.running ? 'success' : 'pending'}>
              {status.running ? '运行中' : '未运行'}
            </StatusBadge>
            <span className="text-sm text-gray-500 dark:text-gray-400">PID: {status.pid ?? '-'}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">端口: {status.port ?? '-'}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">运行时长: {formatUptime(status.uptime)}</span>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <Button onClick={() => void runAction('start')} loading={actionLoading} icon={<Play className="h-4 w-4" />}>
              启动
            </Button>
            <Button onClick={() => void runAction('stop')} loading={actionLoading} variant="danger" icon={<Square className="h-4 w-4" />}>
              停止
            </Button>
            <Button onClick={() => void runAction('restart')} loading={actionLoading} variant="secondary" icon={<RefreshCcw className="h-4 w-4" />}>
              重启
            </Button>
            <Button onClick={() => void refreshStatus()} variant="outline" loading={isLoading}>
              刷新状态
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="实时日志" description="通过 SSE 订阅服务日志与状态" />
        <CardContent>
          <LogViewer logs={logs} connected={isConnected} onReconnect={connect} onClear={clearLogs} />
        </CardContent>
      </Card>
    </div>
  )
}
