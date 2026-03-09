import { createServer } from 'node:http'
import { handleEnvironmentRoutes } from './routes/environment.js'
import { handleInstallRoutes } from './routes/install.js'
import { handleSetupRoutes } from './routes/setup.js'
import { handleServiceRoutes } from './routes/service.js'
import { handleConfigRoutes } from './routes/config.js'
import { handleDiagnosticsRoutes } from './routes/diagnostics.js'
import { handleCommandRoutes } from './routes/commands.js'
import { sendJson, toJsonHeaders } from './utils/helpers.js'

const PORT = parseInt(process.env.OPEN_WIZARD_PORT ?? '3187', 10)
const HOST = process.env.OPEN_WIZARD_HOST?.trim() || '127.0.0.1'

const server = createServer(async (req, res) => {
  try {
    const method = req.method?.toUpperCase() ?? 'GET'

    if (method === 'OPTIONS') {
      res.writeHead(204, toJsonHeaders())
      res.end()
      return
    }

    if (method === 'GET' && req.url === '/api/health') {
      sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() })
      return
    }

    const handlers = [
      handleEnvironmentRoutes,
      handleInstallRoutes,
      handleSetupRoutes,
      handleServiceRoutes,
      handleConfigRoutes,
      handleDiagnosticsRoutes,
      handleCommandRoutes,
    ]

    for (const handler of handlers) {
      const handled = await handler(req, res, HOST, PORT)
      if (handled) return
    }

    sendJson(res, 404, {
      ok: false,
      error: `Not found: ${method} ${req.url}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[open-wizard] Error:', message)
    sendJson(res, 500, { ok: false, error: message })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[open-wizard] Backend running at http://${HOST}:${PORT}`)
})
