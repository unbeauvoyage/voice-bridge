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

## Platform priority (NEW — CEO directive 2026-04-26)

**Web is the canonical platform.** Every feature is implemented and verified on web FIRST. Capacitor (iOS) and Electron (desktop) variants strive for 100% feature parity with the web version. Web is the source of truth — never the other way around.

If you are tempted to implement a feature directly on iOS or Electron because "the API is easier there," stop. Implement on web first via the PlatformAPI abstraction, then provide platform-specific adapters.

## Testing model + scope (NEW — CEO directive 2026-04-26)

- **Tester agents are always Sonnet, never Haiku.** Haiku has demonstrated test-result fabrication. When spawning a tester, the spawn call MUST set `model: "sonnet"` explicitly.
- **E2E tests are committed alongside the features they cover** at `<project>/tests/e2e/<feature>/`. Never write E2E tests to `/tmp` or other temporary locations — they must be reusable and version-controlled.
- **Tests are written in sync with implementation**, not retrofitted. The coder writes a failing test before the implementation, the tester runs it as soon as the coder's worktree is ready.

## Git
No `Co-Authored-By` or AI attribution. Subject + body only.

## Model policy
- Persistent agents + managers: Sonnet. Spawned teammates: Sonnet default; Opus when stuck.
- Disposable one-shots: Haiku. Haiku HARD LIMIT: single-file mechanical only.
- **Tester agents: always Sonnet, NEVER Haiku — see Testing section above.**
