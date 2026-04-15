/**
 * Persistent "last target" store — a one-line text file remembering which
 * agent the wake-word daemon should address when it next dispatches.
 *
 * Factory shape (not free functions): the file path is closed over at
 * construction time so call sites read as `targetStore.read()` instead of
 * `readLastTarget(LAST_TARGET_FILE)`. Makes unit tests trivial (inject a
 * tmp path) and keeps the main-process shell free of path plumbing.
 *
 * Read errors → default to "command". Write errors → silently swallowed
 * (best-effort persistence; the daemon will fall back to the default on
 * next read anyway).
 */

import { readFileSync, writeFileSync } from 'node:fs'

export type TargetStore = {
  read: () => string
  save: (target: string) => void
}

export function createTargetStore(filePath: string): TargetStore {
  return {
    read(): string {
      try {
        return readFileSync(filePath, 'utf8').trim() || 'command'
      } catch {
        return 'command'
      }
    },
    save(target: string): void {
      try {
        writeFileSync(filePath, target)
      } catch {
        /* best-effort persistence */
      }
    }
  }
}
