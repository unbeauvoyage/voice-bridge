/**
 * GET /agents — list agents known to the relay.
 *
 * Relay-required: any failure (timeout, fetch throw, non-OK status, or
 * schema-invalid body) returns HTTP 502 with body { error: string, detail?: string }.
 * There is no fallback source — relay is the single authoritative source.
 */

import { z } from 'zod'
import { RELAY_TIMEOUT_MS } from '../config.ts'

// ─── Route handler ────────────────────────────────────────────────────────────

export type AgentsContext = {
  relayBaseUrl: string
  fetchFn: typeof fetch
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

// Relay /agents payload: an object with an `agents` array whose entries are
// either plain strings (canonical agent names) or objects carrying at least
// a `name` field. Anything else is treated as relay-broken.
const RelayAgentsSchema = z.object({
  agents: z.array(z.union([z.string(), z.object({ name: z.string() }).loose()]))
})

export async function handleAgents(_req: Request, ctx: AgentsContext): Promise<Response> {
  try {
    const relayRes = await ctx.fetchFn(`${ctx.relayBaseUrl}/agents`, {
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS)
    })
    if (!relayRes.ok) {
      return Response.json(
        { error: `Relay returned ${relayRes.status}` },
        { status: 502, headers: CORS_HEADERS }
      )
    }
    let raw: unknown
    try {
      raw = await relayRes.json()
    } catch {
      return Response.json(
        { error: 'Relay returned invalid JSON' },
        { status: 502, headers: CORS_HEADERS }
      )
    }
    const parsed = RelayAgentsSchema.safeParse(raw)
    if (!parsed.success) {
      return Response.json(
        { error: 'Relay response failed schema validation', detail: parsed.error.message },
        { status: 502, headers: CORS_HEADERS }
      )
    }
    return Response.json(parsed.data, { headers: CORS_HEADERS })
  } catch (err) {
    return Response.json(
      { error: 'Relay unavailable', detail: String(err) },
      { status: 502, headers: CORS_HEADERS }
    )
  }
}
