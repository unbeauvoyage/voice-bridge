/**
 * Delivers transcribed text to a Claude Code agent via the relay server.
 * Also echoes the message into the CEO's own feed so the conversation view
 * shows both outgoing voice messages and agent responses in one thread.
 */

type SendRequest = { from: string; to: string; type: string; body: string }

function isRelayResponse(value: unknown): value is { status: string } {
  return typeof value === 'object' && value !== null && 'status' in value
}

const RELAY_BASE_URL = process.env.RELAY_BASE_URL ?? 'http://localhost:8767'
const RELAY_URL = `${RELAY_BASE_URL}/send`
const RELAY_TIMEOUT_MS = 5_000

export async function deliverToAgent(transcript: string, to: string): Promise<void> {
  const body: SendRequest = {
    from: 'ceo',
    to,
    type: 'voice',
    body: transcript
  }

  const res = await fetch(RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS)
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Relay returned ${res.status}: ${text}`)
  }

  const data: unknown = await res.json()
  if (!isRelayResponse(data)) {
    throw new Error('Relay returned invalid response')
  }
  if (data.status === 'queued') {
    throw new Error(`Agent "${to}" is offline — message queued but not delivered`)
  }

  // Echo into CEO's feed so outgoing messages appear alongside agent responses.
  // Fire-and-forget — don't block delivery on this.
  fetch(RELAY_URL, {
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
}
