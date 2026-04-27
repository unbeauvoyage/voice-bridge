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
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs'
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

  // Concurrent-write safety: two calls to atomicWriteFile for the same target
  // must NOT share the same tmp path. If they did, writer B could overwrite
  // writer A's tmp file before A's rename, causing A to rename stale bytes.
  // The UUID suffix guarantees each call gets its own tmp file.
  test('uses a unique temp path per call (no collision)', () => {
    const target = join(dir, 'settings.json')
    const seenTmpPaths: string[] = []
    // Capture the tmpPath used by each call via injected writeFile/rename.
    // Both calls must succeed (rename goes to target); we just collect the paths.
    const captureAndWrite = (p: string, c: string): void => {
      seenTmpPaths.push(p)
      writeFileSync(p, c)
    }
    let firstTmp: string | null = null
    const captureRename = (from: string, to: string): void => {
      // record and perform the real rename
      renameSync(from, to)
      // stash so we can compare
      firstTmp = firstTmp ?? from
    }
    // First call
    atomicWriteFile(target, 'A', { writeFile: captureAndWrite, rename: captureRename })
    // Second call — must use a different tmp path
    atomicWriteFile(target, 'B', { writeFile: captureAndWrite, rename: captureRename })
    expect(seenTmpPaths).toHaveLength(2)
    expect(seenTmpPaths[0]).not.toBe(seenTmpPaths[1])
    // Both tmp paths must be extensions of the target path (not some other dir).
    expect(seenTmpPaths[0]).toMatch(new RegExp(`^${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    expect(seenTmpPaths[1]).toMatch(new RegExp(`^${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  })

  // Cleanup guarantee: if rename fails, the unique tmp file must be deleted
  // so that orphaned .tmp.{uuid} files don't accumulate on disk.
  test('cleans up temp file when rename fails', () => {
    const target = join(dir, 'settings.json')
    let capturedTmpPath: string | null = null
    const trackingWrite = (p: string, c: string): void => {
      capturedTmpPath = p
      writeFileSync(p, c) // real write so the file actually exists
    }
    const failingRename = (): void => {
      throw new Error('simulated rename failure')
    }
    expect(() =>
      atomicWriteFile(target, 'content', { writeFile: trackingWrite, rename: failingRename })
    ).toThrow('simulated rename failure')
    // The temp file must have been cleaned up — no orphan left on disk.
    expect(capturedTmpPath).not.toBeNull()
    if (capturedTmpPath === null)
      throw new Error('expected capturedTmpPath to be set by trackingWrite')
    expect(existsSync(capturedTmpPath)).toBe(false)
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
