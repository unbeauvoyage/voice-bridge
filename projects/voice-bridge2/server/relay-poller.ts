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
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { once } from 'node:events'
import { POLL_INTERVAL_MS, RELAY_POLL_TIMEOUT_MS, OVERLAY_TIMEOUT_MS, MIC_PAUSE_FILE } from './config.ts'

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

/**
 * Shape of the TTS spawn boundary. Takes a command + argv array — NEVER
 * a shell string. The production default uses argv-only `spawn` so the
 * agent-controlled body can never reach a shell. Injected in tests so
 * the contract is enforceable (see relay-poller.test.ts).
 *
 * Returns a NodeJS.EventEmitter so callers can await 'exit'. The default
 * implementation returns the ChildProcess from node:child_process.
 *
 * Chunk-5 #1 HIGH fix: the previous implementation piped the body
 * through `sh -c` with a JSON-quoted substitution; shell `$(...)`
 * expansion inside double quotes made every queued message a latent
 * RCE on the host when TTS was enabled.
 */
export type TtsSpawn = (command: string, args: string[]) => NodeJS.EventEmitter

const defaultTtsSpawn: TtsSpawn = (command, args) => {
  return spawn(command, args, { stdio: 'ignore' })
}

/**
 * Pause-guard boundary: acquire() touches /tmp/wake-word-pause before TTS
 * starts (suppresses wake-word detection in daemon/wake_word.py); release()
 * removes it after afplay finishes.
 *
 * The old `speak` wrapper script did this implicitly. When Chunk-5 #1 split
 * edge-tts+afplay into two direct argv-only spawns (no shell), the speak
 * wrapper was bypassed and the guard was dropped — leaving the mic hot during
 * playback. TTS audio fed back into the open mic, wake-word fired on ambient
 * noise, Whisper hallucinated "hello", delivery looped 23+ times in 2 min.
 *
 * Injected in tests so the acquire→spawn→exit→release ordering is verified.
 */
export interface TtsPauseGuard {
  acquire(): void
  release(): void
}

const defaultTtsPauseGuard: TtsPauseGuard = {
  acquire() {
    try {
      writeFileSync(MIC_PAUSE_FILE, '')
    } catch {
      /* ignore write errors */
    }
  },
  release() {
    try {
      unlinkSync(MIC_PAUSE_FILE)
    } catch {
      /* file may not exist */
    }
  }
}

export interface RelayPollerOptions {
  relayBaseUrl: string
  overlayUrl: string
  /** If true, trigger TTS via edge-tts + afplay for short messages */
  ttsEnabled: boolean
  /** Max word count for TTS; messages over this limit skip TTS */
  ttsWordLimit?: number
  /** Injectable spawn for TTS; defaults to argv-only node:child_process spawn */
  ttsSpawn?: TtsSpawn
  /** Injectable pause guard; defaults to touching/unlinking /tmp/wake-word-pause */
  ttsPauseGuard?: TtsPauseGuard
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
    ttsEnabled,
    ttsWordLimit = 50,
    ttsSpawn = defaultTtsSpawn,
    ttsPauseGuard = defaultTtsPauseGuard
  } = options
  const seenIds = new Set<string>()
  let intervalHandle: Timer | null = null

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

      seenIds.add(msg.id)

      const shortBody = msg.body.slice(0, MAX_BODY_CHARS)
      const toastText = `${msg.from}: ${shortBody}`

      // POST to overlay
      try {
        await fetch(overlayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'message', text: toastText }),
          signal: AbortSignal.timeout(OVERLAY_TIMEOUT_MS)
        })
      } catch (err) {
        console.error(
          '[relay-poller] overlay POST failed:',
          err instanceof Error ? err.message : String(err)
        )
      }

      // TTS via edge-tts (Microsoft Jenny neural voice).
      //
      // Chunk-5 #1 HIGH fix: no shell. The body is passed as a single
      // argv element; shell metacharacters (`$(...)`, backticks, `;`,
      // `&&`, pipes) cannot be interpreted because no shell is spawned.
      // The previous `sh -c "edge-tts ... --text ${JSON.stringify(body)}
      // ... && afplay /tmp/vb2-tts.mp3"` path was an RCE: double-quoted
      // `$(...)` still expands under `sh -c`, so any queued message
      // body could execute arbitrary commands on the host.
      //
      // We run the two steps independently (fire-and-forget), mirroring
      // the prior fire-and-forget semantics. afplay races with edge-tts
      // writing the file, but that matches the prior `&&` chain's
      // best-effort intent; full sequencing would require awaiting the
      // first child and is not part of the security fix.
      if (ttsEnabled) {
        const wordCount = msg.body.trim().split(/\s+/).length
        if (wordCount <= ttsWordLimit) {
          // Suppress wake-word detection across the full TTS playback window.
          // acquire() writes /tmp/wake-word-pause (daemon reads it every chunk).
          // release() removes it after afplay exits — guaranteed by try/finally.
          //
          // Before Chunk-5 #1 the old `speak` wrapper script handled this
          // implicitly. The argv-only split dropped the wrapper and the guard
          // with it, leaving the mic hot during TTS playback → feedback loop.
          ttsPauseGuard.acquire()
          try {
            ttsSpawn('edge-tts', [
              '--voice',
              'en-US-JennyNeural',
              '--text',
              msg.body,
              '--write-media',
              '/tmp/vb2-tts.mp3'
            ])
            // Await afplay exit so release() fires after audio finishes.
            // edge-tts runs fire-and-forget; afplay races with it writing
            // the file — matching the prior &&-chain's best-effort intent.
            //
            // 60-second cap prevents the poll loop from hanging forever if
            // afplay somehow never exits (e.g. SIGSTOP, zombie process).
            const afplayChild = ttsSpawn('afplay', ['/tmp/vb2-tts.mp3'])
            await Promise.race([
              once(afplayChild, 'exit'),
              new Promise<void>((resolve) => setTimeout(resolve, 60_000))
            ]).catch(() => {
              // afplay may exit non-zero (file not ready yet) — that's acceptable;
              // we still need to release the guard.
            })
          } catch (err) {
            console.error(
              '[relay-poller] TTS spawn failed:',
              err instanceof Error ? err.message : String(err)
            )
          } finally {
            ttsPauseGuard.release()
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
      const raw: string = readFileSync(opts.settingsPath, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (parsed !== null && typeof parsed === 'object') {
        if ('tts_enabled' in parsed && parsed.tts_enabled === true) {
          ttsEnabled = true
        }
        if ('tts_word_limit' in parsed && typeof parsed.tts_word_limit === 'number') {
          ttsWordLimit = parsed.tts_word_limit
        }
      }
    } catch {
      // settings file absent or unreadable — use defaults
    }
  }

  const poller = createRelayPoller({
    relayBaseUrl: opts.relayBaseUrl,
    overlayUrl: opts.overlayUrl,
    ttsEnabled,
    ttsWordLimit
  })
  poller.start()
  return poller
}
