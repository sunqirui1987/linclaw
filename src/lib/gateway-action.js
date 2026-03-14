import { showProgressModal } from '../components/modal.js'
import { resetAutoRestart, setUserStopped, syncGatewayStatus } from './app-state.js'
import { api } from './api/feature-services.js'

const ACTION_META = {
  start: {
    label: '启动',
    expectRunning: true,
    invoke: () => api.startService('ai.openclaw.gateway'),
    waitingText: '等待 Gateway 进入运行状态...',
  },
  restart: {
    label: '重启',
    expectRunning: true,
    invoke: () => api.restartService('ai.openclaw.gateway'),
    waitingText: '等待 Gateway 完成重启...',
  },
  stop: {
    label: '停止',
    expectRunning: false,
    invoke: () => api.stopService('ai.openclaw.gateway'),
    waitingText: '等待 Gateway 完全停止...',
  },
}

const POLL_INTERVAL = 1500
const POLL_TIMEOUT = 30000
const LOG_TAIL_LINES = 20
let activeTask = null
let progressModal = null

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createProgressModal(title, initialText) {
  if (progressModal?.isOpen?.()) {
    progressModal.destroy()
  }
  progressModal = showProgressModal({ title, initialText })
  return progressModal
}

async function appendGatewayLogs(modal) {
  try {
    const logs = await api.readLogTail('gateway', LOG_TAIL_LINES)
    const lines = String(logs || '').trim()
    if (!lines) return
    modal.appendLog('')
    modal.appendLog('最近 Gateway 日志:')
    lines.split('\n').forEach(line => modal.appendLog(`  ${line}`))
  } catch (e) {
    modal.appendLog(`读取 Gateway 日志失败: ${e.message || e}`)
  }
}

export async function runGatewayLifecycleAction(action, options = {}) {
  if (activeTask?.promise) {
    activeTask.modal?.focus?.()
    return activeTask.promise
  }

  const meta = ACTION_META[action]
  if (!meta) throw new Error(`不支持的 Gateway 操作: ${action}`)
  const title = options.title || `${meta.label} Gateway`

  if (action === 'stop') {
    setUserStopped(true)
  } else {
    resetAutoRestart()
  }

  const modal = createProgressModal(title, `准备${meta.label}...`)
  modal.setTitle(title)

  const task = {
    action,
    title,
    modal,
    promise: null,
  }
  activeTask = task

  task.promise = (async () => {
    modal.appendLog(`开始${meta.label} Gateway`)
    modal.setProgress(10)
    modal.setStatus(`正在发送${meta.label}命令...`)

    try {
      await meta.invoke()
      modal.appendLog(`${meta.label}命令已发送`)
    } catch (e) {
      const message = e.message || String(e)
      modal.appendLog(`${meta.label}命令失败: ${message}`)
      await appendGatewayLogs(modal)
      modal.setError(`${meta.label}失败: ${message}`)
      await options.onSettled?.({ ok: false, error: e })
      return { ok: false, error: e }
    }

    const startedAt = Date.now()
    let lastPollError = null
    let lastLoggedSecond = -1
    modal.setProgress(25)
    modal.setStatus(meta.waitingText)

    while (Date.now() - startedAt < POLL_TIMEOUT) {
      const elapsedMs = Date.now() - startedAt
      const elapsedSec = Math.floor(elapsedMs / 1000)
      const progress = Math.min(90, 25 + Math.floor((elapsedMs / POLL_TIMEOUT) * 65))
      modal.setProgress(progress)
      modal.setStatus(`${meta.waitingText} ${elapsedSec}s`)

      if (elapsedSec > 0 && elapsedSec % 5 === 0 && elapsedSec !== lastLoggedSecond) {
        modal.appendLog(`已等待 ${elapsedSec}s，继续检查服务状态...`)
        lastLoggedSecond = elapsedSec
      }

      try {
        const services = await api.getServicesStatus(true)
        const gateway = syncGatewayStatus(services)
        if (gateway?.running === meta.expectRunning) {
          const doneMessage = meta.expectRunning
            ? `${meta.label}完成${gateway.pid ? ` (PID: ${gateway.pid})` : ''}`
            : 'Gateway 已停止'
          modal.appendLog(doneMessage)
          modal.setDone(doneMessage)
          await options.onSuccess?.(gateway)
          await options.onSettled?.({ ok: true, gateway })
          return { ok: true, gateway }
        }
        lastPollError = null
      } catch (e) {
        lastPollError = e
      }

      await sleep(POLL_INTERVAL)
    }

    if (lastPollError) {
      modal.appendLog(`状态轮询失败: ${lastPollError.message || lastPollError}`)
    }
    modal.appendLog(`${meta.label}超时，${POLL_TIMEOUT / 1000}s 内未观察到目标状态`)
    await appendGatewayLogs(modal)
    modal.setError(`${meta.label}超时，请查看日志`)
    await options.onSettled?.({ ok: false, timeout: true, error: lastPollError || null })
    return { ok: false, timeout: true, error: lastPollError || null }
  })().finally(() => {
    if (activeTask === task) activeTask = null
  })

  return task.promise
}
