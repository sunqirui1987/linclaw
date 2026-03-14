/**
 * 初始设置页面 — openclaw 未安装时的引导
 * 自动检测环境 → 版本选择 → 一键安装 → 自动跳转
 */
import { api } from '../lib/api/feature-services.js'
import { invalidateCommandCache as invalidate } from '../lib/http-client.js'
import { showUpgradeModal } from '../components/modal.js'
import { toast } from '../components/toast.js'
import { setUpgrading, isMacPlatform } from '../lib/app-state.js'
import { diagnoseInstallError } from '../lib/error-diagnosis.js'
import { icon, statusIcon } from '../lib/icons.js'
import { getGatewayServiceSnapshot } from '../lib/service-status.js'

export async function render() {
  const page = document.createElement('div')
  page.className = 'page'

  page.innerHTML = `
    <div style="max-width:560px;margin:48px auto;text-align:center">
      <div style="margin-bottom:var(--space-lg)">
        <img src="/images/logo-brand.png" alt="LinClaw" style="max-width:160px;width:100%;height:auto">
      </div>
      <h1 style="font-size:var(--font-size-xl);margin-bottom:var(--space-xs)">欢迎使用 LinClaw</h1>
      <p style="color:var(--text-secondary);margin-bottom:var(--space-xl);line-height:1.6">
        OpenClaw AI Agent 框架的桌面管理面板
      </p>

      <div id="setup-steps"></div>

      <div style="margin-top:var(--space-lg)">
        <button class="btn btn-secondary btn-sm" id="btn-recheck" style="min-width:120px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:4px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          重新检测
        </button>
      </div>
    </div>
  `

  page.querySelector('#btn-recheck').addEventListener('click', () => runDetect(page))
  runDetect(page)
  return page
}

async function runDetect(page) {
  const stepsEl = page.querySelector('#setup-steps')
  stepsEl.innerHTML = `
    <div class="stat-card loading-placeholder" style="height:48px"></div>
    <div class="stat-card loading-placeholder" style="height:48px;margin-top:8px"></div>
    <div class="stat-card loading-placeholder" style="height:48px;margin-top:8px"></div>
    <div class="stat-card loading-placeholder" style="height:48px;margin-top:8px"></div>
  `
  // 清除缓存，确保拿到最新检测结果
  invalidate('check_node', 'check_git', 'get_services_status', 'check_installation')
  // 并行检测 Node.js、Git、OpenClaw CLI、配置文件
  const [nodeRes, gitRes, clawRes, configRes] = await Promise.allSettled([
    api.checkNode(),
    api.checkGit(),
    api.getServicesStatus(),
    api.checkInstallation(),
  ])

  const node = nodeRes.status === 'fulfilled' ? nodeRes.value : { installed: false }
  const git = gitRes.status === 'fulfilled' ? gitRes.value : { installed: false }
  const gateway = clawRes.status === 'fulfilled' ? getGatewayServiceSnapshot(clawRes.value) : getGatewayServiceSnapshot([])
  const cliOk = clawRes.status === 'fulfilled'
    && clawRes.value?.length > 0
    && gateway.cli_installed !== false
  let config = configRes.status === 'fulfilled' ? configRes.value : { installed: false }

  // CLI 已装但配置缺失 → 自动创建默认配置
  if (cliOk && !config.installed) {
    try {
      const initResult = await api.initOpenclawConfig()
      if (initResult?.created) {
        config = await api.checkInstallation()
      }
    } catch (e) {
      console.warn('[setup] 自动初始化配置失败:', e)
    }
  }

  // Git 已安装时，自动配置 HTTPS 替代 SSH（静默执行）
  if (git.installed) {
    api.configureGitHttps().catch(() => {})
  }

  renderSteps(page, { node, git, cliOk, config, gateway })
}

function stepIcon(ok) {
  const color = ok ? 'var(--success)' : 'var(--text-tertiary)'
  return `<span style="color:${color};font-weight:700;width:18px;display:inline-block">${ok ? '✓' : '✗'}</span>`
}

function sourceLabel(source) {
  switch (source) {
    case 'managed': return '当前目录'
    case 'custom': return '自定义路径'
    case 'system': return '系统环境'
    default: return '未检测到'
  }
}

function renderSteps(page, { node, git, cliOk, config, gateway }) {
  const stepsEl = page.querySelector('#setup-steps')
  const nodeOk = node.installed
  const gitOk = git?.installed || false
  const allOk = nodeOk && cliOk && config.installed

  let html = ''

  html += `
    <div class="config-section" style="text-align:left;margin-bottom:var(--space-md)">
      <div class="config-section-title">自动安装向导</div>
      <div style="font-size:var(--font-size-sm);color:var(--text-secondary);line-height:1.7">
        LinClaw 会按这个顺序工作：
        <strong>先检查当前目录</strong> → <strong>再检查系统环境</strong> → <strong>缺什么就安装到当前目录</strong>。
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        ${!nodeOk ? '<button class="btn btn-primary btn-sm" id="btn-next-install-node">下一步：安装 Node.js + npm</button>' : ''}
        ${nodeOk && !cliOk ? '<button class="btn btn-primary btn-sm" id="btn-next-install-cli">下一步：安装 OpenClaw</button>' : ''}
        ${nodeOk && cliOk && !config.installed ? '<button class="btn btn-primary btn-sm" id="btn-next-init-config">下一步：创建配置文件</button>' : ''}
        ${allOk ? '<span style="color:var(--success);font-size:var(--font-size-sm);font-weight:600">✓ 基础环境已就绪，可以继续进入面板</span>' : ''}
      </div>
    </div>
  `

  // 第一步：Node.js
  html += `
    <div class="config-section" style="text-align:left">
      <div class="config-section-title" style="display:flex;align-items:center;gap:4px">
        ${stepIcon(nodeOk)} Node.js 环境
      </div>
      ${nodeOk
        ? `<p style="color:var(--success);font-size:var(--font-size-sm)">已安装 ${node.version || ''} · ${sourceLabel(node.source)}${node.npmInstalled ? ` · npm ${node.npmVersion || ''}` : ''}</p>
           <p style="font-size:var(--font-size-xs);color:var(--text-tertiary);line-height:1.6">查找顺序：当前目录 → 自定义路径 → 系统环境</p>`
        : `<p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-sm)">
            会先检查当前目录里的便携 Node.js/npm，再检查系统环境；如果都没有，可以一键安装到当前目录。
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button class="btn btn-primary btn-sm" id="btn-install-node-runtime">一键安装到当前目录</button>
            <a class="btn btn-secondary btn-sm" href="https://nodejs.org/" target="_blank" rel="noopener">手动下载</a>
            <span class="form-hint">安装目录：<code style="user-select:all">.linclaw/runtime</code></span>
          </div>
          <div style="margin-top:var(--space-sm);padding:8px 12px;background:var(--bg-tertiary);border-radius:var(--radius-sm);font-size:var(--font-size-xs);color:var(--text-secondary);line-height:1.6">
            <strong>已经装了但检测不到？</strong>
            ${isMacPlatform()
              ? `macOS 上从 Finder 启动可能找不到 Node.js。试试关掉 LinClaw 后从终端启动：<br>
                 <code style="background:var(--bg-secondary);padding:2px 6px;border-radius:3px;user-select:all">open /Applications/LinClaw.app</code>`
              : `安装 Node.js 后点击「重新检测」或使用下方「自动扫描」，无需重启。`
            }
            <div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" id="btn-scan-node" style="font-size:11px;padding:3px 10px">${icon('search', 12)} 自动扫描</button>
              <span style="color:var(--text-tertiary)">或手动指定路径：</span>
            </div>
            <div style="margin-top:6px;display:flex;gap:6px">
              <input id="input-node-path" type="text" placeholder="${isMacPlatform() ? '/usr/local/bin' : 'F:\\\\AI\\\\Node'}"
                style="flex:1;padding:4px 8px;border:1px solid var(--border-primary);border-radius:var(--radius-sm);background:var(--bg-secondary);color:var(--text-primary);font-size:11px;font-family:monospace">
              <button class="btn btn-primary btn-sm" id="btn-check-path" style="font-size:11px;padding:3px 10px">检测</button>
            </div>
            <div id="scan-result" style="margin-top:6px;display:none"></div>
          </div>`
      }
    </div>
  `

  // 第二步：Git
  html += `
    <div class="config-section" style="text-align:left;${nodeOk ? '' : 'opacity:0.4;pointer-events:none'}">
      <div class="config-section-title" style="display:flex;align-items:center;gap:4px">
        ${stepIcon(gitOk)} Git 版本管理
      </div>
      ${gitOk
        ? `<p style="color:var(--success);font-size:var(--font-size-sm)">已安装 ${git.version || ''}</p>
           <p style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-top:4px">✅ 已自动配置 Git 使用 HTTPS（避免 SSH 连接问题）</p>`
        : `<p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-sm);line-height:1.5">
            部分依赖需要 Git 下载源码。点击下方按钮自动安装，如果失败请手动安装。
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" id="btn-auto-install-git">一键安装 Git</button>
            <a class="btn btn-secondary btn-sm" href="https://git-scm.com/downloads" target="_blank" rel="noopener">手动下载</a>
          </div>
          <div id="git-install-result" style="margin-top:var(--space-sm);display:none"></div>
          <div style="margin-top:8px;font-size:var(--font-size-xs);color:var(--text-tertiary);line-height:1.5">
            <strong>没有 Git 也能安装？</strong> 大部分情况下可以，但个别依赖可能需要 Git。建议安装以避免问题。
          </div>`
      }
    </div>
  `

  // 第三步：OpenClaw CLI
  html += `
    <div class="config-section" style="text-align:left;${nodeOk ? '' : 'opacity:0.4;pointer-events:none'}">
      <div class="config-section-title" style="display:flex;align-items:center;gap:4px">
        ${stepIcon(cliOk)} OpenClaw CLI
      </div>
      ${cliOk
        ? `<p style="color:var(--success);font-size:var(--font-size-sm)">CLI 可用${gateway?.description ? ` · ${gateway.description}` : ''}</p>`
        : renderInstallSection()
      }
    </div>
  `
  // 第四步：配置文件
  html += `
    <div class="config-section" style="text-align:left;${cliOk ? '' : 'opacity:0.4;pointer-events:none'}">
      <div class="config-section-title" style="display:flex;align-items:center;gap:4px">
        ${stepIcon(config.installed)} 配置文件
      </div>
      ${config.installed
        ? `<p style="color:var(--success);font-size:var(--font-size-sm)">配置文件位于 ${config.path || ''}</p>`
        : `<p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-sm)">
            配置文件不存在，点击下方按钮自动创建默认配置。
          </p>
          <button class="btn btn-primary btn-sm" id="btn-init-config">一键初始化配置</button>`
      }
    </div>
  `

  // AI 助手入口
  html += `
    <div class="config-section" style="text-align:left;margin-top:var(--space-md)">
      <div class="config-section-title" style="display:flex;align-items:center;gap:6px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
        小龙虾助手
      </div>
      <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-sm);line-height:1.5">
        遇到安装问题？AI 助手可以帮你诊断和解决。配置好模型后，点击下方按钮${!allOk ? '，当前问题会自动发送给 AI 分析' : ''}。
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" id="btn-goto-assistant">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:4px"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
          打开 AI 助手
        </button>
        ${!allOk ? `<button class="btn btn-primary btn-sm" id="btn-ask-ai-help">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:4px"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          让 AI 帮我解决
        </button>` : ''}
      </div>
    </div>
  `

  // 全部就绪 → 进入面板
  if (allOk) {
    html += `
      <div class="config-section" style="text-align:left;margin-top:var(--space-md)">
        <div class="config-section-title">下一步建议</div>
        <div style="color:var(--text-secondary);font-size:var(--font-size-sm);line-height:1.7">
          当前仅表示运行环境已经就绪，并不代表已经可以直接聊天。通常还需要继续完成以下步骤：
          <ol style="margin:8px 0 0 18px;padding:0">
            <li>前往「模型配置」添加至少一个可用模型，并确认主模型已设置</li>
            <li>前往「Gateway」确认服务已启动</li>
            <li>如需飞书、钉钉、QQ 等消息渠道，请到「消息渠道」完成接入与配对</li>
          </ol>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn btn-secondary btn-sm" id="btn-goto-models">配置模型</button>
          <button class="btn btn-secondary btn-sm" id="btn-goto-gateway">Gateway 设置</button>
          <button class="btn btn-secondary btn-sm" id="btn-goto-channels">消息渠道</button>
        </div>
      </div>
      <div style="margin-top:var(--space-lg)">
        <button class="btn btn-primary" id="btn-enter" style="min-width:200px">进入面板</button>
      </div>
    `
  }

  stepsEl.innerHTML = html
  bindEvents(page, nodeOk, { node, git, cliOk, config })
}

function renderInstallSection() {
  const isWin = navigator.platform?.startsWith('Win') || navigator.userAgent?.includes('Windows')
  const isMac = navigator.platform?.startsWith('Mac') || navigator.userAgent?.includes('Macintosh')
  let envHint = ''
  if (false) { // Web 版不显示桌面端专属提示
    envHint = `
      <div style="margin-top:var(--space-sm);padding:10px 12px;background:var(--bg-tertiary);border-radius:var(--radius-sm);border-left:3px solid var(--warning);font-size:var(--font-size-xs);color:var(--text-secondary);line-height:1.7">
        <strong style="color:var(--text-primary)">找不到已安装的 OpenClaw？</strong>
        <p style="margin:6px 0 2px">LinClaw 桌面版只能管理<strong>本机</strong>安装的 OpenClaw。以下环境中的安装无法被检测到：</p>
        <ul style="margin:4px 0 8px 16px;padding:0">
          ${isWin ? `
            <li><strong>WSL (Windows 子系统)</strong> — OpenClaw 装在 WSL 里，Windows 侧无法访问</li>
            <li><strong>Docker 容器</strong> — 容器内的安装与宿主机隔离</li>
          ` : ''}
          ${isMac ? `
            <li><strong>Docker 容器</strong> — 容器内的安装与宿主机隔离</li>
            <li><strong>远程服务器</strong> — 安装在其他机器上</li>
          ` : ''}
          ${!isWin && !isMac ? `
            <li><strong>Docker 容器</strong> — 容器内的安装与宿主机隔离</li>
          ` : ''}
        </ul>
        <details style="cursor:pointer">
          <summary style="font-weight:600;color:var(--primary);margin-bottom:6px">
            在对应环境中安装管理面板
          </summary>
          <div style="margin-top:8px">
            ${isWin ? `
              <div style="margin-bottom:10px">
                <div style="font-weight:600;margin-bottom:4px">WSL 中使用 Web 版：</div>
                <div style="margin-bottom:2px;opacity:0.8">打开 WSL 终端，一键部署 LinClaw Web 版：</div>
                <code style="display:block;background:var(--bg-secondary);padding:6px 10px;border-radius:4px;user-select:all;word-break:break-all">curl -fsSL https://raw.githubusercontent.com/sunqirui1987/linclaw/main/deploy.sh | bash</code>
                <div style="margin-top:4px;opacity:0.7">国内用户如无法访问 GitHub：<code style="background:var(--bg-secondary);padding:2px 4px;border-radius:3px;user-select:all">curl -fsSL https://gitee.com/QtCodeCreators/linclaw/raw/main/deploy.sh | bash</code></div>
                <div style="margin-top:4px;opacity:0.7">部署后在浏览器访问 WSL 的 IP 即可管理。</div>
              </div>
            ` : ''}
            <div style="margin-bottom:10px">
              <div style="font-weight:600;margin-bottom:4px">Docker 容器中使用：</div>
              <div style="margin-bottom:2px;opacity:0.8">在容器内安装 OpenClaw + LinClaw Web 版：</div>
              <code style="display:block;background:var(--bg-secondary);padding:6px 10px;border-radius:4px;user-select:all;word-break:break-all;margin-bottom:4px">npm i -g @qingchencloud/openclaw-zh</code>
              <code style="display:block;background:var(--bg-secondary);padding:6px 10px;border-radius:4px;user-select:all;word-break:break-all">curl -fsSL https://raw.githubusercontent.com/sunqirui1987/linclaw/main/deploy.sh | bash</code>
              <div style="margin-top:4px;opacity:0.7">国内镜像：<code style="background:var(--bg-secondary);padding:2px 4px;border-radius:3px;user-select:all">curl -fsSL https://gitee.com/QtCodeCreators/linclaw/raw/main/deploy.sh | bash</code></div>
            </div>
            <div>
              <div style="font-weight:600;margin-bottom:4px">远程服务器：</div>
              <div style="margin-bottom:2px;opacity:0.8">SSH 登录服务器后执行：</div>
              <code style="display:block;background:var(--bg-secondary);padding:6px 10px;border-radius:4px;user-select:all;word-break:break-all">curl -fsSL https://raw.githubusercontent.com/sunqirui1987/linclaw/main/deploy.sh | bash</code>
              <div style="margin-top:4px;opacity:0.7">国内镜像：<code style="background:var(--bg-secondary);padding:2px 4px;border-radius:3px;user-select:all">curl -fsSL https://gitee.com/QtCodeCreators/linclaw/raw/main/deploy.sh | bash</code></div>
            </div>
          </div>
        </details>
        <div style="margin-top:6px;opacity:0.7">
          或者，你也可以在本机重新安装 OpenClaw（使用下方的「一键安装」）。
        </div>
      </div>`
  }

  return `
    <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-sm)">
      选择版本后点击安装，LinClaw 会优先使用当前目录里的 Node.js/npm，并把 OpenClaw 安装到当前目录。
    </p>
    <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm)">
      <label class="setup-source-option" style="flex:1;cursor:pointer">
        <input type="radio" name="install-source" value="chinese" checked style="margin-right:6px">
        <div>
          <div style="font-weight:600;font-size:var(--font-size-sm)">汉化优化版（推荐）</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-tertiary)">@qingchencloud/openclaw-zh</div>
        </div>
      </label>
      <label class="setup-source-option" style="flex:1;cursor:pointer">
        <input type="radio" name="install-source" value="official" style="margin-right:6px">
        <div>
          <div style="font-weight:600;font-size:var(--font-size-sm)">官方原版</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-tertiary)">openclaw</div>
        </div>
      </label>
    </div>
    <div style="margin-bottom:var(--space-sm)">
      <label style="font-size:var(--font-size-xs);color:var(--text-tertiary);display:block;margin-bottom:4px">npm 镜像源</label>
      <select id="registry-select" style="width:100%;padding:6px 8px;border-radius:var(--radius-sm);border:1px solid var(--border-primary);background:var(--bg-secondary);color:var(--text-primary);font-size:var(--font-size-sm)">
        <option value="https://registry.npmmirror.com">淘宝镜像（推荐国内用户）</option>
        <option value="https://registry.npmjs.org">npm 官方源</option>
        <option value="https://repo.huaweicloud.com/repository/npm/">华为云镜像</option>
      </select>
    </div>
    <button class="btn btn-primary btn-sm" id="btn-install">一键安装到当前目录</button>
    ${envHint}
  `
}

function buildSetupProblemPrompt({ node, git, cliOk, config }) {
  const problems = []
  if (!node.installed) problems.push('- Node.js 未安装或未检测到')
  else problems.push(`- Node.js 已安装: ${node.version || '版本未知'}`)
  if (!git?.installed) problems.push('- Git 未安装')
  else problems.push(`- Git 已安装: ${git.version || '版本未知'}`)
  if (!cliOk) problems.push('- OpenClaw CLI 未安装')
  else problems.push('- OpenClaw CLI 已安装')
  if (!config.installed) problems.push('- 配置文件不存在')
  else problems.push(`- 配置文件正常: ${config.path || ''}`)

  return `我在安装 OpenClaw 时遇到问题，以下是当前检测状态：

${problems.join('\n')}

请帮我分析问题并给出解决步骤。如果需要，请使用工具帮我检查系统环境。`
}

function bindEvents(page, nodeOk, detectState) {
  const handleInitConfig = async (btn) => {
    const originalText = btn?.textContent || '一键初始化配置'
    if (btn) {
      btn.disabled = true
      btn.textContent = '初始化中...'
    }
    try {
      const result = await api.initOpenclawConfig()
      if (result?.created) {
        toast('配置文件已创建', 'success')
      } else {
        toast(result?.message || '配置文件已存在', 'info')
      }
      setTimeout(() => runDetect(page), 500)
    } catch (e) {
      toast('初始化失败: ' + e, 'error')
      if (btn) {
        btn.disabled = false
        btn.textContent = originalText
      }
    }
  }

  const handleInstallNodeRuntime = async (btn) => {
    const originalText = btn?.textContent || '一键安装到当前目录'
    const modal = showUpgradeModal()
    modal.appendLog('正在下载并安装 Node.js/npm 到当前目录...')
    if (btn) {
      btn.disabled = true
      btn.textContent = '安装中...'
    }
    setUpgrading(true)
    try {
      const result = await api.installNodeRuntime()
      modal.appendHtmlLog(`${statusIcon('ok', 14)} Node.js ${result?.version || ''}`)
      if (result?.npmInstalled) {
        modal.appendHtmlLog(`${statusIcon('ok', 14)} npm ${result?.npmVersion || ''}`)
      }
      modal.appendHtmlLog(`${statusIcon('ok', 14)} 安装位置：${result?.path || result?.targetDir || '.linclaw/runtime'}`)
      modal.setDone(result?.message || 'Node.js/npm 已安装到当前目录')
      toast('Node.js/npm 安装成功', 'success')
      setTimeout(() => runDetect(page), 600)
    } catch (e) {
      const errStr = String(e?.message || e)
      modal.appendLog(errStr)
      modal.setError('Node.js/npm 安装失败')
      toast('Node.js/npm 安装失败: ' + errStr, 'error')
    } finally {
      setUpgrading(false)
      if (btn) {
        btn.disabled = false
        btn.textContent = originalText
      }
    }
  }

  // 打开 AI 助手
  page.querySelector('#btn-goto-assistant')?.addEventListener('click', () => {
    window.location.hash = '/assistant'
  })

  // 让 AI 帮我解决（带问题上下文）
  page.querySelector('#btn-ask-ai-help')?.addEventListener('click', () => {
    if (detectState) {
      const prompt = buildSetupProblemPrompt(detectState)
      sessionStorage.setItem('assistant-auto-prompt', prompt)
    }
    window.location.hash = '/assistant'
  })

  // 进入面板
  page.querySelector('#btn-enter')?.addEventListener('click', () => {
    window.location.hash = '/dashboard'
  })
  page.querySelector('#btn-goto-models')?.addEventListener('click', () => {
    window.location.hash = '/models'
  })
  page.querySelector('#btn-goto-gateway')?.addEventListener('click', () => {
    window.location.hash = '/gateway'
  })
  page.querySelector('#btn-goto-channels')?.addEventListener('click', () => {
    window.location.hash = '/channels'
  })

  page.querySelector('#btn-install-node-runtime')?.addEventListener('click', async (event) => {
    await handleInstallNodeRuntime(event.currentTarget)
  })
  page.querySelector('#btn-next-install-node')?.addEventListener('click', async (event) => {
    await handleInstallNodeRuntime(event.currentTarget)
  })
  page.querySelector('#btn-next-init-config')?.addEventListener('click', async (event) => {
    await handleInitConfig(event.currentTarget)
  })

  // 一键安装 Git
  page.querySelector('#btn-auto-install-git')?.addEventListener('click', async () => {
    const btn = page.querySelector('#btn-auto-install-git')
    const resultEl = page.querySelector('#git-install-result')
    btn.disabled = true
    btn.textContent = '安装中...'
    if (resultEl) {
      resultEl.style.display = 'block'
      resultEl.innerHTML = '<span style="color:var(--text-tertiary)">正在安装 Git，请稍候...</span>'
    }
    try {
      const msg = await api.autoInstallGit()
      if (resultEl) resultEl.innerHTML = `<span style="color:var(--success)">✓ ${msg}</span>`
      toast('Git 安装成功', 'success')
      // 安装成功后自动配置 HTTPS
      api.configureGitHttps().catch(() => {})
      setTimeout(() => runDetect(page), 1000)
    } catch (e) {
      const errMsg = String(e.message || e)
      if (resultEl) {
        resultEl.innerHTML = `<div>
          <span style="color:var(--danger)">自动安装失败: ${errMsg}</span>
          <p style="margin-top:6px;font-size:var(--font-size-xs);color:var(--text-secondary);line-height:1.5">
            请手动安装 Git：<br>
            <strong>Windows:</strong> 下载 <a href="https://git-scm.com/downloads" target="_blank" style="color:var(--accent)">git-scm.com</a> 安装包<br>
            <strong>macOS:</strong> 在终端执行 <code style="background:var(--bg-secondary);padding:2px 4px;border-radius:3px">xcode-select --install</code> 或 <code style="background:var(--bg-secondary);padding:2px 4px;border-radius:3px">brew install git</code><br>
            <strong>Linux:</strong> <code style="background:var(--bg-secondary);padding:2px 4px;border-radius:3px">sudo apt install git</code> 或 <code style="background:var(--bg-secondary);padding:2px 4px;border-radius:3px">sudo yum install git</code>
          </p>
        </div>`
      }
      toast('Git 自动安装失败，请手动安装', 'warning')
    } finally {
      btn.disabled = false
      btn.textContent = '一键安装 Git'
    }
  })

  // 一键初始化配置
  page.querySelector('#btn-init-config')?.addEventListener('click', async (event) => {
    await handleInitConfig(event.currentTarget)
  })

  // 自动扫描 Node.js
  page.querySelector('#btn-scan-node')?.addEventListener('click', async () => {
    const btn = page.querySelector('#btn-scan-node')
    const resultEl = page.querySelector('#scan-result')
    btn.disabled = true
    btn.textContent = '扫描中...'
    resultEl.style.display = 'block'
    resultEl.innerHTML = '<span style="color:var(--text-tertiary)">正在扫描常见安装路径...</span>'
    try {
      const results = await api.scanNodePaths()
      if (results.length === 0) {
        resultEl.innerHTML = '<span style="color:var(--warning)">未找到 Node.js 安装，请手动指定路径或下载安装。</span>'
      } else {
        resultEl.innerHTML = results.map(r =>
          `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <span style="color:var(--success)">✓</span>
            <code style="flex:1;background:var(--bg-secondary);padding:2px 6px;border-radius:3px;font-size:11px">${r.path}</code>
            <span style="font-size:11px;color:var(--text-tertiary)">${r.version}</span>
            <button class="btn btn-primary btn-sm btn-use-path" data-path="${r.path}" style="font-size:10px;padding:2px 8px">使用</button>
          </div>`
        ).join('')
        resultEl.querySelectorAll('.btn-use-path').forEach(b => {
          b.addEventListener('click', async () => {
            await api.saveCustomNodePath(b.dataset.path)
            toast('Node.js 路径已保存，正在重新检测...', 'success')
            setTimeout(() => runDetect(page), 300)
          })
        })
      }
    } catch (e) {
      resultEl.innerHTML = `<span style="color:var(--danger)">扫描失败: ${e}</span>`
    } finally {
      btn.disabled = false
      btn.innerHTML = `${icon('search', 12)} 自动扫描`
    }
  })

  // 手动指定路径检测
  page.querySelector('#btn-check-path')?.addEventListener('click', async () => {
    const input = page.querySelector('#input-node-path')
    const resultEl = page.querySelector('#scan-result')
    const dir = input?.value?.trim()
    if (!dir) { toast('请输入 Node.js 安装目录', 'warning'); return }
    resultEl.style.display = 'block'
    resultEl.innerHTML = '<span style="color:var(--text-tertiary)">检测中...</span>'
    try {
      const result = await api.checkNodeAtPath(dir)
      if (result.installed) {
        await api.saveCustomNodePath(dir)
        resultEl.innerHTML = `<span style="color:var(--success)">✓ 找到 Node.js ${result.version}，路径已保存</span>`
        toast('Node.js 路径已保存，正在重新检测...', 'success')
        setTimeout(() => runDetect(page), 300)
      } else {
        resultEl.innerHTML = `<span style="color:var(--warning)">该目录下未找到 node 可执行文件，请确认路径正确。</span>`
      }
    } catch (e) {
      resultEl.innerHTML = `<span style="color:var(--danger)">检测失败: ${e}</span>`
    }
  })

  // 一键安装
  const handleOpenClawInstall = async () => {
    const source = page.querySelector('input[name="install-source"]:checked')?.value || 'chinese'
    const registry = page.querySelector('#registry-select')?.value
    const modal = showUpgradeModal()
    modal.appendLog('将先检查当前目录里的 Node.js/npm 与 OpenClaw，再在需要时安装到当前目录。')

    setUpgrading(true)
    try {
      // 先设置镜像源
      if (registry) {
        modal.appendLog(`设置 npm 镜像源: ${registry}`)
        try { await api.setNpmRegistry(registry) } catch {}
      }

      const msg = await api.upgradeOpenclaw(source)
      modal.setDone(msg)

      // 安装成功后自动安装 Gateway
      modal.appendLog('正在安装 Gateway 服务...')
      try {
        await api.installGateway()
        modal.appendHtmlLog(`${statusIcon('ok', 14)} Gateway 服务已安装`)
      } catch (e) {
        modal.appendHtmlLog(`${statusIcon('warn', 14)} Gateway 安装失败: ${e}`)
      }

      // 确保 openclaw.json 有关键默认值，否则 Gateway 启动不了或功能受限
      try {
        const config = await api.readOpenclawConfig()
        if (config) {
          let patched = false
          if (!config.gateway) config.gateway = {}
          if (!config.gateway.mode) {
            config.gateway.mode = 'local'
            patched = true
            modal.appendHtmlLog(`${statusIcon('ok', 14)} 已设置 Gateway 运行模式为 local`)
          }
          if (!config.tools || config.tools.profile !== 'full') {
            config.tools = { profile: 'full', sessions: { visibility: 'all' }, ...(config.tools || {}) }
            config.tools.profile = 'full'
            if (!config.tools.sessions) config.tools.sessions = {}
            config.tools.sessions.visibility = 'all'
            patched = true
            modal.appendHtmlLog(`${statusIcon('ok', 14)} 已开启 Agent 工具全部权限`)
          }
          if (patched) await api.writeOpenclawConfig(config)
        }
      } catch (e) {
        modal.appendHtmlLog(`${statusIcon('warn', 14)} 自动配置失败: ${e}`)
      }

      toast('OpenClaw 安装成功', 'success')
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      const errStr = String(e)
      modal.appendLog(errStr)
      await new Promise(r => setTimeout(r, 150))
      const fullLog = modal.getLogText() + '\n' + errStr
      const diagnosis = diagnoseInstallError(fullLog)
      modal.setError(diagnosis.title)
      if (diagnosis.hint) modal.appendLog('')
      if (diagnosis.hint) modal.appendHtmlLog(`${statusIcon('info', 14)} ${diagnosis.hint}`)
      if (diagnosis.command) modal.appendHtmlLog(`${icon('clipboard', 14)} ${diagnosis.command}`)
      if (window.__openAIDrawerWithError) {
        window.__openAIDrawerWithError({
          title: diagnosis.title,
          error: fullLog,
          scene: '初始安装 OpenClaw',
          hint: diagnosis.hint,
        })
      }
    } finally {
      setUpgrading(false)
    }
  }

  const installBtn = page.querySelector('#btn-install')
  const nextInstallBtn = page.querySelector('#btn-next-install-cli')
  if (!nodeOk) return

  installBtn?.addEventListener('click', handleOpenClawInstall)
  nextInstallBtn?.addEventListener('click', handleOpenClawInstall)
}
