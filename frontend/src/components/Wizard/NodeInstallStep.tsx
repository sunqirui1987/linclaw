import { Clipboard, ExternalLink, RefreshCcw } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'

interface NodeInstallStepProps {
  platform: string
  guide: string[]
  isLoadingGuide: boolean
  isChecking: boolean
  nodeReady: boolean
  onLoadGuide: () => void
  onRecheck: () => void
  onNext: () => void
}

function extractCopyableCommand(lines: string[]): string | null {
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#')) continue
    if (trimmed.startsWith('http')) continue
    return trimmed
  }
  return null
}

export function NodeInstallStep({
  platform,
  guide,
  isLoadingGuide,
  isChecking,
  nodeReady,
  onLoadGuide,
  onRecheck,
  onNext,
}: NodeInstallStepProps) {
  const copyableCommand = extractCopyableCommand(guide)

  const copyCommand = async () => {
    if (!copyableCommand) return
    await navigator.clipboard.writeText(copyableCommand)
  }

  return (
    <Card>
      <CardHeader
        title="Step 2: 安装 Node.js"
        description="检测到 Node.js 缺失或版本过低，请先安装 Node.js LTS（>= 18）。"
      />
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60">
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">当前系统: {platform}</p>
          {guide.length > 0 ? (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-6 text-gray-700 dark:bg-gray-950 dark:text-gray-300">
              {guide.join('\n')}
            </pre>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">点击“加载安装指引”获取安装方式。</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={onLoadGuide} variant="secondary" loading={isLoadingGuide}>
            加载安装指引
          </Button>
          <Button
            onClick={copyCommand}
            variant="outline"
            icon={<Clipboard className="h-4 w-4" />}
            disabled={!copyableCommand}
          >
            复制安装命令
          </Button>
          <a
            href="https://nodejs.org/zh-cn/download"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
          >
            官网下载
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Button
            onClick={onRecheck}
            variant="secondary"
            loading={isChecking}
            icon={!isChecking ? <RefreshCcw className="h-4 w-4" /> : undefined}
          >
            检测安装
          </Button>
          <Button onClick={onNext} disabled={!nodeReady || isChecking}>
            下一步
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
