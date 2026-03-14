import { registerRoute } from '../router.js'

const pageRoutes = [
  ['/dashboard', () => import('../pages/dashboard.js')],
  ['/chat', () => import('../pages/chat.js')],
  ['/chat-debug', () => import('../pages/chat-debug.js')],
  ['/services', () => import('../pages/services.js')],
  ['/logs', () => import('../pages/logs.js')],
  ['/models', () => import('../pages/models.js')],
  ['/agents', () => import('../pages/agents.js')],
  ['/gateway', () => import('../pages/gateway.js')],
  ['/memory', () => import('../pages/memory.js')],
  ['/skills', () => import('../pages/skills.js')],
  ['/security', () => import('../pages/security.js')],
  ['/about', () => import('../pages/about.js')],
  ['/assistant', () => import('../pages/assistant.js')],
  ['/setup', () => import('../pages/setup.js')],
  ['/qiniu-setup', () => import('../pages/qiniu-setup.js')],
  ['/channels', () => import('../pages/channels.js')],
  ['/cron', () => import('../pages/cron.js')],
]

export function registerAppRoutes() {
  for (const [path, loader] of pageRoutes) {
    registerRoute(path, loader)
  }
}
