/**
 * Relay response poller.
 *
 * Polls GET /queue/ceo on the relay every POLL_INTERVAL_MS and forwards
 * new agent messages to the overlay server as message toasts.
 *
 * Also triggers TTS via edge-tts (macOS) when tts_enabled is true and the
 * message body is within the configured word limit.
 *
 * TTS playback + mic pause guard logic lives in ./tts.ts.
 */

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import {
  POLL_INTERVAL_MS,
  RELAY_POLL_TIMEOUT_MS,
  OVERLAY_TIMEOUT_MS
} from './config.ts'
import {
  type TtsSpawn,
  type TtsPauseGuard,
  defaultTtsSpawn,
  createTtsPauseGuard,
  playTts
} from './tts.ts'

// Re-export so existing consumers (relay-poller.test.ts) continue to import from here.
export type { TtsSpawn, TtsPauseGuard }

// Types replicated inline so this module has no path-alias dependencies.
type SendRequest = { from: string; to: string; type: string; body: string }
type SendResponse = { id: string; status: 'delivered' | 'queued' }

export { SendRequest, SendResponse } // re-exported so relay.ts can use them

/** Message shape returned by GET /queue/:agent */
interface QueuedMessage {
  id: string
  from: string
  to: string
  type: string
  body: string
  ts: string
}

/** Message types that should be shown in the overlay */
const TOAST_TYPES = new Set(['done', 'status', 'message', 'waiting-for-input'])

const MAX_BODY_CHARS = 120

export interface RelayPollerOptions {
  relayBaseUrl: string
  overlayUrl: string
  /**
   * Dynamic TTS settings factory. Called at the start of each poll cycle so
   * settings changes (e.g. toggling TTS in the UI) take effect without restart.
   * If getSettings throws, TTS is suppressed for that cycle (safe default).
   *
   * When provided, takes precedence over the static ttsEnabled/ttsWordLimit fields.
   */
  getSettings?: () => { ttsEnabled: boolean; ttsWordLimit: number }
  /**
   * Static TTS enable flag. Ignored when getSettings is provided.
   * Kept for backward compatibility with existing tests.
   */
  ttsEnabled?: boolean
  /** Max word count for TTS; messages over this limit skip TTS. Ignored when getSettings is provided. */
  ttsWordLimit?: number
  /** Injectable spawn for TTS; defaults to argv-only node:child_process spawn */
  ttsSpawn?: TtsSpawn
  /**
   * Injectable pause guard factory. Called once per TTS message so each TTS
   * cycle gets a unique token — prevents concurrent cycles from stomping each
   * other's tokens and avoids clearing the user's manual mic-off token.
   *
   * If you pass a fixed TtsPauseGuard object (for tests that verify acquire/release
   * ordering), it is wrapped to behave like a factory returning that same guard.
   *
   * Defaults to createTtsPauseGuard() which writes tts-{uuid} token in MIC_PAUSE_DIR.
   */
  ttsPauseGuard?: TtsPauseGuard | (() => TtsPauseGuard)
  /**
   * Maximum ms to wait for edge-tts to finish writing the mp3 before proceeding
   * to afplay anyway. Production default: 30000ms (30s).
   * Injectable in tests with a short value (e.g. 80ms) to avoid real waits.
   */
  edgeTtsTimeoutMs?: number
  /**
   * Maximum ms to wait for afplay to finish before releasing the pause guard.
   * Production default: 60000ms (60s).
   * Injectable in tests.
   */
  afplayTimeoutMs?: number
}

export interface RelayPoller {
  /** Run a single poll cycle (for testing) */
  pollOnce(): Promise<void>
  /** Start background polling interval */
  start(): void
  /** Stop background polling */
  stop(): void
}

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

  // Resolve TTS settings strategy.
  // getSettings (dynamic) takes precedence; static ttsEnabled/ttsWordLimit are
  // kept for backward compat with existing tests that don't use getSettings.
  const resolveSettings = (): { ttsEnabled: boolean; ttsWordLimit: number } => {
    if (options.getSettings) {
      try {
        return options.getSettings()
      } catch {
        // getSettings threw — safe default: TTS off
        return { ttsEnabled: false, ttsWordLimit: 50 }
      }
    }
    return { ttsEnabled: options.ttsEnabled ?? false, ttsWordLimit: options.ttsWordLimit ?? 50 }
  }

  // Resolve the pause guard option into a factory function.
  // If the caller passed a plain TtsPauseGuard object (e.g. test fakes that
  // record acquire/release ordering), wrap it as a factory returning that same
  // object. If the caller passed a factory function, use it as-is.
  // Default: createTtsPauseGuard() — one unique token per TTS call.
  let guardFactory: () => TtsPauseGuard
  if (options.ttsPauseGuard === undefined) {
    guardFactory = createTtsPauseGuard
  } else if (typeof options.ttsPauseGuard === 'function') {
    guardFactory = options.ttsPauseGuard
  } else {
    // Plain TtsPauseGuard object — wrap in a factory that always returns the same guard.
    // TypeScript narrows to TtsPauseGuard here (the function branch is handled above).
    const fixedGuard: TtsPauseGuard = options.ttsPauseGuard
    guardFactory = () => fixedGuard
  }

  const seenIds = new Map<string, number>() // id → timestamp for TTL eviction
  const SEEN_ID_TTL_MS = 60 * 60 * 1000 // 1 hour
  // Track overlay POST failure count per message id. After 3 consecutive failures,
  // the message is marked seen to prevent infinite retry when overlay is persistently down.
  // The count is cleared when overlay POST succeeds.
  const overlayFailCount = new Map<string, number>()
  const OVERLAY_MAX_RETRIES = 3
  let intervalHandle: Timer | null = null
  // In-flight guard: prevents two concurrent poll cycles from running simultaneously.
  // Without this, the 3s interval can fire a second pollOnce() while the first is
  // still awaiting TTS afplay, causing two concurrent TTS playbacks to race.
  let inFlight = false

  function isQueuedMessage(value: unknown): value is QueuedMessage {
    if (value === null || typeof value !== 'object') return false
    return (
      'id' in value &&
      typeof value.id === 'string' &&
      'from' in value &&
      typeof value.from === 'string' &&
      'to' in value &&
      typeof value.to === 'string' &&
      'type' in value &&
      typeof value.type === 'string' &&
      'body' in value &&
      typeof value.body === 'string' &&
      'ts' in value &&
      typeof value.ts === 'string'
    )
  }

  function parseQueueResponse(value: unknown): QueuedMessage[] {
    if (value === null || typeof value !== 'object') return []
    if (!('messages' in value)) return []
    const raw = value.messages
    if (!Array.isArray(raw)) return []
    return raw.filter(isQueuedMessage)
  }

  async function pollOnce(): Promise<void> {
    // Evict stale seenIds entries (older than 1 hour) to prevent unbounded growth.
    const now = Date.now()
    for (const [id, ts] of seenIds) {
      if (now - ts > SEEN_ID_TTL_MS) seenIds.delete(id)
    }

    // Read TTS settings at the start of each cycle so UI changes (e.g. toggling
    // TTS) take effect without a server restart. Matches the Python daemon's
    // 5-second hot-reload approach (daemon/wake_word.py:192-203).
    const { ttsEnabled, ttsWordLimit } = resolveSettings()

    let messages: QueuedMessage[]
    try {
      const res = await fetch(`${relayBaseUrl}/queue/ceo`, {
        signal: AbortSignal.timeout(RELAY_POLL_TIMEOUT_MS)
      })
      if (!res.ok) return
      const data: unknown = await res.json()
      messages = parseQueueResponse(data)
    } catch {
      // Relay offline — silent skip
      return
    }

    for (const msg of messages) {
      if (seenIds.has(msg.id)) continue
      if (!TOAST_TYPES.has(msg.type)) continue

      const shortBody = msg.body.slice(0, MAX_BODY_CHARS)
      const toastText = `${msg.from}: ${shortBody}`

      // POST to overlay. seenIds.add() is deferred until AFTER a successful
      // POST so that a transient failure (overlay down) does not permanently
      // drop the message — the next poll cycle will retry it.
      //
      // To prevent infinite retry when overlay is persistently down, we track
      // failure count per message id. After OVERLAY_MAX_RETRIES (3) failures,
      // the message is marked seen anyway (with a warning) so the queue drains.
      let overlayOk = false
      try {
        const res = await fetch(overlayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'message', text: toastText }),
          signal: AbortSignal.timeout(OVERLAY_TIMEOUT_MS)
        })
        overlayOk = res.ok
        if (!res.ok) {
          console.error(`[relay-poller] overlay POST returned ${res.status} for msg ${msg.id}`)
        }
      } catch (err) {
        console.error(
          '[relay-poller] overlay POST failed:',
          err instanceof Error ? err.message : String(err)
        )
      }

      if (overlayOk) {
        // Success: mark seen and clear any failure count
        seenIds.set(msg.id, Date.now())
        overlayFailCount.delete(msg.id)
      } else {
        // Failure: increment count; after cap, mark seen to stop retrying
        const failures = (overlayFailCount.get(msg.id) ?? 0) + 1
        overlayFailCount.set(msg.id, failures)
        if (failures >= OVERLAY_MAX_RETRIES) {
          console.warn(
            `[relay-poller] overlay POST failed ${failures}x for msg ${msg.id} — marking seen to prevent infinite retry`
          )
          seenIds.set(msg.id, Date.now())
          overlayFailCount.delete(msg.id)
        }
        // Not yet at cap: leave message unseen so next poll retries
        continue
      }

      // TTS via edge-tts (Microsoft Jenny neural voice).
      // Full playback logic (argv-only spawn, sequential edge-tts→afplay, timeout+kill,
      // per-owner pause guard) lives in ./tts.ts — see playTts() for the security rationale.
      if (ttsEnabled) {
        const wordCount = msg.body.trim().split(/\s+/).length
        if (wordCount <= ttsWordLimit) {
          // Each message gets its own unique guard instance (unique UUID token).
          // Unique mp3 path per call so concurrent cycles cannot overwrite each other's files.
          const mp3Path = `/tmp/vb2-tts-${randomUUID()}.mp3`
          const guard = guardFactory()
          await playTts(msg.body, mp3Path, guard, ttsSpawn, edgeTtsTimeoutMs, afplayTimeoutMs)
        }
      }
    }
  }

  function start(): void {
    if (intervalHandle !== null) return
    // Fire immediately, then on interval.
    // inFlight is set BEFORE the eager fire so that if an interval tick fires
    // while the eager pollOnce is still awaiting TTS, the tick is correctly
    // dropped by the inFlight guard. Without this, calling start() once and
    // having a very short POLL_INTERVAL_MS could let an interval tick launch a
    // second concurrent pollOnce before the eager one finishes.
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

/**
 * Reads tts settings from daemon/settings.json on each poll cycle and starts
 * a background poller. Called from server/index.ts on startup.
 *
 * Settings are re-read every poll cycle (no caching, no file watcher). The
 * file is small and reads are cheap at 3s intervals — this intentionally
 * matches the Python daemon's hot-reload approach (daemon/wake_word.py:192-203).
 * Toggling TTS in the UI via POST /settings now takes effect on the next cycle.
 */
export function startRelayPoller(opts: {
  relayBaseUrl: string
  overlayUrl: string
  settingsPath?: string
}): RelayPoller {
  const poller = createRelayPoller({
    relayBaseUrl: opts.relayBaseUrl,
    overlayUrl: opts.overlayUrl,
    getSettings: () => {
      if (!opts.settingsPath) return { ttsEnabled: false, ttsWordLimit: 50 }
      try {
        const raw: string = readFileSync(opts.settingsPath, 'utf8')
        const parsed: unknown = JSON.parse(raw)
        if (parsed !== null && typeof parsed === 'object') {
          return {
            ttsEnabled: 'tts_enabled' in parsed && parsed.tts_enabled === true,
            ttsWordLimit:
              'tts_word_limit' in parsed && typeof parsed.tts_word_limit === 'number'
                ? parsed.tts_word_limit
                : 50
          }
        }
      } catch {
        // settings file absent or unreadable — use defaults
      }
      return { ttsEnabled: false, ttsWordLimit: 50 }
    }
  })
  poller.start()
  return poller
}
