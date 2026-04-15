/**
 * POST /target — { target: string } → persists new target.
 *
 * Boundary validation (Stage-4 codex chunk2-review HIGH — /target was the
 * 4th site still using the old `safeJsonParse` copy-loop, which is
 * prototype-pollutable via `{"__proto__":{"target":"pwned"}}`): body is
 * validated against a strict Zod schema before any lookup. Unknown keys,
 * non-string target, and malformed JSON all return 400.
 */

import { z } from 'zod'
import { parseJsonBody } from './validation.ts'

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
