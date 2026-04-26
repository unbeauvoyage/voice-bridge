/**
 * Integration tests for the mobile recording UI served at GET /.
 *
 * These tests spawn the real server (same as status.test.ts) and verify
 * that the HTML page exists, loads correctly, and contains the required
 * UI elements: agent dropdown, mic state indicator, record/stop buttons,
 * and status area.
 *
 * TDD: written BEFORE server/public/index.html exists.
 * Expected initial run: GET / returns 404 (file missing) → all tests fail.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { join } from 'node:path'

const TEST_PORT = 3098
const REPO_ROOT = join(import.meta.dir, '..')

let proc: ReturnType<typeof Bun.spawn>

beforeAll(async () => {
  proc = Bun.spawn(['bun', 'run', 'server/index.ts'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdout: 'pipe',
    stderr: 'pipe'
  })

  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/health`)
      if (res.ok) break
    } catch {
      /* server not ready yet */
    }
    await Bun.sleep(100)
  }
})

afterAll(() => {
  proc?.kill()
})

describe('mobile recording UI — GET /', () => {
  test('returns 200 with text/html content-type (not 404)', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
  })

  test('HTML body contains an agent selector dropdown', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/`)
    const html = await res.text()
    // The agent <select> element must be present so users can pick a destination
    expect(html).toContain('<select')
    // Must have an id so JS can reference it
    expect(html).toMatch(/id=["']agent/)
  })

  test('HTML body contains mic state indicator element', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/`)
    const html = await res.text()
    // Mic state indicator must exist so the user knows if mic is on/off
    expect(html).toMatch(/id=["']mic/)
  })

  test('HTML body contains record button', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/`)
    const html = await res.text()
    // Record button initiates MediaRecorder
    expect(html).toMatch(/id=["']record/)
  })

  test('HTML body contains stop button', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/`)
    const html = await res.text()
    // Stop button stops recording and triggers POST /transcribe
    expect(html).toMatch(/id=["']stop/)
  })

  test('HTML body contains status display area', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/`)
    const html = await res.text()
    // Status area shows Idle → Recording → Transcribing → result
    expect(html).toMatch(/id=["']status/)
  })

  test('HTML references /agents endpoint in JS', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/`)
    const html = await res.text()
    // The page must fetch /agents to populate the dropdown on load
    expect(html).toContain('/agents')
  })

  test('HTML references /transcribe endpoint in JS', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/`)
    const html = await res.text()
    // The page must POST to /transcribe with the recorded audio blob
    expect(html).toContain('/transcribe')
  })

  test('HTML references /mic endpoint for polling', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/`)
    const html = await res.text()
    // The page polls /mic every 3s to keep the mic state indicator fresh
    expect(html).toContain('/mic')
  })

  test('HTML has a dark background color', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/`)
    const html = await res.text()
    // Dark theme matching Capacitor app (#14141c or similar dark hex)
    expect(html).toMatch(/#1[0-9a-f]{5}|#0[0-9a-f]{5}|background.*dark|dark.*background/i)
  })
})
