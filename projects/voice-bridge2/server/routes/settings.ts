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
import { logger } from '../logger.ts'

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

// Full existing-file schema: same fields but uses passthrough() so unknown
// keys written by older daemon versions don't cause false-corrupt rejections.
// We only care that every KNOWN field has the right type — unknown keys pass.
const ExistingSettingsSchema = z
  .object({
    start_threshold: z.number().min(0).max(1).optional(),
    stop_threshold: z.number().min(0).max(1).optional(),
    tts_enabled: z.boolean().optional(),
    tts_word_limit: z.number().int().positive().optional(),
    toast_duration: z.number().positive().finite().optional()
  })
  .passthrough()

/**
 * Parse the current settings file, distinguishing "legit empty/new file"
 * from "corrupt file". Missing file (raw === null) is first-time write,
 * return ok:true {}. Present-but-unparseable or schema-invalid is corruption —
 * the handler must refuse to overwrite, else the next POST silently propagates
 * corrupt typed values (e.g. tts_enabled:"yes") onto disk.
 */
function parseCurrentSettings(
  raw: string | null
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (raw === null) return { ok: true, data: {} }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    return { ok: false, error: `settings.json is corrupt (parse failed: ${String(err)})` }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'settings.json is corrupt (not a JSON object)' }
  }
  // Validate known fields against the schema so type-invalid values (e.g.
  // tts_enabled:"yes") are caught before they merge into the next write.
  const schemaResult = ExistingSettingsSchema.safeParse(parsed)
  if (!schemaResult.success) {
    const issues = schemaResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return { ok: false, error: `settings.json is corrupt (schema invalid: ${issues})` }
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(schemaResult.data)) out[k] = v
  return { ok: true, data: out }
}

export async function handleSettings(req: Request, ctx: SettingsContext): Promise<Response | null> {
  if (req.method === 'GET') {
    let raw: string | null
    try {
      raw = ctx.readSettings()
    } catch (err) {
      // ENOENT is handled by returning null (see server/index.ts wiring).
      // Any other error (EACCES, EISDIR, EIO) must surface as 500 — returning
      // 404 would silently mask a real filesystem problem.
      return Response.json(
        { error: `Cannot read settings: ${String(err)}` },
        { status: 500, headers: CORS_HEADERS }
      )
    }
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
    let rawForMerge: string | null
    try {
      rawForMerge = ctx.readSettings()
    } catch (err) {
      // Same as GET path: non-ENOENT errors must propagate as 500, not silently
      // be treated as "no file" (which would cause a fresh {} to be written,
      // masking the original error with a confusing "Failed to write" message).
      return Response.json(
        { error: `Cannot read settings: ${String(err)}` },
        { status: 500, headers: CORS_HEADERS }
      )
    }
    const currentResult = parseCurrentSettings(rawForMerge)
    if (!currentResult.ok) {
      logger.error('settings', 'refusing_overwrite', { reason: currentResult.error })
      return Response.json(
        { error: `Refusing to overwrite: ${currentResult.error}` },
        { status: 500, headers: CORS_HEADERS }
      )
    }
    const merged = { ...currentResult.data, ...parsed.data }
    try {
      ctx.writeSettings(JSON.stringify(merged, null, 2))
    } catch (err) {
      return Response.json(
        { error: 'Failed to write settings: ' + String(err) },
        { status: 500, headers: CORS_HEADERS }
      )
    }
    logger.info('settings', 'updated', { data: parsed.data })
    return Response.json(merged, { headers: CORS_HEADERS })
  }

  return null
}
