/**
 * Overlay dispatch concern for the relay poller.
 *
 * Extracted from relay-poller.ts — handles the POST-to-overlay loop for
 * each queued message, including:
 *   - Skipping already-seen message IDs (dedup state lives in caller)
 *   - Filtering to TOAST_TYPES only
 *   - Truncating body to MAX_BODY_CHARS for the toast text
 *   - Deferring seenIds promotion until AFTER a successful POST (retry semantics)
 *   - Capping infinite retries at OVERLAY_MAX_RETRIES (3 failures → mark seen)
 *
 * The caller (relay-poller.ts) owns the seenIds/overlayFailCount maps and the
 * TTS pipeline — overlay dispatch has no TTS dependency.
 */

import { OVERLAY_TIMEOUT_MS } from './config.ts'
import { logger } from './logger.ts'

/** Message types that should be shown in the overlay */
const TOAST_TYPES = new Set(['done', 'status', 'message', 'waiting-for-input'])

const MAX_BODY_CHARS = 120
const OVERLAY_MAX_RETRIES = 3

/** Minimal shape of a queued relay message (only fields used by overlay dispatch) */
export interface OverlayMessage {
  id: string
  from: string
  type: string
  body: string
}

/**
 * Mutable state owned by the relay poller and threaded through each dispatch call.
 * Kept external so callers can inspect/reset it in tests.
 */
export interface OverlayDispatchState {
  /** id → timestamp; messages in this map are not re-dispatched */
  seenIds: Map<string, number>
  /** id → consecutive failure count; capped at OVERLAY_MAX_RETRIES then marked seen */
  overlayFailCount: Map<string, number>
}

/**
 * Dispatch a batch of queued relay messages to the overlay server.
 *
 * Mutates `state.seenIds` and `state.overlayFailCount` in-place:
 * - Success: seenIds.set(id), overlayFailCount.delete(id)
 * - Failure (below cap): overlayFailCount.increment(id)
 * - Failure (at cap): seenIds.set(id) to stop retrying, log warning
 *
 * Does NOT handle TTS — that remains in the relay-poller orchestrator.
 *
 * @param messages Array of queued messages from the relay (any type; filtered internally)
 * @param overlayUrl Full URL to POST toasts to (e.g. http://localhost:PORT/overlay)
 * @param state     Mutable dedup + retry state owned by the caller
 */
export async function dispatchOverlayMessages(
  messages: OverlayMessage[],
  overlayUrl: string,
  state: OverlayDispatchState
): Promise<void> {
  for (const msg of messages) {
    if (state.seenIds.has(msg.id)) continue
    if (!TOAST_TYPES.has(msg.type)) continue

    const shortBody = msg.body.slice(0, MAX_BODY_CHARS)
    const toastText = `${msg.from}: ${shortBody}`

    // POST to overlay. seenIds.set() is deferred until AFTER a successful
    // POST so that a transient failure does not permanently drop the message —
    // the next poll cycle will retry it.
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
        logger.error(
          { component: 'relay-poller', status: res.status, msgId: msg.id },
          'overlay_post_failed_status'
        )
      }
    } catch (err) {
      logger.error({ component: 'relay-poller', msgId: msg.id, error: err }, 'overlay_post_failed')
    }

    if (overlayOk) {
      // Success: mark seen and clear any failure count
      state.seenIds.set(msg.id, Date.now())
      state.overlayFailCount.delete(msg.id)
    } else {
      // Failure: increment count; after cap, mark seen to stop retrying
      const failures = (state.overlayFailCount.get(msg.id) ?? 0) + 1
      state.overlayFailCount.set(msg.id, failures)
      if (failures >= OVERLAY_MAX_RETRIES) {
        logger.warn(
          { component: 'relay-poller', failures, msgId: msg.id },
          'overlay_post_retry_cap_reached'
        )
        state.seenIds.set(msg.id, Date.now())
        state.overlayFailCount.delete(msg.id)
      }
      // Not yet at cap: leave message unseen so next poll retries
    }
  }
}
