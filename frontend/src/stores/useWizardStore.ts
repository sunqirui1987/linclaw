import { create } from 'zustand'
import type { WizardStep, EnvCheckResult } from '@/types'

interface WizardState {
  currentStep: WizardStep
  envCheckResult: EnvCheckResult | null
  isChecking: boolean
  isInstalling: boolean
  installProgress: number
  installLogs: string[]
  apiKey: string
  apiKeyValid: boolean | null
  selectedModel: string
  workspace: string
  
  setCurrentStep: (step: WizardStep) => void
  setEnvCheckResult: (result: EnvCheckResult | null) => void
  setIsChecking: (checking: boolean) => void
  setIsInstalling: (installing: boolean) => void
  setInstallProgress: (progress: number) => void
  addInstallLog: (log: string) => void
  clearInstallLogs: () => void
  setApiKey: (key: string) => void
  setApiKeyValid: (valid: boolean | null) => void
  setSelectedModel: (model: string) => void
  setWorkspace: (workspace: string) => void
  reset: () => void
}

const initialState = {
  currentStep: 'env-check' as WizardStep,
  envCheckResult: null,
  isChecking: false,
  isInstalling: false,
  installProgress: 0,
  installLogs: [],
  apiKey: '',
  apiKeyValid: null,
  selectedModel: '',
  workspace: '',
}

export const useWizardStore = create<WizardState>()((set) => ({
  ...initialState,

  setCurrentStep: (step) => set({ currentStep: step }),
  setEnvCheckResult: (result) => set({ envCheckResult: result }),
  setIsChecking: (checking) => set({ isChecking: checking }),
  setIsInstalling: (installing) => set({ isInstalling: installing }),
  setInstallProgress: (progress) => set({ installProgress: progress }),
  addInstallLog: (log) => set((state) => ({ 
    installLogs: [...state.installLogs, log] 
  })),
  clearInstallLogs: () => set({ installLogs: [] }),
  setApiKey: (key) => set({ apiKey: key }),
  setApiKeyValid: (valid) => set({ apiKeyValid: valid }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setWorkspace: (workspace) => set({ workspace }),
  reset: () => set(initialState),
}))
