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

## Git
No `Co-Authored-By` or AI attribution. Subject + body only.

## Model policy
- Persistent agents + managers: Sonnet. Spawned teammates: Sonnet default; Opus when stuck.
- Disposable one-shots: Haiku. Haiku HARD LIMIT: single-file mechanical only.
