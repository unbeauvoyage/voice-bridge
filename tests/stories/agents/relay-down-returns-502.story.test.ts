/**
 * Story: An API client GETs /agents and receives a clear 502 when the relay is down.
 *
 * NEGATIVE CONTROL PROVEN: The first version of this test asserted status 200 —
 * it failed RED ("Expected 502, received 200" inverted: "Expected 200, received 502").
 * After reverting to expect(res.status).toBe(502) it went GREEN. Test is verified
 * to be able to fail.
 *
 * Given:
 *   - voice-bridge is spawned pointing at a port where nothing is listening (relay is "down")
 * When:
 *   - An API client sends GET /agents
 * Then:
 *   - /agents returns HTTP 502
 *   - The response body is JSON with an `error` string field
 *
 * Real services: voice-bridge is a real subprocess. The "relay" is a
 * closed port — a real TCP connection failure, not a mock.
 */

import { test, expect, beforeAll, afterAll } from 'bun:test'
import { createServer } from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Free-port helper ───────────────────────────────────────────────────────────

/** Opens a TCP server on port 0, captures the assigned port, then closes immediately.
 * The resulting port is free (nothing is listening) — the real "relay is down" fixture. */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (!addr || typeof addr === 'string') {
        srv.close()
        reject(new Error('could not get server address'))
        return
      }
      const port = addr.port
      srv.close(() => resolve(port))
    })
  })
}

// ── Voice-bridge subprocess ────────────────────────────────────────────────────

let vbProcess: ChildProcess | null = null
let vbPort = 0

const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../server')

async function startVoiceBridge(relayPort: number): Promise<number> {
  // Pick a free port for voice-bridge itself
  const port = await getFreePort()

  vbProcess = spawn('bun', ['run', 'index.ts'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      RELAY_BASE_URL: `http://127.0.0.1:${relayPort}`
    },
    stdio: 'pipe'
  })

  // Wait for /health to return 200 — server is ready
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 150))
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      if (res.ok) return port
    } catch {
      // not ready yet
    }
  }
  throw new Error(`voice-bridge did not become healthy within 15s on port ${port}`)
}

function stopVoiceBridge(): void {
  if (vbProcess) {
    vbProcess.kill('SIGTERM')
    vbProcess = null
  }
}

// ── Setup / teardown ───────────────────────────────────────────────────────────

beforeAll(async () => {
  const closedPort = await getFreePort()
  vbPort = await startVoiceBridge(closedPort)
})

afterAll(() => {
  stopVoiceBridge()
})

// ── Test ───────────────────────────────────────────────────────────────────────

test('API client GETs /agents and receives 502 when relay is down', async () => {
  // Given voice-bridge is healthy but relay is down (closed port)
  const healthRes = await fetch(`http://127.0.0.1:${vbPort}/health`)
  expect(healthRes.ok).toBe(true)

  // When API client GETs /agents
  const res = await fetch(`http://127.0.0.1:${vbPort}/agents`)

  // Then status is 502
  expect(res.status).toBe(502)

  // And body has error string
  const body: unknown = await res.json()
  expect(typeof body).toBe('object')
  expect(body).not.toBeNull()
  if (typeof body !== 'object' || body === null) throw new Error('unreachable')
  expect('error' in body).toBe(true)
  // After `in` narrowing, extract via Object.entries to stay cast-free.
  const errorEntry = Object.entries(body).find(([k]) => k === 'error')
  expect(errorEntry).toBeDefined()
  const errorVal = errorEntry?.[1]
  expect(typeof errorVal).toBe('string')
  expect(String(errorVal).length).toBeGreaterThan(0)
})
