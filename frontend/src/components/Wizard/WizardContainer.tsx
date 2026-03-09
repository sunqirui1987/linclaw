import { useEffect, useMemo, useState } from 'react'
import { Stepper } from '@/components/common/Stepper'
import { useAppStore } from '@/stores/useAppStore'
import { useWizardStore } from '@/stores/useWizardStore'
import { envApi, installApi, setupApi } from '@/utils/api'
import type { AIModel, EnvCheckResult, WizardStep } from '@/types'
import { EnvCheckStep } from './EnvCheckStep'
import { NodeInstallStep } from './NodeInstallStep'
import { CLIInstallStep } from './CLIInstallStep'
import { ApiKeyStep } from './ApiKeyStep'
import { ModelSelectStep } from './ModelSelectStep'
import { WorkspaceStep } from './WorkspaceStep'
import { CompleteStep } from './CompleteStep'

const orderedSteps: WizardStep[] = [
  'env-check',
  'node-install',
  'cli-install',
  'api-key',
  'model-select',
  'workspace',
  'complete',
]

function nodeMajor(version: string | null): number | null {
  if (!version) return null
  const major = parseInt(version.split('.')[0], 10)
  return Number.isNaN(major) ? null : major
}

function isNodeReady(result: EnvCheckResult | null): boolean {
  if (!result?.node.installed) return false
  const major = nodeMajor(result.node.version)
  return major !== null && major >= 18
}

function modelIdFromRef(modelRef: string): string {
  const parts = modelRef.split('/')
  if (parts.length <= 1) return modelRef
  return parts.slice(1).join('/')
}

function normalizeModelRef(modelId: string): string {
  const trimmed = modelId.trim()
  if (!trimmed) return ''
  return trimmed.includes('/') ? trimmed : `qnaigc/${trimmed}`
}

export function WizardContainer({ onCompleted }: { onCompleted?: () => void }) {
  const {
    currentStep,
    setCurrentStep,
    envCheckResult,
    isChecking,
    isInstalling,
    installProgress,
    installLogs,
    apiKey,
    apiKeyValid,
    selectedModel,
    workspace,
    setEnvCheckResult,
    setIsChecking,
    setIsInstalling,
    setInstallProgress,
    addInstallLog,
    clearInstallLogs,
    setApiKey,
    setApiKeyValid,
    setSelectedModel,
    setWorkspace,
  } = useWizardStore()

  const { addToast, setCurrentPage } = useAppStore()

  const [nodeInstallGuide, setNodeInstallGuide] = useState<string[]>([])
  const [guideLoading, setGuideLoading] = useState(false)
  const [validatingKey, setValidatingKey] = useState(false)
  const [models, setModels] = useState<AIModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [setupLoading, setSetupLoading] = useState(false)
  const [installCommand, setInstallCommand] = useState(
    'npm install -g git+https://github.com/BytePioneer-AI/openclaw-china.git'
  )
  const [completing, setCompleting] = useState(false)
  const [completeDone, setCompleteDone] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null)

  const nodeReady = isNodeReady(envCheckResult)
  const cliReady = Boolean(envCheckResult?.openclaw.installed)
  const platform = envCheckResult?.os.platform ?? 'unknown'

  const completedSteps = useMemo(() => {
    const currentIndex = orderedSteps.indexOf(currentStep)
    return orderedSteps.slice(0, Math.max(currentIndex, 0))
  }, [currentStep])

  const stepItems = [
    { id: 'env-check', label: '环境检测' },
    { id: 'node-install', label: '安装 Node.js' },
    { id: 'cli-install', label: '安装 CLI' },
    { id: 'api-key', label: '配置 API Key' },
    { id: 'model-select', label: '选择模型' },
    { id: 'workspace', label: '工作目录' },
    { id: 'complete', label: '完成' },
  ]

  const checkEnvironment = async (): Promise<EnvCheckResult | null> => {
    setIsChecking(true)
    try {
      const result = await envApi.check()
      if (!result.ok || !result.data) {
        addToast({ type: 'error', message: result.error || '环境检测失败' })
        return null
      }
      setEnvCheckResult(result.data)
      return result.data
    } finally {
      setIsChecking(false)
    }
  }

  const loadNodeGuide = async () => {
    setGuideLoading(true)
    try {
      const result = await envApi.getNodeInstallGuide()
      if (!result.ok || !result.data) {
        addToast({ type: 'error', message: result.error || '无法加载安装指引' })
        return
      }
      setNodeInstallGuide(result.data.instructions)
    } finally {
      setGuideLoading(false)
    }
  }

  const loadModels = async (apiKeyArg?: string) => {
    setLoadingModels(true)
    try {
      const result = await setupApi.getModels(apiKeyArg)
      if (!result.ok || !result.data) {
        addToast({ type: 'error', message: result.error || '加载模型失败' })
        return
      }
      setModels(result.data)
      if (!selectedModel && result.data.length > 0) {
        setSelectedModel(result.data[0].id)
      }
    } finally {
      setLoadingModels(false)
    }
  }

  const bootstrap = async () => {
    setSetupLoading(true)
    try {
      const [setupStateResult, configResult, installMetaResult] = await Promise.all([
        setupApi.getState(),
        setupApi.getCurrentConfig(),
        installApi.getMeta(),
      ])

      if (setupStateResult.ok && setupStateResult.data && !workspace) {
        setWorkspace(setupStateResult.data.defaultWorkspace)
      }

      if (configResult.ok && configResult.data) {
        if (!workspace && configResult.data.workspace) {
          setWorkspace(configResult.data.workspace)
        }
        if (!selectedModel && configResult.data.modelRef) {
          setSelectedModel(modelIdFromRef(configResult.data.modelRef))
        }
        if (!apiKey && configResult.data.apiKey) {
          setApiKey(configResult.data.apiKey)
          setApiKeyValid(true)
        }
      }

      if (installMetaResult.ok && installMetaResult.data?.command) {
        setInstallCommand(installMetaResult.data.command)
      }

      await checkEnvironment()
    } finally {
      setSetupLoading(false)
    }
  }

  useEffect(() => {
    void bootstrap()
  }, [])

  const goNextAfterEnv = (result: EnvCheckResult | null) => {
    if (!result) return

    const nodeOk = isNodeReady(result)
    const cliInstalled = Boolean(result.openclaw.installed)

    if (!nodeOk) {
      setCurrentStep('node-install')
      if (nodeInstallGuide.length === 0) {
        void loadNodeGuide()
      }
      return
    }

    if (!cliInstalled) {
      setCurrentStep('cli-install')
      return
    }

    setCurrentStep('api-key')
  }

  const handleNodeRecheck = async () => {
    const result = await checkEnvironment()
    if (!result) return
    if (isNodeReady(result)) {
      if (result.openclaw.installed) {
        setCurrentStep('api-key')
      } else {
        setCurrentStep('cli-install')
      }
    }
  }

  const handleInstallCli = () => {
    clearInstallLogs()
    setInstallProgress(0)
    setIsInstalling(true)

    const eventSource = installApi.installOpenClaw()

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string
          progress?: number
          message?: string
          success?: boolean
          error?: string
        }

        if (payload.type === 'progress' && typeof payload.progress === 'number') {
          setInstallProgress(payload.progress)
        }

        if (payload.type === 'log' && typeof payload.message === 'string') {
          const lines = payload.message
            .split(/\r?\n/)
            .map((line) => line.trimEnd())
            .filter(Boolean)
          for (const line of lines) {
            addInstallLog(line)
          }
        }

        if (payload.type === 'complete') {
          setIsInstalling(false)
          eventSource.close()

          if (payload.success) {
            setInstallProgress(100)
            addToast({ type: 'success', message: 'OpenClaw CLI 安装成功' })
            void checkEnvironment().then((env) => {
              if (env?.openclaw.installed) {
                setCurrentStep('api-key')
              }
            })
          } else {
            addToast({ type: 'error', message: payload.error || 'CLI 安装失败' })
          }
        }
      } catch {
        // ignore malformed SSE payload
      }
    }

    eventSource.onerror = () => {
      setIsInstalling(false)
      addToast({ type: 'error', message: '安装连接中断，请重试' })
      eventSource.close()
    }
  }

  const handleValidateApiKey = async () => {
    const key = apiKey.trim()
    if (!key) return

    setValidatingKey(true)
    try {
      const result = await setupApi.validateApiKey(key)
      const valid = Boolean(result.ok && result.data?.valid)
      setApiKeyValid(valid)

      if (valid) {
        addToast({ type: 'success', message: 'API Key 验证成功' })
        await loadModels(key)
      } else {
        addToast({ type: 'error', message: 'API Key 验证失败' })
      }
    } finally {
      setValidatingKey(false)
    }
  }

  const handleSkipApiKey = () => {
    setApiKeyValid(null)
    setCurrentStep('model-select')
    if (models.length === 0) {
      void loadModels()
    }
  }

  const handleApiKeyNext = () => {
    setCurrentStep('model-select')
    if (models.length === 0) {
      void loadModels(apiKeyValid === true ? apiKey.trim() : undefined)
    }
  }

  const handleModelNext = () => {
    if (!selectedModel && models.length > 0) {
      setSelectedModel(models[0].id)
    }
    setCurrentStep('workspace')
  }

  const handleWorkspaceNext = () => {
    setCurrentStep('complete')
  }

  const handleComplete = async () => {
    setCompleting(true)
    setCompleteError(null)
    try {
      const result = await setupApi.complete({
        workspace: workspace.trim(),
        modelRef: normalizeModelRef(selectedModel),
        apiKey: apiKeyValid === true ? apiKey.trim() : undefined,
      })

      if (!result.ok || !result.data) {
        const errorMessage = result.error || '完成配置失败'
        setCompleteError(errorMessage)
        addToast({ type: 'error', message: errorMessage })
        return
      }

      if (!result.data.ok) {
        setCompleteDone(true)
        setGatewayUrl(null)
        const message = '配置已保存，但 Gateway 启动失败，请在服务管理中手动启动'
        setCompleteError(message)
        addToast({ type: 'warning', message })
        return
      }

      setCompleteDone(true)
      setGatewayUrl(result.data.gatewayUrl ?? null)
      addToast({ type: 'success', message: '配置完成，Gateway 已启动' })
    } finally {
      setCompleting(false)
    }
  }

  const enterDashboard = () => {
    setCurrentPage('dashboard')
    onCompleted?.()
  }

  const openConsole = () => {
    if (gatewayUrl) {
      window.open(gatewayUrl, '_blank', 'noopener,noreferrer')
    }
    enterDashboard()
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">安装向导</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {'环境检测 -> 安装 CLI -> 配置 API Key -> 选择模型 -> 启动服务'}
        </p>
      </div>

      <Stepper
        steps={stepItems}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={(stepId) => setCurrentStep(stepId as WizardStep)}
      />

      {setupLoading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          正在加载当前配置...
        </div>
      )}

      {!setupLoading && currentStep === 'env-check' && (
        <EnvCheckStep
          result={envCheckResult}
          isChecking={isChecking}
          onCheck={() => void checkEnvironment()}
          onContinue={() => goNextAfterEnv(envCheckResult)}
        />
      )}

      {!setupLoading && currentStep === 'node-install' && (
        <NodeInstallStep
          platform={platform}
          guide={nodeInstallGuide}
          isLoadingGuide={guideLoading}
          isChecking={isChecking}
          nodeReady={nodeReady}
          onLoadGuide={() => void loadNodeGuide()}
          onRecheck={() => void handleNodeRecheck()}
          onNext={() => setCurrentStep(cliReady ? 'api-key' : 'cli-install')}
        />
      )}

      {!setupLoading && currentStep === 'cli-install' && (
        <CLIInstallStep
          installed={cliReady}
          isInstalling={isInstalling}
          progress={installProgress}
          logs={installLogs}
          installCommand={installCommand}
          onInstall={handleInstallCli}
          onRecheck={() => void checkEnvironment()}
          onNext={() => setCurrentStep('api-key')}
        />
      )}

      {!setupLoading && currentStep === 'api-key' && (
        <ApiKeyStep
          apiKey={apiKey}
          apiKeyValid={apiKeyValid}
          isValidating={validatingKey}
          onApiKeyChange={(value) => {
            setApiKey(value)
            setApiKeyValid(null)
          }}
          onValidate={() => void handleValidateApiKey()}
          onSkip={handleSkipApiKey}
          onNext={handleApiKeyNext}
        />
      )}

      {!setupLoading && currentStep === 'model-select' && (
        <ModelSelectStep
          models={models}
          selectedModel={selectedModel}
          loading={loadingModels}
          onSelect={setSelectedModel}
          onRefresh={() => void loadModels(apiKeyValid === true ? apiKey.trim() : undefined)}
          onNext={handleModelNext}
        />
      )}

      {!setupLoading && currentStep === 'workspace' && (
        <WorkspaceStep
          workspace={workspace}
          onWorkspaceChange={setWorkspace}
          onNext={handleWorkspaceNext}
        />
      )}

      {!setupLoading && currentStep === 'complete' && (
        <CompleteStep
          workspace={workspace}
          modelRef={selectedModel}
          hasApiKey={apiKeyValid === true}
          isSubmitting={completing}
          completed={completeDone}
          gatewayUrl={gatewayUrl}
          error={completeError}
          onComplete={() => void handleComplete()}
          onOpenConsole={openConsole}
          onEnterDashboard={enterDashboard}
        />
      )}
    </div>
  )
}
