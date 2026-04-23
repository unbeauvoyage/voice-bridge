# Test Matrix — All Projects
Generated: 2026-04-24

## Summary

| Project | Suite | Runner | Passing | Failing | Skipped | Total |
|---------|-------|--------|---------|---------|---------|-------|
| message-relay | Bun unit | bun test | 33 | 0 | 0 | 33 |
| voice-bridge2 | Bun unit/integration | bun test | 632 | 3 | 0 | 635 |
| voice-bridge2 | Vitest (wrong runner) | vitest | 0 | — | 46 files | — |
| productivitesse | Vitest unit | vitest run | 890 | 0 | 0 | 890 |
| productivitesse | Playwright E2E | playwright | deferred | — | — | — |

**Total: 1555 passing / 3 failing across automated suites run.**
Playwright E2E (productivitesse) deferred — external tester owns that suite (#9).

---

## message-relay

Branch: `fix/plugin-minimal-rewrite` (env repo)
Command: `bun test` in `/Users/riseof/environment/message-relay/`

| Suite | Runner | Passing | Failing | Skipped | Duration | Notes |
|-------|--------|---------|---------|---------|----------|-------|
| `src/__tests__/attachments.test.ts` | bun | — | — | — | — | included in totals |
| `src/__tests__/ota-file-watcher.test.ts` | bun | — | — | — | — | included in totals |
| **Total (4 files)** | bun | **33** | **0** | **0** | 5.5s | |

### Notes
- `package.json` `test` script was previously `echo "no tests for MVP" && exit 0`. The actual test files live in `src/__tests__/` and are discovered by `bun test` directly — the `npm test` stub is a red herring.
- 86 `expect()` calls across 33 tests. All green.

---

## voice-bridge2

Branch: `harden/vb2-ts-eslint-v2`
Command: `bun test` in `/Users/riseof/environment/projects/voice-bridge2/`

| Suite | Runner | Passing | Failing | Skipped | Duration | Notes |
|-------|--------|---------|---------|---------|----------|-------|
| `server/atomicWriteFile.test.ts` | bun | pass | 0 | 0 | — | |
| `server/cancelDetection.test.ts` | bun | pass | 0 | 0 | — | |
| `server/cmux.test.ts` | bun | pass | 0 | 0 | — | |
| `server/integration.test.ts` | bun | pass | 0 | 0 | — | |
| `server/llmRouter.test.ts` | bun | pass | 0 | 0 | — | |
| `server/logger.test.ts` | bun | pass | 0 | 0 | — | |
| `server/mobile-ui.test.ts` | bun | pass | 0 | 0 | — | |
| `server/openapi.test.ts` | bun | 38 | **3** | 0 | — | **FAILING — see below** |
| `server/pythonApp.test.ts` | bun | pass | 0 | 0 | — | |
| `server/relay-overlay.test.ts` | bun | pass | 0 | 0 | — | |
| `server/relay-poller.test.ts` | bun | pass | 0 | 0 | — | |
| `server/relay.test.ts` | bun | pass | 0 | 0 | — | |
| `server/routes/agents.test.ts` | bun | pass | 0 | 0 | — | |
| `server/routes/dedup.test.ts` | bun | pass | 0 | 0 | — | |
| `server/routes/messages.test.ts` | bun | pass | 0 | 0 | — | |
| `server/routes/meta.test.ts` | bun | pass | 0 | 0 | — | |
| `server/routes/settings.test.ts` | bun | pass | 0 | 0 | — | |
| `server/routes/status.test.ts` | bun | pass | 0 | 0 | — | |
| `server/routes/target.test.ts` | bun | pass | 0 | 0 | — | |
| `server/routes/transcribe-mime.test.ts` | bun | pass | 0 | 0 | — | |
| `server/routes/transcribe-parse.test.ts` | bun | pass | 0 | 0 | — | |
| `server/routes/transcribe.test.ts` | bun | pass | 0 | 0 | — | |
| `server/routes/wakeWord.test.ts` | bun | pass | 0 | 0 | — | |
| `server/server-utils.test.ts` | bun | pass | 0 | 0 | — | |
| `server/status.test.ts` | bun | pass | 0 | 0 | — | |
| `server/tts.test.ts` | bun | pass | 0 | 0 | — | |
| `server/wakeWordController.test.ts` | bun | pass | 0 | 0 | — | |
| `server/whisper.test.ts` | bun | pass | 0 | 0 | — | |
| `src/main/ipc.test.ts` | bun | pass | 0 | 0 | — | |
| `src/main/overlay/overlayServer.test.ts` | bun | pass | 0 | 0 | — | |
| `src/main/overlay/overlayWindow.test.ts` | bun | pass | 0 | 0 | — | |
| `src/main/processes/backendServer.test.ts` | bun | pass | 0 | 0 | — | |
| `src/main/processes/daemon.test.ts` | bun | pass | 0 | 0 | — | |
| `src/main/pythonApp.test.ts` | bun | pass | 0 | 0 | — | |
| `src/main/state/targetStore.test.ts` | bun | pass | 0 | 0 | — | |
| `src/main/tray.test.ts` | bun | pass | 0 | 0 | — | |
| `src/main/typeGuards.test.ts` | bun | pass | 0 | 0 | — | |
| `src/main/windows/mainWindow.test.ts` | bun | pass | 0 | 0 | — | |
| `src/renderer/src/stores/wakeStore.test.ts` | bun | pass | 0 | 0 | — | |
| `tests/e2e/mic-pickup-pipeline.spec.ts` | bun | pass | 0 | 0 | — | real HTTP, no Electron |
| `tests/e2e/overlay-stale-messages.spec.ts` | bun | pass | 0 | 0 | — | |
| `tests/e2e/queue-drain.spec.ts` | bun | pass | 0 | 0 | — | |
| `tests/e2e/tray-menu-status.spec.ts` | bun | pass | 0 | 0 | — | |
| `tests/e2e/tray-relay-state.spec.ts` | bun | pass | 0 | 0 | — | |
| `tests/e2e/wake-word-errors.spec.ts` | bun | pass | 0 | 0 | — | |
| `tests/e2e/whisper-health.spec.ts` | bun | pass | 0 | 0 | — | |
| **Total (46 files)** | bun | **632** | **3** | **0** | 18.3s | |

### Vitest runner — incompatible
Running `npx vitest run` against the voice-bridge2 suite fails all 46 files with `Cannot find package 'bun:test'`. These tests use Bun-native imports and must be run with `bun test`, not vitest. The `npm test` script (`typecheck + lint`) does not execute tests. Document gap: `package.json` `test` script should invoke `bun test`, not just typecheck.

### Failing tests — `server/openapi.test.ts`

All 3 failures are in the `GET /messages` describe block:

| Test | Expected | Got | Root cause |
|------|----------|-----|------------|
| `502 when relay is unavailable (default agent)` | 502 | 404 | Route registered at `server/index.ts:153` exists in working tree but test subprocess returns 404 — indicates route is missing or mis-registered in the subprocess environment |
| `400 when agent name exceeds 128 chars` | 400 | 404 | Same — validation guard never reached because route not found |
| `502 with custom agent param` | 502 | 404 | Same |

The test spawns a real server subprocess via `Bun.spawn(['bun', 'run', 'server/index.ts'])`. The `GET /messages` route is present at `server/index.ts:153` in the working tree. The 404 suggests the subprocess is starting a different version of the server, or the route handler registration has a code path that prevents it from being reached. **Not fixed — documented only.**

---

## productivitesse

Branch: checked out on dev (standard worktree)
Command: `npm run test` (`vitest run`) in `/Users/riseof/environment/projects/productivitesse/`

| Suite | Runner | Passing | Failing | Skipped | Duration | Notes |
|-------|--------|---------|---------|---------|----------|-------|
| 109 vitest files (`src/`, `app/`, `electron/`, `scripts/`) | vitest | **890** | **0** | **0** | 9.4s | |

### Playwright E2E — deferred
`npm run test:e2e` (Playwright) is owned by the external tester team (task #9, in_progress). Smoke suite (3 tests) confirmed passing via pre-commit hook observation. Full Playwright suite results will appear in #9 output.

### Notes
- 84 vitest test files found across `src/`, `app/`, `electron/`, `scripts/` — 109 files reported by vitest runner includes files in `.claire/worktrees/` that share the same vitest root (not excluded from config).
- `npm test` also includes `vitest run` only, not typecheck. Separate `npm run check` for that.

---

## Gaps

### High priority — production code paths with zero test coverage

| Gap | Project | File | Impact |
|-----|---------|------|--------|
| `GET /messages` route 404 in OpenAPI integration suite | voice-bridge2 | `server/openapi.test.ts` | 3 failing tests; messages proxy untested against real server subprocess |
| `package.json` `test` script doesn't run `bun test` | voice-bridge2 | `package.json` | CI/CD running `npm test` would only typecheck, skip all 635 test cases |
| Relay bun test file coverage: `src/__tests__/` has only 2 files | message-relay | `src/__tests__/` | Core relay dispatch logic (`src/index.ts` 861 lines) has no test coverage — tailer, WS multiplexer, OTA watcher, route handlers all untested |
| Playwright E2E for productivitesse not part of this run | productivitesse | `tests/ui/` | 75+ spec files, ~539 tests — state unknown pending #9 |

### Medium priority — missing coverage noticed

| Gap | Project | Notes |
|-----|---------|-------|
| Relay WebSocket protocol (chat/activity/raw views) | message-relay | No bun test exercises WS upgrade or message fan-out |
| Relay OTA file-watcher integration | message-relay | `ota-file-watcher.test.ts` exists but only 2 files total |
| Relay JSONL tailer against live filesystem | message-relay | `pollAll()` / `startTailer()` path — not tested |
| voice-bridge2 E2E tests (`tests/e2e/`) run via bun, not Playwright | voice-bridge2 | Real HTTP integration tests, not Electron — currently all pass |
| productivitesse draft-cleared-on-send | productivitesse | Identified in #34 coverage matrix as NO coverage |
| productivitesse `voice_bridge_url` derivation | productivitesse | Identified in #34 as NO coverage |
