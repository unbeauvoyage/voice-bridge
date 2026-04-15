/**
 * Tests for atomicWriteFile — crash-safe file write via temp-file + rename.
 *
 * The atomic write pattern:
 *   1. Write `content` to `{path}.tmp`.
 *   2. Rename `{path}.tmp` → `path` (POSIX rename is atomic).
 *
 * Guarantees:
 *   - A crash BEFORE the rename leaves the original `path` untouched
 *     (only the tmp file is corrupt, and recovery can ignore it).
 *   - A crash DURING the rename is impossible — rename is atomic at the
 *     filesystem level.
 *
 * Without this, writeFileSync(path, content) truncates `path` THEN streams
 * bytes in; a crash mid-write leaves a half-written file that looks corrupt
 * to the next reader (and in our case, would trip the fail-closed parse).
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { atomicWriteFile } from './atomicWriteFile.ts'

describe('atomicWriteFile', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vb2-atomic-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  test('writes content to the target path', () => {
    const target = join(dir, 'settings.json')
    atomicWriteFile(target, '{"toast_duration":3}')
    expect(readFileSync(target, 'utf8')).toBe('{"toast_duration":3}')
  })

  test('overwrites existing file atomically', () => {
    const target = join(dir, 'settings.json')
    writeFileSync(target, '{"old":true}')
    atomicWriteFile(target, '{"new":true}')
    expect(readFileSync(target, 'utf8')).toBe('{"new":true}')
  })

  test('leaves no .tmp file behind on success', () => {
    const target = join(dir, 'settings.json')
    atomicWriteFile(target, 'x')
    expect(existsSync(`${target}.tmp`)).toBe(false)
  })

  // Crash-simulation: if the underlying write to the tmp file throws, the
  // original target file must be untouched — no corruption leak.
  test('target is untouched when injected write fails before rename', () => {
    const target = join(dir, 'settings.json')
    writeFileSync(target, '{"original":"preserved"}')
    expect(() =>
      atomicWriteFile(target, '{"new":true}', {
        writeFile: () => {
          throw new Error('simulated ENOSPC mid-write')
        }
      })
    ).toThrow('simulated ENOSPC')
    // Original content must survive the failed write.
    expect(readFileSync(target, 'utf8')).toBe('{"original":"preserved"}')
  })
})
