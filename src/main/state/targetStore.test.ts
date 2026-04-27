import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createTargetStore } from './targetStore.ts'

let tmpDir: string
let targetPath: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'targetstore-'))
  targetPath = join(tmpDir, 'last-target.txt')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('createTargetStore', () => {
  test('read() returns "command" when file does not exist', () => {
    const store = createTargetStore(targetPath)
    expect(store.read()).toBe('command')
  })

  test('read() returns trimmed file contents', () => {
    writeFileSync(targetPath, '  matrix  \n')
    const store = createTargetStore(targetPath)
    expect(store.read()).toBe('matrix')
  })

  test('read() returns "command" when file exists but is empty/whitespace', () => {
    writeFileSync(targetPath, '   \n\n')
    const store = createTargetStore(targetPath)
    expect(store.read()).toBe('command')
  })

  test('save() writes target to file', () => {
    const store = createTargetStore(targetPath)
    store.save('productivitesse')
    expect(existsSync(targetPath)).toBe(true)
    expect(readFileSync(targetPath, 'utf8')).toBe('productivitesse')
  })

  test('save() overwrites previous value', () => {
    const store = createTargetStore(targetPath)
    store.save('alpha')
    store.save('beta')
    expect(readFileSync(targetPath, 'utf8')).toBe('beta')
  })

  test('save() swallows write errors (no throw) when directory does not exist', () => {
    const bogus = join(tmpDir, 'nope', 'nested', 'file.txt')
    const store = createTargetStore(bogus)
    expect(() => store.save('x')).not.toThrow()
  })

  test('read() and save() round-trip', () => {
    const store = createTargetStore(targetPath)
    store.save('chief-of-staff')
    expect(store.read()).toBe('chief-of-staff')
  })
})
