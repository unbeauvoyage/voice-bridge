/**
 * Story: CEO sends an audio + image attachment via POST /compose
 *
 * NEGATIVE CONTROL PROVEN: The first version of this test asserted that
 * the received body contained "WRONG_MARKER" — it failed RED. After reverting
 * to the correct assertion ("[Attachment:") it went GREEN.
 *
 * Given:
 *   - voice-bridge is running at http://127.0.0.1:3030
 *   - whisper-server is running at http://127.0.0.1:8766
 *   - content-service is running at http://127.0.0.1:8770
 *   - relay is running at http://127.0.0.1:8767
 *   - A test-target HTTP server is registered with the relay
 * When:
 *   - CEO POSTs multipart { to: "test-target", audio: <wav>, attachments: [<png>] } to /compose
 * Then:
 *   - Whisper transcribes the audio (may be empty for silence)
 *   - ContentService stores the PNG and returns a URL
 *   - /compose returns 200 with { delivered: true }
 *   - The test-target received one message whose body contains "[Attachment:" marker
 *   - GET on the attachment URL returns the exact PNG bytes
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
// Use a different port file name to avoid conflicts with text-only test
const PORT_FILE = join(RELAY_CHANNEL_DIR, 'test-target-audio.port')

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
        res.end('{"name":"test-target-audio","status":"ok"}')
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
        reject(new Error('test-target-audio address unavailable'))
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
  timeoutMs = 15000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (messages.length >= count) return
    await sleep(200)
  }
  throw new Error(`Timed out waiting for ${count} messages (got ${messages.length})`)
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

// ── Tests ──────────────────────────────────────────────────────────────────────

test(
  'CEO sends audio + image attachment via /compose; test-target receives body with [Attachment:] marker and GET on URL returns matching PNG bytes',
  async () => {
    // Given all services are running
    const [vbHealth, whisperHealth, csHealth] = await Promise.all([
      fetch('http://127.0.0.1:3030/health'),
      fetch('http://127.0.0.1:8766/health'),
      fetch('http://127.0.0.1:8770/health'),
    ])
    expect(vbHealth.ok).toBe(true)
    expect(whisperHealth.ok).toBe(true)
    expect(csHealth.ok).toBe(true)

    // Clear previous messages
    receivedMessages.length = 0

    // Read fixture files
    const wavBytes = readFileSync(join(FIXTURES_DIR, 'silence.wav'))
    const pngBytes = readFileSync(join(FIXTURES_DIR, 'red-pixel.png'))

    // Build form: to + audio + attachments[]
    const form = new FormData()
    form.append('to', 'test-target-audio')
    form.append('audio', new Blob([wavBytes], { type: 'audio/wav' }), 'silence.wav')
    form.append('attachments', new Blob([pngBytes], { type: 'image/png' }), 'red-pixel.png')

    // When CEO POSTs to /compose (whisper + content-service run in parallel)
    const res = await fetch('http://127.0.0.1:3030/compose', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000),
    })

    // Then /compose returns 200
    expect(res.status).toBe(200)

    const json: unknown = await res.json()
    expect(typeof json).toBe('object')
    expect(json).not.toBeNull()
    if (typeof json !== 'object' || json === null) throw new Error('unreachable')

    expect('delivered' in json && json.delivered).toBe(true)
    expect('to' in json && json.to).toBe('test-target-audio')

    // There must be an attachmentUrls array with one entry
    expect('attachmentUrls' in json).toBe(true)
    if (!('attachmentUrls' in json) || !Array.isArray(json.attachmentUrls)) {
      throw new Error('expected attachmentUrls array')
    }
    expect(json.attachmentUrls).toHaveLength(1)

    const firstAttachment = json.attachmentUrls[0]
    if (
      typeof firstAttachment !== 'object' ||
      firstAttachment === null ||
      !('url' in firstAttachment) ||
      typeof firstAttachment.url !== 'string'
    ) {
      throw new Error('expected first attachment to have url string')
    }
    const attachmentUrl: string = firstAttachment.url

    // And the body contains the [Attachment:] marker
    if (!('body' in json) || typeof json.body !== 'string') {
      throw new Error('expected body string in response')
    }
    expect(json.body).toContain('[Attachment:')
    expect(json.body).toContain(attachmentUrl)

    // And test-target received exactly one message with the [Attachment:] marker
    await waitForMessages(receivedMessages, 1)
    expect(receivedMessages).toHaveLength(1)
    const receivedBody = receivedMessages[0]?.body ?? ''
    expect(receivedBody).toContain('[Attachment:')
    expect(receivedBody).toContain(attachmentUrl)

    // And GET on the attachment URL returns the exact PNG bytes
    const fileRes = await fetch(attachmentUrl)
    expect(fileRes.ok).toBe(true)
    expect(fileRes.headers.get('content-type')).toBe('image/png')
    const returnedBytes = Buffer.from(await fileRes.arrayBuffer())
    expect(returnedBytes).toEqual(pngBytes)
  },
  60000, // 60s timeout for whisper transcription
)
