import { version as APP_VERSION } from '../../package.json'
import { statusIcon } from '../lib/icons.js'
import { checkBackendHealth } from '../lib/http-client.js'

const CAPTCHA_THRESHOLD = 3
const logoSvg = `<svg class="login-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
  <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/>
</svg>`

let backendRetryTimer = null
let loginFailCount = 0

export function getSessionFlag(key) {
  return sessionStorage.getItem(`linclaw_${key}`) ?? sessionStorage.getItem(`clawpanel_${key}`)
}

export function setSessionFlag(key, value) {
  sessionStorage.setItem(`linclaw_${key}`, value)
  sessionStorage.removeItem(`clawpanel_${key}`)
}

export function clearSessionFlag(key) {
  sessionStorage.removeItem(`linclaw_${key}`)
  sessionStorage.removeItem(`clawpanel_${key}`)
}

export function hideSplash() {
  const splash = document.getElementById('splash')
  if (!splash) return
  splash.classList.add('hide')
  setTimeout(() => splash.remove(), 500)
}

export async function checkAuth() {
  try {
    const resp = await fetch('/__api/auth_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const data = await resp.json()
    if (!data.required || data.authenticated) return { ok: true }
    return { ok: false, defaultPw: data.defaultPassword || null }
  } catch {
    return { ok: true }
  }
}

export function showBackendDownOverlay() {
  if (document.getElementById('backend-down-overlay')) return

  hideSplash()

  const overlay = document.createElement('div')
  overlay.id = 'backend-down-overlay'
  overlay.innerHTML = `
    <div class="login-card" style="text-align:center">
      ${logoSvg}
      <div class="login-title" style="color:var(--error,#ef4444)">后端未启动</div>
      <div class="login-desc" style="line-height:1.8">
        LinClaw 后端服务未运行，无法获取真实数据。<br>
        <span style="font-size:12px;color:var(--text-tertiary)">请在服务器上启动后端服务后刷新页面。</span>
      </div>
      <div style="background:var(--bg-tertiary);border-radius:var(--radius-md,8px);padding:14px 18px;margin:16px 0;text-align:left;font-family:var(--font-mono,monospace);font-size:12px;line-height:1.8;user-select:all;color:var(--text-secondary)">
        <div style="color:var(--text-tertiary);margin-bottom:4px"># 开发模式</div>
        npm run dev<br>
        <div style="color:var(--text-tertiary);margin-top:8px;margin-bottom:4px"># 生产模式</div>
        npm run preview
      </div>
      <button class="login-btn" id="btn-backend-retry" style="margin-top:8px">
        <span id="backend-retry-text">重新检测</span>
      </button>
      <div id="backend-retry-status" style="font-size:12px;color:var(--text-tertiary);margin-top:12px"></div>
      <div style="margin-top:16px;font-size:11px;color:#aaa">
        <a href="https://linclaw.qnlinking.com/" target="_blank" rel="noopener" style="color:#aaa;text-decoration:none">https://linclaw.qnlinking.com/</a>
        <span style="margin:0 6px">&middot;</span>v${APP_VERSION}
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  let retrying = false
  const btn = overlay.querySelector('#btn-backend-retry')
  const statusEl = overlay.querySelector('#backend-retry-status')
  const textEl = overlay.querySelector('#backend-retry-text')

  btn?.addEventListener('click', async () => {
    if (retrying) return
    retrying = true
    btn.disabled = true
    textEl.textContent = '检测中...'
    statusEl.textContent = ''

    const ok = await checkBackendHealth()
    if (ok) {
      statusEl.textContent = '后端已连接，正在加载...'
      statusEl.style.color = 'var(--success,#22c55e)'
      overlay.classList.add('hide')
      setTimeout(() => {
        overlay.remove()
        location.reload()
      }, 600)
      return
    }

    statusEl.textContent = '后端仍未响应，请确认服务已启动'
    statusEl.style.color = 'var(--error,#ef4444)'
    textEl.textContent = '重新检测'
    btn.disabled = false
    retrying = false
  })

  if (backendRetryTimer) clearInterval(backendRetryTimer)
  backendRetryTimer = setInterval(async () => {
    const ok = await checkBackendHealth()
    if (!ok) return
    clearInterval(backendRetryTimer)
    backendRetryTimer = null
    statusEl.textContent = '后端已连接，正在加载...'
    statusEl.style.color = 'var(--success,#22c55e)'
    overlay.classList.add('hide')
    setTimeout(() => {
      overlay.remove()
      location.reload()
    }, 600)
  }, 5000)
}

function genCaptcha() {
  const a = Math.floor(Math.random() * 20) + 1
  const b = Math.floor(Math.random() * 20) + 1
  return { q: `${a} + ${b} = ?`, a: a + b }
}

export function showLoginOverlay(defaultPw) {
  const hasDefault = !!defaultPw
  const overlay = document.createElement('div')
  overlay.id = 'login-overlay'
  let captcha = loginFailCount >= CAPTCHA_THRESHOLD ? genCaptcha() : null

  overlay.innerHTML = `
    <div class="login-card">
      ${logoSvg}
      <div class="login-title">LinClaw</div>
      <div class="login-desc">${hasDefault
        ? '首次使用，默认密码已自动填充<br><span style="font-size:12px;color:#6366f1;font-weight:600">登录后请前往「安全设置」修改密码</span>'
        : '请输入访问密码'}</div>
      <form id="login-form">
        <input class="login-input" type="${hasDefault ? 'text' : 'password'}" id="login-pw" placeholder="访问密码" autocomplete="current-password" autofocus value="${hasDefault ? defaultPw : ''}" />
        <div id="login-captcha" style="display:${captcha ? 'block' : 'none'};margin-bottom:10px">
          <div style="font-size:12px;color:#888;margin-bottom:6px">请先完成验证：<strong id="captcha-q" style="color:var(--text-primary,#333)">${captcha ? captcha.q : ''}</strong></div>
          <input class="login-input" type="number" id="login-captcha-input" placeholder="输入计算结果" style="text-align:center" />
        </div>
        <button class="login-btn" type="submit">登 录</button>
        <div class="login-error" id="login-error"></div>
      </form>
      ${!hasDefault ? `<details class="login-forgot" style="margin-top:16px;text-align:center">
        <summary style="font-size:11px;color:#aaa;cursor:pointer;list-style:none;user-select:none">忘记密码？</summary>
        <div style="margin-top:8px;font-size:11px;color:#888;line-height:1.8;text-align:left;background:rgba(0,0,0,.03);border-radius:8px;padding:10px 14px">
          编辑服务器上的配置文件，删除 <code style="background:rgba(99,102,241,.1);padding:1px 5px;border-radius:3px;font-size:10px">accessPassword</code> 字段后重启服务：<br><code style="background:rgba(99,102,241,.1);padding:2px 6px;border-radius:3px;font-size:10px;word-break:break-all">~/.openclaw/linclaw.json</code>
        </div>
      </details>` : ''}
      <div style="margin-top:${hasDefault ? '20' : '12'}px;font-size:11px;color:#aaa;text-align:center">
        <a href="https://linclaw.qnlinking.com/" target="_blank" rel="noopener" style="color:#aaa;text-decoration:none">https://linclaw.qnlinking.com/</a>
        <span style="margin:0 6px">·</span>v${APP_VERSION}
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  hideSplash()

  return new Promise((resolve) => {
    overlay.querySelector('#login-form')?.addEventListener('submit', async (event) => {
      event.preventDefault()

      const pw = overlay.querySelector('#login-pw')?.value || ''
      const btn = overlay.querySelector('.login-btn')
      const errEl = overlay.querySelector('#login-error')
      btn.disabled = true
      btn.textContent = '登录中...'
      errEl.textContent = ''

      if (captcha) {
        const captchaVal = parseInt(overlay.querySelector('#login-captcha-input')?.value, 10)
        if (captchaVal !== captcha.a) {
          errEl.textContent = '验证码错误'
          captcha = genCaptcha()
          const qEl = overlay.querySelector('#captcha-q')
          if (qEl) qEl.textContent = captcha.q
          overlay.querySelector('#login-captcha-input').value = ''
          btn.disabled = false
          btn.textContent = '登 录'
          return
        }
      }

      try {
        const resp = await fetch('/__api/auth_login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pw }),
        })
        const data = await resp.json()

        if (!resp.ok) {
          loginFailCount++
          if (loginFailCount >= CAPTCHA_THRESHOLD && !captcha) {
            captcha = genCaptcha()
            const captchaEl = overlay.querySelector('#login-captcha')
            if (captchaEl) {
              captchaEl.style.display = 'block'
              captchaEl.querySelector('#captcha-q').textContent = captcha.q
            }
          }
          errEl.textContent = (data.error || '登录失败') + (loginFailCount >= CAPTCHA_THRESHOLD ? '' : ` (${loginFailCount}/${CAPTCHA_THRESHOLD})`)
          btn.disabled = false
          btn.textContent = '登 录'
          return
        }

        overlay.classList.add('hide')
        setTimeout(() => overlay.remove(), 400)
        if (data.mustChangePassword || data.defaultPassword === '123456') {
          setSessionFlag('must_change_pw', '1')
        }
        resolve()
      } catch (err) {
        errEl.textContent = '网络错误: ' + (err.message || err)
        btn.disabled = false
        btn.textContent = '登 录'
      }
    })
  })
}

export function installGlobalLoginHook() {
  window.__linclaw_show_login = async function showGlobalLoginOverlay() {
    if (document.getElementById('login-overlay')) return
    await showLoginOverlay()
    location.reload()
  }
  window.__clawpanel_show_login = window.__linclaw_show_login
}

export function showDefaultPasswordBanner() {
  if (getSessionFlag('must_change_pw') !== '1' || document.getElementById('pw-change-banner')) return

  const banner = document.createElement('div')
  banner.id = 'pw-change-banner'
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;background:linear-gradient(135deg,#115e59,#0f766e,#c97732);color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:13px;font-weight:500;box-shadow:0 12px 24px rgba(15,118,110,0.16)'
  banner.innerHTML = `
    <span>${statusIcon('warn', 14)} 当前使用的是系统生成的默认密码，为了安全请尽快修改</span>
    <a href="#/security" id="pw-change-link" style="color:#fff;background:rgba(255,255,255,0.2);padding:4px 14px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600">前往安全设置</a>
    <button id="pw-change-close" style="background:none;border:none;color:rgba(255,255,255,0.7);cursor:pointer;font-size:16px;padding:0 4px;margin-left:4px">✕</button>
  `
  document.body.prepend(banner)

  banner.querySelector('#pw-change-link')?.addEventListener('click', () => {
    banner.remove()
    clearSessionFlag('must_change_pw')
  })
  banner.querySelector('#pw-change-close')?.addEventListener('click', () => {
    banner.remove()
  })
}
