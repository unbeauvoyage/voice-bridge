/**
 * Wake-word daemon subprocess controller.
 *
 * Owns the lifecycle of the Python wake-word process:
 *   - `start()` spawns `<pythonApp> -u <wakeWordScript> --target <T> ...`
 *     with PYTHONPATH set to `<venvPackages>` and cwd set to `<workDir>`
 *   - `stop()` sends SIGTERM (idempotent no-op if not running)
 *   - `isRunning()` reports current state
 *
 * stdout is parsed line-by-line. Lines that start with `{` are JSON-
 * parsed and handed to `onStateChange`. Partial lines are buffered
 * across `data` events. Non-JSON lines and parse errors are silently
 * dropped (matches original behavior).
 *
 * The `win` BrowserWindow coupling from the pre-extraction monolith
 * is replaced by the injected `onStateChange` callback — the daemon
 * no longer knows about Electron BrowserWindows at all. Lifts the
 * module out of the UI layer cleanly.
 *
 * `spawnFn` is injected so tests can substitute a fake that returns
 * an EventEmitter stub with `stdout` / `stderr` / `kill` / `killed`.
 */

import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process'

type StdioTuple = Array<'ignore' | 'pipe' | 'inherit'>

type SpawnLike = (
  command: string,
  args: readonly string[],
  options: {
    cwd?: string
    env?: NodeJS.ProcessEnv
    stdio?: StdioTuple
  }
) => ChildProcess

export type DaemonConfig = {
  pythonApp: string
  wakeWordScript: string
  venvPackages: string
  workDir: string
  readTarget: () => string
  onStateChange: (state: unknown) => void
  spawnFn?: SpawnLike
}

export type DaemonController = {
  start: () => void
  stop: () => void
  isRunning: () => boolean
}

export function createDaemonController(cfg: DaemonConfig): DaemonController {
  const spawnFn: SpawnLike =
    cfg.spawnFn ?? ((command, args, options) => nodeSpawn(command, args, options))
  let proc: ChildProcess | null = null

  function start(): void {
    if (proc && !proc.killed) return
    proc = spawnFn(
      cfg.pythonApp,
      [
        '-u',
        cfg.wakeWordScript,
        '--target',
        cfg.readTarget(),
        '--start-threshold',
        '0.3',
        '--stop-threshold',
        '0.15'
      ],
      {
        cwd: cfg.workDir,
        env: { ...process.env, PYTHONPATH: cfg.venvPackages },
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )
    let buffer = ''
    proc.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('{')) continue
        try {
          const state: unknown = JSON.parse(trimmed)
          cfg.onStateChange(state)
        } catch {
          /* swallow — malformed daemon output should not crash main */
        }
      }
    })
    proc.stderr?.on('data', (d: Buffer) => process.stderr.write(`[daemon:err] ${d.toString()}`))
    proc.on('error', (err: Error) => {
      console.error('[daemon] spawn failed:', err.message)
      proc = null
    })
    proc.on('exit', (code: number | null) => {
      console.log(`[daemon] exited with code ${code}`)
      proc = null
      // Restart on crash (non-null exit code = crash, null = killed by SIGTERM)
      if (code !== null) {
        console.log('[daemon] unexpected exit — restarting in 2s')
        setTimeout(() => start(), 2000)
      }
    })
    console.log(`[daemon] started PID=${proc.pid}`)
  }

  function stop(): void {
    if (proc) {
      proc.kill('SIGTERM')
      // Do NOT set proc = null here. The 'exit' event handler sets proc = null
      // when the process actually terminates. Nulling proc here would cause
      // isRunning() to return false while the process is still alive (between
      // SIGTERM and the exit event) — a race condition that could allow a second
      // start() to run before the first process exits.
    }
  }

  function isRunning(): boolean {
    // proc.killed is true after kill() is called, but the process may still be
    // running (between SIGTERM and exit). Use proc !== null as the sole indicator
    // of whether the process is alive — the 'exit' handler nulls proc on true exit.
    return proc !== null
  }

  return { start, stop, isRunning }
}
