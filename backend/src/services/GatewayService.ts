import { spawn, execSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import type { ServerResponse } from 'node:http'
import type { ServiceStatus } from '../types/index.js'
import { readConfig } from './ConfigService.js'
import { findOpenClawExecutable } from './EnvironmentService.js'
import { asRecord, toSSEHeaders, sendSSE } from '../utils/helpers.js'

const DEFAULT_GATEWAY_URL = process.env.OPENCLAW_ELECTRON_GATEWAY_URL?.trim() || 'http://127.0.0.1:18789/'
const DEFAULT_PORT = 18789
const LOG_HISTORY_LIMIT = 600

type GatewayLogLevel = 'info' | 'warn' | 'error'

interface GatewayLogEntry {
  timestamp: string
  level: GatewayLogLevel
  message: string
}

let gatewayProcess: ChildProcess | null = null
let startTime: number | null = null
const gatewayLogs: GatewayLogEntry[] = []
const logSubscribers = new Set<ServerResponse>()

function readGatewayToken(): string | null {
  const config = readConfig()
  const gw = asRecord(config.gateway)
  const auth = asRecord(gw.auth)
  const token = auth.token
  return typeof token === 'string' && token.trim() ? token.trim() : null
}

function addGatewayLog(level: GatewayLogLevel, message: string): void {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return

  for (const line of lines) {
    const entry: GatewayLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: line,
    }

    gatewayLogs.push(entry)
    if (gatewayLogs.length > LOG_HISTORY_LIMIT) {
      gatewayLogs.splice(0, gatewayLogs.length - LOG_HISTORY_LIMIT)
    }

    for (const subscriber of logSubscribers) {
      try {
        sendSSE(subscriber, { type: 'log', ...entry })
      } catch {
        logSubscribers.delete(subscriber)
      }
    }
  }
}

function getLatestErrorMessage(): string | null {
  for (let i = gatewayLogs.length - 1; i >= 0; i -= 1) {
    const item = gatewayLogs[i]
    if (item.level === 'error' || item.level === 'warn') {
      return item.message
    }
  }
  return null
}

async function isGatewayReachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) })
    // Any HTTP response means the service process is reachable on this port.
    return true
  } catch {
    return false
  }
}

function findGatewayPid(): number | null {
  if (gatewayProcess?.pid) {
    return gatewayProcess.pid
  }

  try {
    const result = execSync(`lsof -i :${DEFAULT_PORT} -t`, { encoding: 'utf8' }).trim()
    const pid = parseInt(result.split('\n')[0], 10)
    return Number.isNaN(pid) ? null : pid
  } catch {
    return null
  }
}

function getProcessMemory(pid: number): number | null {
  try {
    const result = execSync(`ps -o rss= -p ${pid}`, { encoding: 'utf8' }).trim()
    const kb = parseInt(result, 10)
    return Number.isNaN(kb) ? null : kb * 1024
  } catch {
    return null
  }
}

function clearManagedProcess(pid?: number | null): void {
  if (!gatewayProcess) {
    return
  }

  if (!pid || gatewayProcess.pid === pid) {
    gatewayProcess = null
    startTime = null
  }
}

export async function getServiceStatus(): Promise<ServiceStatus> {
  const running = await isGatewayReachable(DEFAULT_GATEWAY_URL)

  if (!running) {
    return {
      running: false,
      pid: null,
      port: null,
      memory: null,
      uptime: null,
      gatewayUrl: null,
    }
  }

  const pid = findGatewayPid()
  const memory = pid ? getProcessMemory(pid) : null
  const token = readGatewayToken()
  const gatewayUrl = token
    ? `${DEFAULT_GATEWAY_URL}#token=${encodeURIComponent(token)}`
    : DEFAULT_GATEWAY_URL

  return {
    running: true,
    pid,
    port: DEFAULT_PORT,
    memory,
    uptime: startTime ? Date.now() - startTime : null,
    gatewayUrl,
  }
}

export async function startGateway(): Promise<{ ok: boolean; gatewayUrl?: string; error?: string }> {
  if (await isGatewayReachable(DEFAULT_GATEWAY_URL)) {
    addGatewayLog('info', 'Gateway is already running')
    const token = readGatewayToken()
    return {
      ok: true,
      gatewayUrl: token
        ? `${DEFAULT_GATEWAY_URL}#token=${encodeURIComponent(token)}`
        : DEFAULT_GATEWAY_URL,
    }
  }

  const openclawCommand = findOpenClawExecutable()
  if (!openclawCommand) {
    const message = 'OpenClaw/OpenClaw-China CLI is not detected. Please install CLI first.'
    addGatewayLog('error', message)
    return { ok: false, error: message }
  }

  const args = [
    'gateway',
    'run',
    '--bind',
    'loopback',
    '--port',
    String(DEFAULT_PORT),
    '--force',
    '--allow-unconfigured',
  ]

  try {
    addGatewayLog('info', `Starting Gateway with command: ${openclawCommand} ${args.join(' ')}`)

    const child = spawn(openclawCommand, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32' && openclawCommand.endsWith('.cmd'),
      env: {
        ...process.env,
        OPENCLAW_SKIP_CHANNELS: '1',
      },
    })

    gatewayProcess = child
    startTime = Date.now()

    child.stdout?.on('data', (data: Buffer) => {
      addGatewayLog('info', data.toString())
    })

    child.stderr?.on('data', (data: Buffer) => {
      addGatewayLog('warn', data.toString())
    })

    child.on('error', (error) => {
      addGatewayLog('error', `Gateway process error: ${error.message}`)
      clearManagedProcess(child.pid)
    })

    child.on('exit', (code, signal) => {
      addGatewayLog('warn', `Gateway process exited: code=${code ?? 'null'}, signal=${signal ?? 'null'}`)
      clearManagedProcess(child.pid)
    })

    for (let i = 0; i < 20; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (await isGatewayReachable(DEFAULT_GATEWAY_URL)) {
        addGatewayLog('info', 'Gateway started successfully')
        const token = readGatewayToken()
        return {
          ok: true,
          gatewayUrl: token
            ? `${DEFAULT_GATEWAY_URL}#token=${encodeURIComponent(token)}`
            : DEFAULT_GATEWAY_URL,
        }
      }
    }

    const latestError = getLatestErrorMessage()
    return {
      ok: false,
      error: latestError
        ? `Gateway failed to start within timeout: ${latestError}`
        : 'Gateway failed to start within timeout',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    addGatewayLog('error', `Failed to start gateway: ${message}`)
    return { ok: false, error: message }
  }
}

export async function stopGateway(): Promise<{ ok: boolean; error?: string }> {
  const pid = findGatewayPid()

  if (!pid) {
    addGatewayLog('info', 'Stop requested but no running gateway process found')
    clearManagedProcess()
    return { ok: true }
  }

  try {
    addGatewayLog('info', `Stopping gateway process: pid=${pid}`)
    process.kill(pid, 'SIGTERM')

    for (let i = 0; i < 10; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (!(await isGatewayReachable(DEFAULT_GATEWAY_URL))) {
        addGatewayLog('info', 'Gateway stopped successfully')
        clearManagedProcess(pid)
        return { ok: true }
      }
    }

    addGatewayLog('warn', `Gateway did not stop gracefully, sending SIGKILL to pid=${pid}`)
    process.kill(pid, 'SIGKILL')
    clearManagedProcess(pid)
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    addGatewayLog('error', `Failed to stop gateway: ${message}`)
    return { ok: false, error: message }
  }
}

export async function restartGateway(): Promise<{ ok: boolean; gatewayUrl?: string; error?: string }> {
  addGatewayLog('info', 'Restarting gateway')
  const stopResult = await stopGateway()
  if (!stopResult.ok) {
    return { ok: false, error: stopResult.error ?? 'Failed to stop gateway before restart' }
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return startGateway()
}

export function streamLogs(res: ServerResponse): void {
  res.writeHead(200, toSSEHeaders())

  logSubscribers.add(res)
  sendSSE(res, { type: 'history', logs: gatewayLogs })
  sendSSE(res, { type: 'info', message: 'Connected to log stream' })

  const sendStatus = async () => {
    if (res.writableEnded) return
    const status = await getServiceStatus()
    sendSSE(res, {
      type: 'status',
      running: status.running,
      pid: status.pid,
      memory: status.memory,
      uptime: status.uptime,
      port: status.port,
      gatewayUrl: status.gatewayUrl,
    })
  }

  void sendStatus()
  const interval = setInterval(() => {
    void sendStatus()
  }, 5000)

  res.on('close', () => {
    clearInterval(interval)
    logSubscribers.delete(res)
  })
}
