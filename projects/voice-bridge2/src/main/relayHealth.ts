/**
 * Relay connectivity health checker + background poller.
 *
 * `checkRelayHealth` performs a single GET /health request and maps the
 * outcome to one of three states:
 *   'connected'    — 2xx response
 *   'error'        — non-2xx response (relay running but unhealthy)
 *   'disconnected' — fetch threw (ECONNREFUSED, timeout, network error)
 *
 * `startRelayHealthPoller` calls checkRelayHealth on a configurable interval
 * and invokes `onStateChange` whenever the state changes. The caller is
 * responsible for wiring onStateChange → TrayController.setRelayState().
 *
 * All I/O is injected via `fetchFn` so tests can stub responses without
 * spawning a real server.
 */

/** Observable states for the relay connection from voice-bridge's perspective. */
export type RelayState = 'connected' | 'disconnected' | 'error'

/** Options for the background poller. */
export type RelayHealthPollerOptions = {
  relayBaseUrl: string
  fetchFn: typeof fetch
  onStateChange: (state: RelayState) => void
  /** How often to check in ms. Defaults to 10 000 (10 s). */
  pollIntervalMs?: number
  /** Timeout per check in ms. Defaults to 4 000. */
  timeoutMs?: number
}

export type RelayHealthPoller = {
  stop: () => void
}

/**
 * Check relay connectivity once.
 *
 * @param relayBaseUrl  Base URL of the relay (e.g. "http://localhost:8767").
 * @param fetchFn       Injected fetch implementation.
 * @returns             'connected' | 'disconnected' | 'error'
 */
export async function checkRelayHealth(
  relayBaseUrl: string,
  fetchFn: typeof fetch,
  timeoutMs: number = 4_000
): Promise<RelayState> {
  try {
    const res = await fetchFn(`${relayBaseUrl}/health`, {
      signal: AbortSignal.timeout(timeoutMs)
    })
    return res.ok ? 'connected' : 'error'
  } catch {
    return 'disconnected'
  }
}

/**
 * Start a background relay health poller.
 *
 * Polls at `pollIntervalMs` intervals. Calls `onStateChange` with the new
 * state on every check (callers may deduplicate if they only care about
 * transitions). Call `.stop()` to cancel the interval.
 *
 * @returns A handle with a `.stop()` method.
 */
export function startRelayHealthPoller(options: RelayHealthPollerOptions): RelayHealthPoller {
  const {
    relayBaseUrl,
    fetchFn,
    onStateChange,
    pollIntervalMs = 10_000,
    timeoutMs = 4_000
  } = options

  const handle = setInterval(() => {
    checkRelayHealth(relayBaseUrl, fetchFn, timeoutMs)
      .then(onStateChange)
      .catch(() => onStateChange('disconnected'))
  }, pollIntervalMs)

  return {
    stop() {
      clearInterval(handle)
    }
  }
}
