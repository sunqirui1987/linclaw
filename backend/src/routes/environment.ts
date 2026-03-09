import type { IncomingMessage, ServerResponse } from 'node:http'
import { checkEnvironment, getNodeInstallGuide } from '../services/EnvironmentService.js'
import { sendJson, parseUrl } from '../utils/helpers.js'

export async function handleEnvironmentRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  host: string,
  port: number
): Promise<boolean> {
  const method = req.method?.toUpperCase() ?? 'GET'
  const url = parseUrl(req, host, port)

  if (method === 'GET' && url.pathname === '/api/env/check') {
    const result = checkEnvironment()
    sendJson(res, 200, result)
    return true
  }

  if (method === 'GET' && url.pathname === '/api/env/node-install-guide') {
    const env = checkEnvironment()
    const guide = getNodeInstallGuide(env.os.platform)
    sendJson(res, 200, guide)
    return true
  }

  return false
}
