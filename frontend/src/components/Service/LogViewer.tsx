import { Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/common/Button'

interface LogViewerProps {
  logs: string[]
  connected: boolean
  onReconnect: () => void
  onClear: () => void
}

export function LogViewer({ logs, connected, onReconnect, onClear }: LogViewerProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-black p-3 dark:border-gray-700">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-300">
          {connected ? <Wifi className="h-4 w-4 text-green-400" /> : <WifiOff className="h-4 w-4 text-red-400" />}
          {connected ? '日志流已连接' : '日志流断开'}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onReconnect}>
            重连
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear}>
            清空
          </Button>
        </div>
      </div>
      <pre className="h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-green-300">
        {logs.length > 0 ? logs.join('\n') : '暂无日志'}
      </pre>
    </div>
  )
}
