/**
 * E2E tests for the overlay stale-message filter — real HTTP throughout.
 *
 * Root cause investigated 2026-04-19: on server restart the seenIds map is
 * empty, so the relay poller replayed every historical message in the queue
 * as overlay toasts — showing messages from hours ago one by one.
 *
 * Fix: messages older than MAX_OVERLAY_MESSAGE_AGE_MS (5 min) are silently
 * marked seen without posting to the overlay.
 *
 * All assertions go through real fetch() calls:
 *   - POST /poll on the control server triggers one relay poll cycle
 *   - GET /captures on the mock overlay reads what was actually posted
 *
 * Three servers run in beforeAll:
 *   MOCK_RELAY  (13041) — GET /queue/ceo → configurable messages
 *   MOCK_OVERLAY(13042) — POST /overlay captures toasts; GET /captures returns them
 *   CONTROL     (13040) — POST /poll triggers one poll cycle synchronously
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { createRelayPoller } from '../../server/relay-poller.ts'

const CONTROL_PORT = 13040
const MOCK_RELAY_PORT = 13041
const MOCK_OVERLAY_PORT = 13042

const CONTROL = `http://localhost:${CONTROL_PORT}`
const MOCK_OVERLAY = `http://localhost:${MOCK_OVERLAY_PORT}`

// Timestamps for test messages
const RECENT_TS = new Date().toISOString()
const STALE_TS = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago

// ── Shared state ──────────────────────────────────────────────────────────────

type RelayMessage = { id: string; from: string; to: string; type: string; body: string; ts: string }
type OverlayPost = { mode: string; text: string }

let relayMessages: RelayMessage[] = []
const overlayCaptures: OverlayPost[] = []

// ── Servers ───────────────────────────────────────────────────────────────────

let mockRelayServer: ReturnType<typeof Bun.serve>
let mockOverlayServer: ReturnType<typeof Bun.serve>
let controlServer: ReturnType<typeof Bun.serve>

beforeAll(() => {
  // Mock relay: returns the current relayMessages array
  mockRelayServer = Bun.serve({
    port: MOCK_RELAY_PORT,
    fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/queue/ceo') {
        return Response.json({ messages: relayMessages })
      }
      return new Response('not found', { status: 404 })
    }
  })

  // Mock overlay: captures POSTs; exposes GET /captures for assertions
  mockOverlayServer = Bun.serve({
    port: MOCK_OVERLAY_PORT,
    async fetch(req) {
      const url = new URL(req.url)
      if (req.method === 'POST' && url.pathname === '/overlay') {
        const body: unknown = await req.json()
        if (
          body !== null &&
          typeof body === 'object' &&
          'mode' in body &&
          'text' in body &&
          typeof body.mode === 'string' &&
          typeof body.text === 'string'
        ) {
          overlayCaptures.push({ mode: body.mode, text: body.text })
        }
        return Response.json({ ok: true })
      }
      if (req.method === 'GET' && url.pathname === '/captures') {
        return Response.json(overlayCaptures)
      }
      return new Response('not found', { status: 404 })
    }
  })

  // Control server: POST /poll triggers one synchronous relay poll cycle.
  // This server imports createRelayPoller — only the assertions below use HTTP,
  // keeping test code free from direct module calls.
  controlServer = Bun.serve({
    port: CONTROL_PORT,
    async fetch(req) {
      const url = new URL(req.url)
      if (req.method === 'POST' && url.pathname === '/poll') {
        // Each request creates a fresh poller (empty seenIds = simulates server restart).
        const poller = createRelayPoller({
          relayBaseUrl: `http://localhost:${MOCK_RELAY_PORT}`,
          overlayUrl: `http://localhost:${MOCK_OVERLAY_PORT}/overlay`,
          ttsEnabled: false
        })
        await poller.pollOnce()
        return Response.json({ ok: true })
      }
      return new Response('not found', { status: 404 })
    }
  })
})

afterAll(() => {
  controlServer?.stop(true)
  mockRelayServer?.stop(true)
  mockOverlayServer?.stop(true)
})

afterEach(() => {
  relayMessages = []
  overlayCaptures.length = 0
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function triggerPoll(): Promise<void> {
  await fetch(`${CONTROL}/poll`, { method: 'POST' })
}

async function getCaptures(): Promise<OverlayPost[]> {
  const res = await fetch(`${MOCK_OVERLAY}/captures`)
  const data: unknown = await res.json()
  if (!Array.isArray(data)) return []
  return data.filter(
    (item): item is OverlayPost =>
      item !== null &&
      typeof item === 'object' &&
      'mode' in item &&
      typeof item.mode === 'string' &&
      'text' in item &&
      typeof item.text === 'string'
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('overlay: stale relay messages do not replay as toasts after server restart', () => {
  test('overlay: recent agent message (within 5 min) appears as overlay toast', async () => {
    relayMessages = [
      {
        id: 'fresh-1',
        from: 'chief-of-staff',
        to: 'ceo',
        type: 'done',
        body: 'Task complete.',
        ts: RECENT_TS
      }
    ]

    await triggerPoll()

    const captures = await getCaptures()
    expect(captures).toHaveLength(1)
    expect(captures[0]?.text).toBe('chief-of-staff: Task complete.')
  })

  test('overlay: server restarts with hours-old messages in queue → no replay toasts appear', async () => {
    // Simulates the CEO-reported bug: app crashed → restart → old messages flood overlay
    relayMessages = [
      {
        id: 'old-1',
        from: 'atlas',
        to: 'ceo',
        type: 'done',
        body: 'Done hours ago.',
        ts: STALE_TS
      }
    ]

    await triggerPoll()

    const captures = await getCaptures()
    // Stale message must be silently suppressed — the overlay should be quiet
    expect(captures).toHaveLength(0)
  })

  test('overlay: mix of old and new messages → only the recent one appears as a toast', async () => {
    relayMessages = [
      {
        id: 'old-mix',
        from: 'agent-a',
        to: 'ceo',
        type: 'status',
        body: 'Status from an hour ago.',
        ts: STALE_TS
      },
      {
        id: 'new-mix',
        from: 'agent-b',
        to: 'ceo',
        type: 'done',
        body: 'Just finished now.',
        ts: RECENT_TS
      }
    ]

    await triggerPoll()

    const captures = await getCaptures()
    expect(captures).toHaveLength(1)
    expect(captures[0]?.text).toBe('agent-b: Just finished now.')
  })

  test('overlay: stale message suppressed on first poll is not retried on the next poll', async () => {
    // Each triggerPoll creates a fresh poller (empty seenIds). This verifies that
    // after the first poll silently marks a stale message as seen, a second poll
    // cycle (same server session) also does not show it. The seenIds mark persists
    // within the same poller instance — but since /poll creates a fresh instance,
    // this test specifically verifies the age-based filter (not the seenIds dedup).
    // Both polls must produce zero overlay posts.
    relayMessages = [
      {
        id: 'no-retry',
        from: 'agent-z',
        to: 'ceo',
        type: 'message',
        body: 'Ancient history.',
        ts: STALE_TS
      }
    ]

    await triggerPoll()
    await triggerPoll()

    const captures = await getCaptures()
    expect(captures).toHaveLength(0)
  })
})
