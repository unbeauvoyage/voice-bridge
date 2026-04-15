---
name: voice-bridge2 known issues
description: Latent bugs and contract violations flagged during development. Each entry is rescue-able — it describes the current behavior, the contract it violates, a proposed fix, and a regression test.
---

# voice-bridge2 Known Issues

## GET /agents — source=relay silently falls through to cmux on non-ok response

**Discovered:** 2026-04-16, during route extraction of /agents into `server/routes/agents.ts` (commit cb76bbd).

**Current behavior:** when a client calls `GET /agents?source=relay` and the relay returns a non-2xx response (e.g., 500), the handler skips the relay-error branch (which is inside a `catch` block guarding `fetch` throws only) and falls through to `listWorkspaceNames()`, returning cmux workspace data as if the call had succeeded.

**Contract violation:** a consumer that explicitly sets `source=relay` has a legitimate expectation of "relay data or an explicit error from relay". Silent substitution with cmux data means the caller cannot distinguish (a) "relay is healthy, data is wrong" from (b) "relay is broken, this is fallback data". This is observability poison — same family as message-relay structural bugs.

**Proposed fix:** split the two failure cases explicitly.
- `source=relay` AND relay throws → return `{ agents: [], error: 'Relay unavailable' }` (current behavior)
- `source=relay` AND relay returns non-ok → return `{ agents: [], error: 'Relay returned <status>' }` (NEW — no silent fallback)
- `source=auto` AND relay throws → fall through to cmux (current behavior)
- `source=auto` AND relay returns non-ok → fall through to cmux (current behavior)

Sketch:
```ts
if (source !== 'workspaces') {
  try {
    const relayRes = await ctx.fetchFn(...)
    if (relayRes.ok) return Response.json(await relayRes.json(), { headers: CORS_HEADERS })
    if (source === 'relay') {
      return Response.json(
        { agents: [], error: `Relay returned ${relayRes.status}` },
        { headers: CORS_HEADERS }
      )
    }
    // source=auto: fall through
  } catch {
    if (source === 'relay') {
      return Response.json({ agents: [], error: 'Relay unavailable' }, { headers: CORS_HEADERS })
    }
    // source=auto: fall through
  }
}
```

**Regression test:** add to `server/routes/agents.test.ts`:
```ts
test('source=relay returns error body when relay returns non-ok', async () => {
  const ctx = ctxWith({ relayOk: false, workspaces: ['shouldNotAppear'] })
  const req = new Request('http://localhost/agents?source=relay')
  const res = await handleAgents(req, ctx)
  const body = await readJsonObject(res)
  expect(body['agents']).toEqual([])
  expect(typeof body['error']).toBe('string')
})
```
Current test suite has a test that ASSERTS the buggy behavior for `source=auto` (cmux fallback on non-ok), which must remain green. The NEW test above is the one that will fail against the current code and pass against the fix.

**Severity:** latent, low observed impact (no known caller explicitly uses `source=relay`), but a real contract violation. Fix is ~10 lines + 1 test. Pure-refactor chunk must not touch this; flag for a separate follow-up commit after route extraction is complete.

---

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
