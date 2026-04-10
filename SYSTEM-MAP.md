# System Map

Complete map of all system and communication-related files and folders in `~/environment/`.
Updated: 2026-04-06

---

## Core System Files (read on startup)

| File | Owner | Purpose |
|------|-------|---------|
| `CLAUDE.md` | system-expert | Meta-manager rules, identity, behavior policies |
| `CONCEPTS.md` | system-expert | Canonical definitions of every system concept |
| `FORMATS.md` | system-expert | Output format schemas — frontmatter + body for all file types |
| `SYSTEM-MAP.md` | system-expert | This file — map of all system and comms files |
| `SESSIONS.md` | command | Active sessions, UUIDs, workspaces, delivery methods |
| `BACKLOG.md` | command | Work queue — Backlog / Active / Done / Learnings |
| `ISSUES.md` | any agent | Kanban of known bugs (quick view — see `issues/` for detail) |
| `PROBLEM-LOG.md` | any agent | Permanent incident history — postmortems |

---

## Agent Definitions

`~/environment/.claude/agents/` — one file per agent type

| File | Type | Model | Role |
|------|------|-------|------|
| `project-manager.md` | project-manager | haiku | Router, tracker, spawner |
| `team-lead.md` | team-lead | sonnet | Project coordinator |
| `coder.md` | coder | sonnet | Feature implementation |
| `code-reviewer.md` | code-reviewer | sonnet | Code review |
| `tester.md` | tester | sonnet | Run existing tests |
| `test-writer.md` | test-writer | sonnet | Write new tests |
| `designer.md` | designer | sonnet | Design system, UI review |
| `spec-writer.md` | spec-writer | sonnet | Feature specs |
| `researcher.md` | researcher | sonnet | Deep research, Q&A answers |
| `proposal-writer.md` | proposal-writer | sonnet | Structured proposals |
| `system-expert.md` | system-expert | opus | Environment architecture (instance: matrix) |
| `communications-expert.md` | communications-expert | opus | Relay health (instance: signal) |
| `ux-expert.md` | ux-expert | opus | CEO UX, dashboard design |
| `security-expert.md` | security-expert | opus | Risk review, permission escalation |
| `agency-lead.md` | agency-lead | sonnet | Market research |

---

## Active Modules

`~/environment/.claude/modules/` — detailed instructions loaded by agents on startup

| File | Purpose |
|------|---------|
| `comms-relay.md` | Communication patterns, fallback chain, relay API |
| `sessions.md` | Session lifecycle, naming rules, spawn protocol |
| `monitoring.md` | Permission monitoring tiers, auto-approval rules |

---

## Scripts & Executables

`~/environment/scripts/`

| File | Trigger | Purpose |
|------|---------|---------|
| `spawn-session.sh` | Manual | Universal session launcher — always use this |
| `spawn-manager.sh` | Manual | Convenience wrapper for PM sessions |
| `spawn-team-lead.sh` | Manual | Convenience wrapper for team lead sessions |
| `distill-ceo-message.sh` | Hook: UserPromptSubmit | Detects Q&A signals in CEO messages |
| `session-mirror.sh` | Hook: Stop | Preserves session context on shutdown |

`~/environment/message-relay/scripts/`

| File | Trigger | Purpose |
|------|---------|---------|
| `register-session.sh` | Hook: SessionStart | Registers agent with relay on startup |
| `poll-messages.sh` | Hook: UserPromptSubmit | Surfaces queued relay messages to agent |

`~/environment/bin/`

| File | Purpose |
|------|---------|
| `hook-event.sh` | Dispatcher for PreToolUse/PostToolUse/Stop hooks |
| `hub-send` | Send messages via relay from shell scripts |
| `hub-monitor` | Monitor relay health |
| `speak` | Text-to-speech output (edge-tts) |
| `restart-session` | Restart a named session |

---

## Hooks Configuration

`~/.claude/settings.json` — applies to ALL agent sessions

| Hook Event | Script | What it does |
|------------|--------|--------------|
| SessionStart | `register-session.sh` | Registers agent name with relay |
| UserPromptSubmit | `poll-messages.sh` | Injects queued relay messages into context |
| UserPromptSubmit | `distill-ceo-message.sh` | Detects Q&A signals, fires question creation |
| PermissionRequest | HTTP → `localhost:8765/hook/permission` | Routes permission requests through relay |
| PreToolUse | `hook-event.sh PreToolUse` | Logs tool usage (async) |
| PostToolUse | `hook-event.sh PostToolUse` | Logs tool completion (async) |
| Stop | `hook-event.sh Stop` | Exit cleanup (async) |
| Stop | `session-mirror.sh` | Context preservation (async) |

---

## Communication Infrastructure

`~/environment/message-relay/`

| Path | Purpose |
|------|---------|
| `server.ts` (or similar) | Relay server source — pm2 managed, port 8765 |
| `queues/` | Per-agent message queue files (disk-backed) |
| `marketplace/` | Plugin definitions: `relay-channel`, `hub-channel` |
| `scripts/` | register-session.sh, poll-messages.sh |

**Relay endpoints:**
- `POST /send` — send message to agent queue
- `GET /history/{agent}` — agent message history
- `POST /hook/permission` — permission approval routing
- `GET /status` — relay health

---

## Output Directories (CEO-facing)

See `FORMATS.md` for schemas of all files in these directories.

| Directory | Content | Dashboard location |
|-----------|---------|-------------------|
| `proposals/` | Proposals awaiting CEO decision | Proposals panel |
| `answers/` | Q&A research answers | Knowledge Board |
| `questions/` | CEO questions (open + answered) | Knowledge Board |
| `issues/` | Individual issue files (complex bugs) | Issues panel |
| `specs/` | Feature design specs (before coding) | — |
| `.worklog/` | Per-agent rolling work logs | — |
| `knowledge/{codebase}/` | Reference knowledge per codebase | — |
| `PROBLEM-LOG.md` | Incident postmortems | Problem Log screen |

---

## Projects

| Path | Session | Purpose |
|------|---------|---------|
| `projects/productivitesse/` | productivitesse | CEO dashboard (React Three Fiber + Electron + Capacitor) |
| `projects/voice-bridge/` | voice-bridge | Voice I/O (Bun + Electron + Whisper) |
| `projects/knowledge-base/` | knowledge-base | Video/web transcript analyzer |
| `jarvis/` | jarvis | Voice router — CEO voice → correct agent |
| `agency/` | various | Market research (routers, biz, bicycles, etc.) |

---

## Who Owns What

| Domain | Owner | Scope |
|--------|-------|-------|
| CLAUDE.md, CONCEPTS.md, FORMATS.md, SYSTEM-MAP.md | system-expert (matrix) | Environment |
| Relay server, message delivery, session health | communications-expert (signal) | Environment |
| Dashboard UX, information architecture | ux-expert | Environment |
| High-risk permission review | security-expert | Environment |
| BACKLOG.md, SESSIONS.md, ISSUES.md, routing | command / atlas / sentinel | Environment |
| productivitesse app | productivitesse team lead | Project |
| voice-bridge app | voice-bridge team lead | Project |
