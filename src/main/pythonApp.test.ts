import { describe, test, expect } from 'bun:test'
import { discoverPythonApp, type DiscoverDeps } from './pythonApp.ts'

function makeDeps(overrides: Partial<DiscoverDeps> = {}): DiscoverDeps {
  return {
    spawnSync: () => ({
      stdout:
        '/opt/homebrew/Cellar/python@3.14/3.14.9_1/Frameworks/Python.framework/Versions/3.14\n',
      status: 0
    }),
    env: {},
    ...overrides
  }
}

describe('discoverPythonApp', () => {
  test('returns PYTHON_APP_PATH override without spawning python3', () => {
    let spawnCalls = 0
    const path = discoverPythonApp(
      makeDeps({
        env: { PYTHON_APP_PATH: '/custom/override/Python' },
        spawnSync: () => {
          spawnCalls += 1
          return { stdout: '', status: 0 }
        }
      })
    )
    expect(path).toBe('/custom/override/Python')
    expect(spawnCalls).toBe(0)
  })

  test('joins sys.prefix from python3 with Resources/Python.app/Contents/MacOS/Python', () => {
    const path = discoverPythonApp(
      makeDeps({
        spawnSync: () => ({
          stdout:
            '/opt/homebrew/Cellar/python@3.14/3.14.9_1/Frameworks/Python.framework/Versions/3.14\n',
          status: 0
        })
      })
    )
    expect(path).toBe(
      '/opt/homebrew/Cellar/python@3.14/3.14.9_1/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python'
    )
  })

  test('trims whitespace from python3 stdout', () => {
    const path = discoverPythonApp(
      makeDeps({
        spawnSync: () => ({ stdout: '  /some/prefix  \n\n', status: 0 })
      })
    )
    expect(path).toBe('/some/prefix/Resources/Python.app/Contents/MacOS/Python')
  })

  test('throws when python3 returns empty stdout', () => {
    expect(() =>
      discoverPythonApp(
        makeDeps({
          spawnSync: () => ({ stdout: '', status: 0 })
        })
      )
    ).toThrow(/empty sys\.prefix/)
  })

  test('passes the correct command and args to spawnSync', () => {
    const calls: Array<{ cmd: string; args: readonly string[] }> = []
    discoverPythonApp(
      makeDeps({
        spawnSync: (cmd, args) => {
          calls.push({ cmd, args })
          return { stdout: '/p', status: 0 }
        }
      })
    )
    expect(calls).toHaveLength(1)
    expect(calls[0]?.cmd).toBe('python3')
    expect(calls[0]?.args).toEqual(['-c', 'import sys; print(sys.prefix)'])
  })
})
