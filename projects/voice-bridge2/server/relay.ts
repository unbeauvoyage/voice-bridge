/**
 * Delivers transcribed text to a Claude Code agent via the relay server.
 * Also echoes the message into the CEO's own feed so the conversation view
 * shows both outgoing voice messages and agent responses in one thread.
 *
 * Per server-standards.md: returns Result<void> instead of throwing.
 * Callers check result.ok; they never need to catch.
 */

import { RELAY_BASE_URL_DEFAULT, RELAY_SEND_TIMEOUT_MS } from './config.ts'
import type { Result } from './lib/result.ts'

type SendRequest = { from: string; to: string; type: string; body: string }

// Chunk-5 #2 HIGH: the prior `'status' in value` check was satisfied by
// any object carrying a `status` key, regardless of value type or enum
// membership. A relay returning `{status: 123}` or `{status: "bogus"}`
// would pass that check, fail the 'queued' comparison, and resolve as
// if delivered — silent non-delivery. The real relay contract is a
// string enum of exactly 'delivered' | 'queued'; anything else is an
// invalid response and MUST be treated as an error.
type RelayStatus = 'delivered' | 'queued'
function isRelayResponse(value: unknown): value is { status: RelayStatus } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  if (!('status' in value)) return false
  const s: unknown = value.status
  return s === 'delivered' || s === 'queued'
}

const RELAY_TIMEOUT_MS = RELAY_SEND_TIMEOUT_MS

function relayUrl(): string {
  const base = process.env.RELAY_BASE_URL ?? RELAY_BASE_URL_DEFAULT
  return `${base}/send`
}

export async function deliverToAgent(transcript: string, to: string): Promise<Result<void>> {
  const body: SendRequest = {
    from: 'ceo',
    to,
    type: 'voice',
    body: transcript
  }

  const url = relayUrl()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS)
    })
  } catch (err) {
    return { ok: false, error: `Relay unreachable: ${String(err)}` }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, error: `Relay returned ${res.status}: ${text}` }
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    return { ok: false, error: 'Relay returned non-JSON response' }
  }

  if (!isRelayResponse(data)) {
    return { ok: false, error: 'Relay returned invalid response' }
  }
  if (data.status === 'queued') {
    return { ok: false, error: `Agent "${to}" is offline — message queued but not delivered` }
  }

  // Echo into CEO's feed so outgoing messages appear alongside agent responses.
  // Fire-and-forget — don't block delivery on this.
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'ceo',
      to: 'ceo',
      type: 'voice-sent',
      body: transcript,
      meta: { sentTo: to }
    }),
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS)
  }).catch(() => {})

  return { ok: true, data: undefined }
}
