import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

// Import the server inline by importing the module's internal logic.
// We spawn the server on a different port to avoid conflicting with a running instance.
const TEST_PORT = 3099

// We start a minimal Bun subprocess so we don't have to refactor index.ts.
// Use PORT env var to override the default 3030.
let proc: ReturnType<typeof Bun.spawn>

beforeAll(async () => {
  proc = Bun.spawn(['bun', 'run', 'server/index.ts'], {
    cwd: '/Users/riseof/environment/projects/voice-bridge',
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

describe('voice-bridge status API', () => {
  test('GET /status returns target and micState', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/status`)
    expect(res.ok).toBe(true)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> =
      typeof body === 'object' && body !== null ? Object.fromEntries(Object.entries(body)) : {}
    expect(typeof obj['target']).toBe('string')
    expect(typeof obj['micState']).toBe('string')
  })

  test('POST /target updates target', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'test-agent' })
    })
    expect(res.ok).toBe(true)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> =
      typeof body === 'object' && body !== null ? Object.fromEntries(Object.entries(body)) : {}
    expect(obj['target']).toBe('test-agent')
  })

  test('GET /health returns ok', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/health`)
    expect(res.ok).toBe(true)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> =
      typeof body === 'object' && body !== null ? Object.fromEntries(Object.entries(body)) : {}
    expect(obj['status']).toBe('ok')
  })
})
