---
title: Relay duplicate session churn
date: 2026-04-08T01:29:45
severity: medium
systems: relay, channel-plugin, spawn-session
resolved: true
resolved_by: signal, matrix
summary: Orphan plugin processes from stopped Claude sessions created WebSocket reconnect storms, causing silent message delivery failures to productivitesse
related: []
---

## Incident

CEO reported that messages sent from phone were not reaching the productivitesse agent reliably. Messages showed as delivered in relay logs (SUCCESS via WebSocket) but the Claude session was catching them via a 1-minute polling cron instead of real-time channel notifications.

Detected: 2026-04-07, reported by CEO and productivitesse team lead.

## Root Cause

**Stopped Claude sessions leave orphan child processes.** When a Claude session is stopped (state T) but not fully killed, its child bun processes (channel plugins) survive and continue running. These orphan plugins maintain WebSocket connections to the relay, competing with the active session's plugin for the same agent name slot.

Specifically:
- PID 84623: stopped Claude session for productivitesse (state T)
- PID 84710, 84707: orphan bun children still connecting as "productivitesse"
- The relay slot was contested — each connection evicted the other, cycling every ~1 second
- Messages delivered during the brief window when the orphan held the slot went to a dead MCP transport

This is the same class of bug as earlier orphan incidents (test-tool-check, mass plugin death on 2026-04-06) — all caused by processes surviving beyond their session lifecycle.

## Fix

Three-layer prevention deployed (commits on `feature/websocket-bidirectional`):

**Layer 1 — spawn-session.sh (structural gate):**
Before launching a new session, the script kills any existing Claude process with the same `--name`. No two sessions for the same agent name can coexist.

**Layer 2 — relay superseded notification:**
When a new WebSocket connects for agent X with a different `RELAY_SESSION_ID`, the relay sends `{ type: 'superseded' }` to the old connection before closing it. The old plugin receives this and exits cleanly instead of reconnecting. Session ID passed via query param: `/ws/agent/{name}?session_id={uuid}`.

**Layer 3 — plugin PID file + graceful exit:**
Plugin writes PID to `/tmp/relay-channel-{name}.pid` on startup. If a PID file exists for the same agent, kills the old process first. On receiving `superseded`, exits with `process.exit(0)` (no reconnect). Cleans up PID file on exit.

**Also fixed:** ACK-based delivery — `markDelivered()` now fires on ACK receipt from the plugin, not on `ws.send()`. Unacknowledged messages replay on reconnect.

## Prevention

- Layer 1 prevents duplicates at session launch (normal operation)
- Layer 2 prevents duplicates at the relay level (edge cases escaping spawn script)
- Layer 3 prevents duplicates at the plugin level (self-dedup via PID file)
- All three layers are independent — any single layer alone prevents the issue

## Timeline

| Time | Event |
|---|---|
| 2026-04-07 ~06:00 | CEO reports phone messages not reaching productivitesse |
| 2026-04-07 06:16 | Relay logs show SUCCESS delivery to productivitesse — problem is downstream |
| 2026-04-07 06:26 | Found two productivitesse plugin processes (PID 19856 active, 84623 stopped) |
| 2026-04-07 06:26 | Killed orphans manually, productivitesse delivery restored |
| 2026-04-07 15:29 | Signal deployed PID file fix (Layer 3) + ACK-based delivery |
| 2026-04-08 01:00 | Signal deployed three-layer prevention (Layers 1+2+3) |
| 2026-04-08 01:15 | All 5 agents reconnected cleanly, no churn, verified one connection each |
