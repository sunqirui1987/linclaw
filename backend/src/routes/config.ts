import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getAIProviders,
  getCurrentConfig,
  saveApiKey,
  updateAIConfig,
  getChannels,
  isValidChannelId,
  updateChannel,
} from '../services/ConfigService.js'
import type { ChannelId } from '../types/index.js'
import { sendJson, readJsonBody, parseUrl, asRecord } from '../utils/helpers.js'

export async function handleConfigRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  host: string,
  port: number
): Promise<boolean> {
  const method = req.method?.toUpperCase() ?? 'GET'
  const url = parseUrl(req, host, port)

  if (method === 'GET' && url.pathname === '/api/config/ai') {
    const providers = getAIProviders()
    const config = getCurrentConfig()
    sendJson(res, 200, {
      providers,
      current: config.modelRef,
    })
    return true
  }

  if (method === 'GET' && url.pathname === '/api/config/ai/providers') {
    sendJson(res, 200, getAIProviders())
    return true
  }

  if (method === 'PUT' && url.pathname === '/api/config/ai') {
    const body = await readJsonBody(req)
    if (typeof body.apiKey === 'string') {
      saveApiKey(body.apiKey)
    }
    if (typeof body.model === 'string') {
      updateAIConfig({ modelRef: body.model })
    }
    sendJson(res, 200, { ok: true })
    return true
  }

  if (method === 'GET' && url.pathname === '/api/config/channels') {
    const channels = getChannels()
    sendJson(res, 200, channels)
    return true
  }

  const channelMatch = url.pathname.match(/^\/api\/config\/channels\/([a-z-]+)$/)
  if (channelMatch) {
    const channelIdParam = channelMatch[1]
    if (!isValidChannelId(channelIdParam)) {
      sendJson(res, 400, { ok: false, error: 'Invalid channel id' })
      return true
    }
    const channelId: ChannelId = channelIdParam

    if (method === 'GET') {
      const channels = getChannels()
      const channel = channels.find((c) => c.id === channelId)
      if (channel) {
        sendJson(res, 200, channel)
      } else {
        sendJson(res, 404, { ok: false, error: 'Channel not found' })
      }
      return true
    }

    if (method === 'PUT') {
      const body = await readJsonBody(req)
      updateChannel(channelId, {
        enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
        config: asRecord(body.config),
      })
      sendJson(res, 200, { ok: true })
      return true
    }
  }

  return false
}
