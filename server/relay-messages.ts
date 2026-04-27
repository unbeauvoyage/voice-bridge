/**
 * Relay message parsing concern.
 *
 * Extracted from relay-poller.ts — type guard and queue response parser for
 * messages returned by GET /queue/:agent on the relay.
 */

/** Message shape returned by GET /queue/:agent */
export interface QueuedMessage {
  id: string
  from: string
  to: string
  type: string
  body: string
  ts: string
}

export function isQueuedMessage(value: unknown): value is QueuedMessage {
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

export function parseQueueResponse(value: unknown): QueuedMessage[] {
  if (value === null || typeof value !== 'object') return []
  if (!('messages' in value)) return []
  const raw = value.messages
  if (!Array.isArray(raw)) return []
  return raw.filter(isQueuedMessage)
}
