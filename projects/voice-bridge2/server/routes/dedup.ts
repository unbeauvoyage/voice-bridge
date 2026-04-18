/**
 * Audio deduplication and Whisper hallucination filtering.
 *
 * Extracted from transcribe.ts to keep concerns separated:
 * - DedupEntry type: the three-variant discriminated union for dedup state
 * - hashAudioBuffer: SHA-256 fingerprint of an audio buffer (dedup key)
 * - evictStaleHashes: prune expired entries from the dedup map
 * - checkDedupEntry: resolves what to do when a duplicate audio hash is seen
 * - isWhisperHallucination: tests whether a transcript + RMS should be suppressed
 *
 * Deduplication prevents WKWebView retries (triggered by slow Whisper transcription)
 * from flooding the relay with duplicate messages. Each audio buffer is hashed;
 * on duplicate detection the handler either waits for the original to complete
 * (inProgress), returns a cached result (resolved/cancelled), or falls through to
 * re-process when the original failed (deleted entry).
 */

import {
  DEDUP_WINDOW_MS,
  WHISPER_HALLUCINATION_PHRASES,
  WHISPER_HALLUCINATION_RMS_THRESHOLD
} from '../config.ts'
import { logger } from '../logger.ts'

// ─── Hash + eviction ─────────────────────────────────────────────────────────

/**
 * SHA-256 fingerprint of an audio buffer, truncated to 16 hex chars.
 * Used as the dedup map key — short enough to be a fast map key, long enough
 * to make accidental collisions cosmically unlikely for real audio payloads.
 */
export function hashAudioBuffer(buf: Buffer): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(buf)
  return hasher.digest('hex').slice(0, 16)
}

/**
 * Prune entries older than DEDUP_WINDOW_MS from the dedup map.
 * Call before inserting a new entry to bound map growth.
 */
export function evictStaleHashes(recentAudioHashes: Map<string, DedupEntry>): void {
  const cutoff = Date.now() - DEDUP_WINDOW_MS
  for (const [h, entry] of recentAudioHashes) {
    if (entry.ts < cutoff) recentAudioHashes.delete(h)
  }
}

// ─── Dedup state ──────────────────────────────────────────────────────────────

/**
 * Deduplication state: tracks recent audio by hash to prevent WKWebView retries
 * from spamming the relay.
 *
 * Three variants:
 * - inProgress: transcription/delivery is still in flight
 * - resolved: transcript was delivered; duplicates get the cached result
 * - cancelled: transcript was a hallucination; duplicates get cancelled result
 *   without re-running whisper (prevents feedback-loop amplification)
 */
export type DedupEntry =
  | { ts: number; transcript: string; to: string; message: string }
  | { ts: number; inProgress: true }
  | { ts: number; cancelled: true; transcript: string }

/**
 * Result returned by checkDedupEntry when a duplicate audio hash is found.
 *
 * - response: a ready-to-return Response (duplicate handled — do not process further)
 * - fallthrough: the original failed mid-wait; the caller should re-process
 */
export type DedupCheckResult = { kind: 'response'; response: Response } | { kind: 'fallthrough' }

/**
 * Handle a duplicate audio hash: wait for the in-progress original to complete,
 * return a cached result if already resolved/cancelled, or fall through if the
 * original failed (cleared the entry).
 *
 * Called only when `recentAudioHashes.get(audioHash)` returns a defined entry.
 *
 * @param existing The existing map entry for this audio hash
 * @param audioHash The hash being checked (used for log messages and map access)
 * @param recentAudioHashes The dedup map (read again inside the wait loop)
 * @param waitDeadlineMs How long to wait for an inProgress original (ms)
 * @param corsHeaders CORS headers to attach to any Response produced
 * @returns DedupCheckResult — either a response to return, or fallthrough
 */
export async function checkDedupEntry(
  existing: DedupEntry,
  audioHash: string,
  recentAudioHashes: Map<string, DedupEntry>,
  waitDeadlineMs: number,
  corsHeaders: Record<string, string>
): Promise<DedupCheckResult> {
  if ('inProgress' in existing) {
    // Chunk-5 #4 HIGH: the old waiter returned
    // `200 {transcript:"", deduplicated:true}` on both deadline
    // expiry and entry-deletion, which let the client believe a
    // message was delivered when nothing had been. Now we
    // distinguish the three outcomes explicitly.
    const deadline = Date.now() + waitDeadlineMs
    let outcome: 'resolved' | 'cancelled' | 'deleted' | 'timeout' = 'timeout'
    let resolved: DedupEntry | undefined
    while (Date.now() < deadline) {
      await Bun.sleep(300)
      const updated = recentAudioHashes.get(audioHash)
      if (!updated) {
        outcome = 'deleted'
        break
      }
      if ('cancelled' in updated) {
        outcome = 'cancelled'
        resolved = updated
        break
      }
      if (!('inProgress' in updated)) {
        outcome = 'resolved'
        resolved = updated
        break
      }
    }
    if (outcome === 'cancelled' && resolved && 'cancelled' in resolved) {
      // Original detected hallucination — return cached cancelled result.
      // Do NOT re-run whisper; that would just hallucinate again.
      logger.info('voice-bridge', 'duplicate_original_hallucination_cached', {})
      return {
        kind: 'response',
        response: Response.json(
          {
            transcript: resolved.transcript,
            cancelled: true,
            reason: 'whisper-hallucination',
            deduplicated: true
          },
          { headers: corsHeaders }
        )
      }
    }
    if (
      outcome === 'resolved' &&
      resolved &&
      !('inProgress' in resolved) &&
      !('cancelled' in resolved) &&
      'to' in resolved
    ) {
      logger.info('voice-bridge', 'duplicate_resolved_cached', {})
      return {
        kind: 'response',
        response: Response.json(
          { transcript: resolved.transcript, to: resolved.to, deduplicated: true },
          { headers: corsHeaders }
        )
      }
    }
    if (outcome === 'timeout') {
      // Original still in progress past the wait deadline. Tell the
      // client to retry — do NOT fabricate a successful empty
      // transcript. 409 Conflict is the honest shape: "there is a
      // conflicting in-flight request for this exact audio; try
      // again shortly."
      logger.info('voice-bridge', 'dedup_wait_deadline_exceeded', { hash: audioHash })
      return {
        kind: 'response',
        response: Response.json(
          { error: 'Original transcription still in progress — retry later', retryAfterMs: 2000 },
          { status: 409, headers: corsHeaders }
        )
      }
    }
    // outcome === 'deleted' — the original request failed and
    // cleared its cache entry. Fall through and re-run transcription
    // + delivery for this duplicate so it gets a real attempt rather
    // than an empty 200.
    logger.info('voice-bridge', 'duplicate_original_failed_reprocessing', { hash: audioHash })
    return { kind: 'fallthrough' }
  } else if ('cancelled' in existing) {
    // Original was a hallucination — return cached cancelled result without re-running whisper.
    logger.info('voice-bridge', 'duplicate_cached_hallucination_cancellation', { hash: audioHash })
    return {
      kind: 'response',
      response: Response.json(
        {
          transcript: existing.transcript,
          cancelled: true,
          reason: 'whisper-hallucination',
          deduplicated: true
        },
        { headers: corsHeaders }
      )
    }
  } else if ('to' in existing) {
    // First request already completed — return cached result, skip relay.
    return {
      kind: 'response',
      response: Response.json(
        { transcript: existing.transcript, to: existing.to, deduplicated: true },
        { headers: corsHeaders }
      )
    }
  }
  // Unknown entry variant — fall through to re-process (defensive)
  return { kind: 'fallthrough' }
}

/**
 * Test whether a transcript + audio RMS combination is a Whisper hallucination
 * that should be suppressed.
 *
 * Returns true when:
 * - The transcript (trimmed, lowercased, punctuation stripped) matches a known
 *   hallucination phrase, AND
 * - The audio RMS is below WHISPER_HALLUCINATION_RMS_THRESHOLD
 *
 * Defense-in-depth against TTS bleed feedback loops: when TTS audio bleeds back
 * into the mic, Whisper's artifact is a known single-phrase hallucination.
 */
export function isWhisperHallucination(transcript: string, audioRms: number): boolean {
  const normalised = transcript
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
  if (!WHISPER_HALLUCINATION_PHRASES.has(normalised)) return false
  return audioRms < WHISPER_HALLUCINATION_RMS_THRESHOLD
}
