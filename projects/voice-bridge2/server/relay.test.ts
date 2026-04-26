/**
 * Tests for deliverToAgent — the /send caller against the relay.
 *
 * Chunk-5 #2 HIGH (found by codex adversarial review).
 *
 * deliverToAgent used `'status' in value` as its response schema check,
 * which is satisfied by any object carrying a `status` key regardless
 * of value type or content. Relay returning `{status: 123}` or
 * `{status: "bogus"}` would pass the check, fail the 'queued' equality
 * check, and resolve as if delivered. The composed deliverMessage in
 * server/index.ts would then report ok:true and /transcribe would
 * reply 200 delivered:true — a silent non-delivery.
 *
 * Both 'delivered' and 'queued' are now treated as ok:true — the relay
 * has accepted the message in both cases. 'queued' means the agent is
 * offline but the message is safely stored and will be delivered when
 * the agent reconnects. Returning ok:false for 'queued' causes the
 * caller to fall back to cmux, which fails for agents started outside
 * cmux. The relay queue is the correct delivery path.
 *
 * Anything else (wrong type, unknown enum, missing key) returns
 * { ok: false } with an invalid-response message.
 *
 * Per server-standards.md: functions that perform I/O return Result<T>,
 * never void/throw. Callers check result.ok instead of catching.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { deliverToAgent } from './relay.ts'

const RELAY_PORT = 19765

let relayServer: ReturnType<typeof Bun.serve>
let nextResponse: { status: number; body: unknown } = { status: 200, body: { status: 'delivered' } }

beforeAll(() => {
  process.env['RELAY_BASE_URL'] = `http://localhost:${RELAY_PORT}`
  relayServer = Bun.serve({
    port: RELAY_PORT,
    fetch() {
      const { status, body } = nextResponse
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })
})

afterAll(() => {
  relayServer?.stop(true)
  delete process.env['RELAY_BASE_URL']
})

describe('deliverToAgent — strict relay response schema', () => {
  test('returns { ok: true } when relay returns {status: "delivered"}', async () => {
    nextResponse = { status: 200, body: { status: 'delivered' } }
    const result = await deliverToAgent('hello', 'command')
    expect(result.ok).toBe(true)
  })

  test('returns { ok: true } when relay returns {status: "queued"}', async () => {
    // 'queued' means the agent is offline but the relay has accepted and stored the message.
    // This is a successful delivery to the relay — not an error. Treating it as ok:false
    // causes the caller to fall through to cmux, which fails with "Access denied" for
    // agents not started inside cmux. The relay queue is the correct and safe delivery path.
    nextResponse = { status: 200, body: { status: 'queued' } }
    const result = await deliverToAgent('hello', 'command')
    expect(result.ok).toBe(true)
  })

  test('returns { ok: false } on unknown status enum value (e.g. "bogus")', async () => {
    // Previously treated as success — only 'delivered' must be accepted.
    nextResponse = { status: 200, body: { status: 'bogus' } }
    const result = await deliverToAgent('hello', 'command')
    expect(result.ok).toBe(false)
  })

  test('returns { ok: false } when status is wrong type (number)', async () => {
    nextResponse = { status: 200, body: { status: 123 } }
    const result = await deliverToAgent('hello', 'command')
    expect(result.ok).toBe(false)
  })

  test('returns { ok: false } when status is wrong type (object)', async () => {
    nextResponse = { status: 200, body: { status: { nested: 'delivered' } } }
    const result = await deliverToAgent('hello', 'command')
    expect(result.ok).toBe(false)
  })

  test('returns { ok: false } when status key is missing entirely', async () => {
    nextResponse = { status: 200, body: { foo: 'delivered' } }
    const result = await deliverToAgent('hello', 'command')
    expect(result.ok).toBe(false)
  })

  test('returns { ok: false } when body is not an object (array)', async () => {
    nextResponse = { status: 200, body: ['delivered'] }
    const result = await deliverToAgent('hello', 'command')
    expect(result.ok).toBe(false)
  })

  test('returns { ok: false } when body is not an object (string)', async () => {
    nextResponse = { status: 200, body: 'delivered' }
    const result = await deliverToAgent('hello', 'command')
    expect(result.ok).toBe(false)
  })
})
