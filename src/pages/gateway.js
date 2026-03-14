/**
 * Gateway 配置页面 — 小白友好版
 */
import { api } from '../lib/api/feature-services.js'
import { toast } from '../components/toast.js'
import { tryShowEngagement } from '../components/engagement.js'

// 兼容新版 SecretRef：token 可能是 string 或 { $env: "VAR" } / { $ref: "x/y" }
function _tokenDisplayStr(token) {
  if (!token) return ''
  if (typeof token === 'string') return token
  if (typeof token === 'object') {
    if (token.$env) return `\$env:${token.$env}`
    if (token.$ref) return `\$ref:${token.$ref}`
    return JSON.stringify(token)
  }
  return String(token)
}
function _isSecretRef(token) {
  return token && typeof token === 'object' && ('$env' in token || '$ref' in token)
}

export async function render() {
  const page = document.createElement('div')
  page.className = 'page'

  page.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Gateway 配置</h1>
      <p class="page-desc">Gateway 是 AI 模型的统一入口，所有应用通过它来调用模型服务</p>
    </div>
    <div id="gateway-config">
      <div class="config-section"><div class="stat-card loading-placeholder" style="height:80px"></div></div>
      <div class="config-section"><div class="stat-card loading-placeholder" style="height:80px"></div></div>
      <div class="config-section"><div class="stat-card loading-placeholder" style="height:80px"></div></div>
    </div>
    <div class="gw-save-bar">
      <button class="btn btn-primary" id="btn-save-gw">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>
        保存并生效
      </button>
      <span class="gw-save-hint">修改后点击保存，Gateway 会自动重载</span>
    </div>
  `

  const state = { config: null, _origToken: null }
  // 非阻塞：先返回 DOM，后台加载数据
  loadConfig(page, state)
  page.querySelector('#btn-save-gw').onclick = async () => {
    const btn = page.querySelector('#btn-save-gw')
    btn.disabled = true
    btn.classList.add('btn-loading')
    btn.textContent = '保存中...'
    try {
      await saveConfig(page, state)
    } finally {
      btn.disabled = false
      btn.classList.remove('btn-loading')
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg> 保存并生效`
    }
  }
  return page
}

async function loadConfig(page, state) {
  const el = page.querySelector('#gateway-config')
  try {
    state.config = await api.readOpenclawConfig()
    state._origToken = state.config?.gateway?.auth?.token ?? null
    renderConfig(page, state)
  } catch (e) {
    el.innerHTML = '<div style="color:var(--error);padding:20px">加载配置失败: ' + e + '</div>'
    toast('加载配置失败: ' + e, 'error')
  }
}

function renderConfig(page, state) {
  const el = page.querySelector('#gateway-config')
  const gw = state.config?.gateway || {}
  const remoteUrl = gw.remote?.url || ''
  const remoteGatewayMode = gw.mode === 'remote' && !!String(remoteUrl).trim()

  // 端口 + 谁能访问
  el.innerHTML = `
    <div class="config-section">
      <div class="config-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
        服务端口
      </div>
      <div class="form-group">
        <label class="form-label">端口号</label>
        <input class="form-input" id="gw-port" type="number" value="${gw.port || 18789}" min="1024" max="65535" style="max-width:200px">
        <div class="form-hint">应用通过这个端口连接 Gateway，默认 18789，一般不需要改</div>
      </div>
    </div>

    <div class="config-section">
      <div class="config-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        谁能访问
      </div>
      <div class="gw-option-cards">
        <label class="gw-option-card ${(gw.bind === 'lan' || gw.bind === 'all') ? '' : 'selected'}" data-bind="loopback">
          <input type="radio" name="gw-bind" value="loopback" ${(gw.bind === 'lan' || gw.bind === 'all') ? '' : 'checked'} hidden>
          <div class="gw-option-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div class="gw-option-text">
            <div class="gw-option-title">仅本机使用</div>
            <div class="gw-option-desc">只有这台电脑上的应用能访问，最安全</div>
          </div>
        </label>
        <label class="gw-option-card ${(gw.bind === 'lan' || gw.bind === 'all') ? 'selected' : ''}" data-bind="lan">
          <input type="radio" name="gw-bind" value="lan" ${(gw.bind === 'lan' || gw.bind === 'all') ? 'checked' : ''} hidden>
          <div class="gw-option-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="7" height="10" rx="1"/><rect x="9" y="3" width="6" height="14" rx="1"/><rect x="16" y="6" width="7" height="10" rx="1"/><line x1="8" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="16" y2="12"/></svg>
          </div>
          <div class="gw-option-text">
            <div class="gw-option-title">局域网共享</div>
            <div class="gw-option-desc">同一网络下的手机、平板等设备也能用</div>
          </div>
        </label>
      </div>
    </div>

    <div class="config-section">
      <div class="config-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Gateway 部署方式
      </div>
      <div class="gw-option-cards">
        <label class="gw-option-card ${remoteGatewayMode ? '' : 'selected'}" data-mode="local">
          <input type="radio" name="gw-mode" value="local" ${remoteGatewayMode ? '' : 'checked'} hidden>
          <div class="gw-option-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
          </div>
          <div class="gw-option-text">
            <div class="gw-option-title">本机 Gateway</div>
            <div class="gw-option-desc">推荐。即使接 OpenAI、Claude、七牛云等云端模型，通常也应该选这个</div>
          </div>
        </label>
        <label class="gw-option-card ${remoteGatewayMode ? 'selected' : ''}" data-mode="remote">
          <input type="radio" name="gw-mode" value="remote" ${remoteGatewayMode ? 'checked' : ''} hidden>
          <div class="gw-option-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div class="gw-option-text">
            <div class="gw-option-title">远程 Gateway</div>
            <div class="gw-option-desc">只有当你要连接另一台已部署好的 Gateway 服务时才用</div>
          </div>
        </label>
      </div>
      <div class="form-group" id="gw-remote-url-group" style="${remoteGatewayMode ? '' : 'display:none'};margin-top:var(--space-md)">
        <label class="form-label">远程 Gateway URL</label>
        <input class="form-input" id="gw-remote-url" value="${remoteUrl}" placeholder="例如 http://10.0.0.5:18789 或 https://gateway.example.com">
        <div class="form-hint">普通云端模型接入不需要这个地址；只有“远程 Gateway”模式才需要填写。</div>
      </div>
    </div>

    <div class="config-section">
      <div class="config-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        安全认证
      </div>
      <div class="form-group" style="margin-bottom:var(--space-md)">
        <label class="form-label">认证方式</label>
        <div class="gw-option-cards">
          <label class="gw-option-card ${gw.auth?.mode === 'password' ? '' : 'selected'}" data-auth="token">
            <input type="radio" name="gw-auth-mode" value="token" ${gw.auth?.mode === 'password' ? '' : 'checked'} hidden>
            <div class="gw-option-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
            </div>
            <div class="gw-option-text">
              <div class="gw-option-title">Token 密钥</div>
              <div class="gw-option-desc">标准认证方式，适合本地和局域网使用</div>
            </div>
          </label>
          <label class="gw-option-card ${gw.auth?.mode === 'password' ? 'selected' : ''}" data-auth="password">
            <input type="radio" name="gw-auth-mode" value="password" ${gw.auth?.mode === 'password' ? 'checked' : ''} hidden>
            <div class="gw-option-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </div>
            <div class="gw-option-text">
              <div class="gw-option-title">密码认证</div>
              <div class="gw-option-desc">Tailscale Funnel 等外网暴露场景必须使用此模式</div>
            </div>
          </label>
        </div>
      </div>
      <div class="form-group" id="gw-auth-token-group" style="${gw.auth?.mode === 'password' ? 'display:none' : ''}">
        <label class="form-label">访问密钥（Token）</label>
        <div style="display:flex;gap:8px">
          <input class="form-input" id="gw-token" type="password" value="${_tokenDisplayStr(gw.auth?.token || gw.authToken)}" placeholder="不设置则任何人都能调用" style="flex:1" ${_isSecretRef(gw.auth?.token) ? 'readonly' : ''}>
          <button class="btn btn-sm btn-secondary" id="btn-toggle-token">显示</button>
        </div>
        <div class="form-hint">${_isSecretRef(gw.auth?.token) ? '当前 Token 通过环境变量/引用配置，如需改为明文请清空后输入' : '设置后，应用调用时需要带上这个密钥才能通过。如果选了「局域网共享」，强烈建议设置'}</div>
      </div>
      <div class="form-group" id="gw-auth-password-group" style="${gw.auth?.mode === 'password' ? '' : 'display:none'}">
        <label class="form-label">密码</label>
        <div style="display:flex;gap:8px">
          <input class="form-input" id="gw-password" type="password" value="${gw.auth?.password || ''}" placeholder="设置 Gateway 访问密码" style="flex:1">
          <button class="btn btn-sm btn-secondary" id="btn-toggle-password">显示</button>
        </div>
        <div class="form-hint">通过 Tailscale Funnel 暴露 Gateway 时，必须使用密码认证模式</div>
      </div>
    </div>

    <div class="config-section">
      <div class="config-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
        Agent 工具权限
      </div>
      <div class="form-group" style="margin-bottom:var(--space-md)">
        <label class="form-label">工具调用权限</label>
        <div class="gw-option-cards">
          <label class="gw-option-card ${(gw.tools?.profile || 'full') === 'full' ? 'selected' : ''}" data-tools-profile="full">
            <input type="radio" name="gw-tools-profile" value="full" ${(gw.tools?.profile || 'full') === 'full' ? 'checked' : ''} hidden>
            <div class="gw-option-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="gw-option-text">
              <div class="gw-option-title">完整权限</div>
              <div class="gw-option-desc">Agent 可使用所有工具（推荐）</div>
            </div>
          </label>
          <label class="gw-option-card ${gw.tools?.profile === 'limited' ? 'selected' : ''}" data-tools-profile="limited">
            <input type="radio" name="gw-tools-profile" value="limited" ${gw.tools?.profile === 'limited' ? 'checked' : ''} hidden>
            <div class="gw-option-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            </div>
            <div class="gw-option-text">
              <div class="gw-option-title">受限模式</div>
              <div class="gw-option-desc">仅允许安全工具，禁用文件/命令操作</div>
            </div>
          </label>
          <label class="gw-option-card ${gw.tools?.profile === 'none' ? 'selected' : ''}" data-tools-profile="none">
            <input type="radio" name="gw-tools-profile" value="none" ${gw.tools?.profile === 'none' ? 'checked' : ''} hidden>
            <div class="gw-option-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </div>
            <div class="gw-option-text">
              <div class="gw-option-title">禁用工具</div>
              <div class="gw-option-desc">Agent 只能对话，不能调用任何工具</div>
            </div>
          </label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">会话可见性</label>
        <select class="form-input" id="gw-sessions-visibility" style="width:auto;min-width:180px">
          <option value="all" ${(gw.tools?.sessions?.visibility || 'all') === 'all' ? 'selected' : ''}>所有会话可见</option>
          <option value="own" ${gw.tools?.sessions?.visibility === 'own' ? 'selected' : ''}>仅自己的会话</option>
          <option value="none" ${gw.tools?.sessions?.visibility === 'none' ? 'selected' : ''}>不可见</option>
        </select>
        <div class="form-hint">控制 Agent 是否能查看其他会话的上下文</div>
      </div>
    </div>

    <div class="gw-advanced-toggle" id="gw-advanced-toggle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>
      高级选项
    </div>
    <div class="gw-advanced-panel" id="gw-advanced-panel" style="display:none">
      <div class="config-section">
        <div class="config-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          Tailscale 组网
        </div>
        <div class="form-group">
          <label class="form-label">Tailscale 地址</label>
          <input class="form-input" id="gw-tailscale" value="${gw.tailscale?.address || ''}" placeholder="例如 100.x.x.x:18789">
          <div class="form-hint">如果你用 Tailscale 虚拟局域网，填上地址后远程设备就能通过它访问 Gateway。不用可以留空</div>
        </div>
      </div>
    </div>
  `

  bindConfigEvents(el)
}

function bindConfigEvents(el) {
  // 密码显示/隐藏
  function bindToggle(btnId, inputId) {
    const btn = el.querySelector('#' + btnId)
    if (!btn) return
    btn.onclick = () => {
      const input = el.querySelector('#' + inputId)
      if (input.type === 'password') {
        input.type = 'text'
        btn.textContent = '隐藏'
      } else {
        input.type = 'password'
        btn.textContent = '显示'
      }
    }
  }
  bindToggle('btn-toggle-token', 'gw-token')
  bindToggle('btn-toggle-password', 'gw-password')

  // 选项卡片点击高亮
  el.querySelectorAll('.gw-option-cards').forEach(group => {
    group.querySelectorAll('.gw-option-card').forEach(card => {
      card.addEventListener('click', () => {
        group.querySelectorAll('.gw-option-card').forEach(c => c.classList.remove('selected'))
        card.classList.add('selected')
      })
    })
  })

  // 认证模式切换：显示/隐藏对应输入框
  el.querySelectorAll('input[name="gw-auth-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const mode = radio.value
      const tokenGroup = el.querySelector('#gw-auth-token-group')
      const passwordGroup = el.querySelector('#gw-auth-password-group')
      if (tokenGroup) tokenGroup.style.display = mode === 'token' ? '' : 'none'
      if (passwordGroup) passwordGroup.style.display = mode === 'password' ? '' : 'none'
    })
  })

  el.querySelectorAll('input[name="gw-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const remoteGroup = el.querySelector('#gw-remote-url-group')
      if (!remoteGroup) return
      remoteGroup.style.display = radio.checked && radio.value === 'remote' ? '' : 'none'
    })
  })

  // 高级选项折叠
  el.querySelector('#gw-advanced-toggle').onclick = () => {
    const panel = el.querySelector('#gw-advanced-panel')
    const toggle = el.querySelector('#gw-advanced-toggle')
    const visible = panel.style.display !== 'none'
    panel.style.display = visible ? 'none' : 'block'
    toggle.classList.toggle('open', !visible)
  }
}

async function saveConfig(page, state) {
  const port = parseInt(page.querySelector('#gw-port')?.value) || 18789
  const bindRadio = page.querySelector('input[name="gw-bind"]:checked')
  const bind = bindRadio?.value || 'loopback'
  const modeRadio = page.querySelector('input[name="gw-mode"]:checked')
  const mode = modeRadio?.value || 'local'
  const remoteUrl = page.querySelector('#gw-remote-url')?.value || ''
  const authModeRadio = page.querySelector('input[name="gw-auth-mode"]:checked')
  const authMode = authModeRadio?.value || 'token'
  const authToken = page.querySelector('#gw-token')?.value || ''
  const authPassword = page.querySelector('#gw-password')?.value || ''
  const tailscaleAddr = page.querySelector('#gw-tailscale')?.value || ''

  if (mode === 'remote' && !remoteUrl.trim()) {
    toast('远程 Gateway 模式必须填写远程 Gateway URL', 'error')
    return
  }

  // 兼容 SecretRef：如果用户没改 token 显示值，保留原始对象
  let resolvedToken = authToken
  if (_isSecretRef(state._origToken) && authToken === _tokenDisplayStr(state._origToken)) {
    resolvedToken = state._origToken
  }
  const auth = authMode === 'password'
    ? { mode: 'password', password: authPassword }
    : resolvedToken ? { mode: 'token', token: resolvedToken } : {}

  const toolsProfile = page.querySelector('input[name="gw-tools-profile"]:checked')?.value || 'full'
  const sessionsVisibility = page.querySelector('#gw-sessions-visibility')?.value || 'all'

  state.config.tools = {
    ...(state.config.tools || {}),
    profile: toolsProfile,
    sessions: { ...(state.config.tools?.sessions || {}), visibility: sessionsVisibility },
  }

  state.config.gateway = {
    ...state.config.gateway,
    port,
    bind,
    mode: mode === 'remote' ? 'remote' : 'local',
    auth,
    remote: mode === 'remote'
      ? { ...(state.config.gateway?.remote || {}), url: remoteUrl.trim() }
      : undefined,
    tailscale: tailscaleAddr.trim() ? { address: tailscaleAddr.trim() } : undefined,
  }

  try {
    await api.writeOpenclawConfig(state.config)
    toast('配置已保存，正在重载 Gateway...', 'info')
    try {
      await api.reloadGateway()
      toast('Gateway 已重载，新配置已生效', 'success')
      setTimeout(tryShowEngagement, 3000)
    } catch (e) {
      toast('配置已保存，但重载失败: ' + e, 'warning')
    }
  } catch (e) {
    toast('保存失败: ' + e, 'error')
  }
}
