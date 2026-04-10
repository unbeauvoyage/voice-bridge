---
title: Active Notification System
date: 2026-04-03
status: approved
---
# Active Notification System
**Proposed:** 2026-04-03
**For:** CEO
**Status:** approved

## Problem

The CEO has no active signal when agent work completes. Research results land in `~/environment/proposals/` and `~/environment/answers/` silently. The CEO must manually check these folders or scroll through relay message history. This creates two failure modes: missed results (CEO never sees the work) and delayed action (CEO sees it hours later). As the agent team grows, passive delivery breaks down entirely.

## Proposal

Add a notification layer to the 3D dashboard. When an agent completes work, a holographic notification card floats up in 3D space. The card states what finished, at what urgency, and offers a single-click path to the result. Cards stack newest-on-top. Routine cards auto-dismiss after 30 seconds; important and urgent cards persist until the CEO explicitly dismisses them.

This is a thin layer on top of existing relay infrastructure — no new transport, no polling, no new agent protocols required for the basic case.

## Technical Design

### Trigger Sources

Three independent trigger paths feed into a unified notification queue:

**1. Relay message interception**
The relay server already receives all agent messages. Add a middleware pass that inspects incoming messages:
- Message type `"notification"` → route directly to notification queue with provided urgency
- Message body matches `^DONE` → auto-generate an "Important" notification
- Message body matches `permission request` / `BLOCKED` / `CRASH` → auto-generate "Urgent" notification

This requires no changes to agents that already send DONE messages correctly.

**2. File system watcher (backend)**
A lightweight watcher (Node `fs.watch` or `chokidar`) monitors:
- `~/environment/proposals/` — new `.md` file → Important notification: "Proposal ready: [filename]"
- `~/environment/answers/` — new file → Important notification: "Answer ready: [filename]"

The watcher runs in the relay server process or as a sidecar. On new file, it emits a WebSocket event to the dashboard under the existing relay WebSocket connection.

**3. Permission hook**
When `voice-bridge` or any agent fires a permission request to `/hook/permission/approve`, the relay intercepts it and emits an Urgent notification before forwarding. CEO sees the request in the dashboard before it times out.

### Relay Changes

Add one new message type to the relay protocol:

```json
{
  "type": "notification",
  "from": "agent-name",
  "to": "dashboard",
  "urgency": "important",
  "title": "Research on X complete",
  "body": "Full answer in ~/environment/answers/2026-04-03-X.md",
  "action": {
    "type": "open_file",
    "path": "~/environment/answers/2026-04-03-X.md"
  },
  "timestamp": "2026-04-03T14:32:00Z"
}
```

Agents that want explicit control use:
```
relay_send(to: "dashboard", type: "notification", message: "Research on X complete. See answers/...", urgency: "important")
```

Agents that don't change anything get auto-promoted DONE messages. Both paths produce identical notification cards.

### Dashboard Rendering (React Three Fiber)

**NotificationCard component** — a `<mesh>` panel rendered in 3D space above the main hierarchy view:
- Positioned at a fixed screen-space anchor (top-right quadrant, offset from agent nodes)
- Cards stack along the Y axis, newest card at lowest Z offset (front)
- Each card: title line, one-line body, dismiss button, optional "View" button
- Urgency determines emissive glow color (see matrix below)
- Auto-dismiss timer renders as a depleting arc around the card border (routine only)

**State management:**
- `notifications[]` array in dashboard state, keyed by `id` (UUID from relay)
- WebSocket message handler appends to array on `type: "notification"`
- Dismiss removes by id
- Auto-dismiss sets a `setTimeout` on card mount for routine items (30s)

**Click actions:**
- "View" button for `open_file` action → opens existing file viewer panel in dashboard
- "View" button for `open_message` action → opens relay message thread
- "Approve" / "Deny" buttons for permission requests → POST to `/hook/permission/approve` or `/deny`

## Urgency Matrix

| Level | Color | Glow | Auto-dismiss | Examples |
|---|---|---|---|---|
| **Urgent** | Red (`#ff3333`) | Pulsing red halo | Never — requires action | Security alert, permission block, agent crash, BLOCKED message |
| **Important** | Gold (`#ffcc00`) | Steady gold rim | Never — requires acknowledgement | Research complete, proposal ready, answer ready, DONE from CEO-initiated task |
| **Routine** | Blue (`#3399ff`) | Faint blue edge | 30 seconds | Background agent status change, heartbeat, non-critical completion |

Urgency is set explicitly by the sender, or inferred by relay middleware:
- `DONE` from a message thread the CEO initiated → Important
- `DONE` from background maintenance → Routine
- Anything mentioning `BLOCKED`, `crash`, `error`, `permission` → Urgent

## Next Steps

1. **CEO approves** this proposal (or requests changes)
2. **Relay server** — add notification message type + DONE auto-promotion middleware (1 session)
3. **File watcher** — add `chokidar` watcher to relay process for `proposals/` and `answers/` (half session)
4. **Dashboard** — add `NotificationCard` component + WebSocket handler + state slice (1–2 sessions)
5. **Permission hook integration** — wire `/hook/permission/approve` events into notification stream (half session)
6. **Test** — send a test DONE message, verify card appears, verify urgency levels render correctly

Total estimated scope: 3–4 focused sessions. Can be done in parallel across relay and dashboard if two engineers are assigned.
