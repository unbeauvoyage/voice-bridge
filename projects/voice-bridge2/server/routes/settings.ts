/**
 * GET  /settings — returns raw daemon/settings.json, or 404 if missing
 * POST /settings — merges incoming partial JSON into existing settings and persists
 *
 * File I/O is injected via SettingsContext so the handler is unit-testable
 * without touching disk. GET returns the raw file bytes (not re-parsed) to
 * preserve the original passthrough behavior. POST merges keys shallowly:
 * incoming values override existing values, and existing keys not mentioned
 * in the incoming body are preserved.
 *
 * Returns `null` for unsupported HTTP methods so the index dispatcher can
 * fall through to a 404.
 */

export type SettingsContext = {
  /** Return the raw settings-file contents, or null if the file is missing. */
  readSettings: () => string | null
  /** Persist the raw JSON string. May throw on write failure. */
  writeSettings: (content: string) => void
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' } as const

async function parseIncomingJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const raw: unknown = await req.json()
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) out[k] = v
    return out
  } catch {
    return null
  }
}

function parseCurrentSettings(raw: string | null): Record<string, unknown> {
  if (raw === null) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed)) out[k] = v
    return out
  } catch {
    return {}
  }
}

export async function handleSettings(req: Request, ctx: SettingsContext): Promise<Response | null> {
  if (req.method === 'GET') {
    const raw = ctx.readSettings()
    if (raw === null) {
      return Response.json(
        { error: 'settings.json not found' },
        { status: 404, headers: CORS_HEADERS }
      )
    }
    return new Response(raw, { headers: JSON_HEADERS })
  }

  if (req.method === 'POST') {
    const incoming = await parseIncomingJson(req)
    if (incoming === null) {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS })
    }
    const current = parseCurrentSettings(ctx.readSettings())
    const merged = { ...current, ...incoming }
    try {
      ctx.writeSettings(JSON.stringify(merged, null, 2))
    } catch (err) {
      return Response.json(
        { error: 'Failed to write settings: ' + String(err) },
        { status: 500, headers: CORS_HEADERS }
      )
    }
    console.log(`[settings] updated: ${JSON.stringify(incoming)}`)
    return Response.json(merged, { headers: CORS_HEADERS })
  }

  return null
}
