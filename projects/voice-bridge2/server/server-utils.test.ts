/**
 * Tests for shared server utility helpers extracted from server/index.ts.
 *
 * These tests document the intended behavior of utilities that handle
 * repeated patterns in the HTTP handler. Running them BEFORE extraction
 * ensures the refactor is behavior-preserving.
 *
 * Integration tests use the real server to verify endpoint-level behavior.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

const TEST_PORT = 3098

let proc: ReturnType<typeof Bun.spawn>

beforeAll(async () => {
  proc = Bun.spawn(['bun', 'run', 'server/index.ts'], {
    cwd: '/Users/riseof/environment/projects/voice-bridge2',
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdout: 'pipe',
    stderr: 'pipe'
  })

  // Wait until server is ready (max 5s)
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/health`)
      if (res.ok) break
    } catch {
      /* server not ready yet — keep polling */
    }
    await Bun.sleep(100)
  }
})

afterAll(() => {
  proc?.kill()
})

describe('safeJsonParse behavior (via HTTP endpoints)', () => {
  // The POST /mic and POST /target endpoints both call safeJsonParse on the request body.
  // Malformed JSON must not crash the endpoint — it should default to an empty parse result.
  // This verifies that after extraction, the behavior is preserved.

  test('POST /mic with malformed JSON body still returns a valid response', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json'
    })
    // Should not 500 — malformed body defaults to {} → state treated as missing → sets to off
    expect(res.status).not.toBe(500)
    const body: unknown = await res.json()
    expect(body).toBeDefined()
  })

  test('POST /target with malformed JSON body returns 400 (missing target field)', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json'
    })
    // Malformed body → Zod boundary rejects as validation_failed → 400
    expect(res.status).toBe(400)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> = {}
    if (typeof body === 'object' && body !== null) {
      Object.assign(obj, body)
    }
    expect(obj['error']).toBe('validation_failed')
  })

  test('POST /mic with valid JSON {state: "on"} sets mic on', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'on' })
    })
    expect(res.ok).toBe(true)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> = {}
    if (typeof body === 'object' && body !== null) {
      Object.assign(obj, body)
    }
    expect(obj['state']).toBe('on')
  })

  test('POST /mic with valid JSON {state: "off"} sets mic off', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'off' })
    })
    expect(res.ok).toBe(true)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> = {}
    if (typeof body === 'object' && body !== null) {
      Object.assign(obj, body)
    }
    expect(obj['state']).toBe('off')
  })
})

// Chunk2-review HIGH2: /transcribe Content-Length is client-trusted. A
// lying or omitted header lets hostile clients buffer oversized bodies
// before the route-level cap fires. These tests verify the end-to-end
// response is 413 in both cases. They do NOT pin which layer produced it:
// Bun.serve maxRequestBodySize, the route-level Content-Length preflight,
// and the manual streaming accounting all surface as 413, which is exactly
// the defense-in-depth we want — any one of them being turned off would
// still let the others catch the attack.
describe('transcribe body-size enforcement (end-to-end 413)', () => {
  test('POST /transcribe with oversized body + honest Content-Length returns 413', async () => {
    // 50 MiB raw body — above the 11 MiB Bun.serve cap. Rejected via
    // Bun.serve maxRequestBodySize and/or the route-level preflight.
    const big = new Uint8Array(50 * 1024 * 1024)
    const res = await fetch(`http://localhost:${TEST_PORT}/transcribe`, {
      method: 'POST',
      body: big
    })
    expect(res.status).toBe(413)
  })

  test('POST /transcribe with oversized streamed body and no Content-Length returns 413', async () => {
    // Stream a body larger than the cap with NO Content-Length header —
    // the attacker scenario codex flagged. On Bun 1.3.3 maxRequestBodySize
    // does NOT enforce on chunked streams, so it's the manual streaming
    // accounting in handleTranscribe that catches this and returns 413.
    const chunk = new Uint8Array(1024 * 1024) // 1 MiB per chunk
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 50; i++) controller.enqueue(chunk)
        controller.close()
      }
    })
    let status: number | null = null
    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/transcribe`, {
        method: 'POST',
        body: stream,
        // @ts-expect-error Bun-specific init flag
        duplex: 'half'
      })
      status = res.status
    } catch {
      // Connection reset / abort is also acceptable — Bun may terminate
      // the stream once the cap is hit. Either 413 or a thrown fetch error
      // proves the parser-level cap is in force.
      status = -1
    }
    // 413 (parser-level rejection) or -1 (connection killed) both prove
    // the parser-level cap fired. 400 = buffered full body then handler
    // saw invalid multipart = no parser-level enforcement = FAIL.
    expect(status === 413 || status === -1).toBe(true)
  })
})
