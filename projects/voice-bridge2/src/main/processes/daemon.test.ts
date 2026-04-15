import { describe, test, expect } from 'bun:test'
import { EventEmitter } from 'node:events'
import { createDaemonController, type DaemonConfig } from './daemon.ts'

class FakeStream extends EventEmitter {}

type SpawnCall = {
  command: string
  args: readonly string[]
  options: { cwd?: string; env?: NodeJS.ProcessEnv }
}

type FakeProc = EventEmitter & {
  stdout: FakeStream
  stderr: FakeStream
  kill: (signal?: string) => void
  killed: boolean
  pid: number
  killSignal: string | null
}

function createFakeProc(): FakeProc {
  const proc: FakeProc = Object.assign(new EventEmitter(), {
    stdout: new FakeStream(),
    stderr: new FakeStream(),
    killed: false,
    pid: 12345,
    killSignal: null,
    kill(signal?: string): void {
      proc.killed = true
      proc.killSignal = signal ?? 'SIGTERM'
    }
  })
  return proc
}

type Harness = {
  cfg: DaemonConfig
  calls: SpawnCall[]
  procs: FakeProc[]
  stateChanges: unknown[]
  nextProc: () => FakeProc
}

function makeHarness(overrides: Partial<DaemonConfig> = {}): Harness {
  const calls: SpawnCall[] = []
  const procs: FakeProc[] = []
  const stateChanges: unknown[] = []
  const fakeSpawn = (
    command: string,
    args: readonly string[],
    options: SpawnCall['options']
  ): FakeProc => {
    calls.push({ command, args, options })
    const proc = createFakeProc()
    procs.push(proc)
    return proc
  }
  const cfg: DaemonConfig = {
    pythonApp: '/fake/python',
    wakeWordScript: '/fake/wake_word.py',
    venvPackages: '/fake/site-packages',
    workDir: '/fake/cwd',
    readTarget: () => 'command',
    onStateChange: (state: unknown) => {
      stateChanges.push(state)
    },
    spawnFn: fakeSpawn,
    ...overrides
  }
  return {
    cfg,
    calls,
    procs,
    stateChanges,
    nextProc: () => {
      const p = procs[procs.length - 1]
      if (!p) throw new Error('no proc')
      return p
    }
  }
}

describe('createDaemonController — start', () => {
  test('spawns with pythonApp, script, target, thresholds', () => {
    const h = makeHarness({ readTarget: () => 'matrix' })
    const ctrl = createDaemonController(h.cfg)
    ctrl.start()
    expect(h.calls).toHaveLength(1)
    const c = h.calls[0]
    if (!c) throw new Error('expected call')
    expect(c.command).toBe('/fake/python')
    expect(c.args).toContain('-u')
    expect(c.args).toContain('/fake/wake_word.py')
    expect(c.args).toContain('--target')
    expect(c.args).toContain('matrix')
    expect(c.args).toContain('--start-threshold')
    expect(c.args).toContain('0.3')
    expect(c.args).toContain('--stop-threshold')
    expect(c.args).toContain('0.15')
  })

  test('spawn receives cwd and PYTHONPATH env', () => {
    const h = makeHarness()
    createDaemonController(h.cfg).start()
    const c = h.calls[0]
    if (!c) throw new Error('expected call')
    expect(c.options.cwd).toBe('/fake/cwd')
    expect(c.options.env?.['PYTHONPATH']).toBe('/fake/site-packages')
  })

  test('readTarget called fresh each start', () => {
    let n = 0
    const h = makeHarness({
      readTarget: () => {
        n += 1
        return `t${n}`
      }
    })
    const ctrl = createDaemonController(h.cfg)
    ctrl.start()
    h.nextProc().emit('exit', 0)
    ctrl.start()
    expect(h.calls).toHaveLength(2)
    expect(h.calls[0]?.args).toContain('t1')
    expect(h.calls[1]?.args).toContain('t2')
  })

  test('start() is idempotent while running', () => {
    const h = makeHarness()
    const ctrl = createDaemonController(h.cfg)
    ctrl.start()
    ctrl.start()
    ctrl.start()
    expect(h.calls).toHaveLength(1)
  })

  test('start() after exit spawns fresh', () => {
    const h = makeHarness()
    const ctrl = createDaemonController(h.cfg)
    ctrl.start()
    h.nextProc().emit('exit', 0)
    ctrl.start()
    expect(h.calls).toHaveLength(2)
  })
})

describe('createDaemonController — stop', () => {
  test('kills running process with SIGTERM', () => {
    const h = makeHarness()
    const ctrl = createDaemonController(h.cfg)
    ctrl.start()
    ctrl.stop()
    expect(h.nextProc().killed).toBe(true)
    expect(h.nextProc().killSignal).toBe('SIGTERM')
  })

  test('stop() when not running is a no-op', () => {
    const h = makeHarness()
    const ctrl = createDaemonController(h.cfg)
    expect(() => ctrl.stop()).not.toThrow()
  })

  test('isRunning() reflects start/stop state', () => {
    const h = makeHarness()
    const ctrl = createDaemonController(h.cfg)
    expect(ctrl.isRunning()).toBe(false)
    ctrl.start()
    expect(ctrl.isRunning()).toBe(true)
    ctrl.stop()
    expect(ctrl.isRunning()).toBe(false)
  })
})

describe('createDaemonController — stdout JSONL routing', () => {
  test('emits onStateChange for each complete JSON line', () => {
    const h = makeHarness()
    createDaemonController(h.cfg).start()
    const proc = h.nextProc()
    proc.stdout.emit('data', Buffer.from('{"phase":"idle"}\n{"phase":"listening"}\n'))
    expect(h.stateChanges).toHaveLength(2)
    expect(h.stateChanges[0]).toEqual({ phase: 'idle' })
    expect(h.stateChanges[1]).toEqual({ phase: 'listening' })
  })

  test('reassembles lines split across data chunks', () => {
    const h = makeHarness()
    createDaemonController(h.cfg).start()
    const proc = h.nextProc()
    proc.stdout.emit('data', Buffer.from('{"phase":"idle"'))
    proc.stdout.emit('data', Buffer.from('}\n'))
    expect(h.stateChanges).toHaveLength(1)
    expect(h.stateChanges[0]).toEqual({ phase: 'idle' })
  })

  test('skips lines not starting with {', () => {
    const h = makeHarness()
    createDaemonController(h.cfg).start()
    const proc = h.nextProc()
    proc.stdout.emit('data', Buffer.from('[loading]\nready\n{"phase":"idle"}\n'))
    expect(h.stateChanges).toHaveLength(1)
    expect(h.stateChanges[0]).toEqual({ phase: 'idle' })
  })

  test('swallows invalid JSON and continues', () => {
    const h = makeHarness()
    createDaemonController(h.cfg).start()
    const proc = h.nextProc()
    proc.stdout.emit('data', Buffer.from('{bogus json\n{"phase":"idle"}\n'))
    expect(h.stateChanges).toHaveLength(1)
    expect(h.stateChanges[0]).toEqual({ phase: 'idle' })
  })
})
