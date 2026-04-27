/**
 * Integration tests for voice-bridge queue drain on startup.
 *
 * voice-bridge registers as an agent on the relay. Messages sent to it while
 * offline are queued at GET /queue/voice-bridge. On startup, voice-bridge
 * must drain this queue so no messages are lost.
 *
 * Each test spins up a minimal fake relay server (Bun.serve) on a dedicated
 * port, calls drainVoiceBridgeQueue, and asserts on the returned messages
 * and/or side effects. No real relay is required.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { drainVoiceBridgeQueue, type DrainedMessage } from '../../server/queue-drain.ts'

// ── Fake relay ────────────────────────────────────────────────────────────────

const FAKE_RELAY_PORT = 19800

/** What the fake relay returns for GET /queue/voice-bridge. */
let fakeQueueResponse: { status: number; body: unknown } = { status: 200, body: { messages: [] } }

let fakeRelayServer: ReturnType<typeof Bun.serve>

beforeAll(() => {
  fakeRelayServer = Bun.serve({
    port: FAKE_RELAY_PORT,
    fetch(req) {
      const url = new URL(req.url)
      if (req.method === 'GET' && url.pathname === '/queue/voice-bridge') {
        const { status, body } = fakeQueueResponse
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response('Not found', { status: 404 })
    }
  })
})

afterAll(() => {
  fakeRelayServer?.stop(true)
})

const FAKE_RELAY_BASE = `http://localhost:${FAKE_RELAY_PORT}`

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('queue drain on startup', () => {
  test('voice-bridge drains queued messages on startup — processes each message', async () => {
    const queued = [
      {
        id: 'msg-001',
        from: 'chief-of-staff',
        to: 'voice-bridge',
        type: 'message',
        body: 'status update while you were offline',
        ts: new Date().toISOString()
      },
      {
        id: 'msg-002',
        from: 'productivitesse',
        to: 'voice-bridge',
        type: 'message',
        body: 'second queued message',
        ts: new Date().toISOString()
      }
    ]
    fakeQueueResponse = { status: 200, body: { messages: queued } }

    const received: DrainedMessage[] = []
    const drained = await drainVoiceBridgeQueue(FAKE_RELAY_BASE, (msg) => {
      received.push(msg)
    })

    // All queued messages must be returned
    expect(drained).toHaveLength(2)
    expect(drained[0]?.id).toBe('msg-001')
    expect(drained[1]?.id).toBe('msg-002')

    // onMessage callback must have been called for each
    expect(received).toHaveLength(2)
    expect(received[0]?.body).toBe('status update while you were offline')
    expect(received[1]?.body).toBe('second queued message')
  })

  test('empty queue on startup — no errors, returns empty array', async () => {
    fakeQueueResponse = { status: 200, body: { messages: [] } }

    const received: DrainedMessage[] = []
    const drained = await drainVoiceBridgeQueue(FAKE_RELAY_BASE, (msg) => {
      received.push(msg)
    })

    expect(drained).toHaveLength(0)
    expect(received).toHaveLength(0)
  })
})
