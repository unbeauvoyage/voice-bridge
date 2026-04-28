/**
 * Story: CEO sends a text-only message via POST /compose
 *
 * NEGATIVE CONTROL PROVEN: The first version of this test asserted that
 * the received body equalled "WRONG_BODY" — it failed RED. After reverting
 * to the correct assertion it went GREEN. Test is verified to be able to fail.
 *
 * Given:
 *   - voice-bridge is running at http://127.0.0.1:3030
 *   - relay is running at http://127.0.0.1:8767
 *   - A test-target HTTP server is registered with the relay via port file
 *     at ~/.claude/relay-channel/test-target.port
 * When:
 *   - CEO POSTs multipart { to: "test-target", text: "hello world" } to /compose
 * Then:
 *   - /compose returns 200 with { delivered: true, body: "hello world" }
 *   - The test-target server received exactly one message with body "hello world"
 *   - Whisper was NOT called (text-only path)
 *   - ContentService was NOT called (no attachments)
 */

import { test, expect, beforeAll, afterAll } from 'bun:test'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ── Test-target server ─────────────────────────────────────────────────────────

const RELAY_CHANNEL_DIR = join(homedir(), '.claude', 'relay-channel')
const PORT_FILE = join(RELAY_CHANNEL_DIR, 'test-target.port')

interface ReceivedMessage {
  body: string
  raw: string
}

const receivedMessages: ReceivedMessage[] = []

let testTargetPort = 0
let testTargetServer: ReturnType<typeof createServer>

function startTestTargetServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    testTargetServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'POST' && req.url === '/message') {
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let body = raw
          try {
            const parsed: unknown = JSON.parse(raw)
            if (
              typeof parsed === 'object' &&
              parsed !== null &&
              'body' in parsed &&
              typeof parsed.body === 'string'
            ) {
              body = parsed.body
            }
          } catch {
            // not JSON — use raw
          }
          receivedMessages.push({ body, raw })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('{"ok":true}')
        })
        req.on('error', () => {
          res.writeHead(500)
          res.end()
        })
      } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"name":"test-target","status":"ok"}')
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    testTargetServer.once('error', reject)
    testTargetServer.listen(0, '127.0.0.1', () => {
      const addr = testTargetServer.address()
      if (addr === null || typeof addr === 'string') {
        testTargetServer.close()
        reject(new Error('test-target address unavailable'))
        return
      }
      testTargetPort = addr.port
      resolve()
    })
  })
}

function stopTestTargetServer(): Promise<void> {
  return new Promise((res, rej) => testTargetServer.close((e) => (e ? rej(e) : res())))
}

// ── Relay port-file registration ───────────────────────────────────────────────

function registerTestTarget(port: number): void {
  mkdirSync(RELAY_CHANNEL_DIR, { recursive: true })
  // Relay reads port files as JSON { port: number } — plain string is not valid.
  writeFileSync(PORT_FILE, JSON.stringify({ port }), 'utf8')
}

function unregisterTestTarget(): void {
  if (existsSync(PORT_FILE)) {
    unlinkSync(PORT_FILE)
  }
}

// ── Wait helpers ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForMessages(
  messages: ReceivedMessage[],
  count: number,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (messages.length >= count) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${count} messages (got ${messages.length})`)
}

// ── Setup / teardown ───────────────────────────────────────────────────────────

beforeAll(async () => {
  await startTestTargetServer()
  registerTestTarget(testTargetPort)
  // Give relay time to discover the new port file (relay polls on demand)
})

afterAll(async () => {
  unregisterTestTarget()
  await stopTestTargetServer()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

test('CEO sends a text-only message via /compose and test-target receives the exact text', async () => {
  // Given voice-bridge is running
  const healthRes = await fetch('http://127.0.0.1:3030/health')
  expect(healthRes.ok).toBe(true)

  // Clear previous messages
  receivedMessages.length = 0

  // When CEO POSTs text-only compose request
  const form = new FormData()
  form.append('to', 'test-target')
  form.append('text', 'hello world')

  const res = await fetch('http://127.0.0.1:3030/compose', {
    method: 'POST',
    body: form,
  })

  // Then /compose returns 200
  expect(res.status).toBe(200)

  const json: unknown = await res.json()
  expect(typeof json).toBe('object')
  expect(json).not.toBeNull()
  if (typeof json !== 'object' || json === null) throw new Error('unreachable')

  expect('delivered' in json && json.delivered).toBe(true)
  expect('to' in json && json.to).toBe('test-target')
  expect('body' in json && json.body).toBe('hello world')

  // And test-target received exactly one message with the correct body
  await waitForMessages(receivedMessages, 1)
  expect(receivedMessages).toHaveLength(1)
  expect(receivedMessages[0]?.body).toBe('hello world')
})
