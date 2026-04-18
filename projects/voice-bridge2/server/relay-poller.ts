/**
 * Relay response poller — orchestrator.
 *
 * Polls GET /queue/ceo on the relay every POLL_INTERVAL_MS and forwards
 * new agent messages to the overlay server as message toasts.
 *
 * Concerns extracted to sub-modules:
 * - Types: RelayPollerOptions, RelayPoller → ./relay-poller-types.ts
 * - Overlay dispatch (seenIds, retry cap) → ./relay-overlay.ts
 * - Queue message parsing → ./relay-messages.ts
 * - TTS playback + mic pause guard → ./tts.ts
 * - Settings (validateTtsWordLimit, startRelayPoller) → ./relay-settings.ts
 */

import { randomUUID } from 'node:crypto'
import { POLL_INTERVAL_MS, RELAY_POLL_TIMEOUT_MS, MAX_OVERLAY_MESSAGE_AGE_MS } from './config.ts'
import {
  type TtsSpawn,
  type TtsPauseGuard,
  defaultTtsSpawn,
  createTtsPauseGuard,
  playTts,
  summarizeForTts
} from './tts.ts'
import { dispatchOverlayMessages, type OverlayDispatchState } from './relay-overlay.ts'
import { parseQueueResponse } from './relay-messages.ts'
import type { RelayPollerOptions, RelayPoller } from './relay-poller-types.ts'

// Re-export types so existing consumers continue to import from here.
export type { TtsSpawn, TtsPauseGuard }
export type { RelayPollerOptions, RelayPoller }
// Re-export settings utilities — moved to relay-settings.ts.
export { validateTtsWordLimit, startRelayPoller } from './relay-settings.ts'

// Types replicated inline so this module has no path-alias dependencies.
type SendRequest = { from: string; to: string; type: string; body: string }
type SendResponse = { id: string; status: 'delivered' | 'queued' }
export { SendRequest, SendResponse }

const SEEN_ID_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Creates a relay poller. Call `.start()` to begin background polling,
 * or `.pollOnce()` directly in tests.
 */
export function createRelayPoller(options: RelayPollerOptions): RelayPoller {
  const {
    relayBaseUrl,
    overlayUrl,
    ttsSpawn = defaultTtsSpawn,
    edgeTtsTimeoutMs = 30_000,
    afplayTimeoutMs = 60_000
  } = options

  // getSettings (dynamic) takes precedence; static ttsEnabled/ttsWordLimit are
  // kept for backward compat with existing tests that don't use getSettings.
  const resolveSettings = (): { ttsEnabled: boolean; ttsWordLimit: number } => {
    if (options.getSettings) {
      try {
        return options.getSettings()
      } catch {
        return { ttsEnabled: false, ttsWordLimit: 50 }
      }
    }
    return { ttsEnabled: options.ttsEnabled ?? false, ttsWordLimit: options.ttsWordLimit ?? 50 }
  }

  // Resolve the pause guard option into a factory function.
  // Plain TtsPauseGuard object → factory that always returns the same guard.
  let guardFactory: () => TtsPauseGuard
  if (options.ttsPauseGuard === undefined) {
    guardFactory = createTtsPauseGuard
  } else if (typeof options.ttsPauseGuard === 'function') {
    guardFactory = options.ttsPauseGuard
  } else {
    const fixedGuard: TtsPauseGuard = options.ttsPauseGuard
    guardFactory = () => fixedGuard
  }

  const overlayState: OverlayDispatchState = {
    seenIds: new Map<string, number>(),
    overlayFailCount: new Map<string, number>()
  }
  let intervalHandle: Timer | null = null
  // inFlight guard: prevents two concurrent poll cycles from running simultaneously.
  let inFlight = false

  async function pollOnce(): Promise<void> {
    // Evict stale seenIds entries to prevent unbounded growth.
    const now = Date.now()
    for (const [id, ts] of overlayState.seenIds) {
      if (now - ts > SEEN_ID_TTL_MS) overlayState.seenIds.delete(id)
    }

    const { ttsEnabled, ttsWordLimit } = resolveSettings()

    let messages: Awaited<ReturnType<typeof parseQueueResponse>>
    try {
      const res = await fetch(`${relayBaseUrl}/queue/ceo`, {
        signal: AbortSignal.timeout(RELAY_POLL_TIMEOUT_MS)
      })
      if (!res.ok) return
      messages = parseQueueResponse(await res.json())
    } catch {
      return // relay offline — silent skip
    }

    // Mark messages older than MAX_OVERLAY_MESSAGE_AGE_MS as seen without
    // dispatching them to the overlay. This prevents replaying a historical
    // backlog of messages (e.g. from hours ago) when the server restarts with
    // an empty seenIds map. The overlay should only show recent activity.
    const ageCutoff = Date.now() - MAX_OVERLAY_MESSAGE_AGE_MS
    for (const msg of messages) {
      if (overlayState.seenIds.has(msg.id)) continue
      const msgTs = new Date(msg.ts).getTime()
      if (Number.isNaN(msgTs) || msgTs < ageCutoff) {
        overlayState.seenIds.set(msg.id, Date.now())
      }
    }

    // Dispatch overlay toasts; dispatchOverlayMessages mutates overlayState.
    const seenBefore = new Set(overlayState.seenIds.keys())
    await dispatchOverlayMessages(messages, overlayUrl, overlayState)

    // TTS: only for messages newly dispatched this cycle.
    if (ttsEnabled) {
      for (const msg of messages) {
        if (!overlayState.seenIds.has(msg.id) || seenBefore.has(msg.id)) continue
        const ttsText = await summarizeForTts(msg.body, ttsWordLimit)
        const mp3Path = `/tmp/vb2-tts-${randomUUID()}.mp3`
        await playTts(ttsText, mp3Path, guardFactory(), ttsSpawn, edgeTtsTimeoutMs, afplayTimeoutMs)
      }
    }
  }

  function start(): void {
    if (intervalHandle !== null) return
    // Set inFlight BEFORE the eager fire so interval ticks while TTS is running
    // are dropped by the inFlight guard.
    inFlight = true
    pollOnce().finally(() => {
      inFlight = false
    })
    intervalHandle = setInterval(() => {
      if (inFlight) return
      inFlight = true
      pollOnce().finally(() => {
        inFlight = false
      })
    }, POLL_INTERVAL_MS)
  }

  function stop(): void {
    if (intervalHandle !== null) {
      clearInterval(intervalHandle)
      intervalHandle = null
    }
  }

  return { pollOnce, start, stop }
}
