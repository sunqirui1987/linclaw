import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getSetupState,
  getCurrentConfig,
  validateApiKey,
  listModels,
  completeSetup,
} from '../services/ConfigService.js'
import { startGateway } from '../services/GatewayService.js'
import { sendJson, readJsonBody, parseUrl } from '../utils/helpers.js'

export async function handleSetupRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  host: string,
  port: number
): Promise<boolean> {
  const method = req.method?.toUpperCase() ?? 'GET'
  const url = parseUrl(req, host, port)

  if (method === 'GET' && url.pathname === '/api/setup/state') {
    sendJson(res, 200, getSetupState())
    return true
  }

  if (method === 'GET' && url.pathname === '/api/setup/current-config') {
    sendJson(res, 200, getCurrentConfig())
    return true
  }

  if (method === 'POST' && url.pathname === '/api/setup/validate-api-key') {
    const body = await readJsonBody(req)
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : ''
    const valid = await validateApiKey(apiKey)
    sendJson(res, 200, { valid })
    return true
  }

  if (method === 'GET' && url.pathname === '/api/setup/models') {
    const apiKey = url.searchParams.get('apiKey') || undefined
    const models = await listModels(apiKey)
    sendJson(res, 200, models)
    return true
  }

  if (method === 'POST' && url.pathname === '/api/setup/complete') {
    const body = await readJsonBody(req)
    const token = await completeSetup({
      workspace: typeof body.workspace === 'string' ? body.workspace : undefined,
      modelRef: typeof body.modelRef === 'string' ? body.modelRef : undefined,
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
    })

    const result = await startGateway()
    sendJson(res, 200, {
      ok: result.ok,
      gatewayUrl: result.gatewayUrl,
      token,
    })
    return true
  }

  return false
}
