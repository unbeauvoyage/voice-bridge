---
name: voice-bridge2 known issues
description: Latent bugs and contract violations flagged during development. Each entry is rescue-able — it describes the current behavior, the contract it violates, a proposed fix, and a regression test.
---

# voice-bridge2 Known Issues

## POST /wake-word/start — hardcoded Python.app Cellar path breaks on any Python upgrade

**Discovered:** 2026-04-16, during route extraction of /wake-word into `server/routes/wakeWord.ts` (commit 6f731bb).

**Also appears in:** `src/main/index.ts` L60 (the `PYTHON_APP` module-level constant used by `startDaemon()` in the Electron main process) — discovered 2026-04-16 during main/index.ts chunk 1 extraction (commit 1025a1f). Same fix applies to both locations; DFRR on this rescue note — one entry, two call sites.

**Current behavior:** the production wiring of `WakeWordContext.start` in `server/index.ts` hardcodes the Python interpreter path as `/opt/homebrew/Cellar/python@3.14/3.14.3_1/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python`. The same literal appears in `src/main/index.ts` L60. This path is required (instead of the plain `python3` symlink) because Python.app has the macOS microphone entitlements that a regular Python binary lacks.

**Why it breaks:** any `brew upgrade python@3.14` changes the version-suffix segment of the Cellar path (`3.14.3_1` → `3.14.3_2` or `3.14.4_1`), instantly breaking `/wake-word/start` with a silent `ENOENT` — the detached `child.on('error', ...)` logs to stderr but the API still returns `{ running: true }`, so observability is poor. Fresh machines without that exact Python version installed fail identically.

**Proposed fix sketch:** discover Python.app dynamically instead of pinning the Cellar path.

Option A (runtime discovery via Python itself):
```ts
function discoverPythonApp(): string {
  // `python3 -c 'import sys; print(sys.prefix)'` → /opt/homebrew/Cellar/python@3.14/<version>/Frameworks/Python.framework/Versions/3.14
  const result = spawnSync('python3', ['-c', 'import sys; print(sys.prefix)'], { encoding: 'utf8' })
  const prefix = result.stdout.trim()
  return join(prefix, 'Resources/Python.app/Contents/MacOS/Python')
}
```

Option B (env-var override with discovery fallback):
```ts
const pythonApp = process.env.PYTHON_APP_PATH ?? discoverPythonApp()
```

Option B is preferred — deployment flexibility plus automatic upgrade tolerance.

**Regression test shape:**
- Unit test the `discoverPythonApp()` helper in isolation: mock `spawnSync` to return a known prefix, assert the final path concatenates correctly.
- Integration is harder — testing the actual spawn requires a real Python.app, but the existing wake-word E2E (if any) covers it. A minimal smoke test: run `/wake-word/start`, poll `/wake-word` until `running:true` OR fail after 3 seconds.

**Severity:** latent-but-time-bombed. Any `brew upgrade python@3.14` triggers immediate breakage. Low observed impact today (single-machine deployment), HIGH impact as soon as voice-bridge2 runs on a fresh machine. Fix is ~15 lines + 1 unit test. Do not fix in a refactor chunk — schedule a dedicated `fix(vb2)` commit after route extraction completes.

