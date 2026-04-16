import { describe, test, expect } from 'bun:test'
import { handleSettings, type SettingsContext } from './settings.ts'

function expectResponse(res: Response | null): Response {
  if (!res) throw new Error('expected Response, got null')
  return res
}

async function readJsonObject(res: Response | null): Promise<Record<string, unknown>> {
  if (!res) throw new Error('expected Response, got null')
  const raw: unknown = await res.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('non-object body')
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = v
  return out
}

function makeCtx(opts: { existing?: string | null; writeThrows?: boolean }): {
  ctx: SettingsContext
  lastWritten: () => string | null
} {
  let written: string | null = null
  let storage: string | null = opts.existing ?? null
  const ctx: SettingsContext = {
    readSettings: () => storage,
    writeSettings: (content: string) => {
      if (opts.writeThrows) throw new Error('ENOSPC')
      storage = content
      written = content
    }
  }
  return { ctx, lastWritten: () => written }
}

describe('handleSettings', () => {
  test('GET returns raw settings JSON when file exists', async () => {
    const { ctx } = makeCtx({ existing: '{"toast_duration":3,"tts_enabled":true}' })
    const req = new Request('http://localhost/settings')
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(200)
    expect(res?.headers.get('Content-Type')).toBe('application/json')
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const text = await expectResponse(res).text()
    expect(text).toBe('{"toast_duration":3,"tts_enabled":true}')
  })

  test('GET returns 404 when settings file is missing', async () => {
    const { ctx } = makeCtx({ existing: null })
    const req = new Request('http://localhost/settings')
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(404)
    const body = await readJsonObject(res)
    expect(body['error']).toBe('settings.json not found')
  })

  test('POST merges incoming JSON into existing settings and writes', async () => {
    const { ctx, lastWritten } = makeCtx({
      existing: '{"toast_duration":3,"tts_enabled":true}'
    })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ toast_duration: 5 })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(200)
    const body = await readJsonObject(res)
    expect(body['toast_duration']).toBe(5)
    expect(body['tts_enabled']).toBe(true)
    const written = lastWritten()
    expect(written).not.toBeNull()
    const parsed: unknown = JSON.parse(written ?? '')
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not object')
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed)) obj[k] = v
    expect(obj['toast_duration']).toBe(5)
    expect(obj['tts_enabled']).toBe(true)
  })

  test('POST with missing existing file still writes incoming JSON', async () => {
    const { ctx, lastWritten } = makeCtx({ existing: null })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ start_threshold: 0.5 })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(200)
    expect(lastWritten()).not.toBeNull()
    const body = await readJsonObject(res)
    expect(body['start_threshold']).toBe(0.5)
  })

  test('POST with invalid JSON body returns 400 validation_failed', async () => {
    const { ctx, lastWritten } = makeCtx({ existing: '{}' })
    const req = new Request('http://localhost/settings', { method: 'POST', body: 'not json' })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(400)
    const body = await readJsonObject(res)
    expect(body['error']).toBe('validation_failed')
    expect(lastWritten()).toBeNull()
  })

  test('POST with unknown key returns 400 (strict schema)', async () => {
    const { ctx, lastWritten } = makeCtx({ existing: '{}' })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ bogus_key: 1 })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(400)
    expect(lastWritten()).toBeNull()
  })

  test('POST with out-of-range start_threshold (-1) returns 400', async () => {
    const { ctx, lastWritten } = makeCtx({ existing: '{}' })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ start_threshold: -1 })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(400)
    expect(lastWritten()).toBeNull()
  })

  test('POST with out-of-range stop_threshold (1.5) returns 400', async () => {
    const { ctx, lastWritten } = makeCtx({ existing: '{}' })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ stop_threshold: 1.5 })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(400)
    expect(lastWritten()).toBeNull()
  })

  test('POST with non-integer tts_word_limit returns 400', async () => {
    const { ctx, lastWritten } = makeCtx({ existing: '{}' })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ tts_word_limit: 1.5 })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(400)
    expect(lastWritten()).toBeNull()
  })

  test('POST with negative toast_duration returns 400', async () => {
    const { ctx, lastWritten } = makeCtx({ existing: '{}' })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ toast_duration: -5 })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(400)
    expect(lastWritten()).toBeNull()
  })

  test('POST with string tts_enabled returns 400', async () => {
    const { ctx, lastWritten } = makeCtx({ existing: '{}' })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ tts_enabled: 'yes' })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(400)
    expect(lastWritten()).toBeNull()
  })

  test('POST with __proto__ payload returns 400 (prototype-pollution canary)', async () => {
    const { ctx, lastWritten } = makeCtx({ existing: '{}' })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: '{"__proto__":{"tts_enabled":false}}'
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(400)
    expect(lastWritten()).toBeNull()
  })

  test('POST returns 500 when writeSettings throws', async () => {
    const { ctx } = makeCtx({ existing: '{}', writeThrows: true })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ toast_duration: 5 })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(500)
    const body = await readJsonObject(res)
    const err = body['error']
    expect(typeof err).toBe('string')
    if (typeof err === 'string') expect(err.startsWith('Failed to write settings')).toBe(true)
  })

  test('GET with corrupt existing content is returned as-is (raw passthrough)', async () => {
    const { ctx } = makeCtx({ existing: 'not valid json' })
    const req = new Request('http://localhost/settings')
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(200)
    const text = await expectResponse(res).text()
    expect(text).toBe('not valid json')
  })

  // Chunk-4 HIGH: prior handler called parseCurrentSettings() which
  // returned {} on JSON.parse failure, then merged the incoming patch
  // over {} and wrote the result — silently DROPPING every existing
  // key. A crash-truncated settings.json would cause the next successful
  // POST to destroy all unrelated keys.
  //
  // Desired behavior: if the existing file is present but unparseable,
  // refuse the write with 500 so the operator notices corruption BEFORE
  // unrelated data is lost.
  test('POST with corrupt existing file refuses to overwrite (fail-closed, 500)', async () => {
    const { ctx, lastWritten } = makeCtx({
      existing: '{"start_threshold":0.3,"stop_threshold":0.1,"tts_enabl'
    })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ toast_duration: 5 })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(500)
    // Must not have written anything — corruption preserved for recovery.
    expect(lastWritten()).toBeNull()
    const body = await readJsonObject(res)
    const err = body['error']
    expect(typeof err).toBe('string')
    if (typeof err === 'string') expect(err.toLowerCase()).toMatch(/corrupt|parse/)
  })

  // Paired positive case: missing file is NOT corruption — it's a
  // legitimate first-time write. Must merge onto {} and succeed.
  test('POST with missing existing file creates it (merge onto {})', async () => {
    const { ctx, lastWritten } = makeCtx({ existing: null })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ toast_duration: 5 })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(200)
    const written = lastWritten()
    expect(written).not.toBeNull()
    if (written !== null) {
      const parsed: unknown = JSON.parse(written)
      expect(parsed).toEqual({ toast_duration: 5 })
    }
  })

  test('unsupported method returns null (dispatcher falls through)', async () => {
    const { ctx } = makeCtx({ existing: '{}' })
    const req = new Request('http://localhost/settings', { method: 'DELETE' })
    const res = await handleSettings(req, ctx)
    expect(res).toBeNull()
  })

  // ENOENT vs real errors: readSettings returning null means "file missing" —
  // a legitimate first-time state. But EACCES, EISDIR, EIO etc. are real
  // problems that must surface as 500, not silently look like "no file".
  // Without this, a permission error on GET looks like 404 ("not found"),
  // and on POST results in writing fresh {} settings (also failing with a
  // confusing "Failed to write" error masking the real root cause).
  test('GET /settings returns 500 when readSettings throws EACCES', async () => {
    const eaccesErr = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
    const ctx: SettingsContext = {
      readSettings: () => { throw eaccesErr },
      writeSettings: () => { /* should not be called */ }
    }
    const req = new Request('http://localhost/settings')
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(500)
    const body = await readJsonObject(res)
    expect(typeof body['error']).toBe('string')
    // Must not be a 404 — distinguishing ENOENT from real errors is the whole point.
    expect(res?.status).not.toBe(404)
  })

  test('POST /settings returns 500 when readSettings throws EACCES', async () => {
    const eaccesErr = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
    const ctx: SettingsContext = {
      readSettings: () => { throw eaccesErr },
      writeSettings: () => { /* should not be called */ }
    }
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ toast_duration: 5 })
    })
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(500)
    const body = await readJsonObject(res)
    expect(typeof body['error']).toBe('string')
  })

  // Regression: ENOENT (null from readSettings) is still a valid first-time-use
  // case — must return 404 on GET, not 500.
  test('GET /settings returns 404 when file missing (ENOENT — null return)', async () => {
    const { ctx } = makeCtx({ existing: null })
    const req = new Request('http://localhost/settings')
    const res = await handleSettings(req, ctx)
    expect(res?.status).toBe(404)
  })
})
