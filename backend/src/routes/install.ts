import type { IncomingMessage, ServerResponse } from 'node:http'
import { installOpenClaw, getInstallStatus, getInstallMeta } from '../services/InstallerService.js'
import { sendJson, parseUrl } from '../utils/helpers.js'

export async function handleInstallRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  host: string,
  port: number
): Promise<boolean> {
  const method = req.method?.toUpperCase() ?? 'GET'
  const url = parseUrl(req, host, port)

  if (method === 'GET' && url.pathname === '/api/install/openclaw') {
    await installOpenClaw(res)
    return true
  }

  if (method === 'GET' && url.pathname === '/api/install/status') {
    sendJson(res, 200, getInstallStatus())
    return true
  }

  if (method === 'GET' && url.pathname === '/api/install/meta') {
    sendJson(res, 200, getInstallMeta())
    return true
  }

  return false
}
