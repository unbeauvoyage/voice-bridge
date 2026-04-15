/**
 * GET  /mic — { state: "on"|"off" } — read the current mic state
 * POST /mic — { state: "on"|"off" } — set the mic state
 *
 * Returns `null` for unsupported HTTP methods so the index dispatcher can
 * fall through to a 404 path.
 */

export type MicContext = {
  isMicOn: () => boolean
  setMic: (on: boolean) => void
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

export async function handleMic(req: Request, ctx: MicContext): Promise<Response | null> {
  if (req.method === 'GET') {
    return Response.json({ state: ctx.isMicOn() ? 'on' : 'off' }, { headers: CORS_HEADERS })
  }
  if (req.method === 'POST') {
    const body = safeJsonParse(await req.text())
    const on = body['state'] === 'on'
    ctx.setMic(on)
    console.log(`[mic] ${on ? 'RESUMED' : 'PAUSED'} via API`)
    return Response.json({ state: on ? 'on' : 'off' }, { headers: CORS_HEADERS })
  }
  return null
}
