/**
 * GET /agents?source=relay|workspaces|auto — list available agents.
 *
 * Source resolution:
 * - `workspaces` → skip relay entirely, return cmux workspace names
 * - `relay` → relay is the authoritative source; any failure (throw, non-ok,
 *   OR schema-invalid body) returns an explicit error body so callers can
 *   distinguish relay-healthy from relay-broken. Never silently substitutes
 *   cmux data.
 * - `auto` (default) → try relay first; on any failure (throw, non-ok, or
 *   schema-invalid body) fall back to cmux workspace names.
 *
 * Boundary validation (Stage-4 codex findings agents.ts:25 + agents.ts:32
 * MED):
 *   - `source` query param is checked against a strict enum; unknown values
 *     return 400 instead of silently behaving like auto.
 *   - Relay response JSON is validated against RelayAgentsSchema before
 *     being returned to the caller. A 200 body like `{foo:1}` or
 *     `{agents:[123]}` is treated the same as relay being down.
 */

import { z } from 'zod'
import { RELAY_TIMEOUT_MS } from '../config.ts'
import { validationError } from './validation.ts'

export type AgentsContext = {
  relayBaseUrl: string
  listWorkspaceNames: () => string[]
  fetchFn: typeof fetch
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

const SourceSchema = z.enum(['relay', 'workspaces', 'auto'])

// Relay /agents payload: an object with an `agents` array whose entries are
// either plain strings (canonical agent names) or objects carrying at least
// a `name` field. Anything else is treated as relay-broken.
const RelayAgentsSchema = z.object({
  agents: z.array(z.union([z.string(), z.object({ name: z.string() }).passthrough()]))
})

export async function handleAgents(req: Request, ctx: AgentsContext): Promise<Response> {
  const url = new URL(req.url)
  const sourceParam = url.searchParams.get('source') ?? 'auto'
  const sourceParsed = SourceSchema.safeParse(sourceParam)
  if (!sourceParsed.success) return validationError(sourceParsed.error.issues)
  const source = sourceParsed.data

  if (source !== 'workspaces') {
    try {
      const relayRes = await ctx.fetchFn(`${ctx.relayBaseUrl}/agents`, {
        signal: AbortSignal.timeout(RELAY_TIMEOUT_MS)
      })
      if (relayRes.ok) {
        let raw: unknown
        try {
          raw = await relayRes.json()
        } catch {
          if (source === 'relay') {
            return Response.json(
              { agents: [], error: 'Relay returned invalid JSON' },
              { headers: CORS_HEADERS }
            )
          }
          // auto mode: fall through to cmux
          raw = null
        }
        if (raw !== null) {
          const relayParsed = RelayAgentsSchema.safeParse(raw)
          if (relayParsed.success) {
            return Response.json(relayParsed.data, { headers: CORS_HEADERS })
          }
          if (source === 'relay') {
            return Response.json(
              { agents: [], error: 'Relay response failed schema validation' },
              { headers: CORS_HEADERS }
            )
          }
          // auto mode: fall through to cmux
        }
      } else if (source === 'relay') {
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
