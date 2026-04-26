/**
 * GET  /mic — { state: "on"|"off" } — read the current mic state
 * POST /mic — { state: "on"|"off" } — set the mic state
 *
 * POST bodies are validated at the boundary with Zod. Malformed JSON, wrong
 * type, unknown keys, or a `state` outside {"on","off"} returns 400 without
 * mutating mic state. Prior handler used an `out[k] = v` copy loop that made
 * `__proto__`-based prototype pollution observable; `.strict()` rejects it.
 *
 * Returns `null` for unsupported HTTP methods so the index dispatcher can
 * fall through to a 404 path.
 *
 * Also exports the mic business-logic functions setMic, isMicOn, and
 * handleMicCommand that were previously defined in server/index.ts.
 * index.ts is wiring-only per server-standards; business logic lives here.
 */

import { z } from 'zod'
import { existsSync, unlinkSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { MIC_PAUSE_DIR } from '../config.ts'
import { parseJsonBody } from './validation.ts'
import { logger } from '../logger.ts'

// ─── Mic business logic ───────────────────────────────────────────────────────
// Mic control — writes/removes the "manual" token in MIC_PAUSE_DIR.
// Daemon pauses if the directory exists AND contains any file.
// Using a per-owner token (manual) means TTS cycles (tts-{uuid} tokens) cannot
// clear the user's explicit mic-off — their tokens are independent.

const DEFAULT_MANUAL_TOKEN = `${MIC_PAUSE_DIR}/manual`

/**
 * Removes stale TTS pause tokens (tts-* files) from the pause directory.
 *
 * TTS tokens are transient — they are created by `createTtsPauseGuard().acquire()`
 * and removed by `.release()`. If the app crashes between acquire() and release(),
 * the token is never cleaned up. The daemon treats ANY file in MIC_PAUSE_DIR as a
 * pause signal, so stale tokens silently prevent voice pickup even when the UI shows
 * "MIC ON". Call this once on server startup to recover from crash-leftover tokens.
 *
 * Only removes files whose names start with "tts-". The "manual" token (user-set
 * mic-off) is intentionally preserved across restarts.
 *
 * @param pauseDir  Directory to scan (injectable for tests; defaults to MIC_PAUSE_DIR).
 */
export function cleanStaleTtsPauseTokens(pauseDir: string = MIC_PAUSE_DIR): void {
  if (!existsSync(pauseDir)) return
  let entries: string[]
  try {
    entries = readdirSync(pauseDir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.startsWith('tts-')) continue
    try {
      unlinkSync(join(pauseDir, entry))
      logger.info({ component: 'mic', token: entry }, 'stale_tts_token_removed')
    } catch {
      /* token may have already been removed */
    }
  }
}

/**
 * Returns true when the manual pause token does not exist (mic is active).
 * Accepts an optional token path for test injection.
 */
export function isMicOn(manualToken: string = DEFAULT_MANUAL_TOKEN): boolean {
  // Mic is on if the directory has no entries (or doesn't exist).
  // We check only the manual token for the purpose of the UI "state" indicator —
  // TTS tokens are transient and shouldn't make the UI show "mic off" during playback.
  return !existsSync(manualToken)
}

/**
 * Enables or disables the mic by creating or removing the manual pause token.
 * Accepts optional paths for test injection; production uses the defaults.
 */
export function setMic(
  on: boolean,
  pauseDir: string = MIC_PAUSE_DIR,
  manualToken: string = DEFAULT_MANUAL_TOKEN
): void {
  if (on) {
    try {
      unlinkSync(manualToken)
    } catch {
      /* file may not exist */
    }
    // If no other tokens remain, optionally remove the directory too.
    // We leave the directory in place — it's cheap and avoids a TOCTOU race.
  } else {
    try {
      mkdirSync(pauseDir, { recursive: true })
      writeFileSync(manualToken, '')
    } catch (err) {
      logger.error({ component: 'mic', error: err }, 'pause_token_write_failed')
    }
  }
}

/**
 * Returns { handled: true, state } if transcript is a mic control command, null otherwise.
 * "turn off (the) (mac/max) mic(rophone)" → pause
 * "turn on (the) (mac/max) mic(rophone)"  → resume
 * Accepts optional paths for test injection.
 */
export function handleMicCommand(
  transcript: string,
  pauseDir: string = MIC_PAUSE_DIR,
  manualToken: string = DEFAULT_MANUAL_TOKEN
): { handled: true; state: 'on' | 'off' } | null {
  const t = transcript.toLowerCase().trim()
  if (/\b(turn\s+off|disable|mute|pause)\b.{0,20}\b(mic(rophone)?|listening)\b/.test(t)) {
    setMic(false, pauseDir, manualToken)
    return { handled: true, state: 'off' }
  }
  if (/\b(turn\s+on|enable|unmute|resume)\b.{0,20}\b(mic(rophone)?|listening)\b/.test(t)) {
    setMic(true, pauseDir, manualToken)
    return { handled: true, state: 'on' }
  }
  return null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export type MicContext = {
  isMicOn: () => boolean
  setMic: (on: boolean) => void
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

const MicPostSchema = z
  .object({
    state: z.enum(['on', 'off'])
  })
  .strict()

export async function handleMic(req: Request, ctx: MicContext): Promise<Response | null> {
  if (req.method === 'GET') {
    return Response.json({ state: ctx.isMicOn() ? 'on' : 'off' }, { headers: CORS_HEADERS })
  }
  if (req.method === 'POST') {
    const parsed = parseJsonBody(await req.text(), MicPostSchema)
    if (!parsed.ok) return parsed.response
    const on = parsed.data.state === 'on'
    ctx.setMic(on)
    logger.info({ component: 'mic' }, on ? 'resumed_via_api' : 'paused_via_api')
    return Response.json({ state: on ? 'on' : 'off' }, { headers: CORS_HEADERS })
  }
  return null
}
