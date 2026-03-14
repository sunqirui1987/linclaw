import { featureServices } from '../lib/api/feature-services.js'
import { getSessionFlag, setSessionFlag } from './startup-ui.js'

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000
let updateCheckTimer = null

export function startGlobalUpdateChecker() {
  setTimeout(checkGlobalUpdate, 5000)
  updateCheckTimer = setInterval(checkGlobalUpdate, UPDATE_CHECK_INTERVAL)
  return () => {
    if (updateCheckTimer) clearInterval(updateCheckTimer)
    updateCheckTimer = null
  }
}

async function checkGlobalUpdate() {
  const banner = document.getElementById('update-banner')
  if (!banner) return

  try {
    const info = await featureServices.updates.checkFrontendUpdate()
    if (!info.hasUpdate) return

    const version = info.latestVersion || info.manifest?.version || ''
    if (!version) return
    if (getSessionFlag('update_dismissed') === version) return

    const changelog = info.manifest?.changelog || ''
    banner.classList.remove('update-banner-hidden')
    banner.innerHTML = `
      <div class="update-banner-content">
        <div class="update-banner-text">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span class="update-banner-ver">LinClaw v${version} 可用</span>
          ${changelog ? `<span class="update-banner-changelog">· ${changelog}</span>` : ''}
        </div>
        <button class="btn btn-sm" id="btn-update-show-cmd">更新方法</button>
        <a class="btn btn-sm" href="https://github.com/sunqirui1987/linclaw/releases" target="_blank" rel="noopener">Release Notes</a>
        <button class="update-banner-close" id="btn-update-dismiss" title="忽略此版本">✕</button>
      </div>
    `

    banner.querySelector('#btn-update-dismiss')?.addEventListener('click', () => {
      setSessionFlag('update_dismissed', version)
      banner.classList.add('update-banner-hidden')
    })

    banner.querySelector('#btn-update-show-cmd')?.addEventListener('click', () => {
      const overlay = document.createElement('div')
      overlay.className = 'modal-overlay'
      overlay.innerHTML = `
        <div class="modal" style="max-width:480px">
          <div class="modal-title">更新到 v${version}</div>
          <div style="font-size:var(--font-size-sm);line-height:1.8">
            <p style="margin-bottom:12px">在服务器上执行以下命令：</p>
            <pre style="background:var(--bg-tertiary);padding:12px 16px;border-radius:var(--radius-md);font-family:var(--font-mono);font-size:var(--font-size-xs);overflow-x:auto;white-space:pre-wrap;user-select:all">cd /opt/linclaw
git pull origin main
npm install
npm run build
sudo systemctl restart linclaw</pre>
            <p style="margin-top:12px;color:var(--text-tertiary);font-size:var(--font-size-xs)">
              如果 git pull 失败，可先执行 <code style="background:var(--bg-tertiary);padding:2px 6px;border-radius:4px">git checkout -- .</code> 丢弃本地修改。<br>
              路径请替换为实际的 LinClaw 安装目录。
            </p>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary btn-sm" data-action="close">关闭</button>
          </div>
        </div>
      `
      document.body.appendChild(overlay)
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) overlay.remove()
      })
      overlay.querySelector('[data-action="close"]').onclick = () => overlay.remove()
      overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') overlay.remove()
      })
    })
  } catch {
    // Ignore background update check failures.
  }
}
