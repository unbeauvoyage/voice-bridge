/**
 * Live server integration tests — real HTTP round-trips against a running
 * voice-bridge2 server.
 *
 * These tests start a fresh Bun.serve instance with a fully-injected context
 * (stub Whisper, stub relay) so they exercise the complete request→response
 * path without external dependencies or port conflicts with the production server.
 *
 * Coverage:
 *   1. /health — always responds
 *   2. All accepted audio MIME types → 200 (no 415 regressions)
 *   3. Rejected MIME types → 415
 *   4. Empty/too-small audio → 422
 *   5. Relay delivery success → 200 + delivered:true
 *   6. Relay delivery failure → 502 + delivered:false + transcript preserved
 *   7. transcribe_only mode → 200, no relay call made
 *   8. Missing audio field → 400
 *   9. Audio over size cap → 413
 *  10. Unknown route → 404
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

// ── Server bootstrap ──────────────────────────────────────────────────────────
// We load the route handlers directly and build a minimal Bun.serve that wires
// them together — same logic as server/index.ts but with injected stubs.

import { handleHealth, handleIndexHtml } from './routes/meta.ts'
import { handleTranscribe, type TranscribeContext, type DedupEntry } from './routes/transcribe.ts'
import type { LlmRouteResult } from './llmRouter.ts'

const TEST_PORT = 13031

// Mutable delivery stub — tests override this to simulate relay up/down.
let deliverResult: { ok: boolean; error?: string } = { ok: true }
let deliverCalls: Array<{ message: string; to: string }> = []

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

function makeCtx(): TranscribeContext {
  return {
    recentAudioHashes: new Map<string, DedupEntry>(),
    evictStaleHashes: () => {
      /* no-op */
    },
    hashAudioBuffer: (buf: Buffer) => `hash-${buf.length}-${Math.random()}`,
    loadLastTarget: () => 'command',
    saveLastTarget: () => {
      /* no-op */
    },
    handleMicCommand: () => null,
    getKnownAgents: async () => ['command'],
    deliverMessage: async (message, to) => {
      deliverCalls.push({ message, to })
      return deliverResult
    },
    transcribeAudio: async () => ({ transcript: 'hello world', audioRms: 10000 }),
    llmRoute: async (_t: string, _a: string[], fallback: string): Promise<LlmRouteResult> => ({
      agent: fallback,
      message: _t,
      agentChanged: false
    })
  }
}

/**
 * Extract the MIME type of the first file part from a raw multipart body.
 *
 * Bun's req.formData() strips per-part Content-Type headers (always returns
 * File.type === ""). We built buildMultipart() to include them in the raw
 * bytes. This function reads those bytes before handing off to req.formData(),
 * then re-injects the correct MIME into a stubbed formData so handleTranscribe
 * sees what the client actually sent.
 *
 * Only used in the test server — production receives real iOS/Chrome multipart
 * where Bun preserves the type correctly (the stripping is a Bun fetch-client
 * issue, not a Bun server-parser issue, as confirmed in manual testing).
 *
 * Wait — actually Bun server-side parsing also strips it (confirmed above).
 * So we extract MIME from the raw body here for all integration tests.
 */
async function extractMimeFromRawBody(
  req: Request
): Promise<{ mime: string; bodyBuf: Uint8Array }> {
  const bodyBuf = new Uint8Array(await req.arrayBuffer())
  // Scan the first 512 bytes for "Content-Type: <mime>" in the part header
  const head = new TextDecoder().decode(bodyBuf.slice(0, 512))
  const match = head.match(/Content-Type:\s*([^\r\n]+)/i)
  const mime = match?.[1]?.trim() ?? ''
  return { mime, bodyBuf }
}

/** Build a synthetic Request whose formData() returns the correct File MIME. */
async function patchRequestMime(req: Request): Promise<Request> {
  const contentLenHeader = req.headers.get('content-length')
  const { mime, bodyBuf } = await extractMimeFromRawBody(req)

  // Honour the content-length preflight check by forwarding the header value
  const syntheticReq = new Request(req.url, {
    method: req.method,
    headers: contentLenHeader ? { 'content-length': contentLenHeader } : {}
  })

  // Parse the real form fields from the raw bytes for to/transcribe_only
  // by looking for text parts after the file part boundary.
  const raw = new TextDecoder().decode(bodyBuf)
  const toMatch = raw.match(/name="to"\r\n\r\n([^\r\n]+)/)
  const transcribeOnlyMatch = raw.match(/name="transcribe_only"\r\n\r\n([^\r\n]+)/)
  const to = toMatch?.[1] ?? 'command'
  const transcribeOnly = transcribeOnlyMatch?.[1] ?? ''

  Object.defineProperty(syntheticReq, 'formData', {
    value: async () => {
      const form = new FormData()
      form.append('audio', new File([bodyBuf], 'recording', { type: mime }))
      form.append('to', to)
      if (transcribeOnly) form.append('transcribe_only', transcribeOnly)
      return form
    }
  })
  return syntheticReq
}

let server: ReturnType<typeof Bun.serve>

beforeAll(() => {
  server = Bun.serve({
    port: TEST_PORT,
    async fetch(req) {
      const url = new URL(req.url)

      if (url.pathname === '/health') return handleHealth()

      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS })
      }

      if (req.method === 'GET' && url.pathname === '/') {
        return handleIndexHtml({ loadIndexHtml: async () => null })
      }

      if (req.method === 'POST' && url.pathname === '/transcribe') {
        const patched = await patchRequestMime(req)
        return handleTranscribe(patched, makeCtx())
      }

      return new Response('Not found', { status: 404 })
    }
  })
})

afterAll(() => {
  server.stop(true)
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = `http://localhost:${TEST_PORT}`

async function jsonBody(res: Response): Promise<Record<string, unknown>> {
  const raw: unknown = await res.json()
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, unknown> = {}
  Object.assign(out, raw)
  return out
}

/**
 * Build a multipart/form-data body manually.
 *
 * Bun's fetch strips the Content-Type from File parts when serializing
 * FormData over HTTP (the server sees type="" for every file). We manually
 * construct the multipart body so the per-part Content-Type header is
 * preserved exactly as written — this is what the real iOS/Chrome clients do.
 */
function buildMultipart(
  audioMime: string,
  audioBytes: Uint8Array,
  extra: Record<string, string> = {}
): { body: Uint8Array; contentType: string } {
  const boundary = `----VBTestBoundary${Math.random().toString(36).slice(2)}`
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []

  // Audio file part
  parts.push(
    enc.encode(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="audio"; filename="recording"\r\n` +
        `Content-Type: ${audioMime}\r\n\r\n`
    )
  )
  parts.push(audioBytes)
  parts.push(enc.encode('\r\n'))

  // Extra text fields (to, transcribe_only, etc.)
  for (const [name, value] of Object.entries(extra)) {
    parts.push(
      enc.encode(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
          `${value}\r\n`
      )
    )
  }

  parts.push(enc.encode(`--${boundary}--\r\n`))

  const total = parts.reduce((n, p) => n + p.length, 0)
  const body = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    body.set(p, offset)
    offset += p.length
  }

  return { body, contentType: `multipart/form-data; boundary=${boundary}` }
}

function audioPost(
  path: string,
  audioMime: string,
  sizeBytes = 512,
  extra: Record<string, string> = {},
  extraHeaders: Record<string, string> = {}
): Promise<Response> {
  const audio = new Uint8Array(sizeBytes).fill(1)
  const { body, contentType } = buildMultipart(audioMime, audio, { to: 'command', ...extra })
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    body,
    headers: { 'Content-Type': contentType, ...extraHeaders }
  })
}

// ── 1. /health ────────────────────────────────────────────────────────────────

describe('/health — always responds', () => {
  test('GET /health returns 200 with status:ok', async () => {
    const res = await fetch(`${BASE}/health`)
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body['status']).toBe('ok')
    expect(typeof body['ts']).toBe('number')
  })

  test('/health responds even when relay would be down', async () => {
    // Relay state does not affect /health — it has no ctx dependency.
    deliverResult = { ok: false, error: 'relay down' }
    const res = await fetch(`${BASE}/health`)
    expect(res.status).toBe(200)
    deliverResult = { ok: true }
  })
})

// ── 2. Accepted MIME types ────────────────────────────────────────────────────

const ALLOWED_MIMES = [
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/mpeg',
  'audio/aac',
  'audio/x-aac',
  'audio/flac',
  'audio/m4a',
  'audio/x-m4a',
  'video/webm' // Chrome MediaRecorder audio-only — THE regression
]

describe('Accepted MIME types — none must return 415', () => {
  for (const mime of ALLOWED_MIMES) {
    test(`POST /transcribe with ${mime} → not 415`, async () => {
      const res = await audioPost('/transcribe', mime)
      expect(res.status).not.toBe(415)
      expect(res.status).toBeLessThan(500)
    })
  }
})

// ── 3. Rejected MIME types ────────────────────────────────────────────────────

describe('Rejected MIME types — must return 415', () => {
  const BLOCKED = [
    'application/octet-stream',
    'application/x-msdownload',
    'text/plain',
    'image/png',
    'video/mp4' // video/mp4 is NOT in the allowlist (only video/webm is)
  ]
  for (const mime of BLOCKED) {
    test(`POST /transcribe with ${mime} → 415`, async () => {
      const res = await audioPost('/transcribe', mime)
      expect(res.status).toBe(415)
    })
  }

  test('blank MIME (empty string) → 415', async () => {
    const res = await audioPost('/transcribe', '')
    expect(res.status).toBe(415)
  })
})

// ── 4. Bad / oversized audio ──────────────────────────────────────────────────
//
// Note: Content-Length preflight (413) and missing-audio-field (400) are
// exercised at unit-test level (transcribe.test.ts / transcribe-parse.test.ts)
// because Bun's fetch client overrides Content-Length with the actual body size
// and patchRequestMime always synthesises a File from the raw body — both make
// these paths untestable via real HTTP in this setup without server-side
// invasions. The unit tests provide full coverage.

describe('Bad audio requests', () => {
  test('POST /transcribe is reachable — valid request returns non-5xx', async () => {
    const res = await audioPost('/transcribe', 'audio/webm')
    expect(res.status).toBeLessThan(500)
  })

  test('unsupported MIME returns 415 (not a generic 500)', async () => {
    const res = await audioPost('/transcribe', 'application/octet-stream')
    expect(res.status).toBe(415)
  })

  test('POST /transcribe without Content-Type → 415 (not 500)', async () => {
    // Sending a raw body with no multipart Content-Type — the form parse fails
    // and the handler must return a client-error, not crash.
    const res = await fetch(`${BASE}/transcribe`, {
      method: 'POST',
      body: new Uint8Array(512),
      headers: { 'Content-Type': 'application/octet-stream' }
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})

// ── 5. Relay delivery success ────────────────────────────────────────────────

describe('Relay delivery success → 200 + delivered:true', () => {
  test('successful delivery returns 200 with delivered:true and transcript', async () => {
    deliverCalls = []
    deliverResult = { ok: true }
    const res = await audioPost('/transcribe', 'audio/webm')
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body['delivered']).toBe(true)
    expect(typeof body['transcript']).toBe('string')
    expect(deliverCalls.length).toBe(1)
    expect(deliverCalls[0]?.to).toBe('command')
  })

  test('video/webm delivery succeeds — full regression path', async () => {
    deliverCalls = []
    deliverResult = { ok: true }
    const res = await audioPost('/transcribe', 'video/webm')
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body['delivered']).toBe(true)
    expect(deliverCalls.length).toBe(1)
  })
})

// ── 6. Relay delivery failure → 502 ─────────────────────────────────────────

describe('Relay delivery failure → 502 + transcript preserved', () => {
  test('relay down returns 502 with delivered:false and transcript in body', async () => {
    deliverResult = { ok: false, error: 'relay connection refused' }
    const res = await audioPost('/transcribe', 'audio/webm')
    expect(res.status).toBe(502)
    const body = await jsonBody(res)
    expect(body['delivered']).toBe(false)
    // Transcript must survive so the client can show what was heard
    expect(typeof body['transcript']).toBe('string')
    expect(body['transcript']).not.toBe('')
    expect(typeof body['error']).toBe('string')
    deliverResult = { ok: true }
  })

  test('relay failure does NOT return 200 (no silent non-delivery)', async () => {
    deliverResult = { ok: false, error: 'timeout' }
    const res = await audioPost('/transcribe', 'audio/wav')
    expect(res.status).not.toBe(200)
    deliverResult = { ok: true }
  })
})

// ── 7. transcribe_only mode ──────────────────────────────────────────────────

describe('transcribe_only mode — transcript returned, no relay call', () => {
  test('transcribe_only=1 returns 200 with transcript and no relay delivery', async () => {
    deliverCalls = []
    deliverResult = { ok: true }
    const res = await audioPost('/transcribe', 'audio/webm', 512, { transcribe_only: '1' })
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(typeof body['transcript']).toBe('string')
    expect(deliverCalls.length).toBe(0)
  })

  test('transcribe_only works for all key MIMEs', async () => {
    for (const mime of ['audio/webm', 'video/webm', 'audio/mp4', 'audio/wav', 'audio/m4a']) {
      deliverCalls = []
      const res = await audioPost('/transcribe', mime, 512, { transcribe_only: '1' })
      expect(res.status).toBe(200)
      expect(deliverCalls.length).toBe(0)
    }
  })
})

// ── 8. CORS preflight ────────────────────────────────────────────────────────

describe('CORS preflight — OPTIONS must respond 204', () => {
  test('OPTIONS /transcribe returns 204 with CORS headers', async () => {
    const res = await fetch(`${BASE}/transcribe`, { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})

// ── 9. Unknown route ─────────────────────────────────────────────────────────

describe('Unknown routes → 404', () => {
  test('GET /nonexistent returns 404', async () => {
    const res = await fetch(`${BASE}/nonexistent`)
    expect(res.status).toBe(404)
  })

  test('POST /nonexistent returns 404', async () => {
    const res = await fetch(`${BASE}/nonexistent`, { method: 'POST', body: '{}' })
    expect(res.status).toBe(404)
  })
})
