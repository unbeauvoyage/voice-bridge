---
title: Inbox Retention Policy — Message TTL and Storage Architecture
date: 2026-04-04
status: pending
author: system-lead
---

# Inbox Retention Policy — Message TTL and Storage Architecture

**Date:** 2026-04-04T08:15:12
**Author:** system-lead
**Priority:** High — inbox at 755 items after 2 days, projected 40,000+ in 100 days

---

## What Is Currently Stored and Where

Messages are persisted as JSONL files at `message-relay/queues/{agent}.jsonl`.

Every sent message generates **two writes**: one to the recipient's queue file, one echo copy to the sender's queue file. A message from agent A to agent B appears in both `A.jsonl` and `B.jsonl`.

The relay prunes each queue file hourly, keeping:
- All **undelivered** messages (no TTL — grow without bound until delivered)
- Last **50 delivered** messages per agent (`DELIVERED_KEEP = 50` in `persistence.ts:143`)

The current queue depth of **1,387 undelivered messages** indicates a large backlog of messages addressed to agents whose channel is dead (no channel port registered). These messages will never be delivered until those sessions restart — they accumulate indefinitely.

The CEO's inbox count (755) comes from the dashboard reading all messages from the relay store, likely via the WebSocket broadcast or `/messages/ceo` endpoint. The 50-delivered-per-file pruning limits disk growth but does not control what the dashboard displays.

---

## Root Causes of Inbox Overflow

1. **No TTL on delivered messages at the application level** — `done`/`status` messages delivered 3 weeks ago remain visible indefinitely.
2. **No TTL on undelivered messages** — Messages to agents with dead channels accumulate forever.
3. **Echo copies double all counts** — Every message appears in both sender and recipient queues, potentially double-counting in dashboard views.
4. **No acknowledgment mechanism** — CEO has no way to clear/dismiss messages; inbox only grows.

---

## Recommended Retention Policy

### Tier by message type:

| Type | Delivered TTL | Undelivered TTL | Rationale |
|------|--------------|----------------|-----------|
| `done` | 48 hours | 7 days | Status noise — CEO doesn't need "X is done" from last week |
| `status` | 48 hours | 7 days | Same — informational updates expire fast |
| `message` | 7 days | 14 days | General comms — short relevance window |
| `waiting-for-input` | Never (until acknowledged) | 30 days | Requires CEO action — must persist |
| `escalate` | Never (until acknowledged) | 30 days | Critical — must persist |

### Implementation — Two phases:

**Phase 1 (short-term, ~1 day of work):**
Add a `ttl_hours` field to persisted messages based on type. Extend `pruneQueue()` in `persistence.ts` to also drop delivered messages older than their TTL. This is a ~20-line change to `pruneQueue`. Runs on the existing hourly prune cycle.

```ts
// In pruneQueue — add TTL check
const TTL: Record<string, number> = {
  done: 48, status: 48, message: 168, 'waiting-for-input': Infinity, escalate: Infinity
};
const delivered = messages.filter(m => {
  if (!m.delivered) return false;
  const ttl = TTL[m.type ?? 'message'] ?? 168;
  if (!isFinite(ttl)) return true;
  const age = Date.now() - new Date(m.delivered_at ?? m.ts).getTime();
  return age < ttl * 3600 * 1000;
});
```

Also add undelivered TTL: drop undelivered messages older than their type's undelivered TTL. This clears the 1,387 dead-channel queue backlog on the next prune cycle.

**Phase 2 (medium-term, ~2-3 days):**
Add CEO acknowledgment to the relay:
- `POST /surface/acknowledge` — marks message IDs as acknowledged by CEO
- `GET /surface/acknowledged` — returns acknowledged ID set
- Dashboard `InboxPanel` excludes acknowledged messages from Zone 1 count
- `pruneQueue` drops acknowledged messages after 24 hours

This is the same pattern as `_pending_permissions.json` already in `persistence.ts:90`.

**Phase 3 (long-term):**
Migrate to SQLite (already in BACKLOG as "Structured event logging"). Enables proper `WHERE type = 'waiting-for-input' AND NOT acknowledged` queries. Phase 1 buys time until SQLite is ready.

---

## What CEO Needs to Keep Long-Term

- `waiting-for-input` and `escalate` messages — until acknowledged
- Proposals (these are files, not relay messages — unaffected)
- Q&A answers (files, not relay messages — unaffected)
- Problem Log entries (files — unaffected)
- Everything else: ephemeral noise. 48–168 hours is more than enough.

---

## Immediate Action

Before Phase 1 ships: manually prune the undelivered queue now to give the CEO immediate relief:
```bash
# Count queued messages per agent
wc -l message-relay/queues/*.jsonl | sort -n
```
Dead-agent queues (agents no longer running) can be cleared immediately — those messages will never be delivered.

---

## Assign To
consul — this is relay-server infrastructure work.
