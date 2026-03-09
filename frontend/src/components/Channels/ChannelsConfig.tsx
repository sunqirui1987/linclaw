import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Code2, PlugZap, RefreshCcw, Save } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input, Textarea } from '@/components/common/Input'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAppStore } from '@/stores/useAppStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { configApi, diagnosticsApi, serviceApi } from '@/utils/api'
import type { ChannelField } from '@/types'

function sanitizeChannelConfig(config: Record<string, unknown>): Record<string, unknown> {
  const { enabled: _enabled, ...rest } = config
  return rest
}

function isConfiguredValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  return value !== null && value !== undefined
}

function configuredCount(config: Record<string, unknown>): number {
  return Object.values(config).filter(isConfiguredValue).length
}

function splitConfigByFields(config: Record<string, unknown>, fields: ChannelField[]): {
  known: Record<string, unknown>
  extra: Record<string, unknown>
} {
  const fieldKeys = new Set(fields.map((field) => field.key))
  const known: Record<string, unknown> = {}
  const extra: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    if (fieldKeys.has(key)) {
      known[key] = value
    } else {
      extra[key] = value
    }
  }

  return { known, extra }
}

function parseJsonObject(input: string): Record<string, unknown> {
  const parsed = JSON.parse(input.trim() || '{}') as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('高级配置必须是 JSON 对象')
  }
  return parsed as Record<string, unknown>
}

export function ChannelsConfig() {
  const { channels, setChannels, updateChannel } = useConfigStore()
  const { addToast } = useAppStore()

  const [selectedId, setSelectedId] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>({})
  const [advancedJson, setAdvancedJson] = useState('{}')
  const [advancedError, setAdvancedError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [restarting, setRestarting] = useState(false)

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedId) ?? null,
    [channels, selectedId]
  )

  const loadChannels = async () => {
    setLoading(true)
    try {
      const result = await configApi.getChannels()
      if (!result.ok || !result.data) {
        addToast({ type: 'error', message: result.error || '加载渠道配置失败' })
        return
      }
      setChannels(result.data)
      if (!selectedId && result.data.length > 0) {
        setSelectedId(result.data[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadChannels()
  }, [])

  useEffect(() => {
    if (!selectedChannel) return
    setEnabled(selectedChannel.enabled)
    const sanitized = sanitizeChannelConfig(selectedChannel.config)
    const { known, extra } = splitConfigByFields(sanitized, selectedChannel.fields)
    setDraftConfig(known)
    setAdvancedJson(JSON.stringify(extra, null, 2))
    setAdvancedError(null)
  }, [selectedChannel])

  const saveChannel = async () => {
    if (!selectedChannel) return

    let extraConfig: Record<string, unknown>
    try {
      extraConfig = parseJsonObject(advancedJson)
      setAdvancedError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '高级配置 JSON 格式无效'
      setAdvancedError(message)
      addToast({ type: 'error', message })
      return
    }

    const knownConfig: Record<string, unknown> = {}
    for (const field of selectedChannel.fields) {
      if (field.key in draftConfig) {
        knownConfig[field.key] = draftConfig[field.key]
      }
    }

    const mergedConfig = { ...knownConfig, ...extraConfig }

    setSaving(true)
    try {
      const result = await configApi.updateChannel(selectedChannel.id, {
        enabled,
        config: mergedConfig,
      })

      if (!result.ok || !result.data?.ok) {
        addToast({ type: 'error', message: result.error || '保存失败' })
        return
      }

      updateChannel(selectedChannel.id, {
        enabled,
        config: mergedConfig,
      })
      addToast({
        type: 'success',
        message: `${selectedChannel.name} 配置已保存，建议执行 openclaw gateway restart 使配置生效`,
      })
      await loadChannels()
    } finally {
      setSaving(false)
    }
  }

  const testChannel = async () => {
    if (!selectedChannel) return

    setTesting(true)
    try {
      const result = await diagnosticsApi.testChannel(selectedChannel.id)
      if (!result.ok || !result.data?.ok) {
        addToast({ type: 'error', message: result.error || result.data?.error || '渠道测试失败' })
        return
      }
      addToast({
        type: 'success',
        message: result.data.message || `${selectedChannel.name} 连通性测试成功`,
      })
    } finally {
      setTesting(false)
    }
  }

  const restartGateway = async () => {
    setRestarting(true)
    try {
      const result = await serviceApi.restart()
      if (!result.ok || !result.data) {
        addToast({ type: 'error', message: result.error || 'Gateway 重启失败' })
        return
      }
      if (!result.data.ok) {
        addToast({ type: 'error', message: result.data.error || 'Gateway 重启失败' })
        return
      }
      addToast({ type: 'success', message: 'Gateway 已重启，配置已生效' })
    } finally {
      setRestarting(false)
    }
  }

  const renderField = (field: ChannelField) => {
    const rawValue = draftConfig[field.key]
    const label = field.required ? `${field.label} *` : field.label

    if (field.type === 'boolean') {
      return (
        <label
          key={field.key}
          className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
        >
          <input
            type="checkbox"
            checked={rawValue === true}
            onChange={(event) => {
              setDraftConfig((prev) => ({ ...prev, [field.key]: event.target.checked }))
            }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="space-y-1">
            <span className="block font-medium text-gray-800 dark:text-gray-100">{label}</span>
            {field.hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{field.hint}</span>}
          </span>
        </label>
      )
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key} className="md:col-span-2">
          <Textarea
            label={label}
            rows={field.rows ?? 4}
            value={typeof rawValue === 'string' ? rawValue : ''}
            onChange={(event) => {
              setDraftConfig((prev) => ({ ...prev, [field.key]: event.target.value }))
            }}
            placeholder={field.placeholder}
            hint={field.hint}
          />
        </div>
      )
    }

    const inputValue =
      typeof rawValue === 'number' ? String(rawValue) : typeof rawValue === 'string' ? rawValue : ''

    return (
      <Input
        key={field.key}
        label={label}
        type={field.type === 'number' ? 'number' : field.type}
        value={inputValue}
        onChange={(event) => {
          const nextValue =
            field.type === 'number'
              ? event.target.value.trim() === ''
                ? ''
                : (() => {
                    const parsed = Number(event.target.value)
                    return Number.isFinite(parsed) ? parsed : event.target.value
                  })()
              : event.target.value
          setDraftConfig((prev) => ({ ...prev, [field.key]: nextValue }))
        }}
        placeholder={field.placeholder}
        hint={field.hint}
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader title="渠道列表" description="选择要配置的消息渠道" />
        <CardContent className="space-y-2">
          {channels.map((channel) => {
            const channelConfig = sanitizeChannelConfig(channel.config)
            const configured = configuredCount(channelConfig)
            return (
              <button
                type="button"
                key={channel.id}
                onClick={() => setSelectedId(channel.id)}
                className={
                  selectedId === channel.id
                    ? 'w-full rounded-lg border border-primary-500 bg-primary-50 px-3 py-2 text-left dark:border-primary-400 dark:bg-primary-900/20'
                    : 'w-full rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900'
                }
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-medium text-gray-900 dark:text-white">{channel.name}</p>
                  <StatusBadge status={channel.enabled ? 'success' : 'pending'} size="sm">
                    {channel.enabled ? '已启用' : '未启用'}
                  </StatusBadge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{channel.id}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  已配置字段: {configured} / {channel.fields.length}
                </p>
              </button>
            )
          })}

          {channels.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{loading ? '加载中...' : '暂无渠道配置'}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="渠道详情" description="可视化配置渠道字段，并支持高级 JSON 扩展" />
        <CardContent className="space-y-4">
          {selectedChannel ? (
            <>
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                <p>
                  渠道名称: <span className="font-medium text-gray-900 dark:text-white">{selectedChannel.name}</span>
                </p>
                <p>
                  渠道 ID: <span className="font-medium text-gray-900 dark:text-white">{selectedChannel.id}</span>
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                启用渠道
              </label>

              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-200">基础配置</div>
                <div className="grid gap-4 md:grid-cols-2">{selectedChannel.fields.map(renderField)}</div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                  <Code2 className="h-4 w-4" />
                  高级 JSON（可选）
                </div>
                <Textarea
                  rows={8}
                  value={advancedJson}
                  onChange={(event) => {
                    setAdvancedJson(event.target.value)
                    setAdvancedError(null)
                  }}
                  error={advancedError ?? undefined}
                  hint="填写额外字段（对象格式），会与上方可视化字段一起保存。"
                />
              </div>

              <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <Button onClick={() => void saveChannel()} loading={saving} icon={<Save className="h-4 w-4" />}>
                  保存
                </Button>
                <Button
                  onClick={() => void testChannel()}
                  loading={testing}
                  variant="outline"
                  icon={<PlugZap className="h-4 w-4" />}
                >
                  测试连通性
                </Button>
                <Button
                  onClick={() => void restartGateway()}
                  loading={restarting}
                  variant="secondary"
                  icon={<RefreshCcw className="h-4 w-4" />}
                >
                  重启 Gateway
                </Button>
                {enabled && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
                    <CheckCircle2 className="h-4 w-4" />
                    当前渠道已启用
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">请先选择一个渠道</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
