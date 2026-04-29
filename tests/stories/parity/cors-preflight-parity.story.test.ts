/**
 * User story: ceo-app can preflight /compose from the browser.
 *
 * Given the voice-bridge2 server is running
 * When a browser sends OPTIONS /compose (CORS preflight)
 * Then the response status is 204
 * And Access-Control-Allow-Origin is "*"
 * And Access-Control-Allow-Methods includes "POST"
 *
 * Run: bun test ./tests/stories/parity/cors-preflight-parity.story.test.ts
 */

import { test, expect, beforeAll, afterAll } from 'bun:test'
import { spawn, type ChildProcess } from 'child_process'

const VB_TEST_PORT = Number(process.env['VB_TEST_PORT'] ?? 18803)
const VB_URL = `http://127.0.0.1:${VB_TEST_PORT}`
const PRODUCTION_PORTS = new Set([3030])

if (PRODUCTION_PORTS.has(VB_TEST_PORT)) {
  throw new Error(`cors story test refuses to run against production port ${VB_TEST_PORT}`)
}

let serverProcess: ChildProcess | null = null

async function waitForServer(url: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`)
      if (res.ok) return
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`)
}

beforeAll(async () => {
  serverProcess = spawn('bun', ['run', 'server/index.ts'], {
    cwd: '/Users/riseof/environment/projects/management-apps/voice-bridge2',
    env: {
      ...process.env,
      PORT: String(VB_TEST_PORT),
      NODE_ENV: 'test',
    },
    stdio: 'pipe',
  })

  serverProcess.stderr?.on('data', (d: Buffer) => {
    process.stderr.write(`[voice-bridge] ${d.toString()}`)
  })

  await waitForServer(VB_URL)
})

afterAll(() => {
  serverProcess?.kill('SIGTERM')
})

test('OPTIONS /compose returns CORS preflight headers that allow browser requests', async () => {
  // Negative control: wrong method should NOT return Allow-Methods header with POST
  const getRes = await fetch(`${VB_URL}/compose`, { method: 'GET' })
  expect(getRes.headers.get('Access-Control-Allow-Methods')).toBeNull()

  // When: send OPTIONS /compose (browser CORS preflight)
  const res = await fetch(`${VB_URL}/compose`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type',
    },
  })

  // Then: 204 No Content
  expect(res.status).toBe(204)

  // And: Access-Control-Allow-Origin permits any origin
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')

  // And: Access-Control-Allow-Methods includes POST (the method ceo-app uses)
  const allowMethods = res.headers.get('Access-Control-Allow-Methods') ?? ''
  expect(allowMethods).toContain('POST')
})
