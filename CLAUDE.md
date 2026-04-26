# Meta-Manager System

## Sub-agent fast-path
If your role is one of: **coder, code-reviewer, tester, test-writer, spec-writer, designer, researcher, proposal-writer, security-expert** — your instructions are fully in your agent def file. Stop reading here.

## Startup
1. `echo $RELAY_AGENT_NAME` → read `.claude/agents/$RELAY_AGENT_NAME.md`
2. Skim `learnings/token-optimization/PRINCIPLES.md` (P2,P3,P4,P7,P8) + `ANTI-PATTERNS.md`
3. Read `CONCEPTS.md`, `SESSIONS.md`, `BACKLOG.md`, then `.claude/modules/CLAUDE-full.md`

## CEO communication
- Flag/ask CEO via `relay_reply to: "ceo"`. CLI alone = invisible.
- Message `type` mandatory: `done`/`status`/`waiting-for-input`/`escalate`/`message`

## TDD — ABSOLUTE
- Failing test first. Report test name before implementing.
- No `skip()`. Show real pass/fail count or task is not done.

## Real-time visibility (NEW — CEO directive 2026-04-26)

Every progress message you send (mid-work, end-of-task, escalation) MUST include:

- **Files I'm currently editing**: absolute paths, one per line. The CEO opens these in VSCode to follow along live.
- **Worktree path**: absolute path to the git worktree. (If editing the live tree directly because no worktree, say so explicitly.)
- **Merge status**: one of `worktree-only` | `committed-not-pushed` | `pushed-not-merged` | `merged-to-dev` | `merged-to-main`.
- **Branch name**: explicitly named.
- **What I'm doing right now**: one sentence in present-continuous tense ("Editing useMessages.ts to delete the cast at line 56", not "I'll fix the cast").

Pattern at the top of every message:

> WORKING ON
>   Files:    /absolute/path/file1.ts, /absolute/path/file2.ts
>   Worktree: /absolute/path/to/worktree (or "live tree, no worktree")
>   Branch:   feature-branch-name
>   Status:   worktree-only | committed-not-pushed | merged-to-dev | ...
>   Now:     <one sentence in present continuous>

Coders + team-leads + reviewers all use this. CEO's VSCode is open watching these files; if you don't disclose them, the CEO is flying blind.

## Platform priority (NEW — CEO directive 2026-04-26)

**Web is the canonical platform.** Every feature is implemented and verified on web FIRST. Capacitor (iOS) and Electron (desktop) variants strive for 100% feature parity with the web version. Web is the source of truth — never the other way around.

If you are tempted to implement a feature directly on iOS or Electron because "the API is easier there," stop. Implement on web first via the PlatformAPI abstraction, then provide platform-specific adapters.

## Testing model + scope (NEW — CEO directive 2026-04-26)

- **Tester agents are always Sonnet, never Haiku.** Haiku has demonstrated test-result fabrication. When spawning a tester, the spawn call MUST set `model: "sonnet"` explicitly.
- **E2E tests are committed alongside the features they cover** at `<project>/tests/e2e/<feature>/`. Never write E2E tests to `/tmp` or other temporary locations — they must be reusable and version-controlled.
- **Tests are written in sync with implementation**, not retrofitted. The coder writes a failing test before the implementation, the tester runs it as soon as the coder's worktree is ready.

## Real-only testing — no mocks, no fakes, no synthetic data (NEW — CEO directive 2026-04-26)

E2E tests prove user-facing behavior with real services. They do NOT:
- Mock the relay, the database, the LLM, or any backend
- Use MSW, vi.mock, sinon, or any test-double library
- Seed data into Zustand stores, React Query cache, or localStorage to "set up"
- Stub the system under test

E2E tests DO:
- Spin up the real backend (`bun run src/index.ts` for relay)
- Spin up the real frontend (`npm run dev`)
- Use the real database (separate dev instance)
- Drive real Playwright browser sessions with real clicks/keys
- Assert on literals that originated from the real backend during the test run

Preconditions missing (relay down, no agents, no test user) → report `BLOCKED — preconditions absent` and stop. Never seed-and-self-verify.

The reason: in production, the only thing that matters is "did the real system work?" Mocked tests prove only that the mock works. We have already wasted multiple sessions chasing tests that passed against fakes while the real system was broken (see PROBLEM-LOG.md).

This is the positive-rule restatement of the Synthetic-data ban — they are the same rule from two angles.

## Git
No `Co-Authored-By` or AI attribution. Subject + body only.

## Model policy
- Persistent agents + managers: Sonnet. Spawned teammates: Sonnet default; Opus when stuck.
- Disposable one-shots: Haiku. Haiku HARD LIMIT: single-file mechanical only.
- **Tester agents: always Sonnet, NEVER Haiku — see Testing section above.**
