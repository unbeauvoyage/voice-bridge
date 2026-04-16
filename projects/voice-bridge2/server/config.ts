/**
 * Centralized server configuration constants.
 *
 * All hardcoded ports, URLs, and timeouts live here.
 * Files import named constants rather than scattering literals.
 * Env-var overrides are honoured at the point of use, with these values as defaults.
 */

// ─── Ports ────────────────────────────────────────────────────────────────────

/** HTTP port for the voice-bridge Bun server (overridden by process.env.PORT). */
export const SERVER_PORT = 3030

/** Port the message-relay listens on. */
export const RELAY_PORT = 8767

/** Port the whisper.cpp inference server listens on. */
export const WHISPER_PORT = 8766

/** Port the overlay toast server listens on. */
export const OVERLAY_PORT = 47890

/** Port Ollama listens on. */
export const OLLAMA_PORT = 11434

// ─── Base URLs ────────────────────────────────────────────────────────────────

/** Base URL for the message-relay (overridden by process.env.RELAY_BASE_URL). */
export const RELAY_BASE_URL_DEFAULT = `http://localhost:${RELAY_PORT}`

/** Full URL for the whisper.cpp inference endpoint (overridden by process.env.WHISPER_URL). */
export const WHISPER_BASE_URL_DEFAULT = `http://127.0.0.1:${WHISPER_PORT}/inference`

/** Full URL for the Ollama generate endpoint (overridden by process.env.OLLAMA_URL). */
export const OLLAMA_BASE_URL_DEFAULT = `http://localhost:${OLLAMA_PORT}/api/generate`

/** Full URL for the overlay toast endpoint (overridden by process.env.OVERLAY_URL). */
export const OVERLAY_URL_DEFAULT = `http://localhost:${OVERLAY_PORT}/overlay`

// ─── Timeouts (milliseconds) ──────────────────────────────────────────────────

/**
 * Timeout for relay HTTP calls made from server/index.ts (messages proxy, agents list).
 * Generous because the relay may be on a Tailscale VPN hop.
 */
export const RELAY_TIMEOUT_MS = 30_000

/**
 * Timeout for relay HTTP calls made from server/relay.ts (deliver + echo fire-and-forget).
 * Shorter because delivery must not block the transcription response.
 */
export const RELAY_SEND_TIMEOUT_MS = 5_000

/**
 * Timeout for each relay poll request in relay-poller.ts.
 * Short — poll is frequent and should fail fast.
 */
export const RELAY_POLL_TIMEOUT_MS = 5_000

/**
 * Timeout for overlay POST requests in relay-poller.ts.
 * Short — overlay is local and should respond immediately.
 */
export const OVERLAY_TIMEOUT_MS = 3_000

/**
 * Timeout for Ollama generate requests in llmRouter.ts.
 * 10 s is generous for a local quantised model.
 */
export const OLLAMA_TIMEOUT_MS = 10_000

/**
 * Timeout for Whisper transcription requests in whisper.ts.
 * 2 min — medium model on CPU can take 60-90 s for longer audio.
 */
export const WHISPER_TIMEOUT_MS = 120_000

// ─── Polling ──────────────────────────────────────────────────────────────────

/** How often the relay-poller checks for new agent messages (ms). */
export const POLL_INTERVAL_MS = 3_000

// ─── Whisper hallucination filter ─────────────────────────────────────────────

/**
 * Known single-phrase Whisper hallucinations on low-signal audio.
 * When audio RMS is below WHISPER_HALLUCINATION_RMS_THRESHOLD and the
 * trimmed/lowercased/punctuation-stripped transcript matches one of these,
 * the transcription is treated as cancelled rather than delivered.
 *
 * These are artifacts Whisper emits when the input is near-silent
 * (wake-word mic bleed, ambient noise, TTS feedback).
 */
export const WHISPER_HALLUCINATION_PHRASES = new Set([
  'hello',
  'thank you',
  'thanks for watching',
  'you',
  'bye'
])

/**
 * Audio RMS threshold (on 16-bit int16 scale, 0–32767) below which a
 * single-phrase transcript is considered a hallucination.
 * At 500 a genuine voice input is loud enough to exceed this by ~100×;
 * near-silent bleed/ambient noise sits near 0–50.
 */
export const WHISPER_HALLUCINATION_RMS_THRESHOLD = 500

// ─── Mic pause directory (refcount owner-token design) ────────────────────────
//
// The original single-file /tmp/wake-word-pause was shared between:
//   • manual mic-off (server/index.ts) — writes the file when user says "turn off mic"
//   • TTS pause guard (relay-poller.ts) — writes the file before TTS playback
// This caused two collision bugs:
//   1. TTS release() unlinked the file mid-manual-silence → mic went hot against user intent.
//   2. Overlapping TTS cycles raced: second release() unlinked first's token mid-playback.
//
// Fix: per-owner token directory. Each owner writes its own file:
//   • manual mic-off writes {MIC_PAUSE_DIR}/manual
//   • each TTS cycle writes {MIC_PAUSE_DIR}/tts-{uuid}
// Daemon pauses if MIC_PAUSE_DIR exists AND contains any file.
// release() only unlinks its own token; manual token survives TTS cycles.
//
// MIC_PAUSE_FILE kept for backward-compatibility with any external tooling that
// checks the old path. The daemon now checks MIC_PAUSE_DIR instead.

/** @deprecated Use MIC_PAUSE_DIR with per-owner token files instead. */
export const MIC_PAUSE_FILE = '/tmp/wake-word-pause'

/**
 * Directory whose non-empty presence tells daemon/wake_word.py to suppress
 * wake-word detection. Each owner writes its own token file inside this dir.
 * Daemon checks: dir exists AND has at least one entry.
 */
export const MIC_PAUSE_DIR = '/tmp/wake-word-pause.d'

// ─── Deduplication ───────────────────────────────────────────────────────────

/**
 * Window during which identical audio hashes are treated as duplicates (ms).
 * WKWebView retries fetches when Whisper is slow; 30 s covers the retry window.
 */
export const DEDUP_WINDOW_MS = 30_000

/**
 * Maximum time to wait for an in-progress transcription before giving up on
 * a duplicate request (ms).
 */
export const DEDUP_WAIT_DEADLINE_MS = 90_000
