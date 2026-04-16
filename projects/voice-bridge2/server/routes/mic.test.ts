import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { handleMic, type MicContext } from './mic.ts'
import { setMic, handleMicCommand, isMicOn } from './mic.ts'

async function readJsonObject(res: Response | null): Promise<Record<string, unknown>> {
  if (!res) throw new Error('expected Response, got null')
  const raw: unknown = await res.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('non-object body')
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = v
  return out
}

function makeCtx(initial: boolean): { ctx: MicContext; read: () => boolean } {
  let state = initial
  const ctx: MicContext = {
    isMicOn: () => state,
    setMic: (on: boolean) => {
      state = on
    }
  }
  return { ctx, read: () => state }
}

describe('handleMic', () => {
  test('GET returns current state "on"', async () => {
    const { ctx } = makeCtx(true)
    const res = await handleMic(new Request('http://localhost/mic'), ctx)
    expect(res?.status).toBe(200)
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = await readJsonObject(res)
    expect(body['state']).toBe('on')
  })

  test('GET returns current state "off"', async () => {
    const { ctx } = makeCtx(false)
    const res = await handleMic(new Request('http://localhost/mic'), ctx)
    const body = await readJsonObject(res)
    expect(body['state']).toBe('off')
  })

  test('POST { state: "off" } pauses the mic', async () => {
    const { ctx, read } = makeCtx(true)
    const req = new Request('http://localhost/mic', {
      method: 'POST',
      body: JSON.stringify({ state: 'off' }),
      headers: { 'Content-Type': 'application/json' }
    })
    const res = await handleMic(req, ctx)
    const body = await readJsonObject(res)
    expect(body['state']).toBe('off')
    expect(read()).toBe(false)
  })

  test('POST { state: "on" } resumes the mic', async () => {
    const { ctx, read } = makeCtx(false)
    const req = new Request('http://localhost/mic', {
      method: 'POST',
      body: JSON.stringify({ state: 'on' }),
      headers: { 'Content-Type': 'application/json' }
    })
    const res = await handleMic(req, ctx)
    const body = await readJsonObject(res)
    expect(body['state']).toBe('on')
    expect(read()).toBe(true)
  })

  test('POST with malformed JSON returns 400 and does NOT mutate mic state', async () => {
    const { ctx, read } = makeCtx(true)
    const req = new Request('http://localhost/mic', {
      method: 'POST',
      body: 'not json'
    })
    const res = await handleMic(req, ctx)
    expect(res?.status).toBe(400)
    const body = await readJsonObject(res)
    expect(body['error']).toBe('validation_failed')
    expect(read()).toBe(true)
  })

  test('POST with {} body returns 400 (missing state field)', async () => {
    const { ctx, read } = makeCtx(true)
    const req = new Request('http://localhost/mic', {
      method: 'POST',
      body: JSON.stringify({})
    })
    const res = await handleMic(req, ctx)
    expect(res?.status).toBe(400)
    expect(read()).toBe(true)
  })

  test('POST with invalid state value returns 400', async () => {
    const { ctx, read } = makeCtx(true)
    const req = new Request('http://localhost/mic', {
      method: 'POST',
      body: JSON.stringify({ state: 'maybe' })
    })
    const res = await handleMic(req, ctx)
    expect(res?.status).toBe(400)
    expect(read()).toBe(true)
  })

  test('POST with array body returns 400 (not an object)', async () => {
    const { ctx, read } = makeCtx(true)
    const req = new Request('http://localhost/mic', {
      method: 'POST',
      body: JSON.stringify(['state', 'on'])
    })
    const res = await handleMic(req, ctx)
    expect(res?.status).toBe(400)
    expect(read()).toBe(true)
  })

  // Canary: prior `safeJsonParse` used `out[k] = v` in a for-of on
  // Object.entries; a payload with `__proto__` key could flip
  // `body.state === 'on'` via the prototype chain. Zod's strict schema
  // rejects the payload before any lookup.
  test('POST with __proto__ payload does NOT mutate mic (prototype-pollution canary)', async () => {
    const { ctx, read } = makeCtx(false)
    const req = new Request('http://localhost/mic', {
      method: 'POST',
      body: '{"__proto__":{"state":"on"}}'
    })
    const res = await handleMic(req, ctx)
    expect(res?.status).toBe(400)
    expect(read()).toBe(false)
  })

  test('unsupported method returns undefined-ish (null) — index dispatcher handles fallthrough', async () => {
    const { ctx } = makeCtx(true)
    const req = new Request('http://localhost/mic', { method: 'DELETE' })
    const res = await handleMic(req, ctx)
    expect(res).toBeNull()
  })
})

// Tests for the extracted business-logic functions setMic, isMicOn, handleMicCommand.
// These use a temp pause directory so tests do not mutate /tmp/wake-word-pause.d.
const TEST_PAUSE_DIR = '/tmp/test-mic-pause.d'
const TEST_MANUAL_TOKEN = `${TEST_PAUSE_DIR}/manual`

describe('setMic / isMicOn (extracted from index.ts)', () => {
  beforeEach(() => {
    // Ensure clean state: no pause directory
    try { rmSync(TEST_PAUSE_DIR, { recursive: true }) } catch { /* ok */ }
  })
  afterEach(() => {
    try { rmSync(TEST_PAUSE_DIR, { recursive: true }) } catch { /* ok */ }
  })

  test('isMicOn returns true when manual token does not exist', () => {
    // Mic is on by default (no token file)
    expect(isMicOn(TEST_MANUAL_TOKEN)).toBe(true)
  })

  test('setMic(false) creates the manual token and isMicOn returns false', () => {
    setMic(false, TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)
    expect(isMicOn(TEST_MANUAL_TOKEN)).toBe(false)
    expect(existsSync(TEST_MANUAL_TOKEN)).toBe(true)
  })

  test('setMic(true) removes the manual token and isMicOn returns true', () => {
    // First put it in the off state
    mkdirSync(TEST_PAUSE_DIR, { recursive: true })
    writeFileSync(TEST_MANUAL_TOKEN, '')
    setMic(true, TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)
    expect(isMicOn(TEST_MANUAL_TOKEN)).toBe(true)
    expect(existsSync(TEST_MANUAL_TOKEN)).toBe(false)
  })

  test('setMic(true) is idempotent when already on (no token to remove)', () => {
    // No error thrown when token does not exist
    expect(() => setMic(true, TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)).not.toThrow()
    expect(isMicOn(TEST_MANUAL_TOKEN)).toBe(true)
  })

  test('setMic(false) is idempotent when already off', () => {
    setMic(false, TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)
    // Calling again should not throw
    expect(() => setMic(false, TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)).not.toThrow()
    expect(isMicOn(TEST_MANUAL_TOKEN)).toBe(false)
  })
})

describe('handleMicCommand (extracted from index.ts)', () => {
  beforeEach(() => {
    try { rmSync(TEST_PAUSE_DIR, { recursive: true }) } catch { /* ok */ }
  })
  afterEach(() => {
    try { rmSync(TEST_PAUSE_DIR, { recursive: true }) } catch { /* ok */ }
  })

  test('returns null for unrelated transcripts', () => {
    const result = handleMicCommand('tell me the weather today', TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)
    expect(result).toBeNull()
  })

  test('"turn off mic" command returns { handled: true, state: "off" }', () => {
    const result = handleMicCommand('turn off mic', TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)
    expect(result).toEqual({ handled: true, state: 'off' })
    expect(existsSync(TEST_MANUAL_TOKEN)).toBe(true)
  })

  test('"turn on mic" command returns { handled: true, state: "on" }', () => {
    setMic(false, TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)
    const result = handleMicCommand('turn on mic', TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)
    expect(result).toEqual({ handled: true, state: 'on' })
    expect(existsSync(TEST_MANUAL_TOKEN)).toBe(false)
  })

  test('"disable microphone" triggers off command', () => {
    const result = handleMicCommand('please disable microphone', TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)
    expect(result).toEqual({ handled: true, state: 'off' })
  })

  test('"enable listening" triggers on command', () => {
    const result = handleMicCommand('enable listening please', TEST_PAUSE_DIR, TEST_MANUAL_TOKEN)
    expect(result).toEqual({ handled: true, state: 'on' })
  })
})
