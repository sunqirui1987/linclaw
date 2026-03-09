export type Page = 
  | 'wizard'
  | 'dashboard'
  | 'ai-config'
  | 'channels'
  | 'commands'
  | 'service'
  | 'settings'

export type Theme = 'light' | 'dark'

export type WizardStep = 
  | 'env-check'
  | 'node-install'
  | 'cli-install'
  | 'api-key'
  | 'model-select'
  | 'workspace'
  | 'complete'

export interface EnvCheckResult {
  node: {
    installed: boolean
    version: string | null
    path: string | null
  }
  npm: {
    installed: boolean
    version: string | null
  }
  pnpm: {
    installed: boolean
    version: string | null
  }
  openclaw: {
    installed: boolean
    version: string | null
    path: string | null
  }
  os: {
    platform: 'darwin' | 'win32' | 'linux'
    arch: string
  }
}

export interface ServiceStatus {
  running: boolean
  pid: number | null
  port: number | null
  memory: number | null
  uptime: number | null
  gatewayUrl: string | null
}

export interface AIProvider {
  id: string
  name: string
  description: string
  baseUrl: string
  apiKeyConfigured: boolean
  models: AIModel[]
}

export interface AIModel {
  id: string
  name: string
  description?: string
}

export interface SetupState {
  isConfigured: boolean
  defaultWorkspace: string
  cliPath: string
  defaultModelRef: string
  hasApiKey: boolean
}

export interface CurrentConfig {
  workspace: string
  modelRef: string
  apiKey: string
  chinaChannelInstalled: boolean
  chinaChannelsConfigured: boolean
}

export type ChannelId = 
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'feishu'
  | 'dingtalk'
  | 'wecom'
  | 'qqbot'

export type ChannelFieldType = 'text' | 'password' | 'number' | 'boolean' | 'textarea'

export interface ChannelField {
  key: string
  label: string
  type: ChannelFieldType
  required?: boolean
  placeholder?: string
  hint?: string
  rows?: number
}

export interface ChannelConfig {
  id: ChannelId
  name: string
  enabled: boolean
  config: Record<string, unknown>
  fields: ChannelField[]
}

export interface OpenClawCommandParameter {
  key: string
  label: string
  required?: boolean
  placeholder?: string
  defaultValue?: string
}

export interface OpenClawCommandDefinition {
  id: string
  category: string
  title: string
  description: string
  argsTemplate: string[]
  parameters: OpenClawCommandParameter[]
  runnable: boolean
  disabledReason?: string
  longRunning?: boolean
  timeoutMs?: number
  followupHint?: string
}

export interface OpenClawCommandExecutionResult {
  ok: boolean
  commandId: string
  commandLine: string
  exitCode: number | null
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
  truncated: boolean
  message: string
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}
