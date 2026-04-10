---
title: Dynamic Agent/Team Hierarchy in 3D View
date: 2026-04-03
status: approved
---
# Proposal: Dynamic Agent/Team Hierarchy in 3D View

**Status:** Draft
**Author:** Command
**Date:** 2026-04-03

## Problem
The 3D dashboard currently shows a static set of known agents as planets. But the system now spawns sub-agents dynamically (TeamCreate writers, reviewers, testers). These are invisible — CEO can't see who's working on what.

## Goal
Every agent (main + sub-agents + team-create agents) visible as a planet. Teams zoomable to reveal members. Real-time status via hooks.

## Design

### 1. Agent Discovery
The relay already knows all registered agents (`/status` endpoint returns agent list + state). Extend this:

- **Relay endpoint:** `GET /agents/hierarchy` — returns tree structure:
  ```json
  {
    "productivitesse": {
      "state": "busy",
      "role": "team-lead",
      "children": [
        {"name": "Feature-Last-Page-Writer", "state": "busy", "branch": "feature/last-page"},
        {"name": "Feature-Last-Page-Reviewer", "state": "idle", "branch": "feature/last-page"},
        ...
      ]
    }
  }
  ```
- **Agent registration:** When TeamCreate spawns an agent, it sends a relay message: `{type: "agent-spawned", parent: "productivitesse", child: "Feature-X-Writer", role: "writer", branch: "feature/x"}`
- **Relay tracks parent-child relationships** in memory (no persistence needed — rebuilds on reconnect)

### 2. 3D Visual Structure
- **Top level:** Main agents as large planets (existing)
- **Team cluster:** When a main agent has children, render them as smaller moons orbiting the parent planet
- **Zoom interaction:** Click/scroll on a team planet to zoom into the cluster — moons spread out, labels become readable
- **Zoom out:** Click background or press Escape to return to top-level view
- **State colors:** busy=green pulse, idle=dim blue, error=red, done=gold

### 3. Zoom/Drill-Down Model
- **Level 0:** All main agents visible (current view)
- **Level 1:** Click a team lead planet — camera smoothly zooms to show that team's sub-agents as orbiting moons
- **Level 2:** (future) Click a sub-agent moon — shows that agent's current task, branch, recent commits
- Use R3F camera animation (lerp position/target over ~500ms)

### 4. Hooks for Real-Time Status
Claude Code hooks can fire on agent events. The relay should expose a WebSocket event stream:

- **`agent-spawned`** — new planet appears (animate in)
- **`agent-state-changed`** — planet color/pulse changes
- **`agent-done`** — planet flashes gold, notification card floats up
- **`agent-removed`** — planet fades out

Dashboard subscribes to these via existing WebSocket connection to relay.

### 5. Data Flow
```
TeamCreate spawns agent
  → relay_send("agent-spawned", {parent, child, role, branch})
  → relay broadcasts via WebSocket
  → Dashboard receives, adds moon to parent's orbit
  → Agent works, sends status updates
  → Dashboard updates planet state in real-time
  → Agent signals DONE
  → Dashboard flashes gold, triggers notification
```

### 6. Implementation Phases
1. **Phase 1:** Relay `/agents/hierarchy` endpoint + agent-spawned/removed events
2. **Phase 2:** Dashboard renders moons for child agents (static positions)
3. **Phase 3:** Zoom interaction (click to drill into team)
4. **Phase 4:** Real-time state colors + notification integration

## Dependencies
- Relay server changes (new endpoint + event types)
- Dashboard 3D scene changes (moon rendering, camera animation)
- Agent convention: all TeamCreate calls must register via relay

## Risks
- Too many sub-agents could clutter the view — need smart clustering/hiding for 20+ agents
- Performance: R3F with 50+ animated objects — may need instanced rendering
- Agent naming must be consistent for parent-child tracking
