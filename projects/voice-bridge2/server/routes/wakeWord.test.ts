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

function makeCtx(opts: {
  pid: number | null
  /** pid returned by findPid() AFTER start() has been called. Defaults to opts.pid. */
  pidAfterStart?: number | null
  target?: string
}): Spy {
  const stopCalls: number[] = []
  const startCalls: string[] = []
  let started = false
  const ctx: WakeWordContext = {
    findPid: () => {
      // After start() has been called, return pidAfterStart if specified.
      // This lets tests control whether the liveness check sees a live process.
      if (started && opts.pidAfterStart !== undefined) return opts.pidAfterStart
      return opts.pid
    },
    stop: (pid: number) => {
      stopCalls.push(pid)
    },
    start: (target: string) => {
      started = true
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
    // pidAfterStart: process is found alive after spawn (happy path)
    const spy = makeCtx({ pid: null, pidAfterStart: 5678, target: 'matrix' })
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
    // pidAfterStart: process alive after spawn so liveness check passes
    const spy = makeCtx({ pid: null, pidAfterStart: 1111 })
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

  // ── Error-handling: start/stop must not silently lie about success ───────────
  //
  // Previously, start returned {running: true} unconditionally even if ctx.start
  // threw (Python not found, spawn failure). The error propagated as an unhandled
  // exception and the client had no way to know the process didn't launch.
  // Similarly, stop returned {running: false} even if ctx.stop threw (kill permission
  // denied), telling the client the process was dead when it was still alive.

  test('start returns 500 with error when ctx.start throws', async () => {
    // Inject a ctx whose start() simulates a spawn failure (Python not found etc.)
    const ctx: WakeWordContext = {
      findPid: () => null, // not running yet
      stop: () => {},
      start: () => {
        throw new Error('spawn ENOENT: python3 not found')
      },
      loadLastTarget: () => 'command'
    }
    const res = await handleWakeWord(
      new Request('http://localhost/wake-word/start', { method: 'POST' }),
      ctx
    )
    if (!res) throw new Error('null res')
    expect(res.status).toBe(500)
    const body = await readJsonObject(res)
    expect(body['running']).toBe(false)
    expect(typeof body['error']).toBe('string')
    expect(body['error']).toContain('python3 not found')
  })

  test('start verifies process alive via findPid after spawn — returns error if process exited immediately', async () => {
    // ctx.start() does not throw (spawn call succeeded) but the process exited
    // immediately (bad Python path, missing venv, script crash). findPid() returns
    // null after start, indicating the process is already gone.
    let startCalled = false
    const ctx: WakeWordContext = {
      // findPid returns null both before AND after start (process dead before/after spawn)
      findPid: () => null,
      stop: () => {},
      start: () => {
        startCalled = true
        // succeeds — no throw — but process exits immediately
      },
      loadLastTarget: () => 'command'
    }
    const res = await handleWakeWord(
      new Request('http://localhost/wake-word/start', { method: 'POST' }),
      ctx
    )
    if (!res) throw new Error('null res')
    expect(startCalled).toBe(true)
    expect(res.status).toBe(500)
    const body = await readJsonObject(res)
    expect(body['running']).toBe(false)
    expect(typeof body['error']).toBe('string')
  })

  test('stop returns 500 with error when ctx.stop throws', async () => {
    // ctx.stop() throws (e.g. kill permission denied) — process is still alive.
    // Route must report {running: true, error: ...} with status 500.
    const ctx: WakeWordContext = {
      findPid: () => 1234,
      stop: () => {
        throw new Error('EPERM: kill permission denied')
      },
      start: () => {},
      loadLastTarget: () => 'command'
    }
    const res = await handleWakeWord(
      new Request('http://localhost/wake-word/stop', { method: 'POST' }),
      ctx
    )
    if (!res) throw new Error('null res')
    expect(res.status).toBe(500)
    const body = await readJsonObject(res)
    // Stop failed — process is still running
    expect(body['running']).toBe(true)
    expect(typeof body['error']).toBe('string')
    expect(body['error']).toContain('permission denied')
  })
})
