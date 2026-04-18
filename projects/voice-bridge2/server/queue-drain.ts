/**
 * Queue drain — fetch and process messages queued for voice-bridge on the relay.
 *
 * The relay (message-relay) stores messages for offline agents at
 * GET /queue/:agent. When voice-bridge starts up it calls drainVoiceBridgeQueue
 * so messages sent while it was offline are not lost.
 *
 * Design:
 *   - Fetches /queue/voice-bridge once.
 *   - Parses the response with parseQueueResponse (shared with relay-poller).
 *   - Calls onMessage for each valid message so callers can log/dispatch.
 *   - Returns the full array of drained messages.
 *   - Never throws — returns [] on any network or parse error.
 */

import { parseQueueResponse } from './relay-messages.ts'
import { RELAY_POLL_TIMEOUT_MS } from './config.ts'
import { logger } from './logger.ts'

/** Shape of a message drained from the relay queue. */
export type DrainedMessage = {
  id: string
  from: string
  to: string
  type: string
  body: string
  ts: string
}

/**
 * Drains the voice-bridge queue from the relay on startup.
 *
 * @param relayBaseUrl  Base URL of the relay server (e.g. "http://localhost:8767").
 * @param onMessage     Called once per queued message, in order. Use for logging
 *                      or dispatching. Errors thrown here are not caught — callers
 *                      are responsible for wrapping if needed.
 * @returns             All valid messages drained from the queue, or [] on error.
 */
export async function drainVoiceBridgeQueue(
  relayBaseUrl: string,
  onMessage: (msg: DrainedMessage) => void
): Promise<DrainedMessage[]> {
  let raw: unknown
  try {
    const res = await fetch(`${relayBaseUrl}/queue/voice-bridge`, {
      signal: AbortSignal.timeout(RELAY_POLL_TIMEOUT_MS)
    })
    if (!res.ok) {
      logger.warn('queue-drain', 'relay_queue_fetch_failed', { status: res.status })
      return []
    }
    raw = await res.json()
  } catch (err) {
    logger.warn('queue-drain', 'relay_unreachable', { error: err })
    return []
  }

  const messages = parseQueueResponse(raw)

  for (const msg of messages) {
    logger.info('queue-drain', 'processing_queued_message', {
      id: msg.id,
      from: msg.from,
      type: msg.type,
      body: msg.body
    })
    onMessage(msg)
  }

  if (messages.length > 0) {
    logger.info('queue-drain', 'drain_complete', { count: messages.length })
  }

  return messages
}
