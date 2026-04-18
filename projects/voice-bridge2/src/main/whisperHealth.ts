/**
 * Whisper-server connectivity health checker.
 *
 * Mirrors relayHealth.ts — same three-state model:
 *   'connected'    — 2xx response from whisper-server health endpoint
 *   'error'        — non-2xx response (server running but unhealthy)
 *   'disconnected' — fetch threw (ECONNREFUSED, timeout, network error)
 *
 * The whisper-server (whisper.cpp) runs at port 8766. It does not expose
 * a dedicated /health route, so we hit the inference endpoint and treat
 * any response (even 4xx/5xx) as "server is up". A fetch throw means
 * the process is not running.
 *
 * All I/O is injected via `fetchFn` for testability.
 */

/** Observable states for the whisper-server from voice-bridge's perspective. */
export type WhisperState = 'connected' | 'disconnected' | 'error'

/**
 * Check whisper-server connectivity once.
 *
 * @param baseUrl   Base URL of the whisper-server (e.g. "http://localhost:8766").
 * @param fetchFn   Injected fetch implementation.
 * @returns         'connected' | 'disconnected' | 'error'
 */
export async function checkWhisperHealth(
  baseUrl: string,
  fetchFn: typeof fetch,
  timeoutMs: number = 4_000
): Promise<WhisperState> {
  try {
    const res = await fetchFn(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(timeoutMs)
    })
    return res.ok ? 'connected' : 'error'
  } catch {
    return 'disconnected'
  }
}
