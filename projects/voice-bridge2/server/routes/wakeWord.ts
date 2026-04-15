/**
 * Wake-word process control — three routes sharing a common DI surface.
 *
 *   GET  /wake-word       → { running: boolean }
 *   POST /wake-word/stop  → kill the wake_word.py process (idempotent no-op if not running)
 *   POST /wake-word/start → spawn wake_word.py with the last-used target (idempotent no-op if already running)
 *
 * All OS-level plumbing (pgrep, kill, detached spawn) is injected via
 * WakeWordContext so route logic is testable without touching real processes.
 *
 * Returns `null` for any unmatched path/method combination so the index
 * dispatcher can fall through to its 404 path.
 */

export type WakeWordContext = {
  findPid: () => number | null
  stop: (pid: number) => void
  start: (target: string) => void
  loadLastTarget: () => string
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

export function handleWakeWord(req: Request, ctx: WakeWordContext): Response | null {
  const url = new URL(req.url)

  if (req.method === 'GET' && url.pathname === '/wake-word') {
    return Response.json({ running: ctx.findPid() !== null }, { headers: CORS_HEADERS })
  }

  if (req.method === 'POST' && url.pathname === '/wake-word/stop') {
    const pid = ctx.findPid()
    if (pid) {
      ctx.stop(pid)
      console.log(`[wake-word] stopped (PID ${pid})`)
    }
    return Response.json({ running: false }, { headers: CORS_HEADERS })
  }

  if (req.method === 'POST' && url.pathname === '/wake-word/start') {
    const existing = ctx.findPid()
    if (!existing) {
      const target = ctx.loadLastTarget()
      ctx.start(target)
      console.log(`[wake-word] started with target "${target}"`)
    }
    return Response.json({ running: true }, { headers: CORS_HEADERS })
  }

  return null
}
