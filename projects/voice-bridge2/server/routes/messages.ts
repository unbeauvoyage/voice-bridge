/**
 * GET /messages?agent=<name> — proxies relay GET /messages/:agent
 *
 * Thin proxy: forwards to the relay's messages endpoint and returns the JSON
 * body. On any failure (network, non-2xx, timeout) returns 502 with a structured
 * error body so the caller can distinguish "relay down" from "bad request".
 *
 * Validations:
 *   - Agent name capped at 128 chars (400 if exceeded) — matches MAX_TO_LEN.
 *   - Relay response must be a JSON object or array (502 if not).
 */

import { RELAY_TIMEOUT_MS } from '../config.ts'

// Maximum agent name length — matches the MAX_TO_LEN convention from /transcribe.
const MAX_AGENT_LEN = 128

export type MessagesContext = {
  relayBaseUrl: string
  /** Injectable fetch for tests — defaults to global fetch. */
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

export async function handleMessages(req: Request, ctx: MessagesContext): Promise<Response> {
  const url = new URL(req.url)
  const agent = url.searchParams.get('agent') || 'command'

  // Cap agent name length to prevent relay URL bloat and match MAX_TO_LEN.
  if (agent.length > MAX_AGENT_LEN) {
    return Response.json(
      { error: `agent name too long (max ${MAX_AGENT_LEN} chars)`, agent: agent.slice(0, 32) + '...' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const fetchFn = ctx.fetchFn ?? fetch

  try {
    const relayRes = await fetchFn(`${ctx.relayBaseUrl}/messages/${encodeURIComponent(agent)}`, {
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

    const data: unknown = await relayRes.json()

    // Validate relay response shape — must be an object or array.
    // Forwarding a bare string, number, or null blindly could mask relay bugs.
    if (typeof data !== 'object' || data === null) {
      console.warn('[relay] unexpected relay response shape:', typeof data)
      return Response.json(
        { error: 'unexpected relay response shape', agent },
        { status: 502, headers: CORS_HEADERS }
      )
    }

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
