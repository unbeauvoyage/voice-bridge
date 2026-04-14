/**
 * Relay response poller.
 *
 * Polls GET /queue/ceo on the relay every POLL_INTERVAL_MS and forwards
 * new agent messages to the overlay server as message toasts.
 *
 * Also triggers TTS via `say` (macOS) when tts_enabled is true and the
 * message body is within the configured word limit.
 */

import { spawn } from 'node:child_process'

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

interface QueueResponse {
  messages: QueuedMessage[]
}

/** Message types that should be shown in the overlay */
const TOAST_TYPES = new Set(['done', 'status', 'message', 'waiting-for-input'])

const POLL_INTERVAL_MS = 3_000
const MAX_BODY_CHARS = 120

export interface RelayPollerOptions {
  relayBaseUrl: string
  overlayUrl: string
  /** If true, trigger TTS via `say -v Samantha` for short messages */
  ttsEnabled: boolean
  /** Max word count for TTS; messages over this limit skip TTS */
  ttsWordLimit?: number
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
  const { relayBaseUrl, overlayUrl, ttsEnabled, ttsWordLimit = 50 } = options
  const seenIds = new Set<string>()
  let intervalHandle: Timer | null = null

  async function pollOnce(): Promise<void> {
    let messages: QueuedMessage[]
    try {
      const res = await fetch(`${relayBaseUrl}/queue/ceo`, {
        signal: AbortSignal.timeout(5_000),
      })
      if (!res.ok) return
      const data = (await res.json()) as QueueResponse
      messages = Array.isArray(data.messages) ? data.messages : []
    } catch {
      // Relay offline — silent skip
      return
    }

    for (const msg of messages) {
      if (seenIds.has(msg.id)) continue
      if (!TOAST_TYPES.has(msg.type)) continue

      seenIds.add(msg.id)

      const shortBody = msg.body.slice(0, MAX_BODY_CHARS)
      const toastText = `${msg.from}: ${shortBody}`

      // POST to overlay
      try {
        await fetch(overlayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'message', text: toastText }),
          signal: AbortSignal.timeout(3_000),
        })
      } catch {
        // Overlay not running — best effort
      }

      // TTS via edge-tts (Microsoft Jenny neural voice)
      if (ttsEnabled) {
        const wordCount = msg.body.trim().split(/\s+/).length
        if (wordCount <= ttsWordLimit) {
          try {
            // edge-tts --voice en-US-JennyNeural --text "..." --write-media /tmp/tts.mp3 && afplay /tmp/tts.mp3
            spawn('sh', ['-c', `edge-tts --voice en-US-JennyNeural --text ${JSON.stringify(msg.body)} --write-media /tmp/vb2-tts.mp3 && afplay /tmp/vb2-tts.mp3`], { stdio: 'ignore' })
          } catch {
            // TTS unavailable — ignore
          }
        }
      }
    }
  }

  function start(): void {
    if (intervalHandle !== null) return
    // Fire immediately, then on interval
    void pollOnce()
    intervalHandle = setInterval(() => void pollOnce(), POLL_INTERVAL_MS)
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
 * Reads tts settings from daemon/settings.json (if it exists) and starts
 * a background poller.  Called from server/index.ts on startup.
 */
export function startRelayPoller(opts: {
  relayBaseUrl: string
  overlayUrl: string
  settingsPath?: string
}): RelayPoller {
  // Read settings lazily — if file absent, default to tts off
  let ttsEnabled = false
  let ttsWordLimit = 50
  if (opts.settingsPath) {
    try {
      const { readFileSync } = require('node:fs') as typeof import('node:fs')
      const raw = readFileSync(opts.settingsPath, 'utf8') as string
      const settings = JSON.parse(raw) as Record<string, unknown>
      if (settings['tts_enabled'] === true) ttsEnabled = true
      if (typeof settings['tts_word_limit'] === 'number') ttsWordLimit = settings['tts_word_limit'] as number
    } catch {
      // settings file absent or unreadable — use defaults
    }
  }

  const poller = createRelayPoller({
    relayBaseUrl: opts.relayBaseUrl,
    overlayUrl: opts.overlayUrl,
    ttsEnabled,
    ttsWordLimit,
  })
  poller.start()
  return poller
}
