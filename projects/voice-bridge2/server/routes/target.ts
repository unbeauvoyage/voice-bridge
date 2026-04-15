/**
 * POST /target — { target: string } → persists new target
 *
 * Validates that the body has a non-empty `target` string (after trimming),
 * persists via the injected saveLastTarget callback, and echoes the trimmed
 * value. Malformed JSON, missing field, non-string field, or all-whitespace
 * field all return 400 "Missing target".
 */

export type TargetContext = {
  saveLastTarget: (target: string) => void
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

function safeJsonParse(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed === 'object' && parsed !== null) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(parsed)) out[k] = v
      return out
    }
    return {}
  } catch {
    return {}
  }
}

export async function handleTarget(req: Request, ctx: TargetContext): Promise<Response> {
  const body = safeJsonParse(await req.text())
  const raw = body['target']
  const target = (typeof raw === 'string' ? raw : '').trim()
  if (!target) {
    return Response.json({ error: 'Missing target' }, { status: 400, headers: CORS_HEADERS })
  }
  ctx.saveLastTarget(target)
  console.log(`[target] updated to "${target}"`)
  return Response.json({ target }, { headers: CORS_HEADERS })
}
