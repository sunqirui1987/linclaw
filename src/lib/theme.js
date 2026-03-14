/**
 * 主题管理（日间/夜间模式）
 */
const THEME_KEY = 'linclaw-theme'
const LEGACY_THEME_KEY = 'clawpanel-theme'

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY)
  const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  applyTheme(theme)
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme || 'light'
  const next = current === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}

export function getTheme() {
  return document.documentElement.dataset.theme || 'light'
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(THEME_KEY, theme)
  localStorage.removeItem(LEGACY_THEME_KEY)
}
