/**
 * Tests for the relay response poller.
 *
 * The poller polls GET /queue/ceo on the relay and POSTs each new message
 * to the overlay server as a message toast. These tests use mock HTTP servers
 * to verify the correct payloads are sent and that duplicates are suppressed.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createRelayPoller } from './relay-poller'

// ─── Mock servers ─────────────────────────────────────────────────────────────

type OverlayPost = { mode: string; text: string }

let relayMessages: Array<{
  id: string
  from: string
  to: string
  type: string
  body: string
  ts: string
}> = []
const overlayPosts: OverlayPost[] = []

const RELAY_PORT = 18767
const OVERLAY_PORT = 48890

let relayServer: ReturnType<typeof Bun.serve>
let overlayServer: ReturnType<typeof Bun.serve>

beforeAll(() => {
  relayServer = Bun.serve({
    port: RELAY_PORT,
    fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/queue/ceo') {
        return Response.json({ messages: relayMessages })
      }
      return new Response('not found', { status: 404 })
    }
  })

  overlayServer = Bun.serve({
    port: OVERLAY_PORT,
    async fetch(req) {
      if (req.method === 'POST' && new URL(req.url).pathname === '/overlay') {
        const body = (await req.json()) as OverlayPost
        overlayPosts.push(body)
        return Response.json({ ok: true })
      }
      return new Response('not found', { status: 404 })
    }
  })
})

afterAll(() => {
  relayServer?.stop(true)
  overlayServer?.stop(true)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('relay poller: sends agent responses to overlay as message toasts', () => {
  test('POSTs overlay message toast for each queued message', async () => {
    relayMessages = [
      {
        id: 'msg-1',
        from: 'chief-of-staff',
        to: 'ceo',
        type: 'done',
        body: 'Task finished successfully.',
        ts: '2026-04-15T10:00:00Z'
      },
      {
        id: 'msg-2',
        from: 'atlas',
        to: 'ceo',
        type: 'status',
        body: 'Build is running in the background.',
        ts: '2026-04-15T10:00:01Z'
      }
    ]
    overlayPosts.length = 0

    const poller = createRelayPoller({
      relayBaseUrl: `http://localhost:${RELAY_PORT}`,
      overlayUrl: `http://localhost:${OVERLAY_PORT}/overlay`,
      ttsEnabled: false
    })

    // Run one poll cycle and wait for it to complete
    await poller.pollOnce()

    expect(overlayPosts).toHaveLength(2)

    const post1 = overlayPosts[0]!
    expect(post1.mode).toBe('message')
    expect(post1.text).toBe('chief-of-staff: Task finished successfully.')

    const post2 = overlayPosts[1]!
    expect(post2.mode).toBe('message')
    expect(post2.text).toBe('atlas: Build is running in the background.')
  })

  test('truncates long message bodies to 120 chars in toast text', async () => {
    const longBody = 'A'.repeat(200)
    relayMessages = [
      {
        id: 'msg-long',
        from: 'command',
        to: 'ceo',
        type: 'message',
        body: longBody,
        ts: '2026-04-15T10:00:02Z'
      }
    ]
    overlayPosts.length = 0

    const poller = createRelayPoller({
      relayBaseUrl: `http://localhost:${RELAY_PORT}`,
      overlayUrl: `http://localhost:${OVERLAY_PORT}/overlay`,
      ttsEnabled: false
    })

    await poller.pollOnce()

    expect(overlayPosts).toHaveLength(1)
    const post = overlayPosts[0]!
    // "command: " is 9 chars, body truncated to 120 chars
    expect(post.text).toBe(`command: ${'A'.repeat(120)}`)
    expect(post.text.length).toBe(9 + 120)
  })

  test('does not re-send duplicate messages on second poll', async () => {
    relayMessages = [
      {
        id: 'dedup-1',
        from: 'sentinel',
        to: 'ceo',
        type: 'done',
        body: 'Deployment complete.',
        ts: '2026-04-15T10:00:03Z'
      }
    ]
    overlayPosts.length = 0

    const poller = createRelayPoller({
      relayBaseUrl: `http://localhost:${RELAY_PORT}`,
      overlayUrl: `http://localhost:${OVERLAY_PORT}/overlay`,
      ttsEnabled: false
    })

    // First poll — message is new, should be posted
    await poller.pollOnce()
    expect(overlayPosts).toHaveLength(1)

    // Second poll — same message returned by relay, must NOT be re-posted
    await poller.pollOnce()
    expect(overlayPosts).toHaveLength(1)
  })

  test('only shows done/status/message/waiting-for-input types, filters out voice-sent etc', async () => {
    relayMessages = [
      {
        id: 'type-1',
        from: 'agent-a',
        to: 'ceo',
        type: 'done',
        body: 'Done message.',
        ts: '2026-04-15T10:00:04Z'
      },
      {
        id: 'type-2',
        from: 'agent-b',
        to: 'ceo',
        type: 'voice-sent',
        body: 'Voice echo — should be ignored.',
        ts: '2026-04-15T10:00:05Z'
      },
      {
        id: 'type-3',
        from: 'agent-c',
        to: 'ceo',
        type: 'status',
        body: 'Status update.',
        ts: '2026-04-15T10:00:06Z'
      }
    ]
    overlayPosts.length = 0

    const poller = createRelayPoller({
      relayBaseUrl: `http://localhost:${RELAY_PORT}`,
      overlayUrl: `http://localhost:${OVERLAY_PORT}/overlay`,
      ttsEnabled: false
    })

    await poller.pollOnce()

    // Only 'done' and 'status' should be shown; 'voice-sent' should be filtered
    expect(overlayPosts).toHaveLength(2)
    expect(overlayPosts.map((p) => p.text)).toEqual([
      'agent-a: Done message.',
      'agent-c: Status update.'
    ])
  })
})
