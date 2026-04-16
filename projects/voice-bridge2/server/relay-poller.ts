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
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import {
  POLL_INTERVAL_MS,
  RELAY_POLL_TIMEOUT_MS,
  OVERLAY_TIMEOUT_MS,
  MIC_PAUSE_DIR
} from './config.ts'

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

/**
 * Creates a per-call TtsPauseGuard backed by a token file in MIC_PAUSE_DIR.
 *
 * Each TTS cycle gets a unique token name (tts-{uuid}) so concurrent cycles
 * and manual mic-off (which writes {MIC_PAUSE_DIR}/manual) cannot stomp each other.
 * acquire() writes the token; release() unlinks only that token.
 * The directory is created with mkdir -p on acquire so the guard is self-contained.
 */
function createTtsPauseGuard(): TtsPauseGuard {
  const token = `tts-${randomUUID()}`
  const tokenPath = `${MIC_PAUSE_DIR}/${token}`
  return {
    acquire() {
      try {
        mkdirSync(MIC_PAUSE_DIR, { recursive: true })
        writeFileSync(tokenPath, '')
      } catch {
        /* ignore write errors */
      }
    },
    release() {
      try {
        unlinkSync(tokenPath)
      } catch {
        /* token may not exist if acquire failed */
      }
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
    ttsSpawn = defaultTtsSpawn
  } = options

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

  const seenIds = new Set<string>()
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
      // Chunk-5 HIGH fix #2: per-owner pause token.
      // Each TTS call creates a unique tts-{uuid} token in MIC_PAUSE_DIR.
      // release() only unlinks that specific token, so:
      //   • the user's manual mic-off token ({MIC_PAUSE_DIR}/manual) survives TTS
      //   • overlapping TTS cycles cannot clear each other's tokens
      if (ttsEnabled) {
        const wordCount = msg.body.trim().split(/\s+/).length
        if (wordCount <= ttsWordLimit) {
          // Each message gets its own unique guard instance (unique UUID token).
          // This prevents concurrent TTS cycles from stomping each other and
          // prevents TTS from clearing the user's manual mic-off token.
          const guard = guardFactory()
          guard.acquire()
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
            guard.release()
          }
        }
      }
    }
  }

  function start(): void {
    if (intervalHandle !== null) return
    // Fire immediately, then on interval.
    // The inFlight guard is applied only on interval ticks (not the initial
    // eager fire) so the first poll always runs. Interval ticks skip if the
    // previous cycle is still awaiting TTS afplay, preventing two concurrent
    // TTS playbacks from racing when the poll interval is shorter than TTS time.
    void pollOnce()
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
