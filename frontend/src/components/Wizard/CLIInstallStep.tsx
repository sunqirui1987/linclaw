import { CheckCircle2, RefreshCcw, Terminal } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { ProgressBar } from '@/components/common/ProgressBar'

interface CLIInstallStepProps {
  installed: boolean
  isInstalling: boolean
  progress: number
  logs: string[]
  installCommand: string
  onInstall: () => void
  onRecheck: () => void
  onNext: () => void
}

export function CLIInstallStep({
  installed,
  isInstalling,
  progress,
  logs,
  installCommand,
  onInstall,
  onRecheck,
  onNext,
}: CLIInstallStepProps) {
  return (
    <Card>
      <CardHeader
        title="Step 3: 安装 OpenClaw / OpenClaw-China CLI"
        description="自动执行 CLI 安装并展示实时日志。"
      />
      <CardContent className="space-y-4">
        {installed ? (
          <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>检测到 CLI 已安装，可以继续下一步。</span>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              将执行安装命令：<code>{installCommand}</code>
            </p>
          </div>
        )}

        <ProgressBar value={installed ? 100 : progress} label="安装进度" color={installed ? 'success' : 'primary'} />

        <div className="rounded-lg border border-gray-200 bg-black p-3 dark:border-gray-700">
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-300">
            <Terminal className="h-4 w-4" />
            安装日志
          </div>
          <pre className="h-52 overflow-auto whitespace-pre-wrap text-xs leading-5 text-green-300">
            {logs.length > 0 ? logs.join('\n') : '等待安装日志输出...'}
          </pre>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Button onClick={onInstall} loading={isInstalling} disabled={installed}>
            {logs.length > 0 ? '重新安装' : '开始安装'}
          </Button>
          <Button
            onClick={onRecheck}
            variant="secondary"
            icon={<RefreshCcw className="h-4 w-4" />}
            disabled={isInstalling}
          >
            重新检测
          </Button>
          <Button onClick={onNext} disabled={!installed || isInstalling}>
            下一步
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
