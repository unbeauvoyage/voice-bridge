/**
 * Anchor test — relay-overlay sub-module.
 *
 * Written BEFORE the refactor to pin the overlay dispatch concern as a standalone
 * unit. Tests will FAIL until relay-overlay.ts is created (red→green TDD).
 *
 * The overlay dispatcher is responsible for:
 * - POSTing a toast to the overlay server for each queued message
 * - Deferring seenIds promotion until after a successful POST (retry semantics)
 * - Capping infinite retries at OVERLAY_MAX_RETRIES (3 failures → mark seen)
 * - Filtering message types not in TOAST_TYPES
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { dispatchOverlayMessages, type OverlayDispatchState } from './relay-overlay.ts'

const ANCHOR_OVERLAY_PORT = 48910

type OverlayPost = { mode: string; text: string }

function isOverlayPost(v: unknown): v is OverlayPost {
  return (
    v !== null && typeof v === 'object' &&
    'mode' in v && typeof (v as Record<string, unknown>).mode === 'string' &&
    'text' in v && typeof (v as Record<string, unknown>).text === 'string'
  )
}

const posts: OverlayPost[] = []
let anchorOverlayServer: ReturnType<typeof Bun.serve>

beforeAll(() => {
  anchorOverlayServer = Bun.serve({
    port: ANCHOR_OVERLAY_PORT,
    async fetch(req) {
      if (req.method === 'POST' && new URL(req.url).pathname === '/overlay') {
        const body: unknown = await req.json()
        if (isOverlayPost(body)) posts.push(body)
        return Response.json({ ok: true })
      }
      return new Response('not found', { status: 404 })
    }
  })
})

afterAll(() => {
  anchorOverlayServer?.stop(true)
})

function makeState(): OverlayDispatchState {
  return {
    seenIds: new Map<string, number>(),
    overlayFailCount: new Map<string, number>()
  }
}

function makeMsg(id: string, from: string, type: string, body: string) {
  return { id, from, to: 'ceo', type, body, ts: '2026-04-17T00:00:00Z' }
}

describe('dispatchOverlayMessages: overlay dispatch concern', () => {
  test('POSTs a toast for a new message and marks it seen', async () => {
    posts.length = 0
    const state = makeState()
    const msgs = [makeMsg('anchor-1', 'atlas', 'done', 'Done.')]

    await dispatchOverlayMessages(msgs, `http://localhost:${ANCHOR_OVERLAY_PORT}/overlay`, state)

    expect(posts).toHaveLength(1)
    expect(posts[0]!.text).toBe('atlas: Done.')
    expect(state.seenIds.has('anchor-1')).toBe(true)
  })

  test('skips messages already in seenIds', async () => {
    posts.length = 0
    const state = makeState()
    state.seenIds.set('already-seen', Date.now())
    const msgs = [makeMsg('already-seen', 'atlas', 'done', 'Already seen.')]

    await dispatchOverlayMessages(msgs, `http://localhost:${ANCHOR_OVERLAY_PORT}/overlay`, state)

    expect(posts).toHaveLength(0)
  })

  test('filters out message types not in TOAST_TYPES', async () => {
    posts.length = 0
    const state = makeState()
    const msgs = [makeMsg('filtered-1', 'atlas', 'voice-sent', 'Echo.')]

    await dispatchOverlayMessages(msgs, `http://localhost:${ANCHOR_OVERLAY_PORT}/overlay`, state)

    expect(posts).toHaveLength(0)
  })

  test('truncates message body to 120 chars in toast text', async () => {
    posts.length = 0
    const state = makeState()
    const msgs = [makeMsg('trunc-1', 'x', 'message', 'A'.repeat(200))]

    await dispatchOverlayMessages(msgs, `http://localhost:${ANCHOR_OVERLAY_PORT}/overlay`, state)

    expect(posts).toHaveLength(1)
    expect(posts[0]!.text).toBe(`x: ${'A'.repeat(120)}`)
  })

  test('does not mark message seen after overlay failure — retried on next call', async () => {
    const FAIL_PORT = 48911
    let callCount = 0
    const failServer = Bun.serve({
      port: FAIL_PORT,
      fetch() {
        callCount++
        return new Response('error', { status: 500 })
      }
    })

    const state = makeState()
    const msgs = [makeMsg('retry-anchor', 'a', 'done', 'Retry.')]

    await dispatchOverlayMessages(msgs, `http://localhost:${FAIL_PORT}/overlay`, state)
    expect(state.seenIds.has('retry-anchor')).toBe(false)
    expect(callCount).toBe(1)

    failServer.stop(true)
  })

  test('marks message seen after OVERLAY_MAX_RETRIES failures to prevent infinite retry', async () => {
    const ALWAYS_FAIL_PORT = 48912
    let callCount = 0
    const alwaysFailServer = Bun.serve({
      port: ALWAYS_FAIL_PORT,
      fetch() {
        callCount++
        return new Response('error', { status: 500 })
      }
    })

    const state = makeState()
    const msgs = [makeMsg('cap-anchor', 'b', 'status', 'Cap.')]

    // 4 calls; after 3 failures the message is capped as seen
    await dispatchOverlayMessages(msgs, `http://localhost:${ALWAYS_FAIL_PORT}/overlay`, state)
    await dispatchOverlayMessages(msgs, `http://localhost:${ALWAYS_FAIL_PORT}/overlay`, state)
    await dispatchOverlayMessages(msgs, `http://localhost:${ALWAYS_FAIL_PORT}/overlay`, state)
    await dispatchOverlayMessages(msgs, `http://localhost:${ALWAYS_FAIL_PORT}/overlay`, state)

    // After 3 failures the message is marked seen — 4th call skips it
    expect(callCount).toBe(3)
    expect(state.seenIds.has('cap-anchor')).toBe(true)

    alwaysFailServer.stop(true)
  })
})
