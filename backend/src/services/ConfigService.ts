import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type {
  SetupState,
  CurrentConfig,
  AIModel,
  AIProvider,
  ChannelConfig,
  ChannelField,
  ChannelId,
} from '../types/index.js'
import { asRecord } from '../utils/helpers.js'

const DEFAULT_WORKSPACE = join(homedir(), '.openclaw', 'workspace')
const DEFAULT_MODEL_REF = 'qnaigc/deepseek-chat'
const QNAIGC_BASE_URL = 'https://api.qnaigc.com/v1'
const QNAIGC_PROFILE_ID = 'qnaigc-default'
const CHANNEL_DEFS: Array<{ id: ChannelId; name: string; fields: ChannelField[] }> = [
  {
    id: 'telegram',
    name: 'Telegram',
    fields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        type: 'password',
        required: true,
        placeholder: '123456:ABCDEF...',
        hint: '从 @BotFather 创建机器人后获取。',
      },
      {
        key: 'webhookSecret',
        label: 'Webhook Secret',
        type: 'password',
        placeholder: '可选，推荐配置',
      },
      {
        key: 'allowFrom',
        label: '允许用户 ID',
        type: 'textarea',
        rows: 3,
        placeholder: '每行一个 Telegram 用户 ID',
      },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    fields: [
      {
        key: 'token',
        label: 'Bot Token',
        type: 'password',
        required: true,
      },
      {
        key: 'publicKey',
        label: 'Public Key',
        type: 'text',
        placeholder: 'Interactions 验签公钥',
      },
      {
        key: 'guildAllowlist',
        label: '允许服务器 ID',
        type: 'textarea',
        rows: 3,
        placeholder: '每行一个 Guild ID',
      },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    fields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        type: 'password',
        required: true,
        placeholder: 'xoxb-***',
      },
      {
        key: 'signingSecret',
        label: 'Signing Secret',
        type: 'password',
        required: true,
      },
      {
        key: 'appToken',
        label: 'App Token',
        type: 'password',
        placeholder: 'xapp-*** (Socket Mode 可选)',
      },
    ],
  },
  {
    id: 'feishu',
    name: '飞书',
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        type: 'text',
        required: true,
      },
      {
        key: 'appSecret',
        label: 'App Secret',
        type: 'password',
        required: true,
      },
      {
        key: 'verificationToken',
        label: 'Verification Token',
        type: 'password',
      },
      {
        key: 'encryptKey',
        label: 'Encrypt Key',
        type: 'password',
      },
    ],
  },
  {
    id: 'dingtalk',
    name: '钉钉',
    fields: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'text',
        required: true,
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
      },
      {
        key: 'robotCode',
        label: 'Robot Code',
        type: 'text',
        required: true,
      },
      {
        key: 'aesKey',
        label: 'AES Key',
        type: 'password',
        placeholder: '加解密安全设置（可选）',
      },
    ],
  },
  {
    id: 'wecom',
    name: '企业微信',
    fields: [
      {
        key: 'corpId',
        label: 'Corp ID',
        type: 'text',
        required: true,
      },
      {
        key: 'agentId',
        label: 'Agent ID',
        type: 'text',
        required: true,
      },
      {
        key: 'secret',
        label: 'Secret',
        type: 'password',
        required: true,
      },
      {
        key: 'token',
        label: 'Token',
        type: 'password',
      },
      {
        key: 'encodingAESKey',
        label: 'Encoding AES Key',
        type: 'password',
      },
    ],
  },
  {
    id: 'qqbot',
    name: 'QQ Bot',
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        type: 'text',
        required: true,
      },
      {
        key: 'secret',
        label: 'Secret',
        type: 'password',
        required: true,
      },
      {
        key: 'token',
        label: 'Token',
        type: 'password',
      },
      {
        key: 'sandbox',
        label: '沙箱模式',
        type: 'boolean',
        hint: '启用后仅在测试环境收发消息。',
      },
    ],
  },
]

const CHANNEL_IDS: ChannelId[] = CHANNEL_DEFS.map((channel) => channel.id)

function resolveOpenClawDir(): string {
  return process.env.OPENCLAW_STATE_DIR?.trim() || join(homedir(), '.openclaw')
}

function resolveConfigPath(): string {
  return join(resolveOpenClawDir(), 'openclaw.json')
}

function resolveAuthProfilesPath(): string {
  return join(resolveOpenClawDir(), 'agents', 'main', 'agent', 'auth-profiles.json')
}

export function readConfig(): Record<string, unknown> {
  const configPath = resolveConfigPath()
  if (!existsSync(configPath)) return {}
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function writeConfig(config: Record<string, unknown>): void {
  const configPath = resolveConfigPath()
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
}

export function isConfigured(): boolean {
  const config = readConfig()
  const wizard = asRecord(config.wizard)
  return typeof wizard.lastRunAt === 'string' && wizard.lastRunAt.length > 0
}

export function getApiKey(): string {
  const path = resolveAuthProfilesPath()
  if (!existsSync(path)) return ''
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as {
      profiles?: Record<string, { provider?: string; key?: string }>
    }
    for (const cred of Object.values(data.profiles ?? {})) {
      if (cred?.provider === 'qnaigc' && cred?.key?.trim()) {
        return cred.key.trim()
      }
    }
    return ''
  } catch {
    return ''
  }
}

export function saveApiKey(apiKey: string): void {
  const key = apiKey.trim()
  if (!key) return

  const agentDir = join(resolveOpenClawDir(), 'agents', 'main', 'agent')
  mkdirSync(agentDir, { recursive: true })
  const path = resolveAuthProfilesPath()

  let data: { version?: number; profiles?: Record<string, unknown> } = {}
  if (existsSync(path)) {
    try {
      data = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      // ignore
    }
  }

  data.version = data.version ?? 1
  data.profiles = data.profiles ?? {}
  data.profiles[QNAIGC_PROFILE_ID] = {
    type: 'api_key',
    provider: 'qnaigc',
    key,
  }

  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  const key = apiKey.trim()
  if (!key || !key.startsWith('sk-')) return false

  try {
    const response = await fetch(`${QNAIGC_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function listModels(apiKey?: string): Promise<AIModel[]> {
  const key = apiKey?.trim()

  try {
    const response = await fetch(`${QNAIGC_BASE_URL}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return getDefaultModels()
    }

    const data = (await response.json()) as { data?: Array<{ id?: string }> }
    const models: AIModel[] = []
    const seen = new Set<string>()

    for (const item of data.data ?? []) {
      const id = typeof item.id === 'string' ? item.id.trim() : ''
      if (!id || seen.has(id)) continue
      seen.add(id)
      models.push({ id, name: id })
    }

    return models.length > 0 ? models : getDefaultModels()
  } catch {
    return getDefaultModels()
  }
}

function getDefaultModels(): AIModel[] {
  return [
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  ]
}

export function getSetupState(): SetupState {
  return {
    isConfigured: isConfigured(),
    defaultWorkspace: DEFAULT_WORKSPACE,
    cliPath: join(resolveOpenClawDir(), 'bin'),
    defaultModelRef: DEFAULT_MODEL_REF,
    hasApiKey: Boolean(getApiKey()),
  }
}

export function getCurrentConfig(): CurrentConfig {
  const config = readConfig()
  const agents = asRecord(config.agents)
  const defaults = asRecord(agents.defaults)
  const model = asRecord(defaults.model)

  return {
    workspace:
      typeof defaults.workspace === 'string' && defaults.workspace.trim()
        ? defaults.workspace
        : DEFAULT_WORKSPACE,
    modelRef:
      typeof model.primary === 'string' && model.primary.trim()
        ? model.primary
        : DEFAULT_MODEL_REF,
    apiKey: getApiKey(),
    chinaChannelInstalled: false,
    chinaChannelsConfigured: false,
  }
}

export async function completeSetup(params: {
  workspace?: string
  modelRef?: string
  apiKey?: string
}): Promise<string> {
  const now = new Date().toISOString()
  const config = readConfig()

  const gw = asRecord(config.gateway)
  const gwAuth = asRecord(gw.auth)
  const agents = asRecord(config.agents)
  const defaults = asRecord(agents.defaults)
  const existingModel = asRecord(defaults.model)
  const wizard = asRecord(config.wizard)

  const existingToken =
    typeof gwAuth.token === 'string' && gwAuth.token.trim() ? gwAuth.token.trim() : null
  const token = existingToken ?? `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 14)}`

  const workspace = params.workspace?.trim() || DEFAULT_WORKSPACE
  mkdirSync(workspace, { recursive: true })
  
  if (params.apiKey?.trim()) {
    saveApiKey(params.apiKey)
  }

  const modelRef = params.modelRef?.trim() || DEFAULT_MODEL_REF

  const next: Record<string, unknown> = {
    ...config,
    gateway: {
      ...gw,
      mode: 'local',
      auth: {
        ...gwAuth,
        mode: 'token',
        token,
      },
    },
    agents: {
      ...agents,
      defaults: {
        ...defaults,
        workspace,
        model: {
          ...existingModel,
          primary: modelRef,
        },
      },
    },
    wizard: {
      ...wizard,
      lastRunAt: now,
    },
  }

  writeConfig(next)
  return token
}

export function updateAIConfig(params: { modelRef?: string }): void {
  const config = readConfig()
  const agents = asRecord(config.agents)
  const defaults = asRecord(agents.defaults)
  const model = asRecord(defaults.model)

  const nextModelRef = params.modelRef?.trim()

  const next: Record<string, unknown> = {
    ...config,
    agents: {
      ...agents,
      defaults: {
        ...defaults,
        model: {
          ...model,
          ...(nextModelRef ? { primary: nextModelRef } : {}),
        },
      },
    },
  }

  writeConfig(next)
}

export function getAIProviders(): AIProvider[] {
  const apiKey = getApiKey()
  
  return [
    {
      id: 'qnaigc',
      name: 'QnAIGC',
      description: '国内 AI 服务聚合平台',
      baseUrl: QNAIGC_BASE_URL,
      apiKeyConfigured: Boolean(apiKey),
      models: [],
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'GPT-4, GPT-3.5 等模型',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyConfigured: false,
      models: [],
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Claude 系列模型',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKeyConfigured: false,
      models: [],
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      description: 'DeepSeek 系列模型',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKeyConfigured: false,
      models: [],
    },
    {
      id: 'moonshot',
      name: 'Moonshot',
      description: 'Moonshot Kimi 系列模型',
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKeyConfigured: false,
      models: [],
    },
    {
      id: 'gemini',
      name: 'Gemini',
      description: 'Google Gemini 系列模型',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiKeyConfigured: false,
      models: [],
    },
  ]
}

export function getChannels(): ChannelConfig[] {
  const config = readConfig()
  const channels = asRecord(config.channels)

  return CHANNEL_DEFS.map(({ id, name, fields }) => {
    const rawChannelConfig = asRecord(channels[id])
    const { enabled, ...channelConfig } = rawChannelConfig
    return {
      id,
      name,
      enabled: enabled === true,
      config: channelConfig,
      fields,
    }
  })
}

export function isValidChannelId(id: string): id is ChannelId {
  return CHANNEL_IDS.includes(id as ChannelId)
}

export function updateChannel(id: ChannelId, update: Partial<ChannelConfig>): void {
  const config = readConfig()
  const channels = asRecord(config.channels)
  const existingRaw = asRecord(channels[id])
  const { enabled: existingEnabled, ...existingConfig } = existingRaw
  
  channels[id] = {
    ...existingConfig,
    ...update.config,
    enabled: update.enabled ?? (existingEnabled === true),
  }
  
  writeConfig({ ...config, channels })
}
