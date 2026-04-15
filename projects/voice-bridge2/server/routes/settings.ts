/**
 * GET  /settings — returns raw daemon/settings.json, or 404 if missing
 * POST /settings — merges validated partial JSON into existing settings and persists
 *
 * File I/O is injected via SettingsContext so the handler is unit-testable
 * without touching disk. GET returns the raw file bytes (not re-parsed) to
 * preserve the original passthrough behavior.
 *
 * POST validates the incoming partial against a strict Zod schema at the
 * boundary. Unknown keys, wrong types, out-of-range thresholds, and
 * prototype-pollution payloads (__proto__, constructor) all return 400
 * without touching persisted state. Stage-4 codex finding settings.ts:25,62
 * (HIGH): prior handler accepted arbitrary keys and values, letting
 * start_threshold=-1 or tts_enabled="yes" flow to the Python daemon.
 *
 * Returns `null` for unsupported HTTP methods so the index dispatcher can
 * fall through to a 404.
 */

import { z } from 'zod'
import { parseJsonBody } from './validation.ts'

export type SettingsContext = {
  /** Return the raw settings-file contents, or null if the file is missing. */
  readSettings: () => string | null
  /** Persist the raw JSON string. May throw on write failure. */
  writeSettings: (content: string) => void
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' } as const

// Strict schema for POST /settings. Every field is optional (partial update),
// but any field present must match the exact type/bound. Unknown keys are
// rejected (.strict()) so a typo or hostile payload cannot land in the
// daemon settings file.
const SettingsPatchSchema = z
  .object({
    start_threshold: z.number().min(0).max(1).optional(),
    stop_threshold: z.number().min(0).max(1).optional(),
    tts_enabled: z.boolean().optional(),
    tts_word_limit: z.number().int().positive().optional(),
    toast_duration: z.number().positive().finite().optional()
  })
  .strict()

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
    const parsed = parseJsonBody(await req.text(), SettingsPatchSchema)
    if (!parsed.ok) return parsed.response
    const current = parseCurrentSettings(ctx.readSettings())
    const merged = { ...current, ...parsed.data }
    try {
      ctx.writeSettings(JSON.stringify(merged, null, 2))
    } catch (err) {
      return Response.json(
        { error: 'Failed to write settings: ' + String(err) },
        { status: 500, headers: CORS_HEADERS }
      )
    }
    console.log(`[settings] updated: ${JSON.stringify(parsed.data)}`)
    return Response.json(merged, { headers: CORS_HEADERS })
  }

  return null
}
