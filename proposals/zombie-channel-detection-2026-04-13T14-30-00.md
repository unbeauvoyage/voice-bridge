---
title: Zombie Channel Detection
date: 2026-04-13T14:30:00
status: proposed
author: chief-of-staff
summary: Plugin HTTP server returns 200 but MCP transport to Claude session is dead — lean relay sees HTTP 200 and logs delivery as successful, message silently dropped. Three options evaluated; recommendation is Option A (plugin returns 503 when MCP is unavailable).
---

## Failure Mode

The channel plugin runs two connections simultaneously:

1. **HTTP server (inbound)** — plugin listens on a port registered in a port file; the lean relay reads this port file and POSTs to `http://127.0.0.1:{port}/message`
2. **MCP stdio transport** — plugin serves the Claude Code session over stdin/stdout

The lean relay's delivery flow (`relay-lean.ts`, ~line 310-330):
1. Read port file for recipient agent
2. POST to `http://127.0.0.1:{port}/message` with message JSON
3. HTTP 200 → log `delivered: true`
4. ECONNREFUSED → delete stale port file, queue message (self-healing already in place)

When the Claude session dies (crash, timeout, user closes terminal), the MCP stdio transport closes. But the plugin process keeps running — its HTTP server stays bound to the port. When a message arrives, the relay POSTs successfully, the plugin's HTTP handler fires, calls `sendNotification()`, which calls `mcp.notification(...)`. That call throws (transport closed), the retry loop exhausts 3 attempts over ~1s, and the message is silently dropped. The relay already got HTTP 200 — it logged delivery as successful.

**Why it's hard to detect:** The relay has no visibility into the MCP transport. From the relay's perspective, the agent's port file is valid and the HTTP POST succeeded. No 503, no timeout, no error on the relay side. The existing `TRANSPORT_DEAD_THRESHOLD_MS = 30s` watchdog in the plugin will eventually self-terminate — but that's 30s of silent message loss, and only if a message arrives to trigger the failure path.

**Self-healing already in place:** The lean relay already handles ECONNREFUSED by deleting the port file and queuing the message. The zombie gap is narrower than in the old relay — only the HTTP-alive/MCP-dead window remains.

---

## Options

### Option A — Plugin self-check: return 503 when MCP connection is unavailable (recommended)

When `sendNotification()` fails, the plugin already knows the MCP transport is dead. Currently it silently drops the message after retries and returns HTTP 200. Change: instead of returning 200, the plugin HTTP handler returns 503 when MCP is not available. Relay receives 503, re-queues the message, and deletes the port file to mark the agent unreachable. Plugin triggers its own shutdown immediately after first sustained MCP failure rather than waiting 30s.

**Tradeoffs:**
- Pro: minimal change (10–15 lines), fixes the silent loss gap immediately
- Pro: relay already handles ECONNREFUSED queuing — 503 handling follows the same pattern
- Con: relay needs a small addition to treat 503 the same as ECONNREFUSED (delete port file + queue)
- Effort: small (~30 lines across plugin + relay)

### Option B — Relay heartbeat: periodic HTTP echo agents must respond to

Relay POSTs a `{ type: "ping", id: "..." }` to `http://127.0.0.1:{port}/message` every 30s for every registered port file. Plugin must return HTTP 200 with `{ pong: id }` within N seconds — but only if MCP is live. No valid pong (or 503) = relay marks agent zombie, queues subsequent messages, deletes port file.

**Tradeoffs:**
- Pro: catches zombies even when no message is in flight
- Pro: relay-side only change for detection logic
- Con: plugin could return 200 with pong while MCP is still dying — same root problem, one level up, unless plugin checks MCP health before responding
- Con: adds up to 30s steady-state latency to zombie detection if no messages are flowing
- Effort: medium (~50 lines relay side); does not fully solve the problem without combining with Option A

### Option C — Delivery receipts: agent session acks through the session

After the Claude session processes a channel notification (tool handler fires), agent sends an explicit `relay_reply` back to sender confirming receipt. Sender-side timeout triggers retry or failure alert.

**Tradeoffs:**
- Pro: true end-to-end confirmation — proves the LLM session actually received the message
- Con: requires every agent to implement ack behavior; breaks existing fire-and-forget contract
- Con: high overhead for routine messages; ack storms under load
- Con: silent failure if agent is busy (processing takes >N seconds legitimately)
- Effort: large; behavior change for all agents

---

## Recommendation

**Option A** — 503 on MCP failure, immediate plugin self-termination.

It closes the specific gap (silent ack when transport is dead) with the smallest blast radius. The plugin already detects MCP failure; it just needs to signal that upstream instead of swallowing it. Option B is a useful complement (proactive zombie sweep), but does not substitute for A. Option C is the right long-term answer for critical messages but is too invasive as the primary fix.

**Implementation plan:**
1. Plugin HTTP handler: check MCP transport liveness before returning 200; return 503 with `{ error: "mcp_dead" }` if transport is closed
2. Relay handler: treat HTTP 503 the same as ECONNREFUSED — delete port file, re-queue message as undelivered
3. Plugin: after `sendNotification()` exhausts retries, call `process.exit(1)` immediately (don't wait 30s)
4. Optional follow-on: add relay heartbeat (Option B) for proactive detection between messages

**Assign to:** relay engineer + channel-plugin owner (two files: `relay-lean.ts`, `channel-plugin/index.ts`)

**Effort:** 1–2 days. Relay change is ~20 lines; plugin change is ~10 lines. Testing requires forcing MCP transport close while the plugin HTTP server stays bound — achievable with a mock session.
