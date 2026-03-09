import { useEffect, useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { useAppStore } from '@/stores/useAppStore'
import { useWizardStore } from '@/stores/useWizardStore'
import { serviceApi, setupApi } from '@/utils/api'

export function Settings() {
  const { theme, setTheme, addToast, setCurrentPage } = useAppStore()
  const wizardReset = useWizardStore((state) => state.reset)

  const [workspace, setWorkspace] = useState('')
  const [modelRef, setModelRef] = useState('')
  const [port, setPort] = useState('18789')
  const [saving, setSaving] = useState(false)

  const loadSettings = async () => {
    const [configResult, statusResult] = await Promise.all([
      setupApi.getCurrentConfig(),
      serviceApi.getStatus(),
    ])

    if (configResult.ok && configResult.data) {
      setWorkspace(configResult.data.workspace)
      setModelRef(configResult.data.modelRef)
    }

    if (statusResult.ok && statusResult.data?.port) {
      setPort(String(statusResult.data.port))
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    try {
      const result = await setupApi.complete({
        workspace: workspace.trim(),
        modelRef: modelRef.trim(),
      })
      if (!result.ok) {
        addToast({ type: 'error', message: result.error || '保存失败' })
        return
      }

      addToast({ type: 'success', message: '设置已保存' })
    } finally {
      setSaving(false)
    }
  }

  const resetWizard = () => {
    wizardReset()
    setCurrentPage('wizard')
    addToast({ type: 'info', message: '已重置向导状态，请重新执行安装流程' })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="基础设置" description="工作目录、默认模型与端口信息" />
        <CardContent className="space-y-4">
          <Input
            label="工作目录"
            value={workspace}
            onChange={(event) => setWorkspace(event.target.value)}
          />
          <Input
            label="默认模型"
            value={modelRef}
            onChange={(event) => setModelRef(event.target.value)}
          />
          <Input
            label="Gateway 端口"
            value={port}
            onChange={(event) => setPort(event.target.value)}
            hint="端口配置当前由后端环境变量控制，此处用于展示与记录。"
          />

          <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <Button onClick={() => void saveSettings()} loading={saving} icon={<Save className="h-4 w-4" />}>
              保存
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="主题" description="切换界面亮暗模式" />
        <CardContent className="flex gap-3">
          <Button
            variant={theme === 'light' ? 'primary' : 'secondary'}
            onClick={() => setTheme('light')}
          >
            亮色
          </Button>
          <Button
            variant={theme === 'dark' ? 'primary' : 'secondary'}
            onClick={() => setTheme('dark')}
          >
            暗色
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="重置" description="重置向导流程，不会删除系统安装文件" />
        <CardContent>
          <Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={resetWizard}>
            重置向导
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
