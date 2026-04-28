/**
 * GET /agents — list agents known to the relay.
 *
 * Relay-required: any failure (timeout, fetch throw, non-OK status, or
 * schema-invalid body) returns HTTP 502 with body { error: string, detail?: string }.
 * There is no fallback source — relay is the single authoritative source.
 *
 * Also exports getKnownAgents used by the /transcribe path to resolve agent names
 * for please-gate LLM routing. getKnownAgents is relay-only (no cmux fallback).
 */

import { z } from 'zod'
import { RELAY_TIMEOUT_MS } from '../config.ts'

// ─── getKnownAgents business logic ────────────────────────────────────────────

export type GetKnownAgentsDeps = {
  relayBaseUrl: string
  fetchFn: typeof fetch
}

/**
 * Returns all known agent names from the relay, normalized to lowercase.
 * Queries relay /status which returns {agents: {name: {workspace}, ...}}.
 * Returns [] when the relay is unreachable or returns unexpected data.
 */
export async function getKnownAgents(deps: GetKnownAgentsDeps): Promise<string[]> {
  const { relayBaseUrl, fetchFn } = deps
  try {
    const res = await fetchFn(`${relayBaseUrl}/status`, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return []
    const StatusSchema = z.object({ agents: z.record(z.string(), z.unknown()) }).passthrough()
    const data: unknown = await res.json()
    const parsed = StatusSchema.safeParse(data)
    if (!parsed.success) return []
    return Object.keys(parsed.data.agents)
      .map((a) => a.toLowerCase())
      .filter((a) => !a.includes('test') && !a.includes('probe'))
  } catch {
    return []
  }
}

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
  agents: z.array(z.union([z.string(), z.object({ name: z.string() }).passthrough()]))
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
