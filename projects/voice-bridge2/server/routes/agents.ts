/**
 * GET /agents?source=relay|workspaces|auto — list available agents.
 *
 * Source resolution:
 * - `workspaces` → skip relay entirely, return cmux workspace names
 * - `relay` → try relay first; if fetch throws, return empty-array error body;
 *   if relay returns a non-ok status, fall through to cmux (preserves the
 *   original handler's subtle behavior for 5xx from a live relay)
 * - `auto` (default) → try relay first; on any failure (throw or non-ok)
 *   fall back to cmux workspace names
 *
 * Behavior is preserved verbatim from the original index.ts block; this is
 * a pure refactor.
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
      // Non-ok relay response → fall through to cmux fallback below
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
