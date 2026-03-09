import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getOpenClawCommands,
  executeOpenClawCommand,
} from '../services/OpenClawCommandService.js'
import { asRecord, parseUrl, readJsonBody, sendJson } from '../utils/helpers.js'

export async function handleCommandRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  host: string,
  port: number
): Promise<boolean> {
  const method = req.method?.toUpperCase() ?? 'GET'
  const url = parseUrl(req, host, port)

  if (method === 'GET' && url.pathname === '/api/openclaw/commands') {
    sendJson(res, 200, getOpenClawCommands())
    return true
  }

  if (method === 'POST' && url.pathname === '/api/openclaw/commands/execute') {
    const body = await readJsonBody(req)
    const commandId = typeof body.commandId === 'string' ? body.commandId.trim() : ''
    if (!commandId) {
      sendJson(res, 400, { ok: false, error: 'commandId is required' })
      return true
    }

    const timeoutMs = typeof body.timeoutMs === 'number' ? body.timeoutMs : undefined
    const result = await executeOpenClawCommand({
      commandId,
      parameters: asRecord(body.parameters),
      timeoutMs,
    })

    sendJson(res, 200, result)
    return true
  }

  return false
}
