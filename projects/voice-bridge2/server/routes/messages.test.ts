import { describe, test, expect } from 'bun:test'
import { handleMessages, type MessagesContext } from './messages.ts'

async function readJsonObject(res: Response): Promise<Record<string, unknown>> {
  const raw: unknown = await res.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('non-object body')
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = v
  return out
}

function makeCtx(overrides: Partial<MessagesContext> & { relayJson?: unknown } = {}): MessagesContext {
  const { relayJson, ...ctxOverrides } = overrides
  return {
    relayBaseUrl: 'http://mock-relay',
    fetchFn: async () => new Response(JSON.stringify(relayJson ?? { messages: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }),
    ...ctxOverrides
  }
}

describe('handleMessages', () => {
  // Guaranteed-closed loopback port — any fetch to it triggers ConnectionRefused.
  const DEAD_RELAY = 'http://127.0.0.1:1'

  test('module exports handleMessages as a function', () => {
    expect(typeof handleMessages).toBe('function')
  })

  test('returns 502 JSON with CORS header when relay is unreachable', async () => {
    const ctx: MessagesContext = { relayBaseUrl: DEAD_RELAY }
    const req = new Request('http://localhost/messages?agent=command')
    const res = await handleMessages(req, ctx)
    expect(res.status).toBe(502)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = await readJsonObject(res)
    expect(body.error).toBe('Relay unavailable')
    expect(body.agent).toBe('command')
  })

  test('defaults agent to "command" when no agent query param', async () => {
    const ctx: MessagesContext = { relayBaseUrl: DEAD_RELAY }
    const req = new Request('http://localhost/messages')
    const res = await handleMessages(req, ctx)
    const body = await readJsonObject(res)
    expect(body.agent).toBe('command')
  })

  test('propagates explicit agent query param', async () => {
    const ctx: MessagesContext = { relayBaseUrl: DEAD_RELAY }
    const req = new Request('http://localhost/messages?agent=matrix')
    const res = await handleMessages(req, ctx)
    const body = await readJsonObject(res)
    expect(body.agent).toBe('matrix')
  })

  // Agent name length cap: a very long agent name could be forwarded to the
  // relay URL, bloating the request and potentially triggering relay bugs.
  // Cap at 128 chars matching the MAX_TO_LEN convention from /transcribe.
  test('rejects agent name over 128 chars with 400', async () => {
    const ctx: MessagesContext = { relayBaseUrl: DEAD_RELAY }
    const longAgent = 'A'.repeat(200)
    const req = new Request(`http://localhost/messages?agent=${longAgent}`)
    const res = await handleMessages(req, ctx)
    expect(res.status).toBe(400)
    const body = await readJsonObject(res)
    expect(typeof body.error).toBe('string')
  })

  // Shape validation: the relay is internal but could be buggy or compromised.
  // A response that is not an object/array (e.g. a plain string) must not be
  // forwarded blindly — return 502 with a clear reason.
  test('rejects relay response that is not an object/array with 502', async () => {
    const ctx = makeCtx({ relayJson: 'hello' })
    const req = new Request('http://localhost/messages?agent=command')
    const res = await handleMessages(req, ctx)
    expect(res.status).toBe(502)
    const body = await readJsonObject(res)
    expect(typeof body.error).toBe('string')
    expect(String(body.error).toLowerCase()).toMatch(/shape|unexpected|relay/)
  })

  // Happy path with mock: valid relay response (object with messages array)
  // must be forwarded as-is with 200 and CORS header.
  test('forwards valid relay response with 200 and CORS header', async () => {
    const relayPayload = { messages: [{ id: 1, text: 'hello' }] }
    const ctx = makeCtx({ relayJson: relayPayload })
    const req = new Request('http://localhost/messages?agent=command')
    const res = await handleMessages(req, ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = await readJsonObject(res)
    expect(Array.isArray(body.messages)).toBe(true)
  })
})
