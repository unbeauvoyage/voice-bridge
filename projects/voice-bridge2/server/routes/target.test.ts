import { describe, test, expect } from 'bun:test'
import { handleTarget, type TargetContext } from './target.ts'

async function readJsonObject(res: Response): Promise<Record<string, unknown>> {
  const raw: unknown = await res.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('non-object body')
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = v
  return out
}

function makeCtx(): { ctx: TargetContext; saved: () => string | null } {
  let lastSaved: string | null = null
  const ctx: TargetContext = {
    saveLastTarget: (t: string) => {
      lastSaved = t
    }
  }
  return { ctx, saved: () => lastSaved }
}

describe('handleTarget', () => {
  test('valid body persists target and returns 200 { target }', async () => {
    const { ctx, saved } = makeCtx()
    const req = new Request('http://localhost/target', {
      method: 'POST',
      body: JSON.stringify({ target: 'matrix' })
    })
    const res = await handleTarget(req, ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = await readJsonObject(res)
    expect(body['target']).toBe('matrix')
    expect(saved()).toBe('matrix')
  })

  test('trims surrounding whitespace before persisting', async () => {
    const { ctx, saved } = makeCtx()
    const req = new Request('http://localhost/target', {
      method: 'POST',
      body: JSON.stringify({ target: '  command  ' })
    })
    const res = await handleTarget(req, ctx)
    const body = await readJsonObject(res)
    expect(body['target']).toBe('command')
    expect(saved()).toBe('command')
  })

  test('missing target field returns 400 validation_failed', async () => {
    const { ctx, saved } = makeCtx()
    const req = new Request('http://localhost/target', {
      method: 'POST',
      body: JSON.stringify({})
    })
    const res = await handleTarget(req, ctx)
    expect(res.status).toBe(400)
    const body = await readJsonObject(res)
    expect(body['error']).toBe('validation_failed')
    expect(saved()).toBeNull()
  })

  test('empty-string target returns 400', async () => {
    const { ctx, saved } = makeCtx()
    const req = new Request('http://localhost/target', {
      method: 'POST',
      body: JSON.stringify({ target: '   ' })
    })
    const res = await handleTarget(req, ctx)
    expect(res.status).toBe(400)
    expect(saved()).toBeNull()
  })

  test('non-string target (number) returns 400', async () => {
    const { ctx, saved } = makeCtx()
    const req = new Request('http://localhost/target', {
      method: 'POST',
      body: JSON.stringify({ target: 42 })
    })
    const res = await handleTarget(req, ctx)
    expect(res.status).toBe(400)
    expect(saved()).toBeNull()
  })

  test('malformed JSON body returns 400', async () => {
    const { ctx, saved } = makeCtx()
    const req = new Request('http://localhost/target', {
      method: 'POST',
      body: 'not json'
    })
    const res = await handleTarget(req, ctx)
    expect(res.status).toBe(400)
    expect(saved()).toBeNull()
  })

  // Canary: prior `safeJsonParse` used `out[k] = v` in a for-of on
  // Object.entries; a payload with `__proto__` key could flip
  // `body.target === 'pwned'` via the prototype chain, persisting "pwned"
  // via saveLastTarget. Zod's strict schema rejects the payload first.
  test('POST with __proto__ payload does NOT persist target (prototype-pollution canary)', async () => {
    const { ctx, saved } = makeCtx()
    const req = new Request('http://localhost/target', {
      method: 'POST',
      body: '{"__proto__":{"target":"pwned"}}'
    })
    const res = await handleTarget(req, ctx)
    expect(res.status).toBe(400)
    expect(saved()).toBeNull()
  })

  test('unknown keys are rejected by strict schema', async () => {
    const { ctx, saved } = makeCtx()
    const req = new Request('http://localhost/target', {
      method: 'POST',
      body: JSON.stringify({ target: 'matrix', extra: 'no' })
    })
    const res = await handleTarget(req, ctx)
    expect(res.status).toBe(400)
    const body = await readJsonObject(res)
    expect(body['error']).toBe('validation_failed')
    expect(saved()).toBeNull()
  })
})
