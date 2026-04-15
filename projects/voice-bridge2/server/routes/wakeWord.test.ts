import { describe, test, expect } from 'bun:test'
import { handleWakeWord, type WakeWordContext } from './wakeWord.ts'

async function readJsonObject(res: Response): Promise<Record<string, unknown>> {
  const raw: unknown = await res.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('non-object body')
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = v
  return out
}

type Spy = {
  ctx: WakeWordContext
  stopCalls: number[]
  startCalls: string[]
}

function makeCtx(opts: { pid: number | null; target?: string }): Spy {
  const stopCalls: number[] = []
  const startCalls: string[] = []
  const ctx: WakeWordContext = {
    findPid: () => opts.pid,
    stop: (pid: number) => {
      stopCalls.push(pid)
    },
    start: (target: string) => {
      startCalls.push(target)
    },
    loadLastTarget: () => opts.target ?? 'command'
  }
  return { ctx, stopCalls, startCalls }
}

describe('handleWakeWord', () => {
  test('GET /wake-word returns { running: true } when pid exists', async () => {
    const { ctx } = makeCtx({ pid: 42 })
    const res = await handleWakeWord(new Request('http://localhost/wake-word'), ctx)
    expect(res).not.toBeNull()
    if (!res) throw new Error('null res')
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = await readJsonObject(res)
    expect(body['running']).toBe(true)
  })

  test('GET /wake-word returns { running: false } when pid is null', async () => {
    const { ctx } = makeCtx({ pid: null })
    const res = await handleWakeWord(new Request('http://localhost/wake-word'), ctx)
    if (!res) throw new Error('null res')
    const body = await readJsonObject(res)
    expect(body['running']).toBe(false)
  })

  test('POST /wake-word/stop calls stop(pid) when pid exists', async () => {
    const spy = makeCtx({ pid: 1234 })
    const res = await handleWakeWord(
      new Request('http://localhost/wake-word/stop', { method: 'POST' }),
      spy.ctx
    )
    if (!res) throw new Error('null res')
    expect(spy.stopCalls).toEqual([1234])
    const body = await readJsonObject(res)
    expect(body['running']).toBe(false)
  })

  test('POST /wake-word/stop is a no-op when pid is null', async () => {
    const spy = makeCtx({ pid: null })
    const res = await handleWakeWord(
      new Request('http://localhost/wake-word/stop', { method: 'POST' }),
      spy.ctx
    )
    if (!res) throw new Error('null res')
    expect(spy.stopCalls).toEqual([])
    const body = await readJsonObject(res)
    expect(body['running']).toBe(false)
  })

  test('POST /wake-word/start calls start(target) when pid is null', async () => {
    const spy = makeCtx({ pid: null, target: 'matrix' })
    const res = await handleWakeWord(
      new Request('http://localhost/wake-word/start', { method: 'POST' }),
      spy.ctx
    )
    if (!res) throw new Error('null res')
    expect(spy.startCalls).toEqual(['matrix'])
    const body = await readJsonObject(res)
    expect(body['running']).toBe(true)
  })

  test('POST /wake-word/start is a no-op when pid already exists', async () => {
    const spy = makeCtx({ pid: 999, target: 'matrix' })
    const res = await handleWakeWord(
      new Request('http://localhost/wake-word/start', { method: 'POST' }),
      spy.ctx
    )
    if (!res) throw new Error('null res')
    expect(spy.startCalls).toEqual([])
    const body = await readJsonObject(res)
    expect(body['running']).toBe(true)
  })

  test('POST /wake-word/start defaults target to "command" when loadLastTarget returns "command"', async () => {
    const spy = makeCtx({ pid: null })
    await handleWakeWord(
      new Request('http://localhost/wake-word/start', { method: 'POST' }),
      spy.ctx
    )
    expect(spy.startCalls).toEqual(['command'])
  })

  test('unsupported method on /wake-word returns null (dispatcher fallthrough)', async () => {
    const { ctx } = makeCtx({ pid: null })
    const res = await handleWakeWord(
      new Request('http://localhost/wake-word', { method: 'DELETE' }),
      ctx
    )
    expect(res).toBeNull()
  })

  test('unmatched subpath under /wake-word/ returns null', async () => {
    const { ctx } = makeCtx({ pid: null })
    const res = await handleWakeWord(
      new Request('http://localhost/wake-word/bogus', { method: 'POST' }),
      ctx
    )
    expect(res).toBeNull()
  })
})
