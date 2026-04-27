import { describe, test, expect } from 'bun:test'
import { handleStatus, type StatusContext } from './status.ts'

async function readJsonObject(res: Response): Promise<Record<string, unknown>> {
  const raw: unknown = await res.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('non-object body')
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = v
  return out
}

describe('handleStatus', () => {
  test('returns target and micState:"on" when mic is on', async () => {
    const ctx: StatusContext = {
      loadLastTarget: () => 'matrix',
      isMicOn: () => true
    }
    const res = handleStatus(ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = await readJsonObject(res)
    expect(body['target']).toBe('matrix')
    expect(body['micState']).toBe('on')
  })

  test('returns micState:"off" when mic is paused', async () => {
    const ctx: StatusContext = {
      loadLastTarget: () => 'command',
      isMicOn: () => false
    }
    const res = handleStatus(ctx)
    const body = await readJsonObject(res)
    expect(body['target']).toBe('command')
    expect(body['micState']).toBe('off')
  })
})
