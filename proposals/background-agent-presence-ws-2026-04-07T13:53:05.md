---
title: "Background Agent Presence: Status-Only WebSocket Registration"
proposedBy: prism
agent: productivitesse
status: pending
ts: 2026-04-07T13:53:05
updated: 2026-04-07T13:53:05
summary: "Non-interactive background agents are currently invisible to the dashboard — they never appear in /channels because they don't need to receive messages. A lightweight status-only WebSocket connection (no channel plugin, no message handling) would let these agents register presence with the relay, making them visible as alive vs absent without adding communication overhead."
---

# Background Agent Presence: Status-Only WebSocket Registration

**Submitted:** 2026-04-07T13:53:05  
**Author:** prism (ux-expert)  
**Surface:** Relay protocol + dashboard agent status panel  
**Scope:** Small — lightweight WS client + dashboard rendering

---

## Context

The relay WebSocket refactor made agent liveness a clean binary: WS connection open = registered and alive. This works perfectly for interactive agents running the channel plugin.

Non-interactive agents (background workers, one-shot runners, long-running scanners) never open a WS connection — they only send via HTTP POST `/send`. From the relay's perspective, they do not exist. From the dashboard's perspective, they are invisible.

---

## Problem

The CEO currently has zero visibility into whether background agents are running. A background agency scanner could crash at 2am — the CEO would not know until they noticed missing results. The only ground truth is SESSIONS.md, which requires manual cross-referencing.

This is a visibility gap that the WS refactor creates the opportunity to close cheaply.

---

## Proposal

Allow non-interactive agents to open a **status-only WebSocket connection** to the relay — a minimal connection that signals presence without enabling message delivery.

### What it is not
- Not the full channel plugin
- No MCP push, no message handling, no relay_send/relay_reply tooling
- No heartbeat required (WS connection alive = agent alive)

### What it is
- A single persistent WS connection opened at agent startup, held until exit
- On connect: agent sends a minimal registration payload `{ "agent": "name", "type": "status-only" }`
- Relay registers the agent in the known-agent registry as present
- On disconnect: relay marks agent as offline (same as any other WS drop)

### Implementation options

**Option A — Shell script (simplest)**
```bash
# One-liner a background agent can add to its startup
websocat ws://localhost:8765/presence &
PRESENCE_PID=$!
trap "kill $PRESENCE_PID" EXIT
```

**Option B — Tiny Bun script**
```typescript
// presence.ts — drop-in for any agent
const ws = new WebSocket("ws://localhost:8765/presence");
ws.onopen = () => ws.send(JSON.stringify({ agent: process.env.RELAY_AGENT_NAME }));
process.on("exit", () => ws.close());
```

**Option C — Built into spawn-session.sh**
Non-interactive sessions spawned via the script automatically open a presence connection. Zero per-agent work.

Option C is the most leverage — one change covers all background agents.

---

## Relay Changes

Add a `/presence` WebSocket endpoint (or extend `/channels` to accept a `status-only` flag):
- Accept connection
- Register agent name in known-agent registry
- On disconnect: mark offline
- Do NOT route messages to this connection

Estimated relay change: ~20-30 lines.

---

## Dashboard Changes

None beyond what the `dashboard-agent-status-known-absent` proposal already specifies. The offline/connected rendering already handles this — background agents with a presence WS show as connected, without one show as offline.

---

## CEO Experience Outcome

Before: Background scanner crashes — CEO notices missing results hours later.  
After: Background scanner shows offline on dashboard immediately — CEO sees the gap and can act.

This closes the visibility gap between interactive agents (always visible) and background agents (currently invisible) without requiring background agents to handle messages or run the full channel plugin.

---

## Tradeoffs

| Option | Pros | Cons |
|--------|------|------|
| **This proposal** — status-only WS | Full visibility, minimal overhead, no message handling | Small relay change needed, WS connection held open |
| Status quo | No changes | CEO blind to background agent health |
| SESSIONS.md cross-ref only | No relay changes | Requires manual SESSIONS.md maintenance, no real-time liveness |

**Recommendation:** Implement Option C (built into spawn-session.sh) + relay `/presence` endpoint. Maximum coverage, minimal per-agent work.
