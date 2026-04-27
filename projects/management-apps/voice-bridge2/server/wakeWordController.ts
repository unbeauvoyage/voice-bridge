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
import { readFileSync } from 'node:fs'
import { type SpawnSyncLike, discoverPythonApp } from './pythonApp.ts'
import { PYTHON_VENV_SITE_PACKAGES } from './config.ts'
import type { WakeWordContext } from './routes/wakeWord.ts'
import { logger } from './logger.ts'

// Defaults that mirror wake_word.py's module-level constants.
const DEFAULT_START_THRESHOLD = 0.4
const DEFAULT_STOP_THRESHOLD = 0.25

/**
 * Read start_threshold / stop_threshold from daemon/settings.json.
 * Falls back to the wake_word.py module-level defaults if the file is
 * missing, malformed, or the keys are absent.
 */
function loadThresholdsFromSettings(daemonDir: string): { start: number; stop: number } {
  try {
    const raw = readFileSync(join(daemonDir, 'settings.json'), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return { start: DEFAULT_START_THRESHOLD, stop: DEFAULT_STOP_THRESHOLD }
    }
    // Narrow via `in` guard — `parsed` is `object & non-null` here
    const startRaw = 'start_threshold' in parsed ? parsed.start_threshold : undefined
    const stopRaw = 'stop_threshold' in parsed ? parsed.stop_threshold : undefined
    const start = typeof startRaw === 'number' ? startRaw : DEFAULT_START_THRESHOLD
    const stop = typeof stopRaw === 'number' ? stopRaw : DEFAULT_STOP_THRESHOLD
    return { start, stop }
  } catch {
    return { start: DEFAULT_START_THRESHOLD, stop: DEFAULT_STOP_THRESHOLD }
  }
}

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
  pid?: number | undefined
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
      // Read thresholds from settings.json so the daemon's first-5s window
      // matches the persisted user config (settings.json overrides the CLI
      // args after 5s anyway, but keeping them aligned avoids a transient
      // window where the daemon uses the wrong threshold at startup).
      const thresholds = loadThresholdsFromSettings(daemonDir)
      const child = spawn(pythonApp, [
        '-u', script,
        '--target', target,
        '--start-threshold', String(thresholds.start),
        '--stop-threshold', String(thresholds.stop),
      ], {
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
