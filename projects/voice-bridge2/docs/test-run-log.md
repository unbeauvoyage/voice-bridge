# voice-bridge2 integration test run log

**Date:** 2026-04-24  
**Branch:** harden/vb2-ts-eslint-v2 (off fix/plugin-minimal-rewrite)  
**Commit:** 591aef1  
**Runner:** Bun v1.3.3  

---

## Command

```
bun test server/
```

No live server required — all tests use in-process Bun.serve on random ports or mock
backends. Live :3030 process was not touched.

## Result

| Suite | Pass | Fail | Total | Duration |
|---|---|---|---|---|
| server/ (28 files) | 433 | 3 | 436 | ~4.3s |

**No new failures vs baseline.** The 3 failures are pre-existing and not introduced by
any of tasks #4, #5, #6, or #26.

---

## Failing tests

### 1. `GET /messages > 502 when relay is unavailable (default agent)`
**File:** `server/openapi.test.ts:147`  
**Reason:** Pre-existing — `/messages` route was added to `openapi.test.ts` when
`server/routes/messages.ts` was created, but the route was never wired into
`server/index.ts`. Server returns 404 (no matching route); test expects 502.  
**Recommendation:** Wire `handleMessages` into `index.ts` or delete the test if the
`/messages` proxy route is intentionally deferred.

### 2. `GET /messages > 400 when agent name exceeds 128 chars`
**File:** `server/openapi.test.ts:155`  
**Reason:** Same root cause as #1 — route not wired. Server returns 404; test expects 400.  
**Recommendation:** Same as #1.

### 3. `GET /messages > 502 with custom agent param`
**File:** `server/openapi.test.ts:163`  
**Reason:** Same root cause as #1 — route not wired. Server returns 404; test expects 502.  
**Recommendation:** Same as #1.

---

## Notes

- Playwright (`npx playwright test tests/`) was run on the previous session (worktree
  `harden/vb2-ts-eslint`): **82 pass, 0 fail**. UI suite is green.
- All 436 server tests run in ~4s entirely in-process; no external services required.
- The 3 failing tests are orphaned specs for a route that exists in
  `server/routes/messages.ts` but is not mounted in `server/index.ts`. They do not
  represent a runtime regression — they are a reminder to finish wiring or consciously
  defer the feature.
