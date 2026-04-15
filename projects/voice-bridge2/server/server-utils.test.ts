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
    // Malformed body → safeJsonParse returns {} → target field missing → 400
    expect(res.status).toBe(400)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> = {}
    if (typeof body === 'object' && body !== null) {
      Object.assign(obj, body)
    }
    expect(obj['error']).toBe('Missing target')
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
