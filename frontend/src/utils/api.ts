const API_BASE = '/api'

interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        ok: false,
        error: data.error || `HTTP ${response.status}`,
      }
    }

    return { ok: true, data }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
}

export const envApi = {
  check: () => api.get<import('@/types').EnvCheckResult>('/env/check'),
  getNodeInstallGuide: () => api.get<{ platform: string; instructions: string[] }>('/env/node-install-guide'),
}

export const installApi = {
  installOpenClaw: () => {
    return new EventSource(`${API_BASE}/install/openclaw`)
  },
  getStatus: () => api.get<{ installing: boolean; progress: number }>('/install/status'),
  getMeta: () => api.get<{ target: string; command: string }>('/install/meta'),
}

export const setupApi = {
  getState: () => api.get<import('@/types').SetupState>('/setup/state'),
  getCurrentConfig: () => api.get<import('@/types').CurrentConfig>('/setup/current-config'),
  validateApiKey: (apiKey: string, provider?: string) =>
    api.post<{ valid: boolean }>('/setup/validate-api-key', { apiKey, provider }),
  getModels: (apiKey?: string) =>
    api.get<import('@/types').AIModel[]>(`/setup/models${apiKey ? `?apiKey=${encodeURIComponent(apiKey)}` : ''}`),
  complete: (config: {
    workspace?: string
    modelRef?: string
    apiKey?: string
  }) => api.post<{ ok: boolean; gatewayUrl?: string }>('/setup/complete', config),
}

export const serviceApi = {
  getStatus: () => api.get<import('@/types').ServiceStatus>('/service/status'),
  start: () => api.post<{ ok: boolean; gatewayUrl?: string; error?: string }>('/service/start'),
  stop: () => api.post<{ ok: boolean; error?: string }>('/service/stop'),
  restart: () => api.post<{ ok: boolean; gatewayUrl?: string; error?: string }>('/service/restart'),
  getLogs: () => {
    return new EventSource(`${API_BASE}/service/logs`)
  },
}

export const configApi = {
  getAI: () => api.get<{ providers: import('@/types').AIProvider[]; current: string }>('/config/ai'),
  updateAI: (config: { provider?: string; model?: string; apiKey?: string }) =>
    api.put<{ ok: boolean }>('/config/ai', config),
  getChannels: () => api.get<import('@/types').ChannelConfig[]>('/config/channels'),
  getChannel: (id: string) => api.get<import('@/types').ChannelConfig>(`/config/channels/${id}`),
  updateChannel: (id: string, config: Partial<import('@/types').ChannelConfig>) =>
    api.put<{ ok: boolean }>(`/config/channels/${id}`, config),
}

export const commandApi = {
  list: () => api.get<import('@/types').OpenClawCommandDefinition[]>('/openclaw/commands'),
  execute: (payload: {
    commandId: string
    parameters?: Record<string, unknown>
    timeoutMs?: number
  }) => api.post<import('@/types').OpenClawCommandExecutionResult>('/openclaw/commands/execute', payload),
}

export const diagnosticsApi = {
  testAI: (provider?: string) => api.post<{ ok: boolean; latency?: number; error?: string }>('/diagnostics/test-ai', { provider }),
  testChannel: (channelId: string) =>
    api.post<{ ok: boolean; error?: string; message?: string; matchedLines?: string[] }>(
      `/diagnostics/test-channel/${channelId}`
    ),
  getSystem: () => api.get<Record<string, unknown>>('/diagnostics/system'),
}
