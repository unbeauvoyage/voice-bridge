/**
 * E2E tests for the mic pickup pipeline — real HTTP against a live test server.
 *
 * Root cause investigated 2026-04-18: "H-IBC not picking up — mic toggled on
 * but not listening." When the app crashes mid-TTS, a stale `tts-{uuid}` token
 * remains in the pause directory. The daemon pauses for ANY file there, but
 * the UI (isMicOn) only checks the `manual` token — so the UI shows "MIC ON"
 * while the daemon stays silenced. Fix: cleanStaleTtsPauseTokens() runs at
 * server startup and removes all stale tts-* tokens.
 *
 * All tests make real fetch() calls to a Bun.serve instance running on TEST_PORT.
 * The server is configured with a test-isolated pause directory so tests cannot
 * pollute /tmp/wake-word-pause.d used by the production server.
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { mkdirSync, existsSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  handleMic,
  setMic,
  handleMicCommand,
  cleanStaleTtsPauseTokens
} from '../../server/routes/mic.ts'
import { handleTranscribe } from '../../server/routes/transcribe.ts'
import type { TranscribeContext, DedupEntry } from '../../server/routes/transcribe.ts'
import type { LlmRouteResult } from '../../server/llmRouter.ts'

const TEST_PORT = 13035
const TEST_PAUSE_DIR = '/tmp/vb2-mic-e2e-test.d'
const TEST_MANUAL_TOKEN = join(TEST_PAUSE_DIR, 'manual')
const BASE = `http://localhost:${TEST_PORT}`

// ── Test server ───────────────────────────────────────────────────────────────
// Mirrors server/index.ts wiring but with:
//   - isolated test pause directory (not /tmp/wake-word-pause.d)
//   - stub transcribeAudio that returns a configurable transcript
//   - stub deliverMessage that always succeeds

let mockTranscript = 'hello world'

// Bun's fetch client strips Content-Type from multipart file parts.
// Patch the request so the file's MIME is correctly reported to formData().
// (Same technique used in server/integration.test.ts.)
async function patchRequestMime(req: Request): Promise<Request> {
  const bodyBuf = new Uint8Array(await req.arrayBuffer())
  const head = new TextDecoder().decode(bodyBuf.slice(0, 512))
  const match = head.match(/Content-Type:\s*([^\r\n]+)/i)
  const mime = match?.[1]?.trim() ?? ''
  const syntheticReq = new Request(req.url, { method: req.method })
  Object.defineProperty(syntheticReq, 'formData', {
    value: async () => {
      const form = new FormData()
      form.append('audio', new File([bodyBuf], 'recording', { type: mime }))
      form.append('to', 'command')
      return form
    }
  })
  return syntheticReq
}

function makeTranscribeCtx(): TranscribeContext {
  return {
    recentAudioHashes: new Map<string, DedupEntry>(),
    evictStaleHashes: () => {},
    hashAudioBuffer: (buf: Buffer) => `hash-${buf.length}-${Date.now()}-${Math.random()}`,
    loadLastTarget: () => 'command',
    saveLastTarget: () => {},
    handleMicCommand: (transcript: string) =>
      handleMicCommand(transcript, TEST_PAUSE_DIR, TEST_MANUAL_TOKEN),
    getKnownAgents: async () => ['command'],
    deliverMessage: async () => ({ ok: true }),
    transcribeAudio: async () => ({ transcript: mockTranscript, audioRms: 10000 }),
    llmRoute: async (_t: string, _a: string[], fallback: string): Promise<LlmRouteResult> => ({
      agent: fallback,
      message: _t,
      agentChanged: false
    })
  }
}

let server: ReturnType<typeof Bun.serve>

beforeAll(() => {
  // Place stale TTS token before server starts — simulates crash-leftover state
  mkdirSync(TEST_PAUSE_DIR, { recursive: true })
  writeFileSync(join(TEST_PAUSE_DIR, 'tts-stale-from-prev-crash'), '')

  // Server startup: clean stale TTS tokens (mirrors server/index.ts)
  cleanStaleTtsPauseTokens(TEST_PAUSE_DIR)

  server = Bun.serve({
    port: TEST_PORT,
    async fetch(req) {
      const url = new URL(req.url)

      // Mic route
      if (url.pathname === '/mic') {
        const res = await handleMic(req, {
          isMicOn: () => !existsSync(TEST_MANUAL_TOKEN),
          setMic: (on: boolean) => setMic(on, TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)
        })
        if (res) return res
      }

      // Transcribe route (for mic command integration test)
      if (req.method === 'POST' && url.pathname === '/transcribe') {
        const patched = await patchRequestMime(req)
        return handleTranscribe(patched, makeTranscribeCtx())
      }

      return new Response('Not found', { status: 404 })
    }
  })
})

afterAll(() => {
  server.stop(true)
  try {
    rmSync(TEST_PAUSE_DIR, { recursive: true })
  } catch {
    /* ok */
  }
})

afterEach(() => {
  // Reset mic to "on" after each test so tests are independent
  try {
    rmSync(TEST_MANUAL_TOKEN)
  } catch {
    /* may not exist */
  }
  mockTranscript = 'hello world'
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getMicState(): Promise<string> {
  const res = await fetch(`${BASE}/mic`)
  const body: unknown = await res.json()
  if (typeof body === 'object' && body !== null && 'state' in body) {
    return String(body.state)
  }
  throw new Error('unexpected body shape')
}

async function setMicViaHttp(state: 'on' | 'off'): Promise<Response> {
  return fetch(`${BASE}/mic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state })
  })
}

function buildAudioMultipart(transcript: string): { body: Uint8Array; contentType: string } {
  const boundary = '----VBMicTestBoundary'
  const enc = new TextEncoder()
  const audio = new Uint8Array(512).fill(1)
  const parts: Uint8Array[] = [
    enc.encode(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="audio"; filename="recording"\r\n` +
        `Content-Type: audio/webm\r\n\r\n`
    ),
    audio,
    enc.encode('\r\n'),
    enc.encode(
      `--${boundary}\r\n` + `Content-Disposition: form-data; name="to"\r\n\r\ncommand\r\n`
    ),
    enc.encode(`--${boundary}--\r\n`)
  ]
  // Patch the mock transcript before returning — caller sets it via mockTranscript
  void transcript // transcript is set on the module-level mock before calling
  const total = parts.reduce((n, p) => n + p.length, 0)
  const body = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    body.set(p, offset)
    offset += p.length
  }
  return { body, contentType: `multipart/form-data; boundary=${boundary}` }
}

// ── 1. Crash recovery — stale TTS token cleaned on startup ────────────────────

describe('mic: after app crash, stale TTS pause tokens are removed on restart', () => {
  test('stale tts-* token placed before startup is gone after server starts', () => {
    // The token was placed in beforeAll and cleaned by cleanStaleTtsPauseTokens() at startup.
    // This asserts the cleanup actually ran — the stale token must not be present.
    const stalePath = join(TEST_PAUSE_DIR, 'tts-stale-from-prev-crash')
    expect(existsSync(stalePath)).toBe(false)
  })

  test('after crash recovery, GET /mic returns "on" (daemon can resume listening)', async () => {
    // With stale token cleaned and no manual token, the mic should be on.
    const state = await getMicState()
    expect(state).toBe('on')
  })

  test('cleanup preserves the manual token — user-set mic-off survives restart', () => {
    // Set manual token
    mkdirSync(TEST_PAUSE_DIR, { recursive: true })
    writeFileSync(TEST_MANUAL_TOKEN, '')
    // Also write a stale TTS token
    const stalePath = join(TEST_PAUSE_DIR, 'tts-new-stale')
    writeFileSync(stalePath, '')

    cleanStaleTtsPauseTokens(TEST_PAUSE_DIR)

    expect(existsSync(stalePath)).toBe(false) // stale TTS gone
    expect(existsSync(TEST_MANUAL_TOKEN)).toBe(true) // manual survives
    // teardown: afterEach removes manual token
  })

  test('cleanup does not remove non-tts-prefixed files in pause dir', () => {
    const otherFile = join(TEST_PAUSE_DIR, 'some-other-owner')
    writeFileSync(otherFile, '')
    cleanStaleTtsPauseTokens(TEST_PAUSE_DIR)
    const stillExists = existsSync(otherFile)
    try {
      rmSync(otherFile)
    } catch {
      /* ok */
    }
    expect(stillExists).toBe(true)
  })

  test('cleanup is safe to call when pause directory does not exist', () => {
    expect(() => cleanStaleTtsPauseTokens('/tmp/vb2-nonexistent-cleanup-dir-12345')).not.toThrow()
  })
})

// ── 2. Mic toggle via HTTP ─────────────────────────────────────────────────────

describe('mic: user toggles mic on and off via settings UI', () => {
  test('GET /mic returns "on" when mic is active (no manual pause token)', async () => {
    const state = await getMicState()
    expect(state).toBe('on')
  })

  test('POST /mic {state:"off"} — mic turns off, GET /mic confirms "off"', async () => {
    const res = await setMicViaHttp('off')
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(body).toMatchObject({ state: 'off' })
    expect(await getMicState()).toBe('off')
  })

  test('POST /mic {state:"on"} — mic turns on, GET /mic confirms "on"', async () => {
    // Start in off state
    await setMicViaHttp('off')
    expect(await getMicState()).toBe('off')

    const res = await setMicViaHttp('on')
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(body).toMatchObject({ state: 'on' })
    expect(await getMicState()).toBe('on')
  })

  test('POST /mic with invalid state returns 400 — mic state unchanged', async () => {
    const res = await fetch(`${BASE}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'maybe' })
    })
    expect(res.status).toBe(400)
    // Mic should still be on (unchanged)
    expect(await getMicState()).toBe('on')
  })

  test('POST /mic with missing state field returns 400', async () => {
    const res = await fetch(`${BASE}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    expect(res.status).toBe(400)
    expect(await getMicState()).toBe('on')
  })
})

// ── 3. Voice mic commands via /transcribe ─────────────────────────────────────

describe('mic: user speaks voice command to control mic', () => {
  test('"turn off the mic" — transcribe route pauses the mic via manual token', async () => {
    mockTranscript = 'turn off the mic'
    const { body, contentType } = buildAudioMultipart(mockTranscript)

    const res = await fetch(`${BASE}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body
    })

    expect(res.status).toBe(200)
    const responseBody: unknown = await res.json()
    // Mic command responses include mic field indicating the new state
    expect(responseBody).toMatchObject({ mic: 'off', command: true })
    // And the mic state is actually off now
    expect(await getMicState()).toBe('off')
  })

  test('"turn on the microphone" — transcribe route resumes the mic', async () => {
    // Start paused
    await setMicViaHttp('off')
    expect(await getMicState()).toBe('off')

    mockTranscript = 'turn on the microphone'
    const { body, contentType } = buildAudioMultipart(mockTranscript)

    const res = await fetch(`${BASE}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body
    })

    expect(res.status).toBe(200)
    const responseBody: unknown = await res.json()
    expect(responseBody).toMatchObject({ mic: 'on', command: true })
    expect(await getMicState()).toBe('on')
  })

  test('non-mic-command transcript — mic state is unchanged', async () => {
    mockTranscript = 'schedule a meeting for tomorrow'
    const { body, contentType } = buildAudioMultipart(mockTranscript)

    await fetch(`${BASE}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body
    })

    // Mic was on, should remain on after a non-command transcript
    expect(await getMicState()).toBe('on')
  })
})

// ── 4. Pause directory integrity ──────────────────────────────────────────────

describe('mic: pause directory state is consistent across toggle operations', () => {
  test('toggling mic off then on leaves no stale tokens in pause directory', async () => {
    await setMicViaHttp('off')
    await setMicViaHttp('on')

    // After on-off-on cycle, the pause dir should be empty (or contain only non-manual entries
    // from other sources — but the manual token must not remain)
    expect(existsSync(TEST_MANUAL_TOKEN)).toBe(false)

    // If the directory exists, the manual token must not be the only entry
    if (existsSync(TEST_PAUSE_DIR)) {
      const entries = readdirSync(TEST_PAUSE_DIR)
      expect(entries.includes('manual')).toBe(false)
    }
  })
})
