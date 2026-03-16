import { api } from '../lib/api/feature-services.js'
import { toast } from '../components/toast.js'
import { navigate } from '../router.js'
import { icon } from '../lib/icons.js'
import { renderMarkdown } from '../lib/markdown.js'

const TAB_STORAGE_KEY = 'linclaw-openai-tab'
const DEFAULT_MODEL_ID = 'xiaolongxia'
const DEFAULT_ASSISTANT_NAME = '小龙虾'
const EXAMPLE_PROMPTS = [
  '你好，介绍一下你自己。',
  '请用一句话说明这个 OpenAI 接口现在能做什么。',
  '帮我写一段给同事的项目同步消息。',
]

let _page = null
let _status = null
let _messages = []
let _abortController = null
let _isStreaming = false
let _activeTab = loadActiveTab()

export async function render() {
  const page = document.createElement('div')
  page.className = 'page openai-page'
  page.innerHTML = `
    <style>
      .openai-page {
        max-width: 1320px;
        height: calc(100vh - 110px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .openai-shell {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-lg);
      }
      .openai-hero {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-lg);
        flex-wrap: wrap;
      }
      .openai-hero-copy {
        max-width: 720px;
      }
      .openai-hero-copy h1 {
        font-size: var(--font-size-2xl);
        margin-bottom: 8px;
      }
      .openai-hero-copy p {
        color: var(--text-secondary);
        line-height: 1.7;
      }
      .openai-status-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .openai-status-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 999px;
        background: var(--bg-card);
        border: 1px solid var(--border-primary);
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
      }
      .openai-status-chip code {
        font-family: var(--font-mono);
        color: var(--text-primary);
      }
      .openai-panel {
        display: none;
      }
      .openai-panel.active {
        display: block;
        flex: 1;
        min-height: 0;
      }
      .openai-simple-layout {
        height: 100%;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: var(--space-lg);
      }
      .openai-quickstart {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .openai-guide-card {
        padding: 20px 22px;
        border-radius: var(--radius-lg);
        background: linear-gradient(135deg, rgba(15, 118, 110, 0.12), rgba(201, 119, 50, 0.12));
        border: 1px solid rgba(15, 118, 110, 0.16);
      }
      .openai-guide-card h3 {
        font-size: 24px;
        margin-bottom: 10px;
      }
      .openai-guide-card p {
        color: var(--text-secondary);
        line-height: 1.7;
      }
      .openai-steps {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .openai-step {
        padding: 14px 16px;
        border-radius: var(--radius-md);
        background: var(--bg-primary);
        border: 1px solid var(--border-secondary);
      }
      .openai-step-index {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        color: var(--accent-hover);
        background: var(--accent-muted);
        margin-bottom: 10px;
      }
      .openai-step b {
        display: block;
        margin-bottom: 6px;
      }
      .openai-step p {
        color: var(--text-secondary);
        line-height: 1.6;
        font-size: var(--font-size-sm);
      }
      .openai-copy-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .openai-api-editor {
        padding: 14px;
        border-radius: var(--radius-md);
        background: var(--bg-primary);
        border: 1px solid var(--border-secondary);
      }
      .openai-api-editor .form-input {
        width: 100%;
      }
      .openai-inline-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
      }
      .openai-copy-item {
        display: grid;
        grid-template-columns: 88px minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-radius: var(--radius-md);
        background: var(--bg-primary);
        border: 1px solid var(--border-secondary);
      }
      .openai-copy-label {
        color: var(--text-tertiary);
        font-size: var(--font-size-sm);
      }
      .openai-copy-value {
        min-width: 0;
        color: var(--text-primary);
        line-height: 1.5;
        word-break: break-all;
      }
      .openai-copy-value.mono {
        font-family: var(--font-mono);
      }
      .openai-hint-card {
        padding: 16px 18px;
        border-radius: var(--radius-md);
        background: var(--bg-card);
        border: 1px solid var(--border-primary);
      }
      .openai-hint-card h4 {
        margin-bottom: 8px;
      }
      .openai-hint-card p {
        color: var(--text-secondary);
        line-height: 1.6;
        font-size: var(--font-size-sm);
      }
      .openai-side-card {
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .openai-side-card .btn {
        width: 100%;
        justify-content: center;
      }
      .openai-mini-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .openai-mini-item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: var(--font-size-sm);
      }
      .openai-mini-item span:first-child {
        color: var(--text-tertiary);
      }
      .openai-mini-item span:last-child {
        color: var(--text-primary);
        text-align: right;
        word-break: break-word;
      }
      .openai-advanced details {
        border: 1px solid var(--border-secondary);
        border-radius: var(--radius-md);
        background: var(--bg-primary);
        padding: 12px 14px;
      }
      .openai-advanced summary {
        cursor: pointer;
        font-weight: 600;
      }
      .openai-advanced .openai-mini-list {
        margin-top: 12px;
      }
      .openai-test-layout {
        height: 100%;
        min-height: 0;
        display: grid;
        grid-template-columns: 300px minmax(0, 1fr);
        gap: var(--space-lg);
      }
      .openai-test-card {
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .openai-kv-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .openai-kv {
        padding: 12px 14px;
        border-radius: var(--radius-md);
        background: var(--bg-primary);
        border: 1px solid var(--border-secondary);
      }
      .openai-kv-label {
        color: var(--text-tertiary);
        font-size: var(--font-size-sm);
        margin-bottom: 6px;
      }
      .openai-kv-value {
        color: var(--text-primary);
        font-family: var(--font-mono);
        line-height: 1.5;
        word-break: break-all;
      }
      .openai-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .openai-actions .btn svg {
        vertical-align: -2px;
      }
      .openai-examples {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .openai-example-btn {
        width: 100%;
        text-align: left;
        padding: 12px 14px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-secondary);
        background: var(--bg-primary);
        color: var(--text-primary);
        transition: border-color var(--transition-fast), background var(--transition-fast);
      }
      .openai-example-btn:hover {
        border-color: var(--accent);
        background: var(--bg-card-hover);
      }
      .openai-chat-shell {
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: var(--radius-xl);
        border: 1px solid var(--border-primary);
        background: linear-gradient(180deg, rgba(255, 252, 246, 0.96), rgba(244, 239, 230, 0.96));
        box-shadow: var(--shadow-sm);
      }
      .openai-chat-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 20px 14px;
        border-bottom: 1px solid var(--border-secondary);
      }
      .openai-chat-header h3 {
        font-size: 22px;
        margin-bottom: 6px;
      }
      .openai-chat-header p {
        color: var(--text-secondary);
      }
      .openai-chat-shortcuts {
        font-size: var(--font-size-sm);
        color: var(--text-tertiary);
        white-space: nowrap;
      }
      .openai-chat-main {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .openai-chat-main .chat-messages {
        background:
          radial-gradient(circle at top right, rgba(15, 118, 110, 0.08), transparent 24%),
          radial-gradient(circle at left 20%, rgba(201, 119, 50, 0.08), transparent 20%),
          transparent;
      }
      .openai-chat-main .msg-meta {
        font-size: 12px;
        color: var(--text-tertiary);
        margin-bottom: 6px;
        padding: 0 6px;
      }
      .openai-chat-main .msg-user .msg-meta {
        text-align: right;
      }
      .openai-chat-main .msg-ai.error .msg-bubble {
        border: 1px solid rgba(199, 77, 59, 0.2);
        background: var(--error-muted);
      }
      .openai-chat-footer {
        padding: 10px 18px 14px;
        border-top: 1px solid var(--border-secondary);
        color: var(--text-tertiary);
        font-size: 12px;
      }
      @media (max-width: 1160px) {
        .openai-page {
          height: auto;
          overflow: visible;
        }
        .openai-simple-layout,
        .openai-test-layout,
        .openai-steps {
          grid-template-columns: 1fr;
        }
        .openai-chat-shell {
          height: 680px;
        }
      }
      @media (max-width: 720px) {
        .openai-status-row {
          width: 100%;
        }
        .openai-copy-item {
          grid-template-columns: 1fr;
        }
        .openai-chat-header {
          flex-direction: column;
        }
        .openai-chat-shortcuts {
          white-space: normal;
        }
      }
    </style>

    <div class="openai-shell">
      <div class="openai-hero">
        <div class="openai-hero-copy">
          <h1>服务能力</h1>
          <p>这一页只做两件事：告诉你怎么把 LinClaw 接到灵矽，以及让你像用 ChatGPT 一样直接测试这个 OpenAI 接口。</p>
        </div>
        <div class="openai-status-row" id="openai-status-row">
          <div class="openai-status-chip">加载中...</div>
        </div>
      </div>

      <div class="tab-bar" id="openai-tab-bar">
        <div class="tab" data-tab="config">灵矽接入</div>
        <div class="tab" data-tab="test">聊天测试</div>
      </div>

      <section class="openai-panel" data-panel="config">
        <div class="openai-simple-layout">
          <div class="openai-quickstart" id="openai-quickstart-panel">
            <div class="config-section"><div class="stat-card loading-placeholder" style="height:420px"></div></div>
          </div>
          <div class="openai-side-card" id="openai-side-panel">
            <div class="config-section"><div class="stat-card loading-placeholder" style="height:260px"></div></div>
          </div>
        </div>
      </section>

      <section class="openai-panel" data-panel="test">
        <div class="openai-test-layout">
          <div class="openai-test-card" id="openai-test-panel">
            <div class="config-section"><div class="stat-card loading-placeholder" style="height:320px"></div></div>
          </div>

          <div class="openai-chat-shell">
            <div class="openai-chat-header">
              <div>
                <h3>聊天测试</h3>
                <p>不会配也没关系，先在这里发一句话，确认接口能正常回复。</p>
              </div>
              <div class="openai-chat-shortcuts">回车发送，Shift+Enter 换行</div>
            </div>
            <div class="openai-chat-main">
              <div class="chat-messages" id="openai-chat-messages"></div>
              <div class="chat-input-area">
                <div class="chat-input-wrapper">
                  <textarea id="openai-chat-input" rows="1" placeholder="输入一句话，比如：你好，小龙虾。"></textarea>
                </div>
                <button class="chat-send-btn" id="openai-chat-send" disabled title="发送">
                  ${icon('send', 18)}
                </button>
              </div>
            </div>
            <div class="openai-chat-footer" id="openai-chat-footer">会话只保存在当前页面，用来快速验证接口是否正常。</div>
          </div>
        </div>
      </section>
    </div>
  `

  _page = page
  _messages = []

  bindEvents(page)
  switchTab(_activeTab)
  renderMessages()
  await loadStatus()
  return page
}

export function cleanup() {
  stopStreaming(false)
  _page = null
  _status = null
  _messages = []
}

function bindEvents(page) {
  page.querySelectorAll('#openai-tab-bar .tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab))
  })

  page.querySelector('#openai-chat-input')?.addEventListener('input', (event) => {
    autoResizeTextarea(event.target)
    syncSendButton()
  })

  page.querySelector('#openai-chat-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  })

  page.querySelector('#openai-chat-send')?.addEventListener('click', () => {
    if (_isStreaming) {
      stopStreaming(true)
      return
    }
    void sendMessage()
  })
}

async function loadStatus(showToast = false) {
  if (!_page) return
  try {
    const status = await api.getStatus()
    if (!_page) return
    _status = status
    renderStatusRow()
    renderQuickstartPanel()
    renderSidePanel()
    renderTestPanel()
    renderMessages()
    syncSendButton()
    if (showToast) toast('OpenAI 协议状态已刷新', 'success')
  } catch (error) {
    const message = error?.message || String(error)
    renderErrorState(message)
    if (showToast) toast(`刷新失败: ${message}`, 'error')
  }
}

function renderStatusRow() {
  const target = _page?.querySelector('#openai-status-row')
  if (!target) return

  target.innerHTML = `
    <div class="openai-status-chip">${statusDot(_status?.enabled)} ${_status?.enabled ? '默认已启用' : '未启用'}</div>
    <div class="openai-status-chip">Base URL: <code>${escapeHtml(getBaseUrl())}</code></div>
    <div class="openai-status-chip">模型: <code>${escapeHtml(getModelId())}</code></div>
  `
}

function renderQuickstartPanel() {
  const target = _page?.querySelector('#openai-quickstart-panel')
  if (!target) return

  const assistantName = _status?.assistantName || DEFAULT_ASSISTANT_NAME
  const baseUrl = getBaseUrl()
  const interfaceType = _status?.interfaceType || 'OpenAI 接口'
  const apiKey = _status?.apiKey || ''

  target.innerHTML = `
    <div class="config-section">
      <div class="config-section-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <span>一步步接到灵矽</span>
        <button class="btn btn-secondary btn-sm" id="openai-refresh-status">${icon('refresh-cw', 14)} 刷新</button>
      </div>

      <div class="openai-guide-card">
        <h3>把 LinClaw 接成灵矽里的一个 OpenAI 模型</h3>
        <p>你只需要在灵矽平台新建一个模型，然后把下面这 4 个字段复制过去。LinClaw 对外只暴露一个固定模型入口，背后统一由 ${escapeHtml(assistantName)} 承接。</p>
      </div>

      <div class="openai-steps">
        ${renderStep(1, '打开灵矽的「我的模型」', '进入灵矽平台，新增一个自定义模型。')}
        ${renderStep(2, '接口类型选 OpenAI', '不用多想，接口类型就选 OpenAI 接口。')}
        ${renderStep(3, '复制下面 4 个字段', '把 Base URL、模型名、API Key 粘贴进去，保存即可。')}
      </div>

      <div class="openai-copy-list" style="margin-top:var(--space-md)">
        ${copyItem('名称', `LinClaw ${assistantName}`, `LinClaw ${assistantName}`, false, 'copy-name')}
        ${copyItem('接口类型', interfaceType, interfaceType, false, 'copy-interface')}
        ${copyItem('Base URL', baseUrl, baseUrl, true, 'copy-base')}
        ${copyItem('模型', getModelId(), getModelId(), true, 'copy-model')}
      </div>

      <div class="openai-api-editor" style="margin-top:var(--space-md)">
        <div class="openai-copy-label" style="margin-bottom:8px">API Key</div>
        <input class="form-input" id="openai-api-key-input" value="${escapeHtml(apiKey)}" placeholder="请输入新的 API Key">
        <div class="form-hint" style="margin-top:8px">这里可以直接修改 API Key。保存后，灵矽侧要同步更新成新的值。</div>
        <div class="openai-inline-actions">
          <button class="btn btn-primary btn-sm" id="openai-save-api-key">${icon('check', 14)} 保存 API Key</button>
          <button class="btn btn-secondary btn-sm" id="openai-regenerate-api-key">${icon('refresh-cw', 14)} 重新生成</button>
          <button class="btn btn-secondary btn-sm" id="openai-copy-api-key">${icon('clipboard', 14)} 复制 API Key</button>
        </div>
      </div>
    </div>
  `

  target.querySelector('#openai-refresh-status')?.addEventListener('click', () => void loadStatus(true))
  target.querySelector('#openai-save-api-key')?.addEventListener('click', () => void saveApiKey())
  target.querySelector('#openai-regenerate-api-key')?.addEventListener('click', () => {
    const input = target.querySelector('#openai-api-key-input')
    if (!input) return
    input.value = generateApiKey()
  })
  target.querySelector('#openai-copy-api-key')?.addEventListener('click', () => {
    const input = target.querySelector('#openai-api-key-input')
    void copyText(input?.value || '', 'API Key')
  })
  bindCopyButtons(target)
}

function renderSidePanel() {
  const target = _page?.querySelector('#openai-side-panel')
  if (!target) return

  const runtime = _status?.runtime || {}
  const upstream = _status?.upstream || {}

  target.innerHTML = `
    <div class="config-section">
      <div class="config-section-title">遇到问题先看这里</div>
      <div class="openai-hint-card">
        <h4>${upstream.ready ? '现在可以直接用了' : '还差一步模型配置'}</h4>
        <p>${upstream.ready
          ? '如果灵矽里已经填好了参数，建议切到「聊天测试」先问一句“你好”，确认接口工作正常。'
          : 'OpenAI 协议已经默认开启，但上游模型还没准备好。先去模型配置页把七牛云 API Key 和默认模型填好。'}</p>
      </div>
      <div class="openai-actions">
        <button class="btn btn-primary" id="openai-open-models">${icon('box', 14)} 打开模型配置</button>
        <button class="btn btn-secondary" id="openai-switch-test">${icon('message-square', 14)} 去聊天测试</button>
      </div>
    </div>

    <div class="config-section openai-advanced">
      <details>
        <summary>高级信息</summary>
        <div class="openai-mini-list">
          ${miniItem('当前状态', _status?.enabled ? '已启用' : '未启用')}
          ${miniItem('当前占用', runtime.active ? '处理中' : '空闲')}
          ${miniItem('最近请求', formatTime(runtime.lastRequestAt))}
          ${miniItem('请求 ID', runtime.requestId || '暂无')}
          ${miniItem('上游模型', upstream.model || '未配置')}
          ${miniItem('最近错误', runtime.lastError || '暂无')}
        </div>
      </details>
    </div>
  `

  target.querySelector('#openai-open-models')?.addEventListener('click', () => navigate('/models'))
  target.querySelector('#openai-switch-test')?.addEventListener('click', () => switchTab('test'))
}

function renderTestPanel() {
  const target = _page?.querySelector('#openai-test-panel')
  if (!target) return

  const baseUrl = getBaseUrl()
  const apiKey = _status?.apiKey || ''

  target.innerHTML = `
    <div class="config-section">
      <div class="config-section-title">测试前只看这三项</div>
      <div class="form-hint" style="margin-bottom:var(--space-md)">Base URL 会按你当前访问的 IP 或域名自动生成。</div>
      <div class="openai-kv-list">
        ${kvItem('Base URL', baseUrl)}
        ${kvItem('模型', getModelId())}
        ${kvItem('API Key', apiKey)}
      </div>

      <div class="openai-actions" style="margin-top:var(--space-md)">
        <button class="btn btn-secondary" id="openai-copy-curl">${icon('clipboard', 14)} 复制 curl</button>
        <button class="btn btn-secondary" id="openai-clear-chat">${icon('refresh-cw', 14)} 清空会话</button>
        <button class="btn btn-secondary" id="openai-refresh-test">${icon('refresh-cw', 14)} 刷新状态</button>
      </div>
    </div>

    <div class="config-section">
      <div class="config-section-title">不知道问什么？点一下就能试</div>
      <div class="openai-examples">
        ${EXAMPLE_PROMPTS.map((prompt, index) => `
          <button class="openai-example-btn" data-example-index="${index}">${escapeHtml(prompt)}</button>
        `).join('')}
      </div>
      <div class="form-hint" style="margin-top:var(--space-md)">
        当前接口状态：${_status?.upstream?.ready ? '已就绪，可以直接聊天。' : '上游模型未配置，先去模型配置页完成设置。'}
      </div>
    </div>
  `

  target.querySelector('#openai-copy-curl')?.addEventListener('click', () => {
    void copyText(buildCurl(getSuggestedPrompt()), 'curl 命令')
  })
  target.querySelector('#openai-clear-chat')?.addEventListener('click', () => {
    _messages = []
    renderMessages()
    toast('测试会话已清空', 'success')
  })
  target.querySelector('#openai-refresh-test')?.addEventListener('click', () => void loadStatus(true))
  target.querySelectorAll('[data-example-index]').forEach((button) => {
    button.addEventListener('click', () => fillPrompt(EXAMPLE_PROMPTS[Number(button.dataset.exampleIndex)] || ''))
  })
}

function renderMessages() {
  const target = _page?.querySelector('#openai-chat-messages')
  const footer = _page?.querySelector('#openai-chat-footer')
  if (!target) return

  const assistantName = _status?.assistantName || DEFAULT_ASSISTANT_NAME
  const displayMessages = _messages.length
    ? _messages
    : [{
        role: 'assistant',
        content: `你好，我是${assistantName}。你可以直接在这里测试当前 LinClaw 对外开放的 OpenAI 接口。不会配参数也没关系，左边随便点一个示例问题就能开始。`,
      }]

  target.innerHTML = displayMessages.map((message) => renderMessageBubble(message, assistantName)).join('')
  if (footer) {
    footer.textContent = _status?.upstream?.ready
      ? `当前测试地址：${getBaseUrl()}/chat/completions`
      : '当前上游模型还没就绪，先去模型配置页完成设置。'
  }

  requestAnimationFrame(() => {
    target.scrollTop = target.scrollHeight
  })
}

function renderMessageBubble(message, assistantName) {
  const isUser = message.role === 'user'
  const roleClass = isUser ? 'msg-user' : 'msg-ai'
  const errorClass = message.error ? ' error' : ''
  const meta = isUser ? '你' : assistantName
  const body = isUser
    ? escapeHtml(message.content || '').replace(/\n/g, '<br>')
    : renderMarkdown(message.content || '')
  const bubbleContent = !body && message.streaming
    ? '<p style="color:var(--text-tertiary)">正在响应...</p>'
    : (body || '<p style="color:var(--text-tertiary)">已停止响应。</p>')

  return `
    <div class="msg ${roleClass}${errorClass}">
      <div class="msg-meta">${escapeHtml(meta)}</div>
      <div class="msg-bubble">
        ${bubbleContent}
        ${message.streaming ? '<span class="stream-cursor"></span>' : ''}
      </div>
    </div>
  `
}

async function sendMessage() {
  if (_isStreaming || !_page) return

  const textarea = _page.querySelector('#openai-chat-input')
  const prompt = textarea?.value?.trim() || ''
  if (!prompt) return

  if (!_status) {
    await loadStatus()
  }
  if (!_status?.enabled) {
    toast('OpenAI 协议当前未启用', 'warning')
    return
  }
  if (!_status?.upstream?.ready) {
    toast('上游模型还没配置完成，请先去模型配置页', 'warning')
    navigate('/models')
    return
  }

  const history = _messages
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({ role: item.role, content: item.content }))
  const userMessage = { role: 'user', content: prompt }
  const assistantMessage = { role: 'assistant', content: '', streaming: true }

  _messages.push(userMessage, assistantMessage)
  _isStreaming = true
  _abortController = new AbortController()

  textarea.value = ''
  autoResizeTextarea(textarea)
  renderMessages()
  syncSendButton()

  try {
    const response = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${_status?.apiKey || ''}`,
      },
      body: JSON.stringify({
        model: getModelId(),
        stream: true,
        messages: [...history, userMessage],
      }),
      signal: _abortController.signal,
    })

    if (!response.ok) {
      throw new Error(await readOpenAIError(response))
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
      await readSSEStream(response, (event) => {
        const chunk = extractChunkText(event)
        if (!chunk) return
        assistantMessage.content += chunk
        renderMessages()
      }, _abortController.signal)
    } else {
      const payload = await response.json()
      assistantMessage.content = extractMessageText(payload) || '收到空响应'
    }

    if (!assistantMessage.content.trim()) {
      assistantMessage.content = '已收到响应，但返回内容为空。'
    }
  } catch (error) {
    if (_abortController?.signal?.aborted || error?.name === 'AbortError') {
      if (!assistantMessage.content.trim()) {
        assistantMessage.content = '已停止响应。'
      }
    } else {
      assistantMessage.error = true
      assistantMessage.content = error?.message || String(error)
      toast(`接口测试失败: ${assistantMessage.content}`, 'error')
    }
  } finally {
    assistantMessage.streaming = false
    _isStreaming = false
    _abortController = null
    renderMessages()
    syncSendButton()
    void loadStatus()
  }
}

function stopStreaming(showToast = true) {
  if (_abortController) {
    _abortController.abort()
    _abortController = null
  }
  _isStreaming = false
  syncSendButton()
  if (showToast) toast('已停止生成', 'info')
}

function switchTab(tab) {
  _activeTab = tab === 'test' ? 'test' : 'config'
  try {
    localStorage.setItem(TAB_STORAGE_KEY, _activeTab)
  } catch {}

  if (!_page) return
  _page.querySelectorAll('#openai-tab-bar .tab').forEach((node) => {
    node.classList.toggle('active', node.dataset.tab === _activeTab)
  })
  _page.querySelectorAll('.openai-panel').forEach((node) => {
    node.classList.toggle('active', node.dataset.panel === _activeTab)
  })
}

function syncSendButton() {
  const textarea = _page?.querySelector('#openai-chat-input')
  const button = _page?.querySelector('#openai-chat-send')
  if (!textarea || !button) return

  const canSend = textarea.value.trim() !== ''
  button.disabled = !_isStreaming && !canSend
  button.title = _isStreaming ? '停止生成' : '发送'
  button.innerHTML = _isStreaming ? icon('stop', 18) : icon('send', 18)
}

function renderErrorState(message) {
  const configPanel = _page?.querySelector('#openai-quickstart-panel')
  const sidePanel = _page?.querySelector('#openai-side-panel')
  const testPanel = _page?.querySelector('#openai-test-panel')
  const statusRow = _page?.querySelector('#openai-status-row')

  if (statusRow) {
    statusRow.innerHTML = `<div class="openai-status-chip" style="color:var(--error)">加载失败：${escapeHtml(message)}</div>`
  }
  ;[configPanel, sidePanel, testPanel].forEach((panel) => {
    if (panel) {
      panel.innerHTML = `<div class="config-section"><div class="config-section-title">状态异常</div><div style="color:var(--error)">加载失败：${escapeHtml(message)}</div></div>`
    }
  })
}

function copyItem(label, value, copyValue, mono, copyId) {
  return `
    <div class="openai-copy-item">
      <div class="openai-copy-label">${escapeHtml(label)}</div>
      <div class="openai-copy-value${mono ? ' mono' : ''}">${escapeHtml(value)}</div>
      <button class="btn btn-secondary btn-sm" data-copy-id="${escapeHtml(copyId)}" data-copy-value="${escapeHtml(copyValue)}">${icon('clipboard', 14)} 复制</button>
    </div>
  `
}

function renderStep(index, title, description) {
  return `
    <div class="openai-step">
      <div class="openai-step-index">${index}</div>
      <b>${escapeHtml(title)}</b>
      <p>${escapeHtml(description)}</p>
    </div>
  `
}

function miniItem(label, value) {
  return `
    <div class="openai-mini-item">
      <span>${escapeHtml(label)}</span>
      <span>${escapeHtml(value)}</span>
    </div>
  `
}

function kvItem(label, value) {
  return `
    <div class="openai-kv">
      <div class="openai-kv-label">${escapeHtml(label)}</div>
      <div class="openai-kv-value">${escapeHtml(value)}</div>
    </div>
  `
}

function bindCopyButtons(container) {
  container.querySelectorAll('[data-copy-id], [data-copy-value]').forEach((button) => {
    button.addEventListener('click', () => {
      const explicit = button.dataset.copyValue
      const copyId = button.dataset.copyId
      const resolved = explicit || getCopyValue(copyId)
      if (!resolved) {
        toast('没有可复制的内容', 'warning')
        return
      }
      void copyText(resolved, button.textContent.replace('复制', '').trim() || '内容')
    })
  })
}

function getCopyValue(copyId) {
  switch (copyId) {
    case 'copy-name':
      return `LinClaw ${_status?.assistantName || DEFAULT_ASSISTANT_NAME}`
    case 'copy-interface':
      return _status?.interfaceType || 'OpenAI 接口'
    case 'copy-base':
      return getBaseUrl()
    case 'copy-model':
      return getModelId()
    case 'copy-key':
      return _status?.apiKey || ''
    default:
      return ''
  }
}

async function copyText(value, label) {
  const text = String(value || '')
  if (!text) {
    toast(`${label}为空，无法复制`, 'warning')
    return
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const input = document.createElement('textarea')
      input.value = text
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    toast(`${label}已复制`, 'success')
  } catch {
    toast(`复制${label}失败`, 'error')
  }
}

async function saveApiKey() {
  const input = _page?.querySelector('#openai-api-key-input')
  const nextKey = String(input?.value || '').trim()
  if (!nextKey) {
    toast('API Key 不能为空', 'warning')
    return
  }

  try {
    const config = await api.readPanelConfig()
    const nextConfig = JSON.parse(JSON.stringify(config || {}))
    const openaiAdapter = { ...(nextConfig.openaiAdapter || {}) }
    openaiAdapter.enabled = true
    openaiAdapter.apiKey = nextKey
    nextConfig.openaiAdapter = openaiAdapter
    await api.writePanelConfig(nextConfig)
    toast('API Key 已保存', 'success')
    await loadStatus()
  } catch (error) {
    toast(`保存失败: ${error?.message || error}`, 'error')
  }
}

function buildCurl(prompt) {
  const payload = {
    model: getModelId(),
    messages: [{ role: 'user', content: prompt || '你好，小龙虾' }],
  }
  return [
    `curl ${getBaseUrl()}/chat/completions \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Authorization: Bearer ${_status?.apiKey || 'your-api-key'}" \\`,
    `  -d '${JSON.stringify(payload, null, 2)}'`,
  ].join('\n')
}

function fillPrompt(text) {
  const textarea = _page?.querySelector('#openai-chat-input')
  if (!textarea) return
  textarea.value = text
  autoResizeTextarea(textarea)
  syncSendButton()
  textarea.focus()
  switchTab('test')
}

function getSuggestedPrompt() {
  const textareaValue = _page?.querySelector('#openai-chat-input')?.value?.trim()
  if (textareaValue) return textareaValue
  const lastUser = [..._messages].reverse().find((item) => item.role === 'user')
  return lastUser?.content || '你好，小龙虾'
}

function getBaseUrl() {
  const basePath = String(_status?.basePath || '/v1').replace(/\/+$/, '')
  return `${window.location.protocol}//${window.location.host}${basePath}`
}

function getModelId() {
  return _status?.modelId || DEFAULT_MODEL_ID
}

function extractChunkText(event) {
  const delta = event?.choices?.[0]?.delta
  if (!delta) return ''
  if (typeof delta.content === 'string') return delta.content
  if (Array.isArray(delta.content)) return delta.content.map(extractTextLike).join('')
  if (delta.reasoning_content) return extractTextLike(delta.reasoning_content)
  return ''
}

function extractMessageText(payload) {
  const message = payload?.choices?.[0]?.message
  if (!message) return ''
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) return message.content.map(extractTextLike).join('')
  return extractTextLike(message.content)
}

function extractTextLike(value) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  if (typeof value.text === 'string') return value.text
  if (typeof value.content === 'string') return value.content
  return ''
}

async function readOpenAIError(response) {
  const text = await response.text().catch(() => '')
  if (!text) return `请求失败 (${response.status})`

  try {
    const payload = JSON.parse(text)
    return payload?.error?.message || payload?.message || `请求失败 (${response.status})`
  } catch {
    return text.length > 220 ? `${text.slice(0, 220)}...` : text
  }
}

async function readSSEStream(response, onEvent, signal) {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''
  const onAbort = () => {
    try { reader.cancel() } catch {}
  }

  if (signal) {
    if (signal.aborted) {
      try { reader.cancel() } catch {}
      throw new DOMException('Aborted', 'AbortError')
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('event:')) continue
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') return
        try {
          onEvent(JSON.parse(payload))
        } catch {}
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

function autoResizeTextarea(textarea) {
  if (!textarea) return
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
}

function formatTime(value) {
  if (!value) return '暂无'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN')
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statusDot(enabled) {
  return `<span class="status-dot ${enabled ? 'running' : 'stopped'}"></span>`
}

function generateApiKey() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return `linclaw_${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`
}

function loadActiveTab() {
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY)
    return stored === 'test' ? 'test' : 'config'
  } catch {
    return 'config'
  }
}
