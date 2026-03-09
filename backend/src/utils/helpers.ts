import type { IncomingMessage, ServerResponse } from 'node:http'

export function toJsonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export function toSSEHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  }
}

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  res.writeHead(statusCode, toJsonHeaders())
  res.end(JSON.stringify(payload))
}

export function sendSSE(res: ServerResponse, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export async function readJsonBody(
  req: IncomingMessage
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  if (chunks.length === 0) return {}

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as unknown
    return asRecord(parsed)
  } catch {
    throw new Error('Invalid JSON body')
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function parseUrl(req: IncomingMessage, host: string, port: number): URL {
  const reqHost = req.headers.host ?? `${host}:${port}`
  return new URL(req.url ?? '/', `http://${reqHost}`)
}
