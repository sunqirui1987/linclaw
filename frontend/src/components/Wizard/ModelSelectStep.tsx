import { Cpu, RefreshCcw } from 'lucide-react'
import clsx from 'clsx'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import type { AIModel } from '@/types'

interface ModelSelectStepProps {
  models: AIModel[]
  selectedModel: string
  loading: boolean
  onSelect: (modelId: string) => void
  onRefresh: () => void
  onNext: () => void
}

export function ModelSelectStep({
  models,
  selectedModel,
  loading,
  onSelect,
  onRefresh,
  onNext,
}: ModelSelectStepProps) {
  return (
    <Card>
      <CardHeader
        title="Step 5: 选择模型"
        description="从可用模型列表中选择默认模型。"
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={onRefresh}
            loading={loading}
            icon={!loading ? <RefreshCcw className="h-4 w-4" /> : undefined}
          >
            刷新模型
          </Button>
        }
      />
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {models.map((model) => {
            const active = selectedModel === model.id
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => onSelect(model.id)}
                className={clsx(
                  'rounded-xl border p-4 text-left transition-all',
                  active
                    ? 'border-primary-500 bg-primary-50 shadow-sm dark:border-primary-400 dark:bg-primary-900/20'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-900'
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Cpu className={clsx('h-4 w-4', active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500')} />
                  <p className="font-medium text-gray-900 dark:text-white">{model.name}</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{model.id}</p>
                {model.description && (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{model.description}</p>
                )}
              </button>
            )
          })}
        </div>

        {models.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            暂无可用模型，请点击“刷新模型”。
          </div>
        )}

        <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700">
          <Button onClick={onNext} disabled={!selectedModel || loading}>
            下一步
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
