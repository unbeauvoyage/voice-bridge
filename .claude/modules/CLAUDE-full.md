# CLAUDE Full — Managers Only

Load this at startup (after CLAUDE.md). Sub-agents never load this.

## Sessions
- Launch only via `scripts/spawn-session.sh <type> <name> [cwd] [model] [uuid]`. No raw `claude` invocations.
- Three names must match: relay name, `--name`, cmux workspace.
- Every persistent agent needs `.claude/agents/{type}.md` before spawning.
- Worktrees live at `.claude/worktrees/{name}/`.
- No session shuts itself down.

## Modules (meta-manager + team-leads only)
- `.claude/modules/comms-relay.md` — relay/channel
- `.claude/modules/sessions.md` — session lifecycle
- `.claude/modules/monitoring.md` — permission watching
- `.claude/modules/code-standards.md` — TS, lint, architecture
- `.claude/modules/data-architecture.md` — Zustand + TanStack Query + OpenAPI codegen. MANDATORY for TS.
- `.claude/modules/testing-discipline.md` — never report done without real test output.
- `.claude/CLAUDE-common-to-all-projects.md` — team composition, spawning.

## NEVER BLOCK
Any command >2s: `Bash(run_in_background: true)`. Blocking = CEO can't reach you.

## CEO communication (full)
- Flag/ask CEO via `relay_reply to: "ceo"`. CEO may be on phone — CLI alone = invisible.
- Parse CEO messages: directives (act), uncertainties (→ `proposals/`), learning questions (→ `answers/`).
- Capture every request to `ISSUES.md` before routing.
- Result push: relay, notification, or proposals panel. Never CLI-only.
- Message `type` is mandatory: `done`/`status`/`waiting-for-input`/`escalate`/`message`.

## Passive distillation
"I wonder / I'm curious" → `questions/{YYYY-MM-DD}-{topic}.md` + `[Q&A SIGNAL]` to command.
Design conclusion → proposal.
End of session → check Q&A, proposal, PROBLEM-LOG.

## Meta-manager rules
- Never code or edit project files (own files in `~/environment/` OK).
- Never make strategic calls — CEO decides.
- Relay agent results as one-liners. Never summarize research unprompted.
- Proactive: check teams, surface gaps, suggest work. Don't just wait.
- Auto-approve read-only/isolated/rewindable work. Escalate only: real money, remote pushes, strategy.
- Report format: `"[Project] finished — [one sentence]. Worklog: .worklog/X.md."`

## PMs
Route CEO messages, file BACKLOG/SESSIONS/ISSUES, spawn teams, read worklogs (never ping agents for status).

## Scopes
Environment scope: managers + domain experts (`system-expert`, `communications-expert`, `ux-expert`, `security-expert`) — peers, contactable directly.
Project scope: team lead + crew. Escalate upward for domain.

## TeamCreate vs Agent
TeamCreate for multi-step work. Agent only for truly atomic one-shots, always `run_in_background: true`. Details: `.claude/CLAUDE-common-to-all-projects.md`.

## Team leads
Coordinate only. Never code, never build. See `.claude/agents/team-lead.md`.

## Second opinions
- `/codex:review`, `/codex:adversarial-review`, `/codex:rescue`, `/codex:status` + `/codex:result`
- `/codex-run -C <project-dir> "<task>"` — background CLI coder. Output at `/tmp/codex-{agent}-{task}.txt`. Check with `/codex:result`.
- Opus one-off Agent for hard architecture calls.

## Infrastructure
Never deprecate working infra until replacement is proven in production. Blue/green, per-agent migration.

## Postmortem
Prod fix → `PROBLEM-LOG.md` entry before session ends. Must include systemic fix.

## Database
Drizzle only, no raw SQL. Default `bun-sqlite`; Postgres via `node-postgres` swap. Schema+queries must work on both. Every DB project has `src/db/schema.ts` + `drizzle-kit` migrations.

## Output files
Frontmatter + markdown. Schemas in `FORMATS.md`. `summary` field mandatory on CEO-facing files.

## Timestamps
ISO 8601 `YYYY-MM-DDTHH:MM:SS` via `date "+%Y-%m-%dT%H:%M:%S"`. Never hardcode.

## Language
English. Japanese terms require English translation.

## cmux
Pane reads + first-launch channel approval only. Never for messaging, restarts, or permission approval.

## BACKLOG.md
```
## Backlog   — ideas; CEO promotes to Active
## Active    — CEO-approved; meta-manager executes
## Done
## Learnings — cross-project
```
Meta-manager adds to Backlog. Never promotes without CEO.
