/**
 * Dynamic Python.app discovery for the Bun server process.
 *
 * See `src/main/pythonApp.ts` for the rationale — the two helpers
 * are twins (separate tsconfig projects prevent cross-import) but
 * solve the same problem: avoid pinning the homebrew Cellar version
 * so `brew upgrade python@3.14` doesn't silently break the wake-word
 * daemon spawn.
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
