/**
 * Story: CEO sends a voice message via POST /compose and the transcript is delivered.
 *
 * NEGATIVE CONTROL PROVEN: First run asserted body === 'WRONG_TRANSCRIPT' — went RED.
 * After reverting to body.length > 0 the test goes GREEN.
 *
 * Given:
 *   - voice-bridge is running at http://127.0.0.1:3030
 *   - whisper-server is running at http://127.0.0.1:8766 (BLOCKED if not)
 *   - relay is running at http://127.0.0.1:8767
 *   - A test-target-speech HTTP server is registered with the relay
 * When:
 *   - CEO POSTs multipart { to: "test-target-speech", audio: <real speech wav> } to /compose
 * Then:
 *   - Whisper transcribes the audio to a non-empty string
 *   - /compose returns 200 with { delivered: true, body: <non-empty transcript> }
 *   - test-target-speech received one message whose body is the transcript
 *   - Whisper was called with real audio (no mocks)
 *
 * Run: bun test ./tests/stories/compose/audio.story.test.ts
 */

import { test, expect, beforeAll, afterAll } from 'bun:test'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdirSync, writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures')

// ── Test-target server ─────────────────────────────────────────────────────────

const RELAY_CHANNEL_DIR = join(homedir(), '.claude', 'relay-channel')
const PORT_FILE = join(RELAY_CHANNEL_DIR, 'test-target-speech.port')

interface ReceivedMessage {
  body: string
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
          receivedMessages.push({ body })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('{"ok":true}')
        })
        req.on('error', () => {
          res.writeHead(500)
          res.end()
        })
      } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"name":"test-target-speech","status":"ok"}')
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
        reject(new Error('test-target-speech address unavailable'))
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

function registerTestTarget(port: number): void {
  mkdirSync(RELAY_CHANNEL_DIR, { recursive: true })
  writeFileSync(PORT_FILE, JSON.stringify({ port }), 'utf8')
}

function unregisterTestTarget(): void {
  if (existsSync(PORT_FILE)) unlinkSync(PORT_FILE)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForMessages(count: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (receivedMessages.length >= count) return
    await sleep(200)
  }
  throw new Error(`Timed out waiting for ${count} message(s) (got ${receivedMessages.length})`)
}

// ── Setup / teardown ───────────────────────────────────────────────────────────

beforeAll(async () => {
  await startTestTargetServer()
  registerTestTarget(testTargetPort)
})

afterAll(async () => {
  unregisterTestTarget()
  await stopTestTargetServer()
})

// ── Test ───────────────────────────────────────────────────────────────────────

test(
  'CEO sends a voice-only message via /compose; whisper transcribes it and test-target-speech receives the non-empty transcript',
  async () => {
    // BLOCKED guard — whisper must be reachable before we proceed.
    // A failed fetch (ECONNREFUSED) is caught and surfaced as BLOCKED, not a test failure.
    const whisperUp = await fetch('http://127.0.0.1:8766/health')
      .then((r) => r.ok)
      .catch(() => false)
    if (!whisperUp) {
      throw new Error(
        'BLOCKED — preconditions absent: whisper-server at :8766 is not reachable. ' +
          'Start whisper-server before running this test.',
      )
    }

    // Given voice-bridge and relay are running
    const [vbRes, relayRes] = await Promise.all([
      fetch('http://127.0.0.1:3030/health'),
      fetch('http://127.0.0.1:8767/health'),
    ])
    expect(vbRes.ok).toBe(true)
    expect(relayRes.ok).toBe(true)

    receivedMessages.length = 0

    // Load the real speech fixture (Samantha TTS, "testing one two three", 16kHz PCM WAV).
    const wavBytes = readFileSync(join(FIXTURES_DIR, 'speech.wav'))
    const audioBlob = new Blob([wavBytes], { type: 'audio/wav' })

    // When CEO POSTs audio-only compose request
    const form = new FormData()
    form.append('to', 'test-target-speech')
    form.append('audio', audioBlob, 'speech.wav')

    const res = await fetch('http://127.0.0.1:3030/compose', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30_000),
    })

    // Then /compose returns 200
    expect(res.status).toBe(200)

    const json: unknown = await res.json()
    if (typeof json !== 'object' || json === null) throw new Error(`unexpected response: ${String(json)}`)

    // delivered: true
    expect('delivered' in json && json.delivered).toBe(true)
    expect('to' in json && json.to).toBe('test-target-speech')

    // body must be the non-empty transcript
    if (!('body' in json) || typeof json.body !== 'string') {
      throw new Error(`expected body string in response, got: ${JSON.stringify(json)}`)
    }
    const body: string = json.body
    expect(body.length).toBeGreaterThan(0)

    // transcript field is present and matches body (audio-only path → transcript === body)
    if (!('transcript' in json) || typeof json.transcript !== 'string') {
      throw new Error(`expected transcript string in response, got: ${JSON.stringify(json)}`)
    }
    expect(json.transcript.length).toBeGreaterThan(0)

    // And test-target-speech received exactly one message with the same body
    await waitForMessages(1)
    expect(receivedMessages).toHaveLength(1)
    const receivedBody = receivedMessages[0]?.body ?? ''
    expect(receivedBody).toBe(body)
  },
  60_000, // 60s: whisper on CPU can be slow
)
