---
title: Autonomous Backlog Execution (Kanban Auto-Pull)
date: 2026-04-03
status: approved
---

## Problem

Agents sit idle between tasks, waiting for COMMAND to manually assign work. When a task completes and unblocks downstream items, nothing triggers the next activation — the manager must notice and push. This creates unnecessary latency and requires COMMAND attention for routine task flow.

## Plan

### 1. Extend BACKLOG.md task format

Add structured fields to each backlog item:

```
- id: TASK-042
  title: Add retry logic to relay
  status: ready | blocked | active | done
  assigned: null | <agent-name>
  depends-on: [TASK-038, TASK-039]
  effort: S | M | L
```

Tasks with no `depends-on`, or whose dependencies are all `done`, are "ready". Tasks with unmet dependencies are "blocked".

### 2. Relay idle-detection endpoint

Add a `/status/idle` POST endpoint to the relay. When an agent finishes a task, it calls this endpoint with its name and completed task ID. The relay:
- Marks the task as `done` in BACKLOG.md
- Scans for tasks that were `blocked` on that task ID
- Promotes newly unblocked tasks to `ready`
- Scans for idle agents (agents with no active assignment)

### 3. Task assignment logic

When idle agents exist and ready tasks exist, relay assigns the next task:
- Pull highest-priority ready task (order in BACKLOG.md = priority)
- POST to `/relay/send` targeting the idle agent with task details
- Mark task `active`, set `assigned: <agent>`

Agents not registered as idle-capable are skipped (opt-in flag in agent registration).

### 4. Agent idle reporting

Team leads emit an idle signal after completing work. Two paths:
- Explicit: agent calls `relay_send(to: "relay", message: "/idle")` 
- Implicit: relay detects no activity from agent for N minutes (configurable, default 5m)

Idle signal triggers the assignment scan above.

### 5. Completion/unblock flow

```
Agent DONE → POST /status/idle {agent, task_id}
           → relay marks task done
           → relay scans depends-on graph
           → unblocked tasks → status: ready
           → idle agents exist? → assign next task
           → no idle agents? → queue for next idle signal
```

### 6. COMMAND override

COMMAND retains manual assignment authority. Any task can be force-assigned with `/assign <task-id> <agent>`. Manual assignment bypasses the queue.

### 7. Implementation steps

1. Define and document the extended BACKLOG.md task schema
2. Write a BACKLOG.md parser (TypeScript, ~40 lines) that reads/writes task fields
3. Add `/status/idle` endpoint to relay server
4. Implement dependency graph scan (topological — mark newly unblocked tasks ready)
5. Add idle agent registry (in-memory map, keyed by agent name)
6. Wire assignment logic: idle signal → scan ready tasks → assign
7. Add `/assign` override command for COMMAND
8. Update agent startup instructions to emit idle signal on task completion
9. Test with two agents, one linear dependency chain

## Effort estimate

Medium — ~100 lines of TypeScript across relay additions, plus BACKLOG.md schema migration for existing items.

## Dependencies

- Relay HTTP server (already running)
- Agents must support receiving task assignments via channel message (already done)
- BACKLOG.md items need manual schema migration (one-time)

## Next Steps

CEO approves → assign to relay engineer agent → implement in relay repo → test with live backlog items.
