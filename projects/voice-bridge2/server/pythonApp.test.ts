import { describe, test, expect } from 'bun:test'
import { discoverPythonApp, type DiscoverDeps } from './pythonApp.ts'

function makeDeps(overrides: Partial<DiscoverDeps> = {}): DiscoverDeps {
  return {
    spawnSync: () => ({ stdout: '/opt/homebrew/prefix\n', status: 0 }),
    env: {},
    ...overrides
  }
}

describe('discoverPythonApp (server)', () => {
  test('returns PYTHON_APP_PATH override without spawning', () => {
    let spawnCalls = 0
    const path = discoverPythonApp(
      makeDeps({
        env: { PYTHON_APP_PATH: '/custom/Python' },
        spawnSync: () => {
          spawnCalls += 1
          return { stdout: '', status: 0 }
        }
      })
    )
    expect(path).toBe('/custom/Python')
    expect(spawnCalls).toBe(0)
  })

  test('joins python3 sys.prefix with Python.app launcher path', () => {
    const path = discoverPythonApp(
      makeDeps({
        spawnSync: () => ({
          stdout:
            '/opt/homebrew/Cellar/python@3.14/9.9.9_9/Frameworks/Python.framework/Versions/3.14\n',
          status: 0
        })
      })
    )
    expect(path).toBe(
      '/opt/homebrew/Cellar/python@3.14/9.9.9_9/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python'
    )
  })

  test('throws on empty python3 stdout', () => {
    expect(() =>
      discoverPythonApp(makeDeps({ spawnSync: () => ({ stdout: '', status: 0 }) }))
    ).toThrow(/empty sys\.prefix/)
  })
})
