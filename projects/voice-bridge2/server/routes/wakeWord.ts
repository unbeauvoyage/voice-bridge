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
      try {
        ctx.stop(pid)
        console.log(`[wake-word] stopped (PID ${pid})`)
      } catch (err) {
        // kill failed (e.g. permission denied) — process is still running
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[wake-word] stop failed for PID ${pid}: ${message}`)
        return Response.json(
          { running: true, error: message },
          { status: 500, headers: CORS_HEADERS }
        )
      }
    }
    return Response.json({ running: false }, { headers: CORS_HEADERS })
  }

  if (req.method === 'POST' && url.pathname === '/wake-word/start') {
    const existing = ctx.findPid()
    if (!existing) {
      const target = ctx.loadLastTarget()
      try {
        ctx.start(target)
        console.log(`[wake-word] started with target "${target}"`)
      } catch (err) {
        // spawn failed (Python not found, path error, etc.)
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[wake-word] start failed: ${message}`)
        return Response.json(
          { running: false, error: message },
          { status: 500, headers: CORS_HEADERS }
        )
      }
      // Best-effort liveness check: even if spawn didn't throw, the process may
      // have exited immediately (bad Python path, missing venv, script crash).
      // pgrep is fast enough that an immediately-crashing process won't be found.
      const alive = ctx.findPid()
      if (!alive) {
        const message = 'Process exited immediately after spawn'
        console.error(`[wake-word] ${message}`)
        return Response.json(
          { running: false, error: message },
          { status: 500, headers: CORS_HEADERS }
        )
      }
    }
    return Response.json({ running: true }, { headers: CORS_HEADERS })
  }

  return null
}
