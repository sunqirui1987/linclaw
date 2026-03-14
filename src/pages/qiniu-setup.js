/**
 * 七牛云首次配置页
 * 当 QINIU_APIKEY、QINIU_MODEL 未配置时，登录后展示此页
 * 模型列表从 https://api.qnaigc.com/v1/models 拉取，无需 API Key
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

export async function render() {
  const page = document.createElement('div')
  page.className = 'page'

  page.innerHTML = `
    <div style="max-width:480px;margin:48px auto">
      <div style="text-align:center;margin-bottom:var(--space-xl)">
        <h1 style="font-size:var(--font-size-xl);margin-bottom:var(--space-xs)">配置七牛云 AI</h1>
        <p style="color:var(--text-secondary);font-size:var(--font-size-sm);line-height:1.6">
          首次使用需配置 API Key 和主模型，配置将保存到 <code>~/.openclaw/.env</code>
        </p>
      </div>

      <div class="config-section" style="margin-bottom:var(--space-lg)">
        <div class="form-group">
          <label class="form-label">七牛云 API Key</label>
          <input class="form-input" id="qiniu-setup-apikey" type="password" placeholder="sk-..." autocomplete="off">
          <div class="form-hint">
            <a href="${QINIU.apiKeyDocUrl}" target="_blank" rel="noopener" style="color:var(--primary)">获取 API Key</a>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">主模型</label>
          <select class="form-input" id="qiniu-setup-model">
            <option value="">加载中...</option>
          </select>
          <div class="form-hint">模型列表来自 <code>${QINIU.modelsUrl}</code>，无需 API Key 即可拉取</div>
        </div>
        <div style="display:flex;gap:12px;margin-top:var(--space-lg)">
          <button class="btn btn-primary" id="qiniu-setup-save">保存并继续</button>
          <a href="#/dashboard" class="btn btn-secondary" id="qiniu-setup-skip">稍后配置</a>
        </div>
      </div>

      <div style="text-align:center;font-size:var(--font-size-xs);color:var(--text-tertiary)">
        <a href="${QINIU.squareUrl}" target="_blank" rel="noopener">七牛云 AI 大模型广场</a>
      </div>
    </div>
  `

  const apiKeyInput = page.querySelector('#qiniu-setup-apikey')
  const modelSelect = page.querySelector('#qiniu-setup-model')
  const saveBtn = page.querySelector('#qiniu-setup-save')

  // 加载模型列表（无需 API Key）
  try {
    const modelIds = await api.listRemoteModels(QINIU.baseUrl, '', QINIU.api)
    modelSelect.innerHTML = '<option value="">请选择主模型</option>' +
      modelIds.map(id => `<option value="${id}">${id}</option>`).join('')
    if (modelIds.length > 0 && modelIds.includes('deepseek-v3')) {
      modelSelect.value = 'deepseek-v3'
    } else if (modelIds.length > 0) {
      modelSelect.value = modelIds[0]
    }
  } catch (e) {
    modelSelect.innerHTML = '<option value="">加载失败</option>'
    toast(`模型列表加载失败: ${e.message || e}`, 'error')
  }

  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim()
    const model = modelSelect.value?.trim()
    if (!model) {
      toast('请选择主模型', 'warning')
      return
    }
    saveBtn.disabled = true
    saveBtn.textContent = '保存中...'
    try {
      await api.saveQiniuEnv(apiKey, model)
      toast('配置已保存', 'success')
      navigate('/dashboard')
    } catch (e) {
      toast(e.message || '保存失败', 'error')
      saveBtn.disabled = false
      saveBtn.textContent = '保存并继续'
    }
  })

  // 稍后配置：设置 session 标记，避免重复跳转
  page.querySelector('#qiniu-setup-skip').addEventListener('click', (e) => {
    sessionStorage.setItem('linclaw_qiniu_setup_skipped', '1')
    sessionStorage.setItem('clawpanel_qiniu_setup_skipped', '1')
  })

  return page
}
