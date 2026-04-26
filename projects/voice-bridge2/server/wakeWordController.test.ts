/**
 * Unit tests for createWakeWordOsContext.
 *
 * All OS primitives (spawnSync, spawn, env) are injected stubs — no real
 * processes are started. Tests verify that the context functions call the
 * right OS commands with the right arguments and handle edge cases correctly.
 */

import { describe, test, expect } from 'bun:test'
import { createWakeWordOsContext } from './wakeWordController.ts'
import type { WakeWordOsDeps } from './wakeWordController.ts'

const FAKE_DAEMON_DIR = '/fake/daemon'

// ── Stub helpers ──────────────────────────────────────────────────────────────

type SpawnCall = { cmd: string; args: readonly string[]; opts: Record<string, unknown> }

function makeSpawnSync(responses: Record<string, { stdout: string; status: number | null }>): {
  fn: WakeWordOsDeps['spawnSync']
  calls: SpawnCall[]
} {
  const calls: SpawnCall[] = []
  const fn: WakeWordOsDeps['spawnSync'] = (cmd, args, opts) => {
    calls.push({ cmd, args, opts })
    const key = cmd
    const r = responses[key] ?? { stdout: '', status: 0 }
    return r
  }
  return { fn, calls }
}

type SpawnFakeChild = {
  pid: number
  errorCb: ((err: Error) => void) | null
  unrefCalled: boolean
  on: (event: string, cb: (err: Error) => void) => void
  unref: () => void
}

function makeSpawn(): {
  fn: WakeWordOsDeps['spawn']
  calls: SpawnCall[]
  lastChild: SpawnFakeChild | null
} {
  const calls: SpawnCall[] = []
  let lastChild: SpawnFakeChild | null = null
  const fn: WakeWordOsDeps['spawn'] = (cmd, args, opts) => {
    calls.push({ cmd, args, opts })
    const child: SpawnFakeChild = {
      pid: 99999,
      errorCb: null,
      unrefCalled: false,
      on(event, cb) {
        if (event === 'error') this.errorCb = cb
      },
      unref() {
        this.unrefCalled = true
      }
    }
    lastChild = child
    return child
  }
  return {
    fn,
    calls,
    get lastChild() {
      return lastChild
    }
  }
}

function makeDeps(
  spawnSyncResponses: Record<string, { stdout: string; status: number | null }> = {},
  env: NodeJS.ProcessEnv = {}
): { deps: WakeWordOsDeps; spawnSyncCalls: SpawnCall[]; spawnObj: ReturnType<typeof makeSpawn> } {
  const { fn: spawnSyncFn, calls: spawnSyncCalls } = makeSpawnSync(spawnSyncResponses)
  const spawnObj = makeSpawn()
  return {
    deps: { spawnSync: spawnSyncFn, spawn: spawnObj.fn, env },
    spawnSyncCalls,
    spawnObj
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// findPid
// ─────────────────────────────────────────────────────────────────────────────

describe('findPid', () => {
  test('returns the parsed PID when pgrep finds a match', () => {
    const { deps } = makeDeps({ pgrep: { stdout: '12345\n', status: 0 } })
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    expect(ctx.findPid()).toBe(12345)
  })

  test('returns null when pgrep output is empty', () => {
    const { deps } = makeDeps({ pgrep: { stdout: '', status: 1 } })
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    expect(ctx.findPid()).toBeNull()
  })

  test('returns null when pgrep output is not a number', () => {
    const { deps } = makeDeps({ pgrep: { stdout: 'not-a-pid\n', status: 0 } })
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    expect(ctx.findPid()).toBeNull()
  })

  test('uses the first line when multiple PIDs are returned', () => {
    const { deps } = makeDeps({ pgrep: { stdout: '111\n222\n333\n', status: 0 } })
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    expect(ctx.findPid()).toBe(111)
  })

  test('calls pgrep with -f wake_word.py', () => {
    const { deps, spawnSyncCalls } = makeDeps({ pgrep: { stdout: '', status: 1 } })
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    ctx.findPid()
    expect(spawnSyncCalls[0]?.cmd).toBe('pgrep')
    expect(spawnSyncCalls[0]?.args).toContain('wake_word.py')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// stop
// ─────────────────────────────────────────────────────────────────────────────

describe('stop', () => {
  test('calls kill with the given PID as a string', () => {
    const { deps, spawnSyncCalls } = makeDeps({ kill: { stdout: '', status: 0 } })
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    ctx.stop(42)
    expect(spawnSyncCalls[0]?.cmd).toBe('kill')
    expect(spawnSyncCalls[0]?.args).toContain('42')
  })

  test('does not throw when kill exits 0', () => {
    const { deps } = makeDeps({ kill: { stdout: '', status: 0 } })
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    expect(() => ctx.stop(42)).not.toThrow()
  })

  test('throws when kill exits non-zero (permission denied / stale PID)', () => {
    const { deps } = makeDeps({ kill: { stdout: '', status: 1 } })
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    expect(() => ctx.stop(42)).toThrow('kill exited with status 1')
  })

  test('throws with null status message when kill is signalled', () => {
    const { deps } = makeDeps({ kill: { stdout: '', status: null } })
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    expect(() => ctx.stop(42)).toThrow('kill exited with status null')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// start
// ─────────────────────────────────────────────────────────────────────────────

describe('start', () => {
  // discoverPythonApp calls `python3 -c 'import sys; print(sys.prefix)'`
  // We stub that to return a fake prefix so the path is deterministic.
  const FAKE_PREFIX = '/fake/python'

  function makeStartDeps(): ReturnType<typeof makeDeps> {
    return makeDeps({
      python3: { stdout: `${FAKE_PREFIX}\n`, status: 0 }
    })
  }

  test('spawns a child process with the target flag', () => {
    const { deps, spawnObj } = makeStartDeps()
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    ctx.start('atlas')
    expect(spawnObj.calls.length).toBe(1)
    expect(spawnObj.calls[0]?.args).toContain('--target')
    expect(spawnObj.calls[0]?.args).toContain('atlas')
  })

  test('spawns with detached:true so the child survives the parent', () => {
    const { deps, spawnObj } = makeStartDeps()
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    ctx.start('command')
    const opts = spawnObj.calls[0]?.opts
    expect(opts?.['detached']).toBe(true)
  })

  test('calls unref() so the child is not kept alive by the event loop', () => {
    const { deps, spawnObj } = makeStartDeps()
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    ctx.start('command')
    expect(spawnObj.lastChild?.unrefCalled).toBe(true)
  })

  test('sets PYTHONPATH to the venv site-packages directory', () => {
    const { deps, spawnObj } = makeStartDeps()
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    ctx.start('command')
    const opts = spawnObj.calls[0]?.opts
    const envVal = opts?.['env']
    if (envVal !== null && typeof envVal === 'object' && 'PYTHONPATH' in envVal) {
      expect(String(envVal['PYTHONPATH'])).toContain('.venv')
      expect(String(envVal['PYTHONPATH'])).toContain('site-packages')
    } else {
      throw new Error('expected opts.env to contain PYTHONPATH')
    }
  })

  test('includes wake_word.py script path in the spawn args', () => {
    const { deps, spawnObj } = makeStartDeps()
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'command', deps)
    ctx.start('command')
    const scriptArg = spawnObj.calls[0]?.args.find((a) => a.includes('wake_word.py'))
    expect(scriptArg).toBeDefined()
    expect(scriptArg).toContain(FAKE_DAEMON_DIR)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// loadLastTarget (delegation)
// ─────────────────────────────────────────────────────────────────────────────

describe('loadLastTarget', () => {
  test('delegates to the injected loadLastTarget function', () => {
    const { deps } = makeDeps()
    const ctx = createWakeWordOsContext(FAKE_DAEMON_DIR, () => 'productivitesse', deps)
    expect(ctx.loadLastTarget()).toBe('productivitesse')
  })
})
