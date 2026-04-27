/**
 * Backend voice-bridge Bun server subprocess controller.
 *
 * Owns the lifecycle of the `bun run index.ts` subprocess rooted at
 * `<serverDir>`. Stdout and stderr are pipe-forwarded to the parent
 * Electron main process with `[server]` / `[server:err]` prefixes so
 * operators can eyeball the Bun server output in the same terminal
 * as the Electron shell.
 *
 *   - `start()` spawns `<bunBinary> run index.ts` in `<serverDir>`
 *   - `stop()` sends SIGTERM (idempotent no-op if not running)
 *   - `isRunning()` reports current state
 *
 * No domain callbacks — server exposes a HTTP listener that the rest
 * of main talks to via `fetch` instead of piping events through IPC.
 * That keeps this module a pure lifecycle controller.
 *
 * `spawnFn` is injected so tests can substitute a fake that returns
 * an EventEmitter stub with `stdout` / `stderr` / `kill` / `killed`.
 */

import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process'

type StdioTuple = Array<'ignore' | 'pipe' | 'inherit'>

type SpawnLike = (
  command: string,
  args: readonly string[],
  options: { cwd?: string; stdio?: StdioTuple }
) => ChildProcess

export type BackendServerConfig = {
  bunBinary: string
  serverDir: string
  spawnFn?: SpawnLike
}

export type BackendServerController = {
  start: () => void
  stop: () => void
  isRunning: () => boolean
}

export function createBackendServerController(cfg: BackendServerConfig): BackendServerController {
  const spawnFn: SpawnLike =
    cfg.spawnFn ?? ((command, args, options) => nodeSpawn(command, args, options))
  let proc: ChildProcess | null = null
  // Set before calling proc.kill() so the exit handler knows the stop was intentional.
  let intentionalStop = false

  function start(): void {
    if (proc && !proc.killed) return
    intentionalStop = false
    proc = spawnFn(cfg.bunBinary, ['run', 'index.ts'], {
      cwd: cfg.serverDir,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    proc.on('error', (err: Error) => {
      console.error('[server] spawn failed:', err.message)
      proc = null
    })
    proc.stdout?.on('data', (d: Buffer) => process.stdout.write(`[server] ${d.toString()}`))
    proc.stderr?.on('data', (d: Buffer) => process.stderr.write(`[server:err] ${d.toString()}`))
    proc.on('exit', (code: number | null) => {
      console.log(`[server] exited ${code ?? 'signal'}`)
      proc = null
      // Auto-restart after unexpected exit — the server should never be down.
      // Skip restart only when stop() called this intentionally. Covers both
      // non-zero exit codes and signal kills (code=null from SIGTERM/SIGKILL).
      // 2s delay avoids tight crash loops (port still held, bad config, etc.).
      if (!intentionalStop && code !== 0) {
        console.log('[server] auto-restarting in 2s...')
        setTimeout(() => start(), 2000)
      }
    })
    console.log(`[server] started PID=${proc.pid}`)
  }

  function stop(): void {
    if (proc) {
      intentionalStop = true
      proc.kill('SIGTERM')
      // Do NOT set proc = null here. The 'exit' event handler sets proc = null
      // when the process actually terminates. Nulling proc here would cause
      // isRunning() to return false while the process is still alive (between
      // SIGTERM and the exit event).
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
