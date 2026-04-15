/**
 * GET /agents?source=relay|workspaces|auto — list available agents.
 *
 * Source resolution:
 * - `workspaces` → skip relay entirely, return cmux workspace names
 * - `relay` → relay is the authoritative source; any failure (throw OR
 *   non-ok) returns an explicit error body so callers can distinguish
 *   relay-healthy from relay-broken. Never silently substitutes cmux data.
 * - `auto` (default) → try relay first; on any failure (throw or non-ok)
 *   fall back to cmux workspace names
 */

import { RELAY_TIMEOUT_MS } from '../config.ts'

export type AgentsContext = {
  relayBaseUrl: string
  listWorkspaceNames: () => string[]
  fetchFn: typeof fetch
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

export async function handleAgents(req: Request, ctx: AgentsContext): Promise<Response> {
  const url = new URL(req.url)
  const source = url.searchParams.get('source') ?? 'auto'

  if (source !== 'workspaces') {
    try {
      const relayRes = await ctx.fetchFn(`${ctx.relayBaseUrl}/agents`, {
        signal: AbortSignal.timeout(RELAY_TIMEOUT_MS)
      })
      if (relayRes.ok) {
        const data: unknown = await relayRes.json()
        return Response.json(data, { headers: CORS_HEADERS })
      }
      if (source === 'relay') {
        return Response.json(
          { agents: [], error: `Relay returned ${relayRes.status}` },
          { headers: CORS_HEADERS }
        )
      }
      // auto mode: fall through to cmux
    } catch {
      if (source === 'relay') {
        return Response.json({ agents: [], error: 'Relay unavailable' }, { headers: CORS_HEADERS })
      }
      // auto mode: fall through to cmux
    }
  }

  const agents = ctx.listWorkspaceNames()
  return Response.json({ agents }, { headers: CORS_HEADERS })
}
