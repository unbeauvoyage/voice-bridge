import { describe, test, expect } from 'bun:test'
import { handleSettings, type SettingsContext } from './settings.ts'

async function readJsonObject(res: Response): Promise<Record<string, unknown>> {
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
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/json')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const text = await res.text()
    expect(text).toBe('{"toast_duration":3,"tts_enabled":true}')
  })

  test('GET returns 404 when settings file is missing', async () => {
    const { ctx } = makeCtx({ existing: null })
    const req = new Request('http://localhost/settings')
    const res = await handleSettings(req, ctx)
    expect(res.status).toBe(404)
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
    expect(res.status).toBe(200)
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
    expect(res.status).toBe(200)
    expect(lastWritten()).not.toBeNull()
    const body = await readJsonObject(res)
    expect(body['start_threshold']).toBe(0.5)
  })

  test('POST with invalid JSON body returns 400', async () => {
    const { ctx, lastWritten } = makeCtx({ existing: '{}' })
    const req = new Request('http://localhost/settings', { method: 'POST', body: 'not json' })
    const res = await handleSettings(req, ctx)
    expect(res.status).toBe(400)
    const body = await readJsonObject(res)
    expect(body['error']).toBe('Invalid JSON')
    expect(lastWritten()).toBeNull()
  })

  test('POST returns 500 when writeSettings throws', async () => {
    const { ctx } = makeCtx({ existing: '{}', writeThrows: true })
    const req = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ a: 1 })
    })
    const res = await handleSettings(req, ctx)
    expect(res.status).toBe(500)
    const body = await readJsonObject(res)
    const err = body['error']
    expect(typeof err).toBe('string')
    if (typeof err === 'string') expect(err.startsWith('Failed to write settings')).toBe(true)
  })

  test('GET with corrupt existing content is returned as-is (raw passthrough)', async () => {
    const { ctx } = makeCtx({ existing: 'not valid json' })
    const req = new Request('http://localhost/settings')
    const res = await handleSettings(req, ctx)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('not valid json')
  })

  test('unsupported method returns null (dispatcher falls through)', async () => {
    const { ctx } = makeCtx({ existing: '{}' })
    const req = new Request('http://localhost/settings', { method: 'DELETE' })
    const res = await handleSettings(req, ctx)
    expect(res).toBeNull()
  })
})
