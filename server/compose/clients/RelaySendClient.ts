/**
 * RelaySendClient — interface + HTTP implementation.
 *
 * POSTs to relay /send with { from, to, body, type }.
 * Returns the message id on success.
 * Throws on network failure or non-200 from the relay.
 */

// ── Interface ──────────────────────────────────────────────────────────────────

export interface RelaySendParams {
  from: string
  to: string
  body: string
  type: string
}

export interface RelaySendResult {
  id: string
  status: 'delivered' | 'queued'
}

export interface IRelaySendClient {
  /**
   * Send a message via the relay /send endpoint.
   * Returns { id, status } on success.
   * Throws on network failure or relay error.
   */
  send(params: RelaySendParams): Promise<RelaySendResult>
}

// ── Response type guard ───────────────────────────────────────────────────────

function isRelaySendResponse(
  value: unknown
): value is { id: string; status: 'delivered' | 'queued' } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'status' in value &&
    (value.status === 'delivered' || value.status === 'queued')
  )
}

import { propagation, context } from '@opentelemetry/api'

// ── HTTP implementation ────────────────────────────────────────────────────────

export class HttpRelaySendClient implements IRelaySendClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(baseUrl: string, timeoutMs = 5_000) {
    this.baseUrl = baseUrl
    this.timeoutMs = timeoutMs
  }

  async send(params: RelaySendParams): Promise<RelaySendResult> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    propagation.inject(context.active(), headers)

    const res = await fetch(`${this.baseUrl}/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(this.timeoutMs)
    })

    const body: unknown = await res.json().catch(() => null)

    if (!res.ok) {
      const detail =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
          ? body.error
          : String(res.status)
      throw new Error(`relay /send failed ${res.status}: ${detail}`)
    }

    if (!isRelaySendResponse(body)) {
      throw new Error(`relay /send returned unexpected response shape: ${JSON.stringify(body)}`)
    }

    return { id: body.id, status: body.status }
  }
}
