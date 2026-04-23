/**
 * "Meta" routes — the trivial liveness + static UI endpoints that are too
 * small to each warrant their own file.
 *
 *   GET /health     — { status: "ok", ts: <ms-epoch> }  (no CORS, matches original)
 *   GET /api/health — full diagnostic: whisper/ollama/relay probes + uptime + version
 *   GET /           — serves the mobile recording UI HTML, 404 if missing
 */

export function handleHealth(): Response {
  return Response.json({ status: 'ok', ts: Date.now() })
}

export type WhisperState = 'ready' | 'loading' | 'error'
export type OllamaState = 'reachable' | 'unreachable'
export type RelayState = 'connected' | 'disconnected'

export type ApiHealthContext = {
  /** process start time in ms (Date.now() at boot) */
  bootMs: number
  /** git commit SHA of the running build */
  version: string
  /** returns the last-used relay target, or '' if none */
  lastTarget: () => string
  probeWhisper: () => Promise<WhisperState>
  probeOllama: () => Promise<OllamaState>
  probeRelay: () => Promise<RelayState>
}

export type ApiHealthResponse = {
  ok: true
  whisper: WhisperState
  ollama: OllamaState
  relay: RelayState
  lastTarget: string | null
  uptimeSec: number
  version: string
}

export async function handleApiHealth(ctx: ApiHealthContext): Promise<Response> {
  const [whisper, ollama, relay] = await Promise.all([
    ctx.probeWhisper(),
    ctx.probeOllama(),
    ctx.probeRelay()
  ])
  const target = ctx.lastTarget()
  const body: ApiHealthResponse = {
    ok: true,
    whisper,
    ollama,
    relay,
    lastTarget: target === '' ? null : target,
    uptimeSec: Math.floor((Date.now() - ctx.bootMs) / 1000),
    version: ctx.version
  }
  return Response.json(body)
}

export type IndexHtmlContext = {
  /** Load the index.html bytes. Return null if the file is missing. Throws are caught. */
  loadIndexHtml: () => Promise<string | Uint8Array | null>
}

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' } as const

export async function handleIndexHtml(ctx: IndexHtmlContext): Promise<Response> {
  try {
    const html = await ctx.loadIndexHtml()
    if (html === null) return new Response('Not found', { status: 404 })
    return new Response(html, { headers: HTML_HEADERS })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
