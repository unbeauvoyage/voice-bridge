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

  test('auto-restarts after non-zero exit', async () => {
    const h = makeHarness()
    const ctrl = createBackendServerController(h.cfg)
    ctrl.start()
    expect(h.calls).toHaveLength(1)
    const first = h.procs[0]
    if (!first) throw new Error('expected proc')
    // Simulate crash (non-zero exit)
    first.emit('exit', 1)
    expect(ctrl.isRunning()).toBe(false)
    // Wait for the 2s auto-restart timer
    await new Promise((r) => setTimeout(r, 2100))
    expect(h.calls).toHaveLength(2)
    expect(ctrl.isRunning()).toBe(true)
  })

  test('does not auto-restart after clean exit (code 0)', async () => {
    const h = makeHarness()
    const ctrl = createBackendServerController(h.cfg)
    ctrl.start()
    const first = h.procs[0]
    if (!first) throw new Error('expected proc')
    first.emit('exit', 0)
    await new Promise((r) => setTimeout(r, 2500))
    // Should still be just 1 spawn call — no auto-restart
    expect(h.calls).toHaveLength(1)
  })

  // stop() sets the intentionalStop flag before sending SIGTERM. When the process
  // exits with null code (signal kill), the flag prevents auto-restart — the stop
  // was deliberate.
  test('does not auto-restart after intentional stop() (exit code null)', async () => {
    const h = makeHarness()
    const ctrl = createBackendServerController(h.cfg)
    ctrl.start()
    expect(h.calls).toHaveLength(1)
    const first = h.procs[0]
    if (!first) throw new Error('expected proc')
    ctrl.stop() // intentionalStop = true
    // Simulate SIGTERM: node child_process emits exit with null code when killed by signal
    first.emit('exit', null)
    expect(ctrl.isRunning()).toBe(false)
    // Wait past the 2s auto-restart window
    await new Promise((r) => setTimeout(r, 2500))
    // Must remain at 1 spawn — intentional stop must NOT trigger auto-restart
    expect(h.calls).toHaveLength(1)
  })

  // An external kill (not via stop()) sends SIGTERM and exits with null code.
  // Without the intentionalStop flag, the controller should auto-restart because
  // the server going down unexpectedly is a crash, not a planned stop.
  test('auto-restarts after external kill (exit code null, stop() not called)', async () => {
    const h = makeHarness()
    const ctrl = createBackendServerController(h.cfg)
    ctrl.start()
    expect(h.calls).toHaveLength(1)
    const first = h.procs[0]
    if (!first) throw new Error('expected proc')
    // Simulate external kill: null code, but stop() was never called
    first.emit('exit', null)
    expect(ctrl.isRunning()).toBe(false)
    // Wait for the 2s auto-restart timer
    await new Promise((r) => setTimeout(r, 2100))
    expect(h.calls).toHaveLength(2)
    expect(ctrl.isRunning()).toBe(true)
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
