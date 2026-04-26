/**
 * Integration tests for all 14 VB2 OpenAPI operations.
 * Real HTTP calls against a running server subprocess.
 * The OpenAPI spec (docs/openapi.yaml) is the test contract.
 *
 * Covers:
 *  1. GET  /health
 *  2. GET  /
 *  3. POST /transcribe  (error paths only — no Whisper in CI)
 *  4. GET  /messages     (error paths — no relay in CI)
 *  5. GET  /mic
 *  6. POST /mic
 *  7. GET  /agents
 *  8. GET  /status
 *  9. POST /target
 * 10. GET  /settings
 * 11. POST /settings
 * 12. GET  /wake-word
 * 13. POST /wake-word/stop
 * 14. POST /wake-word/start
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { join } from 'node:path'

/** Type predicate: narrows unknown to a plain JSON object. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** Parses a response body as a Record for test assertions. Throws if not an object. */
async function jsonBody(res: Response): Promise<Record<string, unknown>> {
  let v: unknown
  try {
    v = await res.json()
  } catch (err) {
    throw new Error(
      `jsonBody: failed to parse JSON from ${res.url} (status ${res.status}): ${String(err)}`
    )
  }
  if (!isRecord(v))
    throw new Error(`jsonBody: expected JSON object from ${res.url}, got: ${JSON.stringify(v)}`)
  return v
}

const TEST_PORT = 3098
const BASE = `http://localhost:${TEST_PORT}`
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
      const res = await fetch(`${BASE}/health`)
      if (res.ok) break
    } catch {
      /* not ready */
    }
    await Bun.sleep(100)
  }
})

afterAll(() => {
  proc?.kill()
})

// ── 1. GET /health ──────────────────────────────────────────────────────────

describe('GET /health', () => {
  test('returns { status: "ok", ts: number }', async () => {
    const res = await fetch(`${BASE}/health`)
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.status).toBe('ok')
    expect(typeof body.ts).toBe('number')
  })
})

// ── 2. GET / ────────────────────────────────────────────────────────────────

describe('GET /', () => {
  test('returns HTML 200 or 404 when index.html missing', async () => {
    const res = await fetch(`${BASE}/`)
    // No public/index.html in the repo → expect 404
    expect([200, 404]).toContain(res.status)
    if (res.status === 200) {
      expect(res.headers.get('Content-Type')).toContain('text/html')
    }
  })
})

// ── 3. POST /transcribe ────────────────────────────────────────────────────

describe('POST /transcribe', () => {
  test('400 when no audio field in multipart', async () => {
    const form = new FormData()
    form.append('not-audio', 'hello')
    const res = await fetch(`${BASE}/transcribe`, { method: 'POST', body: form })
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(typeof body.error).toBe('string')
  })

  test('415 when audio has unsupported MIME type', async () => {
    const form = new FormData()
    form.append('audio', new Blob(['fake'], { type: 'application/octet-stream' }), 'test.bin')
    const res = await fetch(`${BASE}/transcribe`, { method: 'POST', body: form })
    expect(res.status).toBe(415)
    const body = await jsonBody(res)
    expect(typeof body.error).toBe('string')
    expect(typeof body.error === 'string' ? body.error.toLowerCase() : '').toContain('mime')
  })

  test('413 when audio exceeds 8 MiB', async () => {
    // Create a ~9 MiB buffer with allowed MIME
    const bigBuf = new Uint8Array(9 * 1024 * 1024)
    const form = new FormData()
    form.append('audio', new Blob([bigBuf], { type: 'audio/wav' }), 'big.wav')
    const res = await fetch(`${BASE}/transcribe`, { method: 'POST', body: form })
    expect(res.status).toBe(413)
    const body = await jsonBody(res)
    expect(typeof body.error).toBe('string')
  })

  test('400 when to field exceeds 128 chars', async () => {
    const form = new FormData()
    form.append('audio', new Blob(['fake-audio'], { type: 'audio/wav' }), 'test.wav')
    form.append('to', 'x'.repeat(200))
    const res = await fetch(`${BASE}/transcribe`, { method: 'POST', body: form })
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(typeof body.error).toBe('string')
  })
})

// ── 4. GET /messages ────────────────────────────────────────────────────────

describe('GET /messages', () => {
  test('502 when relay is unavailable (default agent)', async () => {
    const res = await fetch(`${BASE}/messages`)
    // Relay not running in test → 502
    expect(res.status).toBe(502)
    const body = await jsonBody(res)
    expect(typeof body.error).toBe('string')
    expect(typeof body.agent).toBe('string')
  })

  test('400 when agent name exceeds 128 chars', async () => {
    const longAgent = 'a'.repeat(200)
    const res = await fetch(`${BASE}/messages?agent=${longAgent}`)
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(typeof body.error).toBe('string')
  })

  test('502 with custom agent param', async () => {
    const res = await fetch(`${BASE}/messages?agent=test-agent`)
    expect(res.status).toBe(502)
    const body = await jsonBody(res)
    expect(body.agent).toBe('test-agent')
  })
})

// ── 5. GET /mic ─────────────────────────────────────────────────────────────

describe('GET /mic', () => {
  test('returns { state: "on"|"off" }', async () => {
    const res = await fetch(`${BASE}/mic`)
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(['on', 'off']).toContain(body.state)
  })

  test('CORS header present', async () => {
    const res = await fetch(`${BASE}/mic`)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

// ── 6. POST /mic ────────────────────────────────────────────────────────────

describe('POST /mic', () => {
  test('set state to off', async () => {
    const res = await fetch(`${BASE}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'off' })
    })
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.state).toBe('off')
  })

  test('set state to on', async () => {
    const res = await fetch(`${BASE}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'on' })
    })
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.state).toBe('on')
  })

  test('GET reflects POST change', async () => {
    await fetch(`${BASE}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'off' })
    })
    const res = await fetch(`${BASE}/mic`)
    const body = await jsonBody(res)
    expect(body.state).toBe('off')
    // Restore
    await fetch(`${BASE}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'on' })
    })
  })

  test('400 on invalid state value', async () => {
    const res = await fetch(`${BASE}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'maybe' })
    })
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toBe('validation_failed')
    expect(Array.isArray(body.details)).toBe(true)
  })

  test('400 on unknown keys (strict)', async () => {
    const res = await fetch(`${BASE}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'on', extra: true })
    })
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toBe('validation_failed')
  })

  test('400 on malformed JSON', async () => {
    const res = await fetch(`${BASE}/mic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json'
    })
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toBe('validation_failed')
  })
})

// ── 7. GET /agents ──────────────────────────────────────────────────────────

describe('GET /agents', () => {
  test('source=workspaces returns { agents: [...] }', async () => {
    const res = await fetch(`${BASE}/agents?source=workspaces`)
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(Array.isArray(body.agents)).toBe(true)
  })

  test('source=auto returns { agents: [...] }', async () => {
    const res = await fetch(`${BASE}/agents?source=auto`)
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(Array.isArray(body.agents)).toBe(true)
  })

  test('default source (no param) returns { agents: [...] }', async () => {
    const res = await fetch(`${BASE}/agents`)
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(Array.isArray(body.agents)).toBe(true)
  })

  test('source=relay returns agents array (possibly with error)', async () => {
    const res = await fetch(`${BASE}/agents?source=relay`)
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(Array.isArray(body.agents)).toBe(true)
    // Relay likely not running → expect error field
  })

  test('400 on invalid source param', async () => {
    const res = await fetch(`${BASE}/agents?source=invalid`)
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toBe('validation_failed')
    expect(Array.isArray(body.details)).toBe(true)
  })
})

// ── 8. GET /status ──────────────────────────────────────────────────────────

describe('GET /status', () => {
  test('returns { target: string, micState: "on"|"off" }', async () => {
    const res = await fetch(`${BASE}/status`)
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(typeof body.target).toBe('string')
    expect(['on', 'off']).toContain(body.micState)
  })
})

// ── 9. POST /target ─────────────────────────────────────────────────────────

describe('POST /target', () => {
  test('sets target and returns it', async () => {
    const res = await fetch(`${BASE}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'integration-test-agent' })
    })
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.target).toBe('integration-test-agent')
  })

  test('persists — GET /status reflects new target', async () => {
    await fetch(`${BASE}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'persist-check' })
    })
    const res = await fetch(`${BASE}/status`)
    const body = await jsonBody(res)
    expect(body.target).toBe('persist-check')
  })

  test('400 on empty target', async () => {
    const res = await fetch(`${BASE}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: '' })
    })
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toBe('validation_failed')
  })

  test('400 on missing target field', async () => {
    const res = await fetch(`${BASE}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toBe('validation_failed')
  })

  test('400 on unknown keys (strict)', async () => {
    const res = await fetch(`${BASE}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'ok', extra: true })
    })
    expect(res.status).toBe(400)
  })

  test('400 on target exceeding 128 chars', async () => {
    const res = await fetch(`${BASE}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'x'.repeat(200) })
    })
    expect(res.status).toBe(400)
  })

  test('400 on malformed JSON', async () => {
    const res = await fetch(`${BASE}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json'
    })
    expect(res.status).toBe(400)
  })

  test('CORS header present', async () => {
    const res = await fetch(`${BASE}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'cors-check' })
    })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

// ── 10. GET /settings ───────────────────────────────────────────────────────

describe('GET /settings', () => {
  test('returns 200 with JSON or 404 if no settings file', async () => {
    const res = await fetch(`${BASE}/settings`)
    expect([200, 404]).toContain(res.status)
    if (res.status === 404) {
      const body = await jsonBody(res)
      expect(typeof body.error).toBe('string')
    }
  })
})

// ── 11. POST /settings ──────────────────────────────────────────────────────

describe('POST /settings', () => {
  test('sets and returns merged settings', async () => {
    const res = await fetch(`${BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tts_enabled: true })
    })
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.tts_enabled).toBe(true)
  })

  test('partial merge preserves existing keys', async () => {
    // First set two fields
    await fetch(`${BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tts_enabled: false, start_threshold: 0.5 })
    })
    // Then update only one
    const res = await fetch(`${BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tts_enabled: true })
    })
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.tts_enabled).toBe(true)
    expect(body.start_threshold).toBe(0.5)
  })

  test('GET reflects POST changes', async () => {
    await fetch(`${BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toast_duration: 3.5 })
    })
    const res = await fetch(`${BASE}/settings`)
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.toast_duration).toBe(3.5)
  })

  test('400 on unknown keys (strict)', async () => {
    const res = await fetch(`${BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknown_field: 'bad' })
    })
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toBe('validation_failed')
  })

  test('400 on out-of-range threshold', async () => {
    const res = await fetch(`${BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_threshold: 1.5 })
    })
    expect(res.status).toBe(400)
  })

  test('400 on wrong type for tts_enabled', async () => {
    const res = await fetch(`${BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tts_enabled: 'yes' })
    })
    expect(res.status).toBe(400)
  })

  test('400 on malformed JSON', async () => {
    const res = await fetch(`${BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json'
    })
    expect(res.status).toBe(400)
  })
})

// ── 12. GET /wake-word ──────────────────────────────────────────────────────

describe('GET /wake-word', () => {
  test('returns { running: boolean }', async () => {
    const res = await fetch(`${BASE}/wake-word`)
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(typeof body.running).toBe('boolean')
  })
})

// ── 13. POST /wake-word/stop ────────────────────────────────────────────────

describe('POST /wake-word/stop', () => {
  test('returns { running: false } (idempotent)', async () => {
    const res = await fetch(`${BASE}/wake-word/stop`, { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body.running).toBe(false)
  })
})

// ── 14. POST /wake-word/start ───────────────────────────────────────────────

describe('POST /wake-word/start', () => {
  test('returns 200 or 500 with { running: boolean }', async () => {
    const res = await fetch(`${BASE}/wake-word/start`, { method: 'POST' })
    // May 500 if Python/venv not available in CI
    expect([200, 500]).toContain(res.status)
    const body = await jsonBody(res)
    expect(typeof body.running).toBe('boolean')
    if (res.status === 500) {
      expect(typeof body.error).toBe('string')
    }
  })
})

// ── CORS preflight ──────────────────────────────────────────────────────────

describe('OPTIONS preflight', () => {
  test('returns 204 with CORS headers', async () => {
    // Use a path that doesn't match before the OPTIONS handler in the dispatcher.
    // /health matches any method, so OPTIONS /health hits the health handler first.
    const res = await fetch(`${BASE}/mic`, { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type')
  })
})

// ── 404 catch-all ───────────────────────────────────────────────────────────

describe('404 catch-all', () => {
  test('unknown route returns 404', async () => {
    const res = await fetch(`${BASE}/nonexistent-route`)
    expect(res.status).toBe(404)
  })
})
