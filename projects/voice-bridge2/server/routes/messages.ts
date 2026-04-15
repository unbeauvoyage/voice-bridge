/**
 * GET /messages?agent=<name> — proxies relay GET /messages/:agent
 *
 * Thin proxy: forwards to the relay's messages endpoint and returns the JSON
 * body. On any failure (network, non-2xx, timeout) returns 502 with a structured
 * error body so the caller can distinguish "relay down" from "bad request".
 */

import { RELAY_TIMEOUT_MS } from '../config.ts'

export type MessagesContext = {
  relayBaseUrl: string
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

export async function handleMessages(req: Request, ctx: MessagesContext): Promise<Response> {
  const url = new URL(req.url)
  const agent = url.searchParams.get('agent') || 'command'

  try {
    const relayRes = await fetch(`${ctx.relayBaseUrl}/messages/${encodeURIComponent(agent)}`, {
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS)
    })

    if (!relayRes.ok) {
      const detail = await relayRes.text().catch(() => '')
      return Response.json(
        {
          error: 'Relay unavailable',
          agent,
          relayStatus: relayRes.status,
          detail: detail.slice(0, 200)
        },
        { status: 502, headers: CORS_HEADERS }
      )
    }

    const data = await relayRes.json()
    return Response.json(data, { headers: CORS_HEADERS })
  } catch (err) {
    console.warn('[relay] messages fetch failed:', err)
    return Response.json(
      {
        error: 'Relay unavailable',
        agent,
        detail: String(err)
      },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
