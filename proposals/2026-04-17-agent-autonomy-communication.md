---
date: 2026-04-17
author: chief-of-staff
status: draft — awaiting CEO review
summary: Resolves contradictions across our autonomy/communication discussions. One coherent model: files are state, relay is ping-only, agents are ephemeral workers, quality gates are automated.
---

# Agent Autonomy + Communication Model

## The Contradiction We've Been Living With

We have accumulated conflicting approaches:
- Relay messages with full content vs. "check your inbox" pings
- Persistent agents vs. spawn-per-task
- Direct coupling (SendMessage with instructions) vs. file-based decoupling
- Team-lead coordination vs. full coder autonomy
- Sonnet leads vs. Haiku leads

These aren't wrong ideas — they're right ideas applied inconsistently. This proposal picks one coherent model.

---

## Chosen Model: Files Are State, Relay Is Signal

### Core Principle

**Files hold everything. Relay carries nothing except "something changed."**

| Concern | Mechanism |
|---|---|
| Task assignments | Task list (TaskCreate/TaskUpdate) |
| Coder completion reports | `.worklog/{feature}.md` (append) |
| Next-up items | New tasks created before coder shuts down |
| Agent-to-agent content | Never relay — write to a file, ping |
| CEO decisions | Written to task/backlog, agent reads it |
| Architecture / direction | `CLAUDE.md`, agent defs, proposals/ |

Relay messages are only ever one of:
- `"New task available — check task list"`
- `"Your task {id} has a blocker resolved"`
- `"Review ready at .worklog/{feature}.md"`
- `"Shutdown request"`

No content. No instructions. No summaries. If you need to pass content to another agent — write a file, send a ping.

### Why This Resolves the Contradiction

Direct coupling (passing instructions via relay) creates brittle dependencies: agent B needs agent A's context to understand what agent A meant. That context lives in A's session, not B's. B gets confused, asks for clarification, burns tokens.

File-based decoupling means agent B reads the file cold with full context. Files are permanent, relay messages are transient and lossy under compaction.

---

## Agent Lifecycle: Ephemeral by Default

### Model

```
Team lead (Haiku, persistent per project)
  → spawns coder with: goal + relevant file paths
  → coder reads files, forms own plan, creates next-ups, works
  → coder commits + writes .worklog/{feature}.md + creates next-up tasks
  → coder shuts down
  → team lead gets ping: "task complete, check task list"
  → team lead spawns next coder who self-claims from task list
```

### Why persistent team-lead + ephemeral coders

- Team lead accumulates project context over time (what shipped, what's blocked, CEO preferences)
- Coders need zero project context — they read the code and figure it out
- Fresh coder per task = clean context = no stale assumptions bleeding into new work
- Coder's knowledge is captured in commits + worklogs before they exit — nothing lost

### When to spawn vs reuse

| Situation | Action |
|---|---|
| Same task, mid-work | Keep alive |
| Task complete, new unrelated task | Shut down, spawn fresh |
| Task complete, review feedback on same code | Shut down, spawn fresh (reads the PR comments cold) |
| Blocked waiting for CEO | Keep alive (has task context, will resume) |
| Idle > 30 min with no task | Shut down |

---

## Quality Without Direct Coupling

### The problem with review loops

Old model: coder → SendMessage(reviewer) → reviewer reads code → SendMessage(coder with feedback) → coder fixes.

This is direct coupling. Reviewer needs to be alive when coder finishes. Coder needs to be alive when reviewer responds. Both accumulate stale context.

### New model: file-based review gate

```
Coder finishes
  → commits to feature branch
  → writes .worklog/{feature}-review.md: "please review commit {hash}, branch {name}, focus areas: X, Y"
  → creates task: "Review {feature}" in task list
  → shuts down

Team lead sees new task
  → spawns reviewer (fresh, reads the worklog + git diff)
  → reviewer writes .worklog/{feature}-review-feedback.md
  → reviewer creates task: "Address review feedback: {specific item}" for each issue
  → reviewer shuts down

Team lead sees new tasks
  → spawns fresh coder who reads the feedback file and fixes
```

No agent needs to stay alive for another agent. The file is the handoff.

---

## Autonomy Levels

### What team-leads decide autonomously (no CEO input needed)
- Which coder to spawn next
- Whether review is needed (use judgment: trivial fix = no review, new feature = review)
- When to shut down idle agents
- How to sequence tasks from the task list

### What requires CEO approval
- Merging feature branch → dev
- Merging dev → main
- Spawning Opus agents (cost)
- Any action outside the project directory
- Architectural decisions not in existing proposals

### What the CEO never needs to do
- Tell agents what the next task is (task list drives this)
- Chase agents for status (worklog + task list is the status)
- Unblock agents waiting for each other (file handoffs remove coupling)

---

## Push Model for CEO Notifications

CEO should be notified only when:
1. A feature branch is ready for testing
2. A blocker requires CEO decision (new, not restated)
3. A critical failure (build broken, relay down, etc.)

Not when:
- A task completes (team lead handles it)
- A coder shuts down (expected, not interesting)
- A review starts (internal team event)

Notification mechanism: relay message of type `waiting-for-input` to `ceo`. One message per event. No follow-up until CEO responds.

---

## pg_notify Integration (From Relay Proposal)

With the unified relay server (separate proposal), pg_notify replaces relay pings for internal coordination:

- Task updated → `pg_notify('agent_events', {table:'tasks', op:'UPDATE', row:{...}})` → WebSocket broadcast → relevant agents wake
- No relay message needed for "task available"
- Relay messages reserved for: human-facing notifications only

This is the endgame: relay is for CEO ↔ agents, pg_notify is for agents ↔ agents.

---

## Migration: Where We Are Now vs This Model

| Current | Target |
|---|---|
| Relay messages carry content | Relay carries pings only |
| Persistent coders reused across tasks | Ephemeral coders, fresh per task |
| Team-lead decomposes goals | Coders plan their own work |
| Review via SendMessage chains | Review via .worklog files + task list |
| CEO notified on many events | CEO notified only on waiting-for-input |
| Direct coupling between agents | File-based handoffs |

Migration is behavioral, not technical. No code changes needed except:
1. Update team-lead.md to enforce file-based handoffs (already partly done)
2. Update coder.md to write review-ready worklog before shutdown (done)
3. Update CLAUDE.md relay section to say "ping only, no content"

---

## Open Questions for CEO

1. **Review gate**: should every feature require a code-reviewer pass, or only features above a certain complexity? (Proposed: team lead judges — simple fixes skip review)
2. **CEO notification threshold**: is "waiting for merge approval" the right trigger, or should CEO also get notified on significant architectural decisions by coders?
3. **pg_notify timeline**: this depends on the unified relay server. Proceed in parallel or wait?
