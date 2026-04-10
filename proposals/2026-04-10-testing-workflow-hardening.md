---
type: proposal
title: Testing Workflow Hardening — Layered Pre-CEO Gate
summary: Seven-layer testing workflow + TS/ESLint hardening so features are thoroughly verified before the CEO ever opens the app. Discussed during the JSONL sessions feature rollout where a fix passed source review and unit tests but not the actual populated browser state.
status: draft
author: agentflow-expert
date: 2026-04-10T06:22:59
tags: [testing, quality, workflow, typescript, eslint, playwright, nut.js, e2e]
---

# Testing Workflow Hardening — Layered Pre-CEO Gate

## Problem

During the JSONL sessions feature rollout (2026-04-10), a fix passed:
- Unit tests (28/28 store + 11/11 watcher)
- Source code review
- Coder's own verification

…and still needed **two additional rounds of Codex review** to surface real bugs (orphan tool results, duplicate event handling, session recycling, placeholder hydration, unbounded memory growth). The Playwright E2E test couldn't actually verify the populated browser state because the Vite dev server was on HTTPS and the relay was on plain `ws://` — a mixed-content block.

The root issue: **the CEO could have opened the feature and seen broken behavior** before the real bugs were caught. The testing layer was not thorough enough to prevent that class of miss.

## Goals

1. By the time the CEO opens any feature, it has been verified at multiple independent layers.
2. Every class of bug the JSONL rollout hit should be unable to reach the CEO silently.
3. Add layers **without** slowing the dev cycle for small changes — cheap tests run on commit, expensive tests run on CEO-ready gate.
4. Make the verification surface machine-readable — agents can report "CEO-ready: YES/NO" deterministically.

## Proposed Architecture — Seven Layers

### Layer 1 — Pre-commit (husky + lint-staged)

Runs on every `git commit`, blocks the commit if it fails.

- `tsc --noEmit` on staged files only (fast, incremental)
- ESLint with cache on staged files
- Fast unit tests for changed modules only (vitest `--related`)
- Total budget: ~5s

Install: `husky`, `lint-staged`, `vitest`, `@typescript-eslint/*`, `eslint`.

### Layer 2 — Strict TypeScript + ESLint

Foundation layer. Prevents whole bug classes at compile time so the higher layers run on cleaner code.

**TypeScript flags to enable** (already on in `message-relay`, not yet in productivitesse):
- `noUncheckedIndexedAccess` — forces `undefined` handling on array/record access
- `exactOptionalPropertyTypes` — distinguishes `{x?: T}` from `{x: T|undefined}`
- `noImplicitOverride` — forces `override` keyword
- `noPropertyAccessFromIndexSignature` — forces bracket access on index signatures
- `noFallthroughCasesInSwitch`
- `useUnknownInCatchVariables`

**ESLint ruleset:**
- `@typescript-eslint/strict-type-checked` preset as baseline
- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-unused-vars: error`
- `@typescript-eslint/consistent-type-imports: error`
- `@typescript-eslint/no-floating-promises: error` (catches forgotten `await`)
- `@typescript-eslint/no-misused-promises: error`
- `@typescript-eslint/strict-boolean-expressions: warn`

**Roll-out process:**
1. Audit current error count under the target flags before committing any change
2. If <50 errors: fix all in one PR
3. If 50–500: fix critical hot-files, track rest
4. If >500: enable flag by flag, one per week

### Layer 3 — Post-commit persistent tester agent

Replaces the "one-shot tester per feature" pattern.

- Always alive, subscribed to git commits on `dev` (git post-commit hook OR file watcher)
- Runs full test suite on every commit
- Reports failures back via relay immediately
- Green commits = silent; red commits = ping `coder` + surface on dashboard
- CEO hears from the tester only when something is actually broken

### Layer 4 — Replay-based tests (deterministic event fixtures)

**Why:** would have caught the JSONL orphan-tool-result bug because the store could be exercised with fixture events where `tool_result` arrives before `tool_use`.

- Record real `.jsonl` files into `tests/fixtures/sessions/`
- Strip sensitive content (paths, secrets) via a fixture sanitizer
- Replay them through the watcher/store in unit tests
- Each fixture is a named scenario: `normal-session.jsonl`, `orphan-tool-result.jsonl`, `session-recycled.jsonl`, etc.
- Covers replay-buffer edge cases without needing a live Claude Code session

### Layer 5 — Contract tests between relay and dashboard

**Why:** catches the "relay added a field, dashboard forgot" class of bug before runtime. The current `WSEvent` union in `types.ts` is hand-maintained and can drift from what the relay actually sends.

- Extract WS event shapes into a shared `packages/relay-contracts/` folder
- Define them as `zod` schemas (single source of truth)
- Generate TypeScript types from the schemas
- Both relay and dashboard import from the shared package
- A contract test verifies the relay's actual broadcast payloads parse cleanly against the schema — one test per event type

### Layer 6 — Environment parity for Playwright E2E

**Why:** the JSONL rollout hit this directly. Vite on HTTPS + relay on `ws://` = mixed content block = Playwright can't verify populated state.

Fix options (pick one):
- Run Vite on plain HTTP in test mode (simplest, used today)
- Run relay on WSS with a self-signed cert accepted by Playwright's Chromium via `--ignore-certificate-errors`
- Run both behind a single HTTPS reverse proxy (cleanest but more infra)

Add an `npm run test:e2e` script that:
- Sets `NODE_ENV=test`
- Starts relay + Vite in the matched-protocol configuration
- Runs Playwright spec suite
- Tears everything down

### Layer 7 — Pre-beta gate: `npm run ceo-ready`

**The single command that decides whether a build can go to the CEO's phone.**

```bash
npm run ceo-ready
```

Runs in sequence:
1. `tsc --noEmit` (whole repo)
2. ESLint (whole repo)
3. Unit tests (vitest, all)
4. Replay tests (from fixtures)
5. Contract tests (relay ↔ dashboard)
6. Playwright E2E (headless, matched env)
7. nut.js Electron smoke test (launch app, verify overlay appears, verify global hotkey, verify window search)
8. Visual diff vs golden screenshots for each dashboard tab

Exit code 0 = CEO-ready. Exit code 1 = build is blocked from the beta variant.

The persistent `tester` agent runs this automatically on every merge to `dev`. The CEO only sees a build when this is green.

## Tooling Notes

### Puppeteer vs Playwright — stick with Playwright
- Same team built both (ex-Google team at Microsoft)
- Playwright is cross-browser (Chromium + Firefox + WebKit) from day one
- Built-in test runner, auto-waiting, trace viewer, codegen
- Strictly better for E2E testing
- Puppeteer remains fine for scraping/PDF, not testing

### nut.js — different category
- Controls the desktop (mouse/keyboard/screen pixels), not the browser DOM
- Uses OpenCV for image-based element location
- Essential for Electron native-shell features that Playwright can't see: global hotkeys, overlay panel, `alwaysOnTop`, tray icon, window enumeration, cross-app window switching
- productivitesse already has `@nut-tree-fork/nut-js` in devDependencies — foundation is there

### Use both, per concern:
- Playwright → webview + React components
- nut.js → Electron-specific native features + global shortcuts

## Incremental Adoption Order

If we can't do everything at once, here's the order of highest leverage:

1. **Strict TS flags** (Layer 2) — one-time cost, permanent benefit, every future feature inherits it
2. **Environment parity fix** (Layer 6) — small change, unblocks Playwright immediately
3. **Replay fixtures** (Layer 4) — catches event-sourcing bugs that unit tests miss
4. **husky pre-commit** (Layer 1) — blocks the simplest class of mistakes at the cheapest stage
5. **Persistent tester** (Layer 3) — changes the team structure; requires the test suite to be reliable first
6. **Contract tests** (Layer 5) — requires refactoring WSEvent into a shared package
7. **`ceo-ready` gate** (Layer 7) — composes all the above; only useful once the building blocks exist

## What Sparked This

- JSONL sessions feature rollout: 3 rounds of Codex review needed to catch duplicate-event and session-recycling bugs that would fire in production because the relay has a replay buffer
- Playwright couldn't verify the populated browser state because of the HTTPS/ws mixed-content block (Layer 6 gap)
- Unit tests passed but didn't exercise the orphan-result path (Layer 4 gap)
- No gate between "coder commits" and "CEO opens the app" (Layer 7 gap)

## Open Questions for Discussion

1. How much TypeScript strictness pain are we willing to absorb in one sitting vs rolling in flag-by-flag?
2. Should the persistent tester run on every commit to `dev`, or only on merge from a feature branch? (Trade-off: noise vs latency.)
3. Do we want the `ceo-ready` script to auto-deploy to the beta variant when green, or always wait for a human `npm run deploy`?
4. For contract tests between relay and dashboard — is a shared package worth it, or does a looser approach (JSON schema in a docs file, validated manually) work?
5. How do we handle visual regression baselines across the two beta variants (LAN vs Tailscale)? Screenshots should be identical but the network badge changes color.

## Status

DRAFT — captured during the JSONL rollout on 2026-04-10. To be discussed with CEO before implementation. Not blocking any current feature work.
