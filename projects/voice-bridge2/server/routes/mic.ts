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
 */

import { z } from 'zod'
import { parseJsonBody } from './validation.ts'

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
    console.log(`[mic] ${on ? 'RESUMED' : 'PAUSED'} via API`)
    return Response.json({ state: on ? 'on' : 'off' }, { headers: CORS_HEADERS })
  }
  return null
}
