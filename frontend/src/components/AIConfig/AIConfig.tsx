import { useEffect, useMemo, useState } from 'react'
import { Cpu, RefreshCcw, Save } from 'lucide-react'
import clsx from 'clsx'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { useAppStore } from '@/stores/useAppStore'
import { configApi, setupApi } from '@/utils/api'
import type { AIModel } from '@/types'

function modelIdFromRef(modelRef: string): string {
  const parts = modelRef.split('/')
  if (parts.length <= 1) return modelRef
  return parts.slice(1).join('/')
}

function normalizeModelRef(modelId: string): string {
  const value = modelId.trim()
  if (!value) return ''
  return value.includes('/') ? value : `qnaigc/${value}`
}

export function AIConfig() {
  const { addToast } = useAppStore()
  const [models, setModels] = useState<AIModel[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [savedModelRef, setSavedModelRef] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedModelRef = useMemo(() => normalizeModelRef(selectedModel), [selectedModel])

  const load = async () => {
    setLoading(true)
    try {
      const [modelsResult, configResult] = await Promise.all([
        setupApi.getModels(),
        setupApi.getCurrentConfig(),
      ])

      if (!modelsResult.ok || !modelsResult.data) {
        addToast({ type: 'error', message: modelsResult.error || '模型列表加载失败' })
        return
      }

      const currentRef = configResult.ok && configResult.data ? configResult.data.modelRef : ''
      const currentModelId = currentRef ? modelIdFromRef(currentRef) : ''

      const nextModels = [...modelsResult.data]
      if (currentModelId && !nextModels.some((item) => item.id === currentModelId)) {
        nextModels.unshift({ id: currentModelId, name: currentModelId })
      }

      setModels(nextModels)
      setSavedModelRef(currentRef)

      if (currentModelId) {
        setSelectedModel(currentModelId)
      } else if (nextModels.length > 0) {
        setSelectedModel(nextModels[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const save = async () => {
    if (!selectedModelRef) {
      addToast({ type: 'error', message: '请先选择一个模型' })
      return
    }

    setSaving(true)
    try {
      const result = await configApi.updateAI({ model: selectedModelRef })
      if (!result.ok || !result.data?.ok) {
        addToast({ type: 'error', message: result.error || '模型保存失败' })
        return
      }

      setSavedModelRef(selectedModelRef)
      addToast({ type: 'success', message: '默认模型已更新' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">AI 配置</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">仅配置默认模型（API Key 请在安装向导或配置文件中维护）</p>
        </div>
        <Button
          onClick={() => void load()}
          variant="secondary"
          loading={loading}
          icon={!loading ? <RefreshCcw className="h-4 w-4" /> : undefined}
        >
          刷新模型
        </Button>
      </div>

      <Card>
        <CardHeader
          title="模型列表"
          description="选择一个模型作为默认模型"
        />
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => {
              const active = model.id === selectedModel
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedModel(model.id)}
                  className={clsx(
                    'rounded-xl border p-4 text-left transition-all',
                    active
                      ? 'border-primary-500 bg-primary-50 shadow-sm dark:border-primary-400 dark:bg-primary-900/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600 dark:hover:bg-gray-800'
                  )}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Cpu className={clsx('h-4 w-4', active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500')} />
                    <p className="font-medium text-gray-900 dark:text-white">{model.name}</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{model.id}</p>
                </button>
              )
            })}
          </div>

          {models.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              暂无可用模型，请先配置 API Key 后再刷新模型列表。
            </div>
          )}

          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
            <p>当前选择: <span className="font-medium text-gray-900 dark:text-white">{selectedModelRef || '-'}</span></p>
            <p>已保存配置: <span className="font-medium text-gray-900 dark:text-white">{savedModelRef || '-'}</span></p>
          </div>

          <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700">
            <Button onClick={() => void save()} loading={saving} icon={<Save className="h-4 w-4" />}>
              保存默认模型
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
