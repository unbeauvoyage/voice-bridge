---
title: Channel Re-Registration on Relay Restart
date: 2026-04-03
status: approved — implemented 2026-04-03
---

## Problem

Channel registrations are held in memory. When the relay restarts (deploy, crash, manual restart), all plugin registrations are lost. Agents continue sending to the relay but messages are dropped silently — no error, no delivery. The system appears healthy but messages are not reaching agents.

## Plan

### 1. Persist registrations to disk

On every registration or deregistration event, write the full registration map to a JSON file:

```
~/.relay/registrations.json
```

Schema:
```json
{
  "agents": {
    "command": {
      "plugin_url": "http://localhost:3100",
      "channel": "command",
      "registered_at": "2026-04-03T10:00:00Z",
      "last_seen": "2026-04-03T12:34:56Z"
    }
  }
}
```

Writes are synchronous (small file, infrequent writes — no async complexity needed).

### 2. Load and validate on startup

At relay startup, read `registrations.json`. For each stored registration:
- Attempt a `GET /health` (or equivalent ping) to the plugin URL
- If healthy: restore registration into memory, log "restored: <agent>"
- If unreachable: mark stale, log "stale: <agent> — skipping", do not restore

This prevents restoring dead registrations from crashed or shutdown sessions.

### 3. Plugin health polling

Add a background health poll loop (interval: 30s) that pings all registered plugin URLs. On failure (3 consecutive misses):
- Remove registration from memory
- Remove from `registrations.json`
- Log: "unregistered <agent>: plugin unreachable"

This cleans up zombie registrations without requiring manual intervention.

### 4. Agent auto-re-register on message failure

When an agent's plugin receives a message and the relay-side registration is missing (e.g., relay restarted after plugin was last seen), the plugin should re-register on next startup. Plugins already do this at launch — the persistence layer just ensures the relay side is warm on restart too.

### 5. Implementation steps

1. Add a `RegistrationStore` class to relay — wraps the in-memory map with read/write to `registrations.json`
2. Replace all direct map mutations with `RegistrationStore` calls
3. Add startup validation: load file → health-check each entry → restore valid ones
4. Add background health poll loop with 3-strike eviction
5. Write tests: restart relay with stored registrations, verify agents receive messages immediately without re-registering
6. Document: note in relay README that registrations.json is relay state, not config — do not edit manually

## Effort estimate

Small — ~60 lines of TypeScript. No new dependencies (Node `fs` for JSON persistence).

## Dependencies

- Relay HTTP server (already running)
- Plugin HTTP servers must expose a `/health` or `/ping` endpoint (verify or add)

## Next Steps

CEO approves → relay engineer implements RegistrationStore → integration test with COMMAND session restart → deploy.
