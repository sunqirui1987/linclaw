import { openMobileSidebar, renderSidebar } from '../components/sidebar.js'
import { tryShowEngagement } from '../components/engagement.js'
import { statusIcon } from '../lib/icons.js'
import { featureServices } from '../lib/api/feature-services.js'
import {
  detectOpenclawStatus,
  getActiveInstance,
  isGatewayRunning,
  isOpenclawReady,
  loadActiveInstance,
  onGatewayChange,
  onGuardianGiveUp,
  onInstanceChange,
  refreshGatewayStatus,
  startGatewayPoll,
} from '../lib/app-state.js'
import { findGatewayService } from '../lib/service-status.js'
import { runGatewayLifecycleAction } from '../lib/gateway-action.js'
import { wsClient } from '../lib/ws-client.js'
import { initRouter, navigate, setDefaultRoute } from '../router.js'
import { registerAppRoutes } from './routes.js'
import { startAIDrawerBootstrap } from './ai-drawer-bootstrap.js'
import {
  checkAuth,
  hideSplash,
  showBackendDownOverlay,
  showDefaultPasswordBanner,
  showLoginOverlay,
} from './startup-ui.js'
import { checkBackendHealth } from '../lib/http-client.js'
import { startGlobalUpdateChecker } from './update-checker.js'

const { config: configApi, service: serviceApi } = featureServices

export async function startLinclawApp({ sidebar, content }) {
  const backendOk = await checkBackendHealth()
  if (!backendOk) {
    showBackendDownOverlay()
    return
  }

  const auth = await checkAuth()
  if (!auth.ok) await showLoginOverlay(auth.defaultPw)

  await bootShell({ sidebar, content })
  startGlobalUpdateChecker()
  startAIDrawerBootstrap()
}

async function bootShell({ sidebar, content }) {
  if (window.location.hash === '#/docker') navigate('/dashboard')

  registerAppRoutes()
  renderSidebar(sidebar)
  initRouter(content)
  mountMobileTopbar()
  hideSplash()
  showDefaultPasswordBanner()

  await loadActiveInstance()
  await detectOpenclawStatus()
  renderSidebar(sidebar)

  if (!isOpenclawReady()) {
    setDefaultRoute('/setup')
    navigate('/setup')
    return
  }

  if (window.location.hash === '#/setup') navigate('/dashboard')

  const qiniuSkipped = sessionStorage.getItem('linclaw_qiniu_setup_skipped') || sessionStorage.getItem('clawpanel_qiniu_setup_skipped')
  if (!qiniuSkipped) {
    try {
      const qiniu = await configApi.checkQiniuSetup()
      if (qiniu?.needSetup) {
        setDefaultRoute('/qiniu-setup')
        navigate('/qiniu-setup')
      }
    } catch (error) {
      console.warn('[bootstrap] checkQiniuSetup failed:', error)
    }
  }

  setupGatewayBanner()
  startGatewayPoll()

  if (isGatewayRunning()) autoConnectWebSocket()

  onGatewayChange((running) => {
    if (running) {
      autoConnectWebSocket()
      setTimeout(tryShowEngagement, 5000)
      return
    }
    wsClient.disconnect()
  })

  onGuardianGiveUp(() => {
    showGuardianRecovery()
  })

  onInstanceChange(async () => {
    wsClient.disconnect()
    await detectOpenclawStatus()
    if (isGatewayRunning()) autoConnectWebSocket()
  })
}

async function autoConnectWebSocket() {
  try {
    const instance = getActiveInstance()
    console.log(`[bootstrap] auto connect WebSocket (instance: ${instance.name})...`)

    const config = await configApi.readOpenclawConfig()
    const port = config?.gateway?.port || 18789
    const token = typeof config?.gateway?.auth?.token === 'string' ? config.gateway.auth.token : ''

    let needReload = false

    try {
      const pairResult = await featureServices.device.autoPairDevice()
      console.log('[bootstrap] device pairing ready:', pairResult)
      if (typeof pairResult === 'object' && pairResult.changed) {
        needReload = true
      } else if (typeof pairResult === 'string' && pairResult !== '设备已配对') {
        needReload = true
      }
    } catch (error) {
      console.warn('[bootstrap] autoPairDevice failed:', error)
    }

    try {
      const patched = await configApi.patchModelVision()
      if (patched) {
        console.log('[bootstrap] model vision support patched')
        needReload = true
      }
    } catch (error) {
      console.warn('[bootstrap] patchModelVision failed:', error)
    }

    if (needReload) {
      try {
        await configApi.reloadGateway()
        console.log('[bootstrap] Gateway reloaded')
      } catch (error) {
        console.warn('[bootstrap] reloadGateway failed:', error)
      }
    }

    let host
    const latestInstance = getActiveInstance()
    if (latestInstance.type !== 'local' && latestInstance.endpoint) {
      try {
        const url = new URL(latestInstance.endpoint)
        host = `${url.hostname}:${latestInstance.gatewayPort || port}`
      } catch {
        host = location.host
      }
    } else {
      host = location.host
    }

    wsClient.connect(host, token)
    console.log(`[bootstrap] WebSocket connect started -> ${host}`)
  } catch (error) {
    console.error('[bootstrap] auto connect WebSocket failed:', error)
  }
}

function setupGatewayBanner() {
  const banner = document.getElementById('gw-banner')
  if (!banner) return

  function update(running) {
    if (running || sessionStorage.getItem('gw-banner-dismissed')) {
      banner.classList.add('gw-banner-hidden')
      return
    }

    banner.classList.remove('gw-banner-hidden')
    banner.innerHTML = `
      <div class="gw-banner-content">
        <span class="gw-banner-icon">${statusIcon('warn', 16)}</span>
        <span>Gateway 未运行</span>
        <button class="btn btn-sm btn-primary" id="btn-gw-start" style="margin-left:auto">启动</button>
        <a class="btn btn-sm btn-ghost" href="#/services" style="color:inherit;font-size:12px">服务管理</a>
        <button class="gw-banner-close" id="btn-gw-dismiss" title="关闭提示">&times;</button>
      </div>
    `

    banner.querySelector('#btn-gw-dismiss')?.addEventListener('click', () => {
      banner.classList.add('gw-banner-hidden')
      sessionStorage.setItem('gw-banner-dismissed', '1')
    })

    banner.querySelector('#btn-gw-start')?.addEventListener('click', async () => {
      const result = await runGatewayLifecycleAction('start')
      update(result.ok ? true : isGatewayRunning())
    })
  }

  update(isGatewayRunning())
  onGatewayChange(update)
  refreshGatewayStatus({ force: true }).catch(() => {})
}

function showGuardianRecovery() {
  const banner = document.getElementById('gw-banner')
  if (!banner) return

  banner.classList.remove('gw-banner-hidden')
  banner.innerHTML = `
    <div class="gw-banner-content" style="flex-wrap:wrap;gap:8px">
      <span class="gw-banner-icon">${statusIcon('warn', 16)}</span>
      <span>Gateway 反复启动失败，可能配置有误</span>
      <button class="btn btn-sm btn-primary" id="btn-gw-recover-restart">重试启动</button>
      <button class="btn btn-sm btn-secondary" id="btn-gw-recover-backup">从备份恢复</button>
      <a class="btn btn-sm btn-ghost" href="#/services" style="color:inherit;text-decoration:underline">服务管理</a>
      <a class="btn btn-sm btn-ghost" href="#/logs" style="color:inherit;text-decoration:underline">查看日志</a>
    </div>
  `

  banner.querySelector('#btn-gw-recover-restart')?.addEventListener('click', async (event) => {
    const btn = event.target
    btn.disabled = true
    const result = await runGatewayLifecycleAction('start', { title: '恢复并启动 Gateway' })
    btn.disabled = false
    btn.textContent = result.ok ? '再次启动' : '重试启动'
  })
  banner.querySelector('#btn-gw-recover-backup')?.addEventListener('click', () => {
    navigate('/services')
  })
}

function mountMobileTopbar() {
  const mainCol = document.getElementById('main-col')
  if (!mainCol || document.getElementById('mobile-topbar')) return

  const topbar = document.createElement('div')
  topbar.className = 'mobile-topbar'
  topbar.id = 'mobile-topbar'
  topbar.innerHTML = `
    <button class="mobile-hamburger" id="btn-mobile-menu">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <span class="mobile-topbar-title">LinClaw Deck</span>
  `
  topbar.querySelector('.mobile-hamburger')?.addEventListener('click', openMobileSidebar)
  mainCol.prepend(topbar)
}
