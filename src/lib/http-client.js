const commandCache = new Map()
const DEFAULT_CACHE_TTL = 15000

const requestLogs = []
const MAX_REQUEST_LOGS = 100

let backendOnline = null
const backendListeners = []

function logRequest(cmd, args, duration, cached = false) {
  requestLogs.push({
    timestamp: Date.now(),
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false, fractionalSecondDigits: 3 }),
    cmd,
    args: JSON.stringify(args),
    duration: duration ? `${duration}ms` : '-',
    cached,
  })
  if (requestLogs.length > MAX_REQUEST_LOGS) requestLogs.shift()
}

function cacheKey(cmd, args) {
  return `${cmd}:${JSON.stringify(args || {})}`
}

function setBackendOnline(next) {
  if (backendOnline === next) return
  backendOnline = next
  backendListeners.forEach((listener) => {
    try { listener(next) } catch {}
  })
}

async function requestJson(path, payload = {}, options = {}) {
  const { interceptUnauthorized = true } = options
  const resp = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (resp.status === 401 && interceptUnauthorized) {
    if (window.__linclaw_show_login) window.__linclaw_show_login()
    throw new Error('需要登录')
  }

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
    throw new Error(data.error || `HTTP ${resp.status}`)
  }

  return resp.json()
}

export function getRequestLogs() {
  return requestLogs.slice()
}

export function clearRequestLogs() {
  requestLogs.length = 0
}

export function invalidateCommandCache(...cmds) {
  if (!cmds.length) return
  for (const key of commandCache.keys()) {
    if (cmds.some((cmd) => key.startsWith(`${cmd}:`))) commandCache.delete(key)
  }
}

export function clearCommandCache() {
  commandCache.clear()
}

export async function invokeCommand(cmd, args = {}) {
  const startedAt = Date.now()
  const result = await requestJson(`/__api/${cmd}`, args)
  logRequest(cmd, args, Date.now() - startedAt, false)
  return result
}

export function cachedCommand(cmd, args = {}, ttl = DEFAULT_CACHE_TTL) {
  const key = cacheKey(cmd, args)
  const cached = commandCache.get(key)
  if (cached && Date.now() - cached.ts < ttl) {
    logRequest(cmd, args, 0, true)
    return Promise.resolve(cached.value)
  }
  return invokeCommand(cmd, args).then((value) => {
    commandCache.set(key, { value, ts: Date.now() })
    return value
  })
}

export function onBackendStatusChange(fn) {
  backendListeners.push(fn)
  return () => {
    const idx = backendListeners.indexOf(fn)
    if (idx >= 0) backendListeners.splice(idx, 1)
  }
}

export function isBackendOnline() {
  return backendOnline
}

export async function checkBackendHealth() {
  try {
    const resp = await fetch('/__api/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const ok = resp.ok
    setBackendOnline(ok)
    return ok
  } catch {
    setBackendOnline(false)
    return false
  }
}

export { requestJson }
