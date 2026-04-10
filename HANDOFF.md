# Handoff: Session History & Key Decisions

> **NOTE (2026-03-31):** This document is historical context from the original design session (2026-03-28). Some details are outdated — notably, message delivery now uses **Claude Code Channels** (MCP push) instead of cmux terminal injection, and `meta:*` session prefixes are no longer used. See CLAUDE.md for current rules.

This document summarizes the full design session (2026-03-28) that led to the current meta-manager architecture. Read this on your first startup to understand context, decisions, and lessons learned.

## What Was Built

A multi-project orchestration system where:
- **Meta-manager/COMMAND (you)** runs at `~/environment/`, manages all projects
- **Team leads** are persistent `claude -p` sessions, one per project
- **Agents** are team members within each project, managed by the team lead
- **Codex (OpenAI)** is a parallel second brain available to all agents
- **User** interacts with you directly, and can connect to any session via cmux

## Key Decisions (and why)

### 1. No senior-engineer bottleneck
We tried a hierarchical team (senior-engineer → codebase-expert → researcher). It failed because:
- Senior-engineer became a bottleneck — blocked on coding while new tasks waited
- It tried to do everything: decide, code, review, coordinate
- **Decision:** Team leads coordinate only. They do NO work themselves. Engineers, researchers, etc. do the work.

### 2. Persistent sessions over agent teams for cross-session memory
Agent teams (TeamCreate/SendMessage) die when the CLI session ends. We need context to survive.
- `claude -p --session-id` + `--resume` gives persistent context with zero token waste on reload
- Team leads are persistent `-p` sessions
- **Within** a team lead's session, agent teams work fine (parallel, messaging) — they just die when that session ends
- `.worklog/` files provide a backup for persistent agents' accumulated knowledge

### 3. Flat architecture within projects
We tried codebase-expert and senior-engineer as permanent roles. Unnecessary overhead.
- **Decision:** Engineers are equal peers. Each reads what it needs, codes, coordinates directly.
- Team lead decides what's persistent vs disposable based on the work.

### 4. Codex is a parallel second brain, not just a coder
- Any agent can use Codex for review, validation, alternatives, coding
- Always runs in background — NEVER blocks the calling agent
- Duplicate work is encouraged (Claude codes, Codex reviews simultaneously)
- Codex tokens expire — prefer using them when available
- Run via disposable subagents or background Bash

### 5. Work logs are append-only
- `.worklog/{agent-name}.md` in every project
- Research agents append EVERY finding immediately — no data loss (customer-facing data)
- Engineering agents append progress and decisions
- New agents in future sessions read worklogs to get baseline
- Globally gitignored

### 6. COMMAND (Meta-manager) never touches code
- Only uses: TaskCreate, TaskUpdate, TaskList, SendMessage, Agent, Bash (for session management and cmux), Read/Write (only for ~/environment/ files)
- Creates projects, manages sessions, relays between team leads, reports to user
- Does NOT investigate code issues, run builds, or make technical decisions

### 7. Session naming convention
- `meta:*` prefix for all meta-managed sessions
- User-controlled sessions have no prefix
- Prevents accidental cross-contamination

### 8. cmux integration
- `cmux new-workspace --cwd {path} --command "claude --resume $UUID --remote-control"` opens interactive session
- `cmux close-workspace --workspace workspace:N` closes view (session survives on disk)
- User can see sessions on mobile via `--remote-control`

## Things We Tried That Failed

### Activation latency fix (productivity-helper)
- Attempted to speed up RShift → window switch by removing 50ms sleep, changing Swift activation, adding hwnd fast path
- **Broke key assignment** — fast-release safety was violated
- Codex identified root cause: stale `selectedResult` race in `commitSelectionAndHide()`
- All changes were reverted. The real bottleneck is the 200ms cache spin-wait, not the 50ms sleep.
- **Status:** Reverted to clean state. Still needs fixing — approach should be P1 (non-blocking cache) only.

### JSONL transcript restoration
- Tried to restore agent context from JSONL session transcripts
- User preferred simpler brain-dump approach, then evolved to persistent `-p` sessions
- JSONL restoration was removed from the system

### Running Codex directly (not via subagent)
- Senior-engineer kept running `codex exec` directly via Bash, blocking itself
- **Rule:** Always spawn a disposable subagent for Codex calls

## Active Projects

### productivity-helper
- **Path:** `~/environment/productivity-helper/`
- **Status:** Working app, activation latency fix still pending
- **Agent definitions:** engineer, researcher, scout, evaluator in `.claude/agents/`
- **Key files:** See `productivity-helper/CLAUDE.md` for full architecture docs

### Others in ~/environment/
- `WindowSprinter/` — unknown status
- `ydtvocabulary/` — unknown status

## User Preferences
- Prefers voice input (dictation) — expect typos in messages
- Wants agile project creation — one sentence should be enough to start a project
- Wants to be the CEO — dreams and approves, doesn't manage details
- Has Codex subscription with expiring tokens — maximize Codex usage
- Uses cmux terminal with mobile access via `--remote-control`
- Values no token waste — persistent sessions preferred over context restoration
- Research findings are customer-facing — no data loss acceptable
- Meta-manager role is COMMAND

## Your First Actions
1. Read `SESSIONS.md` and `BACKLOG.md`
2. Report status to user
3. Wait for instructions — user will tell you what to work on
