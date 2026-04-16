/**
 * Tests for the relay response poller.
 *
 * The poller polls GET /queue/ceo on the relay and POSTs each new message
 * to the overlay server as a message toast. These tests use mock HTTP servers
 * to verify the correct payloads are sent and that duplicates are suppressed.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { createRelayPoller, type TtsSpawn, type TtsPauseGuard } from './relay-poller'

// ─── Mock servers ─────────────────────────────────────────────────────────────

type OverlayPost = { mode: string; text: string }

function isOverlayPost(value: unknown): value is OverlayPost {
  return (
    value !== null &&
    typeof value === 'object' &&
    'mode' in value &&
    typeof value.mode === 'string' &&
    'text' in value &&
    typeof value.text === 'string'
  )
}

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
        const body: unknown = await req.json()
        if (isOverlayPost(body)) {
          overlayPosts.push(body)
        }
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

    const [post1, post2] = overlayPosts
    if (!post1 || !post2) throw new Error('expected two overlay posts')
    expect(post1.mode).toBe('message')
    expect(post1.text).toBe('chief-of-staff: Task finished successfully.')
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
    const [post] = overlayPosts
    if (!post) throw new Error('expected one overlay post')
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

  // Chunk-5 #1 HIGH — shell-injection RCE via agent-controlled TTS body.
  //
  // The old TTS path used `spawn('sh', ['-c', `edge-tts ... --text ${JSON.stringify(body)} ...`])`.
  // JSON.stringify wraps the body in double quotes, but inside `sh -c`
  // double quotes STILL expand `$(...)` and backticks — so any agent
  // that could queue a message body could execute arbitrary shell on
  // the host the moment TTS fired.
  //
  // The fix: drop the shell entirely and use argv-only spawn. The body
  // becomes a single argv element; no shell parses it. These tests pin
  // that contract by injecting a recorder that captures (command, args)
  // and asserting (a) the command is the TTS binary directly, not `sh`,
  // and (b) the body argument is passed unmodified — no expansion.
  describe('TTS shell-injection hardening', () => {
    test('TTS spawn uses argv only — command is not `sh` and no `-c` flag', async () => {
      const calls: Array<{ command: string; args: string[] }> = []
      const recorder: TtsSpawn = (command, args) => {
        calls.push({ command, args })
      }
      relayMessages = [
        {
          id: 'tts-argv-1',
          from: 'agent-x',
          to: 'ceo',
          type: 'message',
          body: 'Short harmless body.',
          ts: '2026-04-16T10:00:00Z'
        }
      ]
      overlayPosts.length = 0

      const poller = createRelayPoller({
        relayBaseUrl: `http://localhost:${RELAY_PORT}`,
        overlayUrl: `http://localhost:${OVERLAY_PORT}/overlay`,
        ttsEnabled: true,
        ttsSpawn: recorder
      })
      await poller.pollOnce()

      expect(calls.length).toBeGreaterThan(0)
      for (const c of calls) {
        expect(c.command).not.toBe('sh')
        expect(c.command).not.toBe('bash')
        expect(c.command).not.toBe('zsh')
        expect(c.args).not.toContain('-c')
      }
    })

    test('agent-controlled body with $(...) reaches spawn as a SINGLE argv element (no shell expansion)', async () => {
      // Canary payload — if the shell ever parses this, it creates a
      // marker file. The assertions below do NOT depend on edge-tts
      // being installed; they inspect how the spawn boundary is called.
      const payload = '$(touch /tmp/vb-rce-canary-test)`touch /tmp/vb-rce-canary-test`'
      // Pre-clean the canary so a stale file from a previous run cannot
      // give a false pass.
      try {
        unlinkSync('/tmp/vb-rce-canary-test')
      } catch {
        /* file may not exist */
      }

      const calls: Array<{ command: string; args: string[] }> = []
      const recorder: TtsSpawn = (command, args) => {
        calls.push({ command, args })
      }
      relayMessages = [
        {
          id: 'tts-rce-1',
          from: 'malicious-agent',
          to: 'ceo',
          type: 'message',
          body: payload,
          ts: '2026-04-16T10:00:01Z'
        }
      ]
      overlayPosts.length = 0

      const poller = createRelayPoller({
        relayBaseUrl: `http://localhost:${RELAY_PORT}`,
        overlayUrl: `http://localhost:${OVERLAY_PORT}/overlay`,
        ttsEnabled: true,
        ttsSpawn: recorder
      })
      await poller.pollOnce()

      // Contract: body is passed as a single argv element exactly as
      // received — no quoting, no expansion.
      const matchingCall = calls.find((c) => c.args.includes(payload))
      expect(matchingCall).toBeDefined()

      // And the shell never ran to create the canary.
      expect(existsSync('/tmp/vb-rce-canary-test')).toBe(false)
    })
  })

  // ── Pause-guard: mic suppression during TTS ───────────────────────────────
  //
  // Chunk-5 #1 split edge-tts+afplay into two argv-only spawns (no shell),
  // which fixed the RCE. But the old `speak` wrapper touched
  // /tmp/wake-word-pause BEFORE TTS and removed it AFTER afplay, keeping the
  // mic suppressed across the full playback. The argv-only path dropped that
  // guard entirely. Result: TTS audio fed back into the open mic → wake-word
  // triggered on ambient noise → Whisper hallucinated "hello" → loop.
  // CEO saw 23 identical "hello" in 2 min.
  //
  // Fix: inject a TtsPauseGuard boundary (acquire/release). The poller calls
  // acquire() before the first spawn and release() after afplay exits.
  describe('TTS mic pause guard', () => {
    test('creates pause file before TTS spawn and removes it after afplay exits', async () => {
      // Track ordering of events to verify acquire → spawn(edge-tts) →
      // spawn(afplay) → afplay-exit → release sequence.
      const events: string[] = []

      // Fake TtsSpawn returns a fake ChildProcess-like EventEmitter so the
      // poller can await the afplay exit event.
      const fakeSpawn: TtsSpawn = (command, _args) => {
        events.push(`spawn:${command}`)
        // Return a fake EventEmitter so caller can do once(child, 'exit')
        const { EventEmitter } = require('node:events') as typeof import('node:events')
        const child = new EventEmitter()
        // Emit 'exit' after a microtask so the awaiting code runs first
        setImmediate(() => {
          events.push(`exit:${command}`)
          child.emit('exit', 0, null)
        })
        return child
      }

      const fakeGuard: TtsPauseGuard = {
        acquire: () => { events.push('acquire') },
        release: () => { events.push('release') }
      }

      relayMessages = [
        {
          id: 'pause-guard-1',
          from: 'atlas',
          to: 'ceo',
          type: 'message',
          body: 'Pause guard test.',
          ts: '2026-04-16T12:00:00Z'
        }
      ]
      overlayPosts.length = 0

      const poller = createRelayPoller({
        relayBaseUrl: `http://localhost:${RELAY_PORT}`,
        overlayUrl: `http://localhost:${OVERLAY_PORT}/overlay`,
        ttsEnabled: true,
        ttsSpawn: fakeSpawn,
        ttsPauseGuard: fakeGuard
      })
      await poller.pollOnce()

      // acquire must happen BEFORE any spawn; release AFTER afplay exit
      const acquireIdx = events.indexOf('acquire')
      const spawnEdgeIdx = events.indexOf('spawn:edge-tts')
      const spawnAfplayIdx = events.indexOf('spawn:afplay')
      const exitAfplayIdx = events.indexOf('exit:afplay')
      const releaseIdx = events.indexOf('release')

      expect(acquireIdx).toBeGreaterThanOrEqual(0)
      expect(spawnEdgeIdx).toBeGreaterThan(acquireIdx)
      expect(spawnAfplayIdx).toBeGreaterThan(spawnEdgeIdx)
      expect(exitAfplayIdx).toBeGreaterThan(spawnAfplayIdx)
      expect(releaseIdx).toBeGreaterThan(exitAfplayIdx)
    })

    test('release is called even if afplay spawn throws (try/finally guarantee)', async () => {
      // If the afplay spawn itself throws (binary not found etc.), release()
      // must still fire — otherwise the mic stays hot forever.
      const events: string[] = []

      const throwingSpawn: TtsSpawn = (command, _args) => {
        if (command === 'afplay') {
          throw new Error('afplay not found')
        }
        const { EventEmitter } = require('node:events') as typeof import('node:events')
        const child = new EventEmitter()
        setImmediate(() => child.emit('exit', 0, null))
        return child
      }

      const fakeGuard: TtsPauseGuard = {
        acquire: () => { events.push('acquire') },
        release: () => { events.push('release') }
      }

      relayMessages = [
        {
          id: 'pause-guard-throw',
          from: 'atlas',
          to: 'ceo',
          type: 'message',
          body: 'Throw guard test.',
          ts: '2026-04-16T12:00:01Z'
        }
      ]
      overlayPosts.length = 0

      const poller = createRelayPoller({
        relayBaseUrl: `http://localhost:${RELAY_PORT}`,
        overlayUrl: `http://localhost:${OVERLAY_PORT}/overlay`,
        ttsEnabled: true,
        ttsSpawn: throwingSpawn,
        ttsPauseGuard: fakeGuard
      })
      await poller.pollOnce()

      expect(events).toContain('acquire')
      expect(events).toContain('release')
    })
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
