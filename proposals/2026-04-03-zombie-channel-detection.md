---
title: Zombie Channel Detection
date: 2026-04-03
status: pending
---

## Problem

A plugin's HTTP server runs in the agent's Claude Code session. When the MCP connection between Claude Code and the plugin drops (timeout, session reset, app crash), the HTTP server may keep running — it's a separate process. The relay can still POST to that HTTP server and receive 200 responses, so it believes delivery succeeded. But no MCP connection means no agent receives the message. Messages are silently swallowed.

This is the "zombie channel" state: plugin HTTP server alive, MCP connection dead.

## Plan

### 1. MCP connection health tracking in the plugin

The plugin tracks whether its MCP connection is active. When the MCP connection drops:
- Plugin sets an internal flag: `mcp_connected = false`
- Plugin stops accepting new messages — returns `503 Service Unavailable` on all POST /message requests
- Relay receives 503, marks agent unreachable, queues or returns error to sender

When MCP reconnects (session restart, tool reinvocation):
- Plugin sets `mcp_connected = true`
- Plugin resumes accepting messages

### 2. Relay handling of 503

Relay already handles non-200 responses as delivery failures. Ensure 503 specifically triggers:
- Log: "zombie detected: <agent> plugin alive but MCP disconnected"
- Notify sender: message undelivered, agent unreachable
- If sender is COMMAND: surface alert via speak/notify
- Remove from active registration or mark as zombie (distinct from fully unreachable)

### 3. Relay echo/heartbeat

Relay sends a lightweight heartbeat to all registered plugins every 60 seconds:

```
POST /heartbeat  →  200 OK (MCP connected)
                    503      (MCP disconnected / zombie)
                    timeout  (HTTP server dead)
```

Three states map to three relay behaviors:
- 200: healthy, no action
- 503: zombie — mark agent unavailable, notify COMMAND
- timeout: dead — unregister, notify COMMAND

### 4. Delivery receipts

Add an optional delivery receipt flow for high-priority messages:

1. Relay sends message with `receipt_required: true` header
2. Plugin, on successful MCP delivery to Claude Code tool handler, POSTs back to relay: `POST /receipt {message_id, delivered_at}`
3. Relay marks message delivered
4. If no receipt within 10s: relay retries once, then marks failed

Delivery receipts are opt-in per message. Default: fire-and-forget (current behavior). COMMAND-to-agent messages use receipts; agent-to-agent routine messages do not.

### 5. Plugin implementation: MCP connection detection

MCP SDKs expose connection lifecycle events. Plugin hooks:
- `onConnect` → set `mcp_connected = true`
- `onDisconnect` / `onClose` → set `mcp_connected = false`

If the SDK does not expose these events, use a watchdog: plugin tool handler updates a `last_tool_call` timestamp on every invocation. HTTP handler checks: if `now - last_tool_call > 5min` → return 503 (conservative — assumes stale).

### 6. Implementation steps

1. Add MCP connection state tracking to plugin HTTP server
2. Return 503 when `mcp_connected = false`; return 200 when connected
3. Add relay heartbeat loop (60s interval, hits `/heartbeat`)
4. Add zombie state to relay's agent registry (healthy / zombie / dead)
5. Notify COMMAND on zombie detection via channel
6. Add delivery receipt flow (relay side: expect receipt within 10s; plugin side: POST receipt on tool handler invocation)
7. Test: kill MCP connection while HTTP server runs → relay detects zombie within 60s
8. Test: receipt timeout → retry + failure notification

## Effort estimate

Medium — ~80 lines across plugin and relay. MCP disconnect detection is the fiddly part; receipt flow adds another ~30 lines.

## Dependencies

- Plugin HTTP server (already exists)
- MCP SDK connection lifecycle events — verify availability in current SDK version before starting

## Next Steps

CEO approves → relay engineer + plugin engineer pair on this (two repos) → test in staging with forced MCP disconnect → deploy with heartbeat interval configurable via env var.
