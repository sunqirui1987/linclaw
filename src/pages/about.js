/**
 * 关于页面
 * 改为展示 LinClaw 当前实例的七牛云接入状态、模型缓存和关键入口
 */
import { api } from '../lib/api/feature-services.js'
import { toast } from '../components/toast.js'
import { navigate } from '../router.js'
import { icon } from '../lib/icons.js'

const QINIU = {
  baseUrl: 'https://api.qnaigc.com/v1',
  modelsUrl: 'https://api.qnaigc.com/v1/models',
  api: 'openai-completions',
  squareUrl: 'https://www.qiniu.com/ai/models',
  apiKeyDocUrl: 'https://developer.qiniu.com/aitokenapi/12884/how-to-get-api-key',
}

const QINIU_SNAPSHOT_KEY = 'linclaw_about_qiniu_snapshot_v1'
const QINIU_SNAPSHOT_TTL = 10 * 60 * 1000

let _snapshotPromise = null

export async function render() {
  const page = document.createElement('div')
  page.className = 'page about-page'

  page.innerHTML = `
    <section class="about-hero">
      <div class="about-hero-copy">
        <div class="about-kicker">${icon('globe', 14)} 七牛云接入总览</div>
        <div class="page-header">
          <h1 class="page-title">关于 LinClaw</h1>
          <p class="page-desc">这里不再放零散介绍，直接展示当前实例的七牛云接入状态、模型缓存和常用入口。</p>
        </div>
        <div class="about-hero-note" id="about-cache-note">正在读取七牛云配置与模型快照...</div>
      </div>
      <div class="about-hero-actions">
        <button class="btn btn-primary" id="about-refresh">${icon('refresh-cw', 14)} 刷新七牛云快照</button>
        <button class="btn btn-secondary" id="about-models">${icon('box', 14)} 打开模型配置</button>
        <button class="btn btn-secondary" id="about-debug">${icon('bug', 14)} 打开系统诊断</button>
      </div>
    </section>

    <section class="about-grid">
      <article class="about-panel about-panel-emphasis" id="about-qiniu-status">
        ${renderLoadingPanel('七牛云接入状态')}
      </article>
      <article class="about-panel" id="about-runtime">
        ${renderLoadingPanel('运行环境')}
      </article>
      <article class="about-panel about-span-2" id="about-model-cache">
        ${renderLoadingPanel('七牛云模型缓存')}
      </article>
      <article class="about-panel" id="about-config">
        ${renderLoadingPanel('当前默认配置')}
      </article>
      <article class="about-panel" id="about-links">
        ${renderLoadingPanel('快捷入口')}
      </article>
    </section>
  `

  bindActions(page)
  loadOverview(page)
  return page
}

function bindActions(page) {
  page.querySelector('#about-refresh')?.addEventListener('click', async () => {
    const btn = page.querySelector('#about-refresh')
    if (!btn) return
    btn.disabled = true
    btn.innerHTML = `${icon('refresh-cw', 14)} 刷新中...`
    try {
      clearSnapshotCache()
      await loadOverview(page, { force: true })
      toast('七牛云快照已刷新', 'success')
    } catch (e) {
      toast(`刷新失败: ${e.message || e}`, 'error')
    } finally {
      btn.disabled = false
      btn.innerHTML = `${icon('refresh-cw', 14)} 刷新七牛云快照`
    }
  })

  page.querySelector('#about-models')?.addEventListener('click', () => navigate('/models'))
  page.querySelector('#about-debug')?.addEventListener('click', () => navigate('/chat-debug'))
}

async function loadOverview(page, { force = false } = {}) {
  const noteEl = page.querySelector('#about-cache-note')

  try {
    const [version, install, snapshot] = await Promise.all([
      api.getVersionInfo().catch(() => null),
      api.checkInstallation().catch(() => null),
      loadQiniuSnapshot({ force }),
    ])

    renderStatusPanel(page.querySelector('#about-qiniu-status'), snapshot)
    renderRuntimePanel(page.querySelector('#about-runtime'), version, install, snapshot)
    renderModelCachePanel(page.querySelector('#about-model-cache'), snapshot)
    renderConfigPanel(page.querySelector('#about-config'), snapshot)
    renderLinksPanel(page.querySelector('#about-links'), snapshot)

    if (noteEl) {
      const stateText = snapshot.cacheState === 'fresh'
        ? '已从后端刷新最新快照'
        : snapshot.cacheState === 'stale'
          ? '当前显示的是上一次缓存快照'
          : '已命中本地缓存，避免重复请求'
      noteEl.innerHTML = `${icon('clock', 13)} ${stateText} · 本页会缓存七牛云模型信息 10 分钟`
    }
  } catch (e) {
    if (noteEl) {
      noteEl.innerHTML = `${icon('alert-circle', 13)} 无法读取七牛云快照：${escapeHtml(e.message || String(e))}`
    }
    renderErrorPanel(page.querySelector('#about-qiniu-status'), '七牛云接入状态', e)
    renderErrorPanel(page.querySelector('#about-runtime'), '运行环境', e)
    renderErrorPanel(page.querySelector('#about-model-cache'), '七牛云模型缓存', e)
    renderErrorPanel(page.querySelector('#about-config'), '当前默认配置', e)
    renderLinksPanel(page.querySelector('#about-links'), null)
  }
}

async function loadQiniuSnapshot({ force = false } = {}) {
  const freshCache = !force ? readFreshSnapshotCache() : null
  if (freshCache) {
    return { ...freshCache, cacheState: 'cached' }
  }

  if (!force && _snapshotPromise) return _snapshotPromise

  _snapshotPromise = (async () => {
    const staleCache = readSnapshotCache()
    try {
      const [setup, config, remoteModels] = await Promise.all([
        api.checkQiniuSetup().catch(() => ({ needSetup: true, hasApiKey: false, hasModel: false })),
        api.readOpenclawConfig().catch(() => ({})),
        api.listRemoteModels(QINIU.baseUrl, '', QINIU.api),
      ])

      const provider = getQiniuProvider(config)
      const configuredModels = normalizeModelIds(provider.models)
      const primaryModel = getPrimaryModel(config, configuredModels)
      const snapshot = {
        createdAt: Date.now(),
        setup: {
          needSetup: !!setup?.needSetup,
          hasApiKey: !!(setup?.hasApiKey || provider.apiKey),
          hasModel: !!(setup?.hasModel || primaryModel),
        },
        provider: {
          baseUrl: provider.baseUrl || QINIU.baseUrl,
          api: provider.api || QINIU.api,
          apiKeyMasked: maskApiKey(provider.apiKey || ''),
        },
        primaryModel,
        configuredModels,
        remoteModels: Array.isArray(remoteModels) ? remoteModels.filter(Boolean) : [],
      }
      writeSnapshotCache(snapshot)
      return { ...snapshot, cacheState: 'fresh' }
    } catch (e) {
      if (staleCache) {
        return { ...staleCache, cacheState: 'stale', staleReason: e.message || String(e) }
      }
      throw e
    } finally {
      _snapshotPromise = null
    }
  })()

  return _snapshotPromise
}

function renderStatusPanel(el, snapshot) {
  if (!el) return
  const ready = snapshot?.setup?.hasApiKey && snapshot?.setup?.hasModel
  const stateClass = snapshot?.cacheState === 'stale' ? 'warn' : ready ? 'ok' : 'pending'
  const stateText = snapshot?.cacheState === 'stale' ? '缓存回退中' : ready ? '已完成接入' : '仍需配置'

  el.innerHTML = `
    <div class="about-panel-head">
      <div>
        <div class="about-panel-title">七牛云接入状态</div>
        <div class="about-panel-desc">快速确认 API Key、主模型和官方模型列表是否已就绪。</div>
      </div>
      <span class="about-badge ${stateClass}">${stateText}</span>
    </div>
    <div class="about-stats">
      <div class="about-stat">
        <div class="about-stat-label">API Key</div>
        <div class="about-stat-value">${snapshot?.setup?.hasApiKey ? '已配置' : '未配置'}</div>
        <div class="about-stat-meta">${snapshot?.provider?.apiKeyMasked || '需要前往模型配置页填写'}</div>
      </div>
      <div class="about-stat">
        <div class="about-stat-label">主模型</div>
        <div class="about-stat-value">${escapeHtml(snapshot?.primaryModel || '未设置')}</div>
        <div class="about-stat-meta">${snapshot?.setup?.hasModel ? '默认模型已可用' : '请先选择一个主模型'}</div>
      </div>
      <div class="about-stat">
        <div class="about-stat-label">已配置模型</div>
        <div class="about-stat-value">${snapshot?.configuredModels?.length || 0}</div>
        <div class="about-stat-meta">写入到当前实例配置中的模型数量</div>
      </div>
      <div class="about-stat">
        <div class="about-stat-label">远程模型快照</div>
        <div class="about-stat-value">${snapshot?.remoteModels?.length || 0}</div>
        <div class="about-stat-meta">来自 ${escapeHtml(QINIU.modelsUrl)}</div>
      </div>
    </div>
    ${snapshot?.staleReason ? `<div class="about-inline-hint warn">${icon('alert-triangle', 13)} 最新请求失败，已回退到缓存：${escapeHtml(snapshot.staleReason)}</div>` : ''}
  `
}

function renderRuntimePanel(el, version, install, snapshot) {
  if (!el) return
  const panelVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'
  const installStatus = install?.installed ? '已安装' : '未检测到配置'
  const openclawVersion = version?.current || '未安装'
  const latestVersion = version?.latest || '未检测'
  const cacheTime = formatTime(snapshot?.createdAt)

  el.innerHTML = `
    <div class="about-panel-head">
      <div>
        <div class="about-panel-title">运行环境</div>
        <div class="about-panel-desc">保留最关键的版本和安装信息，避免关于页内容太散。</div>
      </div>
      <span class="about-badge neutral">${version?.update_available ? '可更新' : '稳定'}</span>
    </div>
    <div class="about-kv">
      <div class="about-kv-row"><span>LinClaw</span><strong>${escapeHtml(panelVersion)}</strong></div>
      <div class="about-kv-row"><span>OpenClaw</span><strong>${escapeHtml(openclawVersion)}</strong></div>
      <div class="about-kv-row"><span>最新版本</span><strong>${escapeHtml(latestVersion)}</strong></div>
      <div class="about-kv-row"><span>安装状态</span><strong>${escapeHtml(installStatus)}</strong></div>
      <div class="about-kv-row"><span>安装路径</span><code>${escapeHtml(install?.path || '未知')}</code></div>
      <div class="about-kv-row"><span>快照时间</span><strong>${escapeHtml(cacheTime)}</strong></div>
    </div>
  `
}

function renderModelCachePanel(el, snapshot) {
  if (!el) return
  const remoteModels = snapshot?.remoteModels || []
  const configuredModels = snapshot?.configuredModels || []
  const previewModels = remoteModels.slice(0, 12)
  const cacheBadge = snapshot?.cacheState === 'fresh'
    ? '刚刷新'
    : snapshot?.cacheState === 'stale'
      ? '旧缓存'
      : '本地缓存'

  el.innerHTML = `
    <div class="about-panel-head">
      <div>
        <div class="about-panel-title">七牛云模型缓存</div>
        <div class="about-panel-desc">本页会缓存模型列表快照 10 分钟，减少每次切页都请求官方模型接口。</div>
      </div>
      <span class="about-badge ${snapshot?.cacheState === 'stale' ? 'warn' : 'ok'}">${cacheBadge}</span>
    </div>
    <div class="about-panel-copy">
      <div class="about-inline-hint">${icon('radio', 13)} 当前基于 <code>${escapeHtml(QINIU.modelsUrl)}</code> 拉取官方模型列表。</div>
    </div>
    <div class="about-stats compact">
      <div class="about-stat">
        <div class="about-stat-label">远程模型总数</div>
        <div class="about-stat-value">${remoteModels.length}</div>
        <div class="about-stat-meta">已缓存到浏览器本地</div>
      </div>
      <div class="about-stat">
        <div class="about-stat-label">本地配置命中</div>
        <div class="about-stat-value">${configuredModels.length}</div>
        <div class="about-stat-meta">已进入当前实例 provider 配置</div>
      </div>
    </div>
    <div class="about-subtitle">模型预览</div>
    <div class="about-tags">
      ${previewModels.length
        ? previewModels.map(model => `<span class="about-tag">${escapeHtml(model)}</span>`).join('')
        : '<span class="about-empty">暂时没有拿到模型列表</span>'}
    </div>
    <div class="about-subtitle">已配置模型</div>
    <div class="about-tags">
      ${configuredModels.length
        ? configuredModels.slice(0, 12).map(model => `<span class="about-tag muted">${escapeHtml(model)}</span>`).join('')
        : '<span class="about-empty">当前实例还没有写入七牛云模型</span>'}
    </div>
  `
}

function renderConfigPanel(el, snapshot) {
  if (!el) return
  el.innerHTML = `
    <div class="about-panel-head">
      <div>
        <div class="about-panel-title">当前默认配置</div>
        <div class="about-panel-desc">把最常用的七牛云接入参数集中展示在这里。</div>
      </div>
      <span class="about-badge neutral">只读摘要</span>
    </div>
    <div class="about-kv">
      <div class="about-kv-row"><span>Base URL</span><code>${escapeHtml(snapshot?.provider?.baseUrl || QINIU.baseUrl)}</code></div>
      <div class="about-kv-row"><span>接口类型</span><strong>${escapeHtml(snapshot?.provider?.api || QINIU.api)}</strong></div>
      <div class="about-kv-row"><span>API Key 摘要</span><strong>${escapeHtml(snapshot?.provider?.apiKeyMasked || '未配置')}</strong></div>
      <div class="about-kv-row"><span>主模型</span><strong>${escapeHtml(snapshot?.primaryModel || '未设置')}</strong></div>
      <div class="about-kv-row"><span>缓存策略</span><strong>10 分钟本地缓存</strong></div>
      <div class="about-kv-row"><span>刷新方式</span><strong>手动刷新后立即失效旧缓存</strong></div>
    </div>
  `
}

function renderLinksPanel(el, snapshot) {
  if (!el) return
  const installNeeded = snapshot && !snapshot.setup?.hasApiKey

  el.innerHTML = `
    <div class="about-panel-head">
      <div>
        <div class="about-panel-title">快捷入口</div>
        <div class="about-panel-desc">把常用跳转保留下来，减少来回找页面。</div>
      </div>
      <span class="about-badge neutral">动作入口</span>
    </div>
    <div class="about-link-list">
      <a class="about-link-item" href="#/models">
        <span>${icon('box', 14)} 模型配置</span>
        <strong>${installNeeded ? '去补齐配置' : '查看'}</strong>
      </a>
      <a class="about-link-item" href="#/chat-debug">
        <span>${icon('bug', 14)} 系统诊断</span>
        <strong>排查问题</strong>
      </a>
      <a class="about-link-item" href="${QINIU.squareUrl}" target="_blank" rel="noopener">
        <span>${icon('globe', 14)} 七牛云模型广场</span>
        <strong>打开官网</strong>
      </a>
      <a class="about-link-item" href="${QINIU.apiKeyDocUrl}" target="_blank" rel="noopener">
        <span>${icon('key', 14)} API Key 文档</span>
        <strong>获取 Key</strong>
      </a>
    </div>
  `
}

function renderErrorPanel(el, title, error) {
  if (!el) return
  el.innerHTML = `
    <div class="about-panel-head">
      <div>
        <div class="about-panel-title">${escapeHtml(title)}</div>
        <div class="about-panel-desc">加载失败，请稍后重试。</div>
      </div>
      <span class="about-badge warn">失败</span>
    </div>
    <div class="about-inline-hint warn">${icon('alert-circle', 13)} ${escapeHtml(error?.message || String(error))}</div>
  `
}

function renderLoadingPanel(title) {
  return `
    <div class="about-panel-head">
      <div>
        <div class="about-panel-title">${escapeHtml(title)}</div>
        <div class="about-panel-desc">正在读取当前实例信息...</div>
      </div>
      <span class="about-badge neutral">加载中</span>
    </div>
    <div class="about-loading-blocks">
      <div class="about-loading-line"></div>
      <div class="about-loading-line short"></div>
      <div class="about-loading-line"></div>
    </div>
  `
}

function getQiniuProvider(config) {
  const providers = config?.models?.providers || {}
  const qiniu = providers.qiniu || {}
  return {
    apiKey: typeof qiniu.apiKey === 'string' ? qiniu.apiKey.trim() : '',
    baseUrl: typeof qiniu.baseUrl === 'string' && qiniu.baseUrl.trim() ? qiniu.baseUrl.trim() : QINIU.baseUrl,
    api: typeof qiniu.api === 'string' && qiniu.api.trim() ? qiniu.api.trim() : QINIU.api,
    models: Array.isArray(qiniu.models) ? qiniu.models : [],
  }
}

function getPrimaryModel(config, configuredModels) {
  const primary = config?.agents?.defaults?.model?.primary
  if (typeof primary === 'string' && primary.trim()) {
    return primary.startsWith('qiniu/') ? primary.slice('qiniu/'.length) : primary
  }
  return configuredModels[0] || ''
}

function normalizeModelIds(models) {
  const ids = []
  for (const model of models || []) {
    if (typeof model === 'string' && model.trim()) ids.push(model.trim())
    else if (model && typeof model.id === 'string' && model.id.trim()) ids.push(model.id.trim())
  }
  return [...new Set(ids)]
}

function maskApiKey(apiKey) {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return `${apiKey.slice(0, 2)}****`
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`
}

function readSnapshotCache() {
  try {
    const raw = localStorage.getItem(QINIU_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.createdAt) return null
    return parsed
  } catch {
    return null
  }
}

function readFreshSnapshotCache() {
  const snapshot = readSnapshotCache()
  if (!snapshot) return null
  if (Date.now() - snapshot.createdAt > QINIU_SNAPSHOT_TTL) return null
  return snapshot
}

function writeSnapshotCache(snapshot) {
  try {
    localStorage.setItem(QINIU_SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {}
}

function clearSnapshotCache() {
  _snapshotPromise = null
  try { localStorage.removeItem(QINIU_SNAPSHOT_KEY) } catch {}
}

function formatTime(ts) {
  if (!ts) return '未生成'
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return '未生成'
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
