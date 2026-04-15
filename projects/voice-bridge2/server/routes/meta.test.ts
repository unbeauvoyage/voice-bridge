import { describe, test, expect } from 'bun:test'
import { handleHealth, handleIndexHtml, type IndexHtmlContext } from './meta.ts'

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

describe('handleIndexHtml', () => {
  test('returns 200 with text/html content-type when loader yields HTML', async () => {
    const ctx: IndexHtmlContext = {
      loadIndexHtml: async () => '<!doctype html><title>t</title>'
    }
    const res = await handleIndexHtml(ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    const text = await res.text()
    expect(text).toBe('<!doctype html><title>t</title>')
  })

  test('returns 404 "Not found" when loader returns null', async () => {
    const ctx: IndexHtmlContext = { loadIndexHtml: async () => null }
    const res = await handleIndexHtml(ctx)
    expect(res.status).toBe(404)
    const text = await res.text()
    expect(text).toBe('Not found')
  })

  test('returns 404 "Not found" when loader throws', async () => {
    const ctx: IndexHtmlContext = {
      loadIndexHtml: async () => {
        throw new Error('ENOENT')
      }
    }
    const res = await handleIndexHtml(ctx)
    expect(res.status).toBe(404)
    const text = await res.text()
    expect(text).toBe('Not found')
  })

  test('accepts Buffer-like content from loader', async () => {
    const ctx: IndexHtmlContext = {
      loadIndexHtml: async () => Buffer.from('<html/>', 'utf8')
    }
    const res = await handleIndexHtml(ctx)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('<html/>')
  })
})
