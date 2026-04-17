/**
 * POST /target — { target: string } → persists new target.
 *
 * Boundary validation (Stage-4 codex chunk2-review HIGH — /target was the
 * 4th site still using the old `safeJsonParse` copy-loop, which is
 * prototype-pollutable via `{"__proto__":{"target":"pwned"}}`): body is
 * validated against a strict Zod schema before any lookup. Unknown keys,
 * non-string target, and malformed JSON all return 400.
 *
 * Also exports loadLastTarget and saveLastTarget that were previously defined
 * in server/index.ts. index.ts is wiring-only per server-standards; business
 * logic lives here.
 */

import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { atomicWriteFile } from '../atomicWriteFile.ts'
import { parseJsonBody } from './validation.ts'

// ─── Target persistence business logic ───────────────────────────────────────

const DEFAULT_LAST_TARGET_FILE = join(import.meta.dir, '../../tmp/last-target.txt')

// Zod schema for validating content read from the last-target file.
// Accepts a non-empty string of ≤128 chars; anything else falls back to 'command'.
const LastTargetSchema = z.string().min(1).max(128)

// Known-dead targets that should never be used as a relay destination.
// These can get persisted in last-target.txt from debugging sessions and
// will cause all subsequent voice commands to route to a dead/offline agent.
// "cors-check" was a debugging target that caused CEO to lose 8 hours.
const BLOCKED_TARGETS = new Set(['cors-check', '*', 'ceo'])

/**
 * Reads the last-used relay target from disk.
 * Falls back to 'command' when the file is missing, empty, invalid, or blocked.
 * Accepts an optional file path for test injection.
 */
export function loadLastTarget(filePath: string = DEFAULT_LAST_TARGET_FILE): string {
  try {
    const raw = readFileSync(filePath, 'utf8').trim()
    const parsed = LastTargetSchema.safeParse(raw)
    if (!parsed.success) return 'command'
    if (BLOCKED_TARGETS.has(parsed.data)) {
      console.warn(
        `[target] blocked target "${parsed.data}" in last-target.txt — resetting to "command"`
      )
      return 'command'
    }
    return parsed.data
  } catch {
    return 'command'
  }
}

/**
 * Persists the relay target to disk using an atomic write (temp file + rename).
 * Accepts an optional file path for test injection.
 */
export function saveLastTarget(target: string, filePath: string = DEFAULT_LAST_TARGET_FILE): void {
  try {
    atomicWriteFile(filePath, target)
  } catch (err) {
    console.error(
      '[target] failed to persist last target:',
      err instanceof Error ? err.message : String(err)
    )
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export type TargetContext = {
  saveLastTarget: (target: string) => void
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

const TargetPostSchema = z
  .object({
    target: z.string().min(1).max(128)
  })
  .strict()

export async function handleTarget(req: Request, ctx: TargetContext): Promise<Response> {
  const parsed = parseJsonBody(await req.text(), TargetPostSchema)
  if (!parsed.ok) return parsed.response
  const target = parsed.data.target.trim()
  if (!target) {
    return Response.json({ error: 'Missing target' }, { status: 400, headers: CORS_HEADERS })
  }
  ctx.saveLastTarget(target)
  console.log(`[target] updated to "${target}"`)
  return Response.json({ target }, { headers: CORS_HEADERS })
}
