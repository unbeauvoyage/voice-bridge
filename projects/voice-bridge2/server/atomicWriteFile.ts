/**
 * Crash-safe file write via temp-file + rename.
 *
 * Chunk-4 HIGH (settings.ts:62): the prior wiring called writeFileSync
 * directly on the target path. writeFileSync truncates the destination
 * THEN streams bytes in — a crash, power loss, or ENOSPC mid-write leaves
 * a truncated file that looks corrupt to the next reader. Combined with
 * the fail-closed parse on read, that's a recoverable outage; combined
 * with the OLD fail-open parse, it was silent data loss of every
 * unrelated key. This helper makes the write atomic from the filesystem's
 * perspective:
 *
 *   1. Write `content` to `{path}.tmp`.
 *   2. Rename `{path}.tmp` → `path`.
 *
 * POSIX rename is atomic across the same filesystem, so readers see
 * either the old content or the new content, never a partial write.
 *
 * The `deps` parameter exists purely for test injection of a failing
 * writeFile — production always uses the default node:fs implementations.
 */

import {
  writeFileSync as fsWriteFileSync,
  renameSync as fsRenameSync,
  unlinkSync as fsUnlinkSync
} from 'node:fs'
import { randomUUID } from 'node:crypto'

export type AtomicWriteDeps = {
  writeFile: (path: string, content: string) => void
  rename: (from: string, to: string) => void
}

const DEFAULT_DEPS: AtomicWriteDeps = {
  writeFile: (path, content) => fsWriteFileSync(path, content),
  rename: (from, to) => fsRenameSync(from, to)
}

export function atomicWriteFile(
  path: string,
  content: string,
  deps: Partial<AtomicWriteDeps> = {}
): void {
  const { writeFile, rename } = { ...DEFAULT_DEPS, ...deps }
  // Use a UUID suffix so concurrent writes to the same target never share a
  // tmp file — without this, writer B overwrites writer A's tmp, and writer A
  // renames stale bytes to the target (concurrent-write data loss).
  const tmpPath = `${path}.tmp.${randomUUID()}`
  writeFile(tmpPath, content)
  try {
    rename(tmpPath, path)
  } catch (err) {
    // Clean up the orphaned tmp file so no .tmp.{uuid} files accumulate.
    try {
      fsUnlinkSync(tmpPath)
    } catch {
      // ENOENT is fine (write may have already failed); ignore all cleanup errors.
    }
    throw err
  }
}
