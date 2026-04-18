/**
 * Public types for the POST /transcribe handler.
 *
 * Extracted from transcribe.ts to keep the orchestrator concise.
 */

import type { TranscribeResult } from '../whisper.ts'
import type { LlmRouteResult } from '../llmRouter.ts'
import type { DedupEntry } from './dedup.ts'

export type DeliveryResult = { ok: true } | { ok: false; error: string }

/**
 * Context object passed to the transcribe handler.
 * All shared state and dependencies needed by the handler.
 */
export type TranscribeContext = {
  // Audio dedup state and operations
  recentAudioHashes: Map<string, DedupEntry>
  evictStaleHashes: () => void
  hashAudioBuffer: (buf: Buffer) => string

  // Target (sticky routing destination)
  loadLastTarget: () => string
  saveLastTarget: (target: string) => void

  // Mic control (voice commands can pause/resume)
  handleMicCommand: (transcript: string) => { handled: true; state: 'on' | 'off' } | null

  // Agent discovery (for "please" routing)
  getKnownAgents: () => Promise<string[]>

  // Audio transcription — injected so tests can stub without mock.module()
  transcribeAudio: (buffer: Buffer, mimeType: string) => Promise<TranscribeResult>

  // LLM-based agent routing — injected so tests can stub without mock.module()
  llmRoute: (
    transcript: string,
    knownAgents: string[],
    fallbackAgent: string
  ) => Promise<LlmRouteResult>

  // Message delivery — returns {ok:false} only when BOTH relay and cmux fail.
  deliverMessage: (message: string, to: string) => Promise<DeliveryResult>

  // Optional override for the dedup-waiter deadline. Tests inject a small value
  // so retry/timeout paths can be exercised quickly.
  dedupWaitDeadlineMs?: number
}
