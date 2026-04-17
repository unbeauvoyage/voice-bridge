/**
 * Public types for the relay poller.
 *
 * Extracted from relay-poller.ts to keep the orchestrator concise.
 * Import these types wherever RelayPollerOptions or RelayPoller are needed.
 */

import type { TtsSpawn, TtsPauseGuard } from './tts.ts'

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
