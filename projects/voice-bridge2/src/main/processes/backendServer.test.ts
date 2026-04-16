import { describe, test, expect } from 'bun:test'
import { EventEmitter } from 'node:events'
import { createBackendServerController, type BackendServerConfig } from './backendServer.ts'

class FakeStream extends EventEmitter {}

type SpawnCall = {
  command: string
  args: readonly string[]
  options: { cwd?: string }
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
    pid: 54321,
    killSignal: null,
    kill(signal?: string): void {
      proc.killed = true
      proc.killSignal = signal ?? 'SIGTERM'
    }
  })
  return proc
}

function makeHarness(): {
  cfg: BackendServerConfig
  calls: SpawnCall[]
  procs: FakeProc[]
} {
  const calls: SpawnCall[] = []
  const procs: FakeProc[] = []
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
  return {
    cfg: {
      bunBinary: '/fake/bun',
      serverDir: '/fake/server',
      spawnFn: fakeSpawn
    },
    calls,
    procs
  }
}

describe('createBackendServerController', () => {
  test('start() spawns bun run index.ts with serverDir cwd', () => {
    const h = makeHarness()
    createBackendServerController(h.cfg).start()
    expect(h.calls).toHaveLength(1)
    const c = h.calls[0]
    if (!c) throw new Error('expected call')
    expect(c.command).toBe('/fake/bun')
    expect(c.args).toEqual(['run', 'index.ts'])
    expect(c.options.cwd).toBe('/fake/server')
  })

  test('start() is idempotent while running', () => {
    const h = makeHarness()
    const ctrl = createBackendServerController(h.cfg)
    ctrl.start()
    ctrl.start()
    expect(h.calls).toHaveLength(1)
  })

  test('start() after exit spawns fresh', () => {
    const h = makeHarness()
    const ctrl = createBackendServerController(h.cfg)
    ctrl.start()
    const first = h.procs[0]
    if (!first) throw new Error('expected proc')
    first.emit('exit', 0)
    ctrl.start()
    expect(h.calls).toHaveLength(2)
  })

  test('stop() kills running process with SIGTERM', () => {
    const h = makeHarness()
    const ctrl = createBackendServerController(h.cfg)
    ctrl.start()
    ctrl.stop()
    const p = h.procs[0]
    if (!p) throw new Error('expected proc')
    expect(p.killed).toBe(true)
    expect(p.killSignal).toBe('SIGTERM')
  })

  test('stop() when not running is a no-op', () => {
    const h = makeHarness()
    const ctrl = createBackendServerController(h.cfg)
    expect(() => ctrl.stop()).not.toThrow()
  })

  test('isRunning() reflects start/exit state — false before start, true while running, false after exit', () => {
    const h = makeHarness()
    const ctrl = createBackendServerController(h.cfg)
    expect(ctrl.isRunning()).toBe(false)
    ctrl.start()
    expect(ctrl.isRunning()).toBe(true)
    // After stop() sends SIGTERM, process is still running until exit event fires.
    ctrl.stop()
    const p = h.procs[0]
    if (!p) throw new Error('expected proc')
    p.emit('exit', 0)
    expect(ctrl.isRunning()).toBe(false)
  })

  // After stop() sends SIGTERM, the OS process is still alive until it emits 'exit'.
  // isRunning() must return true between the SIGTERM and the exit event — it must NOT
  // return false prematurely because stop() nulled proc before exit fired.
  test('isRunning() stays true after SIGTERM until exit event fires', () => {
    const h = makeHarness()
    const ctrl = createBackendServerController(h.cfg)
    ctrl.start()
    const proc = h.procs[0]
    if (!proc) throw new Error('expected proc')

    ctrl.stop()

    // Process has been sent SIGTERM but has NOT fired 'exit' yet — still alive.
    expect(ctrl.isRunning()).toBe(true)

    // Simulate exit event
    proc.emit('exit', 0)
    expect(ctrl.isRunning()).toBe(false)
  })
})
