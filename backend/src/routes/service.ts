import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getServiceStatus,
  startGateway,
  stopGateway,
  restartGateway,
  streamLogs,
} from '../services/GatewayService.js'
import { sendJson, parseUrl } from '../utils/helpers.js'

export async function handleServiceRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  host: string,
  port: number
): Promise<boolean> {
  const method = req.method?.toUpperCase() ?? 'GET'
  const url = parseUrl(req, host, port)

  if (method === 'GET' && url.pathname === '/api/service/status') {
    const status = await getServiceStatus()
    sendJson(res, 200, status)
    return true
  }

  if (method === 'POST' && url.pathname === '/api/service/start') {
    const result = await startGateway()
    sendJson(res, 200, result)
    return true
  }

  if (method === 'POST' && url.pathname === '/api/service/stop') {
    const result = await stopGateway()
    sendJson(res, 200, result)
    return true
  }

  if (method === 'POST' && url.pathname === '/api/service/restart') {
    const result = await restartGateway()
    sendJson(res, 200, result)
    return true
  }

  if (method === 'GET' && url.pathname === '/api/service/logs') {
    streamLogs(res)
    return true
  }

  return false
}
