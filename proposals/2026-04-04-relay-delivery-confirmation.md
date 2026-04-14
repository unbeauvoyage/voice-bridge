---
title: Relay Delivery Confirmation — Agent Visibility into Message Receipt
date: 2026-04-04
status: needs-update
author: system-lead
priority: high
---

> **NEEDS UPDATE (2026-04-13):** Phase 1 of this proposal (synchronous delivery status) was addressed by the lean relay + http-plugin: `POST /send` now calls the agent's HTTP port directly and returns the real HTTP status code. Phase 2 (availability probe at `GET /agents/:name/reachable`) and Phase 3 (end-to-end acknowledgment via `POST /messages/:id/ack`) are still unimplemented. The old relay architecture (WS-based, "always queued") described in Root Cause Analysis no longer applies. This proposal should be updated to reflect what remains to be done on top of the lean relay.

# Relay Delivery Confirmation — Agent Visibility into Message Receipt

**Date:** 2026-04-04T23:45:05
**Author:** system-lead
**Triggered by:** CEO escalation — agent reported "contacted productivitesse" but recipient was unresponsive

---

## The Problem

Agents have zero visibility into whether a message was actually received. The relay always returns:
```json
{"id": "...", "status": "queued"}
```
…regardless of whether channel delivery succeeded or the message is sitting in a disk queue. An agent calling `relay_send` cannot distinguish these two outcomes.

This causes the pattern the CEO experienced: agent reports "I contacted X" with confidence, but X never saw the message.

---

## Root Cause Analysis

### Gap 1 — Relay always returns "queued" (even for channel deliveries)

In `message-relay/src/index.ts:516`:
```typescript
enqueue(msg);
return reply.send({ id: msg.id, status: 'queued' }); // always "queued"
```

`enqueue()` fires channel delivery **asynchronously** and returns immediately. The HTTP response is sent before the delivery attempt completes. So callers never learn the outcome.

### Gap 2 — "Delivered" means "HTTP 200 from plugin", not "agent processed it"

When channel delivery succeeds, `markDelivered()` sets `delivered: true`. But this only means the channel plugin's HTTP `/deliver` endpoint returned 200. It does **not** mean the Claude session received the MCP notification. If the MCP connection between the plugin and Claude is dead (zombie channel), the plugin returns 200 and the message silently disappears.

### Gap 3 — No channel = guaranteed queue, but callers don't know

Currently registered channels: `productivitesse, system-lead, command, jarvis, ux-lead, agentflow-expert, cline-kanban-expert`

**Not registered (no channel):** `consul, hq, voice-bridge, knowledge-base, agency-biz, agency-routers`

consul has **9 undelivered messages** it has never received. Every message sent to consul has silently queued. Agents that messaged consul assumed it was delivered.

### Gap 4 — Terminal dependency (partial)

Channel plugins are spawned as child processes of `claude`. When the terminal kills the claude process (iTerm window close = SIGHUP to process group; cmux kill = kill all panes), the plugin dies. **However:** there is a brief race window where the plugin port is still alive while the MCP connection is already dead — the zombie channel window. The relay's 60s health check can detect this, but only if the plugin actually starts returning non-200.

**cmux vs iTerm:** Not the root cause. Both kill processes when the session dies. The relay itself runs under pm2 and is terminal-independent. The vulnerability is claude+plugin coupling, not the terminal type.

---

## Recommended Fixes — Three Phases

### Phase 1 — Synchronous delivery status (1–2 hours, consul/relay-server)

Change `POST /send` to attempt channel delivery **synchronously** (with a short timeout) before returning, and include the outcome in the response:

```typescript
// NEW response shape
{"id": "...", "status": "channel_delivered" | "queued", "channel": true | false}
```

Implementation: in the `/send` handler, if the target has a registered channel, attempt delivery (2s timeout) before replying. On success → `status: "channel_delivered"`. On failure/timeout → enqueue + `status: "queued"`.

**Agents can then check the response.** If `status: "queued"`, they know delivery is uncertain and can either wait and retry, escalate, or notify the CEO that the agent is unreachable.

### Phase 2 — Availability probe endpoint (half-day, consul/relay-server)

Add `GET /agents/:name/reachable` that:
1. Checks if the agent has a registered channel
2. Does a lightweight ping to the channel port (`GET /health`)
3. Returns `{reachable: true | false, method: "channel" | "queued" | "none"}`

Agents call this before important coordination messages to confirm the recipient is reachable. Command and HQ should call this before telling CEO "I've contacted X."

### Phase 3 — End-to-end acknowledgment (1–2 days, consul/relay-server)

Add `POST /messages/:id/ack` endpoint. Agent sessions call this after processing a message:
```typescript
// Agent processes message, then:
await fetch('http://localhost:8765/messages/' + msg.id + '/ack', { method: 'POST' });
```

This adds `agent_acked_at` timestamp to the message record. Dashboard and relay callers can now distinguish:
- `delivered: false` — never reached channel plugin
- `delivered: true`, no `agent_acked_at` — plugin received it, session may be zombie
- `delivered: true` + `agent_acked_at` — agent session confirmed receipt

The MCP `relay_reply` tool should auto-ack when called — no extra agent code needed for replies.

---

## Immediate Actions (No Code Changes)

Until Phase 1 ships, agents should use this pattern for critical coordination:

1. **Check channel registration first:** `GET /channels` — if target not listed, message is queued, not delivered. State this to CEO: "Consul has no channel registered — message queued, uncertain delivery."

2. **consul has 9 undelivered messages right now.** Command should restart consul with the channel plugin to flush them.

3. **Do not say "contacted X" unless:**
   - X appears in `GET /channels`, AND
   - X has been responsive in the last N minutes (check `GET /status` for recent state change)

---

## Relay Stability Assessment

The relay itself (pm2, port 8765) is stable — terminal-independent. The vulnerability is in the channel plugins (bun processes coupled to claude sessions). Current stability profile:

| Component | Terminal-dependent? | Failure mode | Recovery |
|-----------|-------------------|--------------|----------|
| relay server (pm2) | No | pm2 auto-restarts | Automatic |
| channel plugin (bun) | Yes — dies with claude | Zombie or clean death | Session restart |
| message queue (disk) | No | File corruption (rare) | pruneAllQueues() |
| channel registration | Survives relay restart | Port staleness | 30s heartbeat re-registers |

The relay is as stable as it can be without solving zombie channels (Phase 3). The 60s health check catches most zombies. The race window (plugin alive, MCP dead) is bounded by how long bun takes to exit after claude — typically <5 seconds.

---

## Assign To

consul — this is relay-server infrastructure. Priority order: Phase 1 first (gives agents immediate visibility), then Phase 2 (probing), then Phase 3 (end-to-end acks, pairs with retention policy work).
