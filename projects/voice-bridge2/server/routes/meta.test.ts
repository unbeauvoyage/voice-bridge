import { describe, test, expect } from 'bun:test'
import {
  handleHealth,
  handleApiHealth,
  handleIndexHtml,
  type IndexHtmlContext,
  type ApiHealthContext
} from './meta.ts'

async function readJsonObject(res: Response): Promise<Record<string, unknown>> {
  const raw: unknown = await res.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('non-object body')
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = v
  return out
}

describe('handleHealth', () => {
  test('returns status ok with a numeric timestamp', async () => {
    const res = handleHealth()
    expect(res.status).toBe(200)
    const body = await readJsonObject(res)
    expect(body['status']).toBe('ok')
    expect(typeof body['ts']).toBe('number')
  })

  test('timestamp is monotonically close to Date.now()', async () => {
    const before = Date.now()
    const res = handleHealth()
    const after = Date.now()
    const body = await readJsonObject(res)
    const ts = body['ts']
    if (typeof ts !== 'number') throw new Error('ts not number')
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})

describe('handleApiHealth', () => {
  const BOOT_MS = Date.now() - 5000 // simulate server started 5s ago

  function makeCtx(overrides: Partial<ApiHealthContext> = {}): ApiHealthContext {
    return {
      bootMs: BOOT_MS,
      version: 'abc1234',
      lastTarget: () => 'test-agent',
      probeWhisper: async () => 'ready',
      probeOllama: async () => 'reachable',
      probeRelay: async () => 'connected',
      ...overrides
    }
  }

  test('handleApiHealth — returns 200 with all required diagnostic fields', async () => {
    const res = await handleApiHealth(makeCtx())
    expect(res.status).toBe(200)
    const body = await readJsonObject(res)
    expect(body['ok']).toBe(true)
    expect(body['whisper']).toBe('ready')
    expect(body['ollama']).toBe('reachable')
    expect(body['relay']).toBe('connected')
    expect(body['lastTarget']).toBe('test-agent')
    expect(typeof body['uptimeSec']).toBe('number')
    expect(body['version']).toBe('abc1234')
  })

  test('handleApiHealth — uptimeSec is approximately correct', async () => {
    const res = await handleApiHealth(makeCtx())
    const body = await readJsonObject(res)
    const uptime = body['uptimeSec']
    if (typeof uptime !== 'number') throw new Error('uptimeSec not a number')
    expect(uptime).toBeGreaterThanOrEqual(4)
    expect(uptime).toBeLessThan(10)
  })

  test('handleApiHealth — reports degraded state when probes fail', async () => {
    const res = await handleApiHealth(
      makeCtx({
        probeWhisper: async () => 'error',
        probeOllama: async () => 'unreachable',
        probeRelay: async () => 'disconnected'
      })
    )
    expect(res.status).toBe(200)
    const body = await readJsonObject(res)
    expect(body['ok']).toBe(true) // health always returns 200
    expect(body['whisper']).toBe('error')
    expect(body['ollama']).toBe('unreachable')
    expect(body['relay']).toBe('disconnected')
  })

  test('handleApiHealth — lastTarget is null when no target set', async () => {
    const res = await handleApiHealth(makeCtx({ lastTarget: () => '' }))
    const body = await readJsonObject(res)
    expect(body['lastTarget']).toBeNull()
  })
})

describe('handleIndexHtml', () => {
  function makeCtx(overrides: Partial<IndexHtmlContext> = {}): IndexHtmlContext {
    return {
      loadIndexHtml: async () => '<!doctype html><title>t</title>',
      ...overrides
    }
  }

  test('returns 200 with text/html content-type when loader yields HTML', async () => {
    const res = await handleIndexHtml(makeCtx())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    const text = await res.text()
    expect(text).toBe('<!doctype html><title>t</title>')
  })

  test('returns 404 "Not found" when loader returns null', async () => {
    const res = await handleIndexHtml(makeCtx({ loadIndexHtml: async () => null }))
    expect(res.status).toBe(404)
    const text = await res.text()
    expect(text).toBe('Not found')
  })

  test('returns 404 "Not found" when loader throws', async () => {
    const res = await handleIndexHtml(
      makeCtx({
        loadIndexHtml: async () => {
          throw new Error('ENOENT')
        }
      })
    )
    expect(res.status).toBe(404)
    const text = await res.text()
    expect(text).toBe('Not found')
  })

  test('accepts Buffer-like content from loader', async () => {
    const res = await handleIndexHtml(
      makeCtx({
        loadIndexHtml: async () => Buffer.from('<html/>', 'utf8')
      })
    )
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('<html/>')
  })
})
