---
title: Permission Relay Persistence
date: 2026-04-03
status: done
implemented: 2026-04-14T09:05:32
commit: 3ebf34a
summary: Permissions persisted to _permissions.json (already done in lean relay). Added startup re-notification — relay broadcasts pending records to dashboard and attempts delivery to command on startup. 174 tests pass.
---

> **NEEDS UPDATE (2026-04-13):** This proposal references the old relay's disk paths (`~/.relay/permissions/pending/`) and `queues/` directory. The lean relay replaced the old persistence architecture. The core idea (persist pending permission requests across relay restarts) is still valid but the implementation path must be revised for `relay-lean.ts` and its storage model. The `pendingPermissions` map and `_pending_permissions.json` in the old relay are now the reference point for what was built; this proposal should describe what still needs to be done (if anything) for the lean relay.

## Problem

Pending permission requests are held in relay memory. If the relay restarts while a request is pending (awaiting COMMAND approval), the request is silently lost. The blocked agent never receives a response — it either times out or hangs. COMMAND is never re-notified. The agent's work stalls with no recovery path.

## Plan

### 1. Write pending requests to disk on arrival

When a permission request arrives at the relay, before notifying COMMAND, write it to:

```
~/.relay/permissions/pending/<request-id>.json
```

Schema:
```json
{
  "id": "perm-20260403-abc123",
  "from_agent": "engineer-1",
  "tool": "Bash",
  "command": "rm -rf /tmp/stale-build",
  "requested_at": "2026-04-03T11:00:00Z",
  "status": "pending"
}
```

One file per request. Directory is the queue.

### 2. Restore pending requests on startup

At relay startup, scan `~/.relay/permissions/pending/`. For each file:
- Load the request into the in-memory pending map
- Re-notify COMMAND via channel: "Restored pending permission request from [agent]: [tool] — [command]. Approve or deny."

Requests older than a configurable TTL (default: 1 hour) are auto-expired and removed rather than restored — stale permission prompts for commands that may no longer be relevant are confusing.

### 3. Resolve flow

When COMMAND approves or denies:
- Relay sends response to agent (existing flow)
- Relay deletes the corresponding file from `~/.relay/permissions/pending/`

If the agent that requested permission is no longer running when the relay restores the request, the relay detects this (no active registration for that agent) and discards the file with a log entry.

### 4. COMMAND re-notification format

Restored requests should be clearly marked to avoid confusion:

```
[RESTORED] Pending permission from engineer-1 (requested 11:00am):
  Tool: Bash
  Command: rm -rf /tmp/stale-build
  Approve? (reply approve/deny)
```

### 5. Implementation steps

1. Add `PermissionStore` to relay — mkdir on init, write JSON on request arrival, delete on resolution
2. On relay startup, scan pending dir and rebuild in-memory map
3. For each restored request: check agent is still registered, re-notify COMMAND channel
4. Add TTL expiry: skip restoration of requests older than 1 hour (configurable)
5. Test: relay restart mid-pending-request → COMMAND re-notified → agent receives response
6. Test: relay restart with expired request → file cleaned up, no notification

## Effort estimate

Small — ~50 lines of TypeScript. Same pattern as channel re-registration but simpler (one-directional flow, no health checking).

## Dependencies

- Channel re-registration (proposals/2026-04-03-channel-re-registration.md) — COMMAND must be reachable after restart to receive re-notification
- Permission relay (already running)

## Next Steps

CEO approves → implement alongside channel re-registration (same relay engineer, same sprint) → test with forced relay restart during a pending approval → deploy.
