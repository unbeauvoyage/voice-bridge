---
type: proposal
title: System-wide PostToolUse tsc+vitest feedback hook for all TypeScript projects
summary: After every TypeScript file write, agents see tsc errors and related unit test results immediately — like IDE inline feedback — preventing surprises at build time.
status: done
implemented: 2026-04-14T20:00:00
commits: [d8726f3, 74211c2]
authors: [productivitesse]
created: 2026-04-14T15:03:53
priority: high
project: environment
---

## Problem

Agents write TypeScript code blind. Type errors and broken unit tests only surface at build time — or not at all if no one runs the build. This caused the `AgentMessage.timestamp→ts` rename incident today: a property was renamed, callers were not updated, and the type system caught nothing until a crash in a running session. The gap between writing code and seeing errors creates an entire class of avoidable bugs.

## Solution

A PostToolUse hook that fires after every `Write`, `Edit`, or `MultiEdit` on `.ts`/`.tsx` source files. It runs two checks:

1. `tsc --noEmit --incremental` — type-checks the project using the `.tsbuildinfo` cache (fast after the first run, typically under 5s)
2. The related unit test file, if it exists — matches `src/foo/bar.ts` to `src/foo/__tests__/bar.test.ts` or `tests/foo/bar.test.ts`

Output is filtered to errors only (no noise), capped at 15 tsc errors and 10 test result lines. The agent sees this immediately after each file write — same feedback loop as IDE squiggles.

The hook always exits 0. It is informational, never blocking.

## What the Agent Sees

```
--- TypeScript check ---
TypeScript errors:
src/types/AgentMessage.ts(12,5): error TS2339: Property 'timestamp' does not exist...

--- Unit tests (related files) ---
FAIL src/types/__tests__/AgentMessage.test.ts
× should serialize timestamp field
```

Or, when clean:

```
--- TypeScript check ---
tsc: clean

--- Unit tests (related files) ---
No unit test file found for AgentMessage
```

## Prototype — Already Live

productivitesse has this running today:

- Hook script: `.claude/hooks/post-edit-typecheck.sh`
- Wired in: `.claude/settings.json` under `PostToolUse` with matcher `Write|Edit|MultiEdit`, timeout 30s
- File filter: only fires for `projects/productivitesse/src/**/*.{ts,tsx}`, skips `.d.ts` and config files

## Rollout Plan

Extend the same pattern to the three other TypeScript projects. Each needs:

1. A copy of the hook script at `.claude/hooks/post-edit-typecheck.sh` with the `PROJECT` path and file filter updated for that project's `src/` location
2. The same `PostToolUse` entry in `.claude/settings.json`

Target projects:
- `projects/message-relay`
- `projects/knowledge-base`
- `projects/voice-bridge`

The script is ~65 lines, parameterized by `PROJECT` path. Adaptation per project is a 2-line change.

## Non-Goals

- **Not blocking** — exit 0 always; agents mid-refactor may have intentional transient errors
- **Not running Playwright** — E2E suite is too slow for per-edit feedback; belongs at deploy time
- **Not running on non-TypeScript files** — JSON, CSS, shell scripts are excluded by the file filter

## Why Non-Blocking Matters

An agent refactoring an interface will break callers before fixing them. Blocking on the first error would halt the refactor mid-way. The hook surfaces information; the agent decides whether the errors are expected. Blocking is counterproductive here — the hard gate belongs in deploy scripts.

## Complement to the Deploy Gate

Deploy scripts already enforce `tsc --noEmit` + `vitest run` as a hard block before any build reaches the phone. The PostToolUse hook is the fast feedback layer that catches errors during development. Together they form a two-layer safety net: catch early (hook) and enforce at the boundary (deploy gate).
