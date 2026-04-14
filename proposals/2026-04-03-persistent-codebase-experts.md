---
title: Persistent Codebase Expert Agents
date: 2026-04-03
status: proposed
---

# Proposal: Persistent Codebase Expert Agents

**Status:** Draft
**Author:** Command
**Date:** 2026-04-03

## Problem

When an agent studies a codebase (e.g., Cline Kanban tonight), that knowledge lives only in the agent's context window. When the session ends, the next agent re-studies from scratch — duplicate work, wasted tokens, inconsistent findings.

## Solution: Expert Agent Sessions + Knowledge Files

Each expert agent:
1. Studies its codebase once deeply → writes structured knowledge files to `~/environment/knowledge/[codebase]/`
2. Remains as a persistent Claude Code session (resumed with `claude --resume [uuid]`)
3. When consulted, reads its knowledge files and answers questions without re-studying

**The persistence is file-based, not context-based.** The agent's context resets between sessions, but its knowledge files remain. On resume, agent loads files and answers from stored knowledge.

## Knowledge File Format

```
~/environment/knowledge/cline-kanban/
  overview.md        — architecture overview, key concepts
  integration.md     — how to integrate with our system
  api.md             — all endpoints, types, interfaces
  findings.md        — specific answers to questions already asked
  sources.md         — GitHub URLs, commit SHAs studied
```

On each consultation, agent:
1. Reads its knowledge files (fast — already researched)
2. Answers from knowledge (no re-crawl needed)
3. If question is new and not in knowledge → researches it, appends to findings.md

## Agent Definition

Each expert lives in `~/environment/.claude/agents/expert-[name].md`:

```markdown
# Expert: Cline Kanban
You are the persistent expert on the Cline Kanban codebase.

Your knowledge is in ~/environment/knowledge/cline-kanban/.

On startup:
1. Read all files in ~/environment/knowledge/cline-kanban/
2. Acknowledge you are ready to answer questions
3. Report your knowledge coverage (last studied date, gaps)

When asked a question:
1. Check if it's in findings.md
2. If yes: answer from file
3. If no: research it, then add to findings.md
```

## Session Management

Experts are listed in SESSIONS.md as non-interactive unless being consulted.
When CEO wants to consult: `claude --resume [uuid]` or relay message.
Experts respond via relay and update their knowledge files.

## Initial Expert Candidates

Priority order:
1. **cline-expert** — Cline VS Code extension + Kanban (cline-researcher already studied this tonight)
2. **relay-expert** — our own message-relay codebase (frequently modified)
3. **productivitesse-expert** — dashboard + 3D view architecture
4. **voice-bridge-expert** — voice pipeline + Whisper integration

## What This IS and ISN'T

**IS:**
- A persistent session that accumulates knowledge files over time
- A way to avoid re-studying the same codebase repeatedly
- A single point of truth for a codebase's architecture

**ISN'T:**
- Infinite context (agent context resets between turns)
- A search engine (it's structured Q&A from pre-studied material)
- A replacement for reading code (it complements it)

## Immediate Action

The cline-researcher agent from tonight has a complete research report at `~/environment/reports/cline-kanban-research.md`. Promote it:
1. Create `~/environment/knowledge/cline-kanban/` directory
2. Split the report into structured knowledge files
3. Register cline-researcher as the persistent cline-expert in SESSIONS.md

Total cost: ~15 minutes.
