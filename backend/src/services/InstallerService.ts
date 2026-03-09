import { spawn } from 'node:child_process'
import type { ServerResponse } from 'node:http'
import { checkEnvironment } from './EnvironmentService.js'
import { OPENCLAW_INSTALL_COMMAND, OPENCLAW_INSTALL_TARGET } from './OpenClawConfig.js'
import { toSSEHeaders, sendSSE } from '../utils/helpers.js'

interface InstallState {
  installing: boolean
  progress: number
  error: string | null
}

const state: InstallState = {
  installing: false,
  progress: 0,
  error: null,
}

export function getInstallStatus(): InstallState {
  return { ...state }
}

export function getInstallMeta(): { target: string; command: string } {
  return {
    target: OPENCLAW_INSTALL_TARGET,
    command: OPENCLAW_INSTALL_COMMAND,
  }
}

export async function installOpenClaw(res: ServerResponse): Promise<void> {
  if (state.installing) {
    res.writeHead(409, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Installation already in progress' }))
    return
  }

  state.installing = true
  state.progress = 0
  state.error = null

  res.writeHead(200, toSSEHeaders())

  sendSSE(res, {
    type: 'start',
    message: `Starting OpenClaw installation (${OPENCLAW_INSTALL_TARGET})...`,
  })
  sendSSE(res, { type: 'progress', progress: 5 })
  sendSSE(res, { type: 'log', message: `Running: ${OPENCLAW_INSTALL_COMMAND}` })

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const child = spawn(npmCmd, ['install', '-g', OPENCLAW_INSTALL_TARGET], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  })

  let outputBuffer = ''

  child.stdout?.on('data', (data: Buffer) => {
    const text = data.toString()
    outputBuffer += text
    sendSSE(res, { type: 'log', message: text })
    
    if (text.includes('added') || text.includes('changed') || text.includes('up to date')) {
      state.progress = Math.min(state.progress + 20, 90)
      sendSSE(res, { type: 'progress', progress: state.progress })
    }
  })

  child.stderr?.on('data', (data: Buffer) => {
    const text = data.toString()
    outputBuffer += text
    sendSSE(res, { type: 'log', message: text, level: 'warn' })
  })

  child.on('close', (code) => {
    state.installing = false

    if (code === 0) {
      const env = checkEnvironment()
      if (env.openclaw.installed) {
        state.progress = 100
        sendSSE(res, { type: 'progress', progress: 100 })
        sendSSE(res, {
          type: 'complete',
          success: true,
          message: `OpenClaw installed successfully (${env.openclaw.version ?? 'version unknown'})`,
        })
      } else {
        state.error = 'Package installed but OpenClaw executable was not detected'
        sendSSE(res, { type: 'complete', success: false, error: state.error })
      }
    } else {
      state.error = `Installation failed with code ${code}`
      sendSSE(res, { type: 'complete', success: false, error: state.error })
    }

    res.end()
  })

  child.on('error', (err) => {
    state.installing = false
    state.error = err.message
    sendSSE(res, { type: 'complete', success: false, error: err.message })
    res.end()
  })
}
