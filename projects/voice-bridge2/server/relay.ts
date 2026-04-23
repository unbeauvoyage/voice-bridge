/**
 * Delivers transcribed text to a Claude Code agent via the relay server.
 *
 * Per server-standards.md: returns Result<void> instead of throwing.
 * Callers check result.ok; they never need to catch.
 *
 * New relay contract (POST /api/messages):
 *   200 {status:"delivered"} — agent received it
 *   503 {status:"offline"}  — agent not connected; terminal, no retry
 */

import { RELAY_BASE_URL_DEFAULT, RELAY_SEND_TIMEOUT_MS } from './config.ts'
import type { Result } from './lib/result.ts'

type SendRequest = { from: string; to: string; type: string; body: string }

function isDeliveredResponse(value: unknown): value is { status: 'delivered' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'status' in value &&
    value.status === 'delivered'
  )
}

const RELAY_TIMEOUT_MS = RELAY_SEND_TIMEOUT_MS

function relayUrl(): string {
  const base = process.env.RELAY_BASE_URL ?? RELAY_BASE_URL_DEFAULT
  return `${base}/api/messages`
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

  if (!isDeliveredResponse(data)) {
    return { ok: false, error: 'Relay returned invalid response' }
  }

  return { ok: true, data: undefined }
}
