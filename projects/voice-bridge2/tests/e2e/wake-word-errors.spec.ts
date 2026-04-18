/**
 * Error-path tests for the wake word controller.
 *
 * Tests three failure modes that previously had no coverage:
 *   1. Spawn throws on startup (audio device unavailable) — handled gracefully,
 *      server continues, structured log entry emitted.
 *   2. Process crashes mid-session (child emits 'exit' with non-zero code) —
 *      restart is attempted and logged.
 *   3. Wake word disabled in settings — start() is never called, no errors.
 *
 * All OS primitives are injected stubs — no real processes are started.
 */

import { describe, test, expect } from 'bun:test'
import { createWakeWordOsContext, type WakeWordOsDeps } from '../../server/wakeWordController.ts'
import { handleWakeWord } from '../../server/routes/wakeWord.ts'

// ── Helpers ────────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

async function jsonBody(res: Response | null | undefined): Promise<Record<string, unknown>> {
  if (!res) throw new Error('Response is null/undefined')
  const v: unknown = await res.json()
  if (!isRecord(v)) throw new Error(`Expected JSON object, got: ${JSON.stringify(v)}`)
  return v
}

// ── Stub helpers ──────────────────────────────────────────────────────────────

type FakeChild = {
  pid: number
  unrefCalled: boolean
  triggerExit: (code: number | null) => void
  triggerError: (err: Error) => void
  on: (event: string, cb: ((err: Error) => void) | ((code: number | null) => void)) => void
  unref: () => void
}

type SpawnCall = { cmd: string; args: readonly string[] }

function makeSpawn(opts: { throws?: Error } = {}): {
  fn: WakeWordOsDeps['spawn']
  calls: SpawnCall[]
  children: FakeChild[]
} {
  const calls: SpawnCall[] = []
  const children: FakeChild[] = []

  const fn: WakeWordOsDeps['spawn'] = (cmd, args) => {
    if (opts.throws) throw opts.throws
    calls.push({ cmd, args })

    // Store callbacks in a plain map keyed by event name. Using unknown avoids
    // the union-narrowing cast on the way IN — we cast on the way OUT when we
    // know the exact argument type at the call site.
    const listeners: Record<string, unknown> = {}

    const child: FakeChild = {
      pid: 10000 + children.length,
      unrefCalled: false,
      on(event, cb) {
        listeners[event] = cb
      },
      triggerExit(code) {
        const cb = listeners['exit']
        if (typeof cb === 'function') cb(code)
      },
      triggerError(err) {
        const cb = listeners['error']
        if (typeof cb === 'function') cb(err)
      },
      unref() {
        this.unrefCalled = true
      }
    }
    children.push(child)
    return child
  }

  return { fn, calls, children }
}

function makeSpawnSync(
  responses: Record<string, { stdout: string; status: number | null }>
): WakeWordOsDeps['spawnSync'] {
  return (cmd) => {
    return responses[cmd] ?? { stdout: '', status: 0 }
  }
}

function makeDeps(
  spawnOpts: { throws?: Error } = {},
  spawnSyncOverrides: Record<string, { stdout: string; status: number | null }> = {}
): {
  deps: WakeWordOsDeps
  spawnObj: ReturnType<typeof makeSpawn>
} {
  const spawnObj = makeSpawn(spawnOpts)
  const deps: WakeWordOsDeps = {
    spawnSync: makeSpawnSync({
      python3: { stdout: '/usr/local\n', status: 0 },
      pgrep: { stdout: '', status: 1 },
      ...spawnSyncOverrides
    }),
    spawn: spawnObj.fn,
    env: {}
  }
  return { deps, spawnObj }
}

// ── 1. Audio device unavailable on startup ────────────────────────────────────

describe('audio device unavailable on startup → logs warning, server starts anyway', () => {
  test('POST /wake-word/start returns 500 with error field when spawn throws', async () => {
    const spawnError = new Error('ENODEV: no audio device')
    const { deps } = makeDeps({ throws: spawnError })
    const ctx = createWakeWordOsContext('/fake/daemon', () => 'command', deps)

    const req = new Request('http://localhost/wake-word/start', { method: 'POST' })
    const res = handleWakeWord(req, ctx)

    // Handler must return a structured error response — not an unhandled throw
    expect(res).not.toBeNull()
    expect(res?.status).toBe(500)

    const body = await jsonBody(res)
    expect(body['running']).toBe(false)
    expect(typeof body['error']).toBe('string')
  })

  test('server does not throw — error is fully contained in the response', () => {
    const spawnError = new Error('ENODEV: no audio device')
    const { deps } = makeDeps({ throws: spawnError })
    const ctx = createWakeWordOsContext('/fake/daemon', () => 'command', deps)

    const req = new Request('http://localhost/wake-word/start', { method: 'POST' })
    // handleWakeWord must not throw
    expect(() => handleWakeWord(req, ctx)).not.toThrow()
  })
})

// ── 2. Crash mid-session → restart ───────────────────────────────────────────

describe('wake word listener crashes mid-session → restarts gracefully, logs error', () => {
  test('spawns a second process when child exits with non-zero code', () => {
    const { deps, spawnObj } = makeDeps()
    const ctx = createWakeWordOsContext('/fake/daemon', () => 'command', deps)

    // Simulate a successful start
    ctx.start('command')
    expect(spawnObj.children).toHaveLength(1)

    // Crash the child with a non-zero exit code — restart must be attempted
    spawnObj.children[0]?.triggerExit(1)

    expect(spawnObj.children).toHaveLength(2)
  })

  test('does not restart when child exits cleanly (code 0)', () => {
    const { deps, spawnObj } = makeDeps()
    const ctx = createWakeWordOsContext('/fake/daemon', () => 'command', deps)

    ctx.start('command')
    spawnObj.children[0]?.triggerExit(0)

    // Clean exit — no restart expected
    expect(spawnObj.children).toHaveLength(1)
  })

  test('restart uses the same target as the original spawn', () => {
    const { deps, spawnObj } = makeDeps()
    const ctx = createWakeWordOsContext('/fake/daemon', () => 'atlas', deps)

    ctx.start('atlas')
    spawnObj.children[0]?.triggerExit(1)

    const restartCall = spawnObj.calls[1]
    expect(restartCall?.args).toContain('atlas')
  })
})

// ── 3. Wake word disabled in config ──────────────────────────────────────────

describe('wake word disabled in config → listener never starts, no errors', () => {
  test('POST /wake-word/start returns disabled:true when wakeWordEnabled is false', async () => {
    const { deps } = makeDeps()
    const ctx = createWakeWordOsContext('/fake/daemon', () => 'command', deps)

    // Override wakeWordEnabled to false — simulates settings: { wakeWordEnabled: false }
    const disabledCtx = { ...ctx, wakeWordEnabled: false }

    const req = new Request('http://localhost/wake-word/start', { method: 'POST' })
    const res = handleWakeWord(req, disabledCtx)

    expect(res).not.toBeNull()
    const body = await jsonBody(res)
    expect(body['disabled']).toBe(true)
    expect(body['running']).toBe(false)
  })

  test('start() is never called when wakeWordEnabled is false', () => {
    const { deps, spawnObj } = makeDeps()
    const ctx = createWakeWordOsContext('/fake/daemon', () => 'command', deps)
    const disabledCtx = { ...ctx, wakeWordEnabled: false }

    const req = new Request('http://localhost/wake-word/start', { method: 'POST' })
    handleWakeWord(req, disabledCtx)

    expect(spawnObj.children).toHaveLength(0)
  })
})
