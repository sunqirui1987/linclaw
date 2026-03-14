import { featureServices } from '../lib/api/feature-services.js'
import { isGatewayRunning, isOpenclawReady } from '../lib/app-state.js'
import { findGatewayService } from '../lib/service-status.js'
import { wsClient } from '../lib/ws-client.js'

export function startAIDrawerBootstrap() {
  setTimeout(async () => {
    const { initAIFab, registerPageContext, openAIDrawerWithError } = await import('../components/ai-drawer.js')

    initAIFab()

    registerPageContext('/chat-debug', async () => {
      const lines = ['## 系统诊断快照']
      lines.push(`- OpenClaw: ${isOpenclawReady() ? '就绪' : '未就绪'}`)
      lines.push(`- Gateway: ${isGatewayRunning() ? '运行中' : '未运行'}`)
      lines.push(`- WebSocket: ${wsClient.connected ? '已连接' : '未连接'}`)

      try {
        const node = await featureServices.environment.checkNode()
        lines.push(`- Node.js: ${node?.version || '未知'}`)
      } catch {}

      try {
        const version = await featureServices.config.getVersionInfo()
        lines.push(`- 版本: ${version?.current || '?'} → ${version?.latest || '?'}`)
      } catch {}

      return { detail: lines.join('\n') }
    })

    registerPageContext('/services', async () => {
      const lines = ['## 服务状态']
      lines.push(`- Gateway: ${isGatewayRunning() ? '运行中' : '未运行'}`)
      try {
        const services = await featureServices.service.getServicesStatus()
        const gateway = findGatewayService(services)
        if (gateway) {
          lines.push(`- CLI: ${gateway.cli_installed ? '已安装' : '未安装'}`)
          lines.push(`- PID: ${gateway.pid || '无'}`)
        }
      } catch {}
      return { detail: lines.join('\n') }
    })

    registerPageContext('/gateway', async () => {
      try {
        const config = await featureServices.config.readOpenclawConfig()
        const gateway = config?.gateway || {}
        const lines = ['## Gateway 配置']
        lines.push(`- 端口: ${gateway.port || 18789}`)
        lines.push(`- 模式: ${gateway.mode || 'local'}`)
        lines.push(`- Token: ${gateway.auth?.token ? '已设置' : '未设置'}`)
        if (gateway.controlUi?.allowedOrigins) lines.push(`- Origins: ${JSON.stringify(gateway.controlUi.allowedOrigins)}`)
        return { detail: lines.join('\n') }
      } catch {
        return null
      }
    })

    registerPageContext('/setup', () => ({
      detail: '用户正在进行 OpenClaw 初始安装，请帮助检查 Node.js 环境和网络状况',
    }))

    window.__openAIDrawerWithError = openAIDrawerWithError
  }, 500)
}
