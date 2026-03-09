import { CheckCircle2, CircleAlert, Rocket } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'

interface CompleteStepProps {
  workspace: string
  modelRef: string
  hasApiKey: boolean
  isSubmitting: boolean
  completed: boolean
  gatewayUrl: string | null
  error: string | null
  onComplete: () => void
  onOpenConsole: () => void
  onEnterDashboard: () => void
}

export function CompleteStep({
  workspace,
  modelRef,
  hasApiKey,
  isSubmitting,
  completed,
  gatewayUrl,
  error,
  onComplete,
  onOpenConsole,
  onEnterDashboard,
}: CompleteStepProps) {
  return (
    <Card>
      <CardHeader
        title="Step 7: 完成配置"
        description="确认配置并启动 Gateway 服务。"
      />
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60">
          <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">配置摘要</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">工作目录</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{workspace}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">默认模型</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{modelRef || '未选择'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">API Key</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{hasApiKey ? '已配置' : '未配置（可稍后设置）'}</dd>
            </div>
          </dl>
        </div>

        {completed && (
          <div className="space-y-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>安装与配置已完成。</span>
            </div>
            {gatewayUrl && (
              <p className="pl-6 text-xs">
                Gateway: <a href={gatewayUrl} target="_blank" rel="noreferrer" className="underline">{gatewayUrl}</a>
              </p>
            )}
            {!gatewayUrl && (
              <p className="pl-6 text-xs">Gateway 暂未就绪，可先进入仪表盘后在服务管理页启动。</p>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Button onClick={onComplete} loading={isSubmitting} disabled={completed} icon={<Rocket className="h-4 w-4" />}>
            启动并完成
          </Button>
          {gatewayUrl && (
            <Button onClick={onOpenConsole} variant="secondary">
              进入控制台
            </Button>
          )}
          {completed && !gatewayUrl && (
            <Button onClick={onEnterDashboard} variant="secondary">
              进入仪表盘
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
