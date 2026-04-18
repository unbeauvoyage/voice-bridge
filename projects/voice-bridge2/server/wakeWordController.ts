/**
 * OS-level context factory for the wake-word route handler.
 *
 * Extracted from server/index.ts — all pgrep/kill/spawn plumbing
 * lives here so index.ts stays pure wiring. Mirrors the backendServer.ts
 * pattern: one factory function, all OS deps injected, independently
 * testable.
 *
 * Injected deps (SpawnSyncLike / SpawnLike) let tests substitute stubs
 * without spawning real processes. Production callers pass node:child_process
 * directly.
 */

import { join } from 'node:path'
import { type SpawnSyncLike, discoverPythonApp } from './pythonApp.ts'
import { PYTHON_VENV_SITE_PACKAGES } from './config.ts'
import type { WakeWordContext } from './routes/wakeWord.ts'
import { logger } from './logger.ts'

// Minimal spawn shape — only the fields createWakeWordOsContext uses.
type SpawnLike = (
  cmd: string,
  args: readonly string[],
  opts: {
    cwd: string
    detached: boolean
    stdio: 'ignore'
    env: NodeJS.ProcessEnv
  }
) => {
  pid?: number
  on: (event: string, cb: ((err: Error) => void) | ((code: number | null) => void)) => void
  unref: () => void
}

export type WakeWordOsDeps = {
  spawnSync: SpawnSyncLike
  spawn: SpawnLike
  env: NodeJS.ProcessEnv
}

/**
 * Build a WakeWordContext wired to real OS operations.
 *
 * @param daemonDir  Absolute path to the daemon/ directory (contains wake_word.py and .venv/).
 * @param loadLastTarget  Bound function returning the current sticky relay target.
 * @param deps  Injected OS primitives (default: node:child_process).
 */
export function createWakeWordOsContext(
  daemonDir: string,
  loadLastTarget: () => string,
  deps: WakeWordOsDeps
): WakeWordContext {
  const { spawnSync, spawn, env } = deps

  // Assign to a named variable so the exit handler can call context.start()
  // via closure — the exit callback fires after the object is fully constructed.
  const context: WakeWordContext = {
    findPid(): number | null {
      const result = spawnSync('pgrep', ['-f', 'wake_word.py'], { encoding: 'utf8' })
      const pid = parseInt(result.stdout.trim().split('\n')[0] ?? '', 10)
      return isNaN(pid) ? null : pid
    },

    stop(pid: number): void {
      const result = spawnSync('kill', [String(pid)], { encoding: 'utf8' })
      if (result.status !== 0) {
        throw new Error(`kill exited with status ${result.status ?? 'null'}`)
      }
    },

    start(target: string): void {
      const pythonApp = discoverPythonApp({ spawnSync, env })
      const script = join(daemonDir, 'wake_word.py')
      const venvPackages = join(daemonDir, PYTHON_VENV_SITE_PACKAGES)
      const child = spawn(pythonApp, ['-u', script, '--target', target], {
        cwd: join(daemonDir, '..'),
        detached: true,
        stdio: 'ignore',
        env: { ...env, PYTHONPATH: venvPackages }
      })
      child.on('error', (err: Error) =>
        logger.error({ component: 'wake-word', error: err }, 'spawn_failed')
      )
      child.on('exit', (code: number | null) => {
        if (code !== 0) {
          logger.error({ component: 'wake-word', code, target }, 'process_crashed')
          try {
            context.start(target)
          } catch (restartErr) {
            logger.error({ component: 'wake-word', error: restartErr }, 'restart_failed')
          }
        }
      })
      child.unref()
      logger.info({ component: 'wake-word', pid: child.pid ?? null }, 'spawned')
    },

    loadLastTarget
  }
  return context
}
