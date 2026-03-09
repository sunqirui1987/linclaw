import { CheckCircle2, CircleAlert, Loader2, RefreshCcw } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { EnvCheckResult } from '@/types'

interface EnvCheckStepProps {
  result: EnvCheckResult | null
  isChecking: boolean
  onCheck: () => void
  onContinue: (step: 'node-install' | 'cli-install' | 'api-key') => void
}

function parseNodeMajor(version: string | null): number | null {
  if (!version) return null
  const major = parseInt(version.split('.')[0], 10)
  return Number.isNaN(major) ? null : major
}

function ResultRow({
  label,
  installed,
  detail,
  warning,
}: {
  label: string
  installed: boolean
  detail?: string | null
  warning?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{label}</p>
        {detail && <p className="text-sm text-gray-500 dark:text-gray-400">{detail}</p>}
        {warning && <p className="text-sm text-yellow-600 dark:text-yellow-400">{warning}</p>}
      </div>
      {installed ? (
        <StatusBadge status="success">已安装</StatusBadge>
      ) : (
        <StatusBadge status="error">未安装</StatusBadge>
      )}
    </div>
  )
}

export function EnvCheckStep({ result, isChecking, onCheck, onContinue }: EnvCheckStepProps) {
  const nodeMajor = parseNodeMajor(result?.node.version ?? null)
  const nodeReady = Boolean(result?.node.installed && nodeMajor !== null && nodeMajor >= 18)
  const packageManagerReady = Boolean(result?.npm.installed || result?.pnpm.installed)
  const cliReady = Boolean(result?.openclaw.installed)

  const canContinue = Boolean(result && packageManagerReady)

  const getNextStep = (): 'node-install' | 'cli-install' | 'api-key' => {
    if (!nodeReady) return 'node-install'
    if (!cliReady) return 'cli-install'
    return 'api-key'
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Step 1: 环境检测"
          description="检测 Node.js、包管理器与 OpenClaw / OpenClaw-China CLI 是否可用。"
        />
        <CardContent className="space-y-4">
          {result ? (
            <>
              <ResultRow
                label="Node.js"
                installed={nodeReady}
                detail={result.node.version ? `版本: ${result.node.version}` : undefined}
                warning={
                  result.node.installed && !nodeReady
                    ? '当前版本低于 18，建议升级到 LTS 版本'
                    : undefined
                }
              />
              <ResultRow
                label="npm"
                installed={result.npm.installed}
                detail={result.npm.version ? `版本: ${result.npm.version}` : undefined}
              />
              <ResultRow
                label="pnpm"
                installed={result.pnpm.installed}
                detail={result.pnpm.version ? `版本: ${result.pnpm.version}` : undefined}
              />
              <ResultRow
                label="OpenClaw CLI"
                installed={cliReady}
                detail={result.openclaw.version ? `版本: ${result.openclaw.version}` : undefined}
              />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
              点击下方按钮开始检测环境
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={onCheck}
              loading={isChecking}
              icon={!isChecking ? <RefreshCcw className="h-4 w-4" /> : undefined}
              variant="secondary"
            >
              {result ? '重新检测' : '开始检测'}
            </Button>

            <Button
              onClick={() => onContinue(getNextStep())}
              disabled={!canContinue || isChecking}
            >
              继续下一步
            </Button>
          </div>

          {result && !packageManagerReady && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>未检测到 npm 或 pnpm，安装 Node.js 后通常会自动附带 npm。</span>
            </div>
          )}

          {isChecking && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在检测环境...
            </div>
          )}

          {result && nodeReady && packageManagerReady && cliReady && (
            <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>环境检测通过，可以进入配置流程。</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
