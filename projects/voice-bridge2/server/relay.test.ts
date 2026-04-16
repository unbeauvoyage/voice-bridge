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
 * These tests pin the tighter shape: the response must be exactly
 * { status: 'delivered' }. 'queued' throws with the offline message;
 * anything else (wrong type, unknown enum, missing key) throws as an
 * invalid relay response.
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
  test('resolves when relay returns {status: "delivered"}', async () => {
    nextResponse = { status: 200, body: { status: 'delivered' } }
    await expect(deliverToAgent('hello', 'command')).resolves.toBeUndefined()
  })

  test('throws offline error when relay returns {status: "queued"}', async () => {
    nextResponse = { status: 200, body: { status: 'queued' } }
    await expect(deliverToAgent('hello', 'command')).rejects.toThrow(/offline|queued/i)
  })

  test('throws on unknown status enum value (e.g. "bogus")', async () => {
    // Previously treated as success — only 'delivered' must be.
    nextResponse = { status: 200, body: { status: 'bogus' } }
    await expect(deliverToAgent('hello', 'command')).rejects.toThrow()
  })

  test('throws when status is wrong type (number)', async () => {
    nextResponse = { status: 200, body: { status: 123 } }
    await expect(deliverToAgent('hello', 'command')).rejects.toThrow()
  })

  test('throws when status is wrong type (object)', async () => {
    nextResponse = { status: 200, body: { status: { nested: 'delivered' } } }
    await expect(deliverToAgent('hello', 'command')).rejects.toThrow()
  })

  test('throws when status key is missing entirely', async () => {
    nextResponse = { status: 200, body: { foo: 'delivered' } }
    await expect(deliverToAgent('hello', 'command')).rejects.toThrow()
  })

  test('throws when body is not an object (array)', async () => {
    nextResponse = { status: 200, body: ['delivered'] }
    await expect(deliverToAgent('hello', 'command')).rejects.toThrow()
  })

  test('throws when body is not an object (string)', async () => {
    nextResponse = { status: 200, body: 'delivered' }
    await expect(deliverToAgent('hello', 'command')).rejects.toThrow()
  })
})
