/**
 * Dynamic Python.app discovery — avoids pinning the homebrew Cellar
 * version path. Any `brew upgrade python@3.14` bumps the version
 * suffix (e.g. `3.14.3_1` → `3.14.3_2`), and a hardcoded interpreter
 * path breaks silently. We ask `python3 -c 'import sys; print(sys.prefix)'`
 * for the framework root and append the Python.app launcher.
 *
 * `PYTHON_APP_PATH` env var takes precedence — useful for CI, fresh
 * machines, or non-homebrew installs.
 *
 * Python.app (not `python3`) is required because only the .app bundle
 * carries the macOS microphone entitlements the wake-word daemon needs.
 */

import { join } from 'node:path'

export type SpawnSyncLike = (
  cmd: string,
  args: readonly string[],
  opts: { encoding: 'utf8' }
) => { stdout: string; status: number | null }

export type DiscoverDeps = {
  spawnSync: SpawnSyncLike
  env: NodeJS.ProcessEnv
}

export function discoverPythonApp(deps: DiscoverDeps): string {
  const override = deps.env['PYTHON_APP_PATH']
  if (typeof override === 'string' && override.length > 0) return override

  const result = deps.spawnSync('python3', ['-c', 'import sys; print(sys.prefix)'], {
    encoding: 'utf8'
  })
  const prefix = result.stdout.trim()
  if (prefix.length === 0) {
    throw new Error('discoverPythonApp: python3 returned empty sys.prefix')
  }
  return join(prefix, 'Resources/Python.app/Contents/MacOS/Python')
}
