---
title: "Robust Communication System — Problems, Root Causes & Solutions"
proposedBy: signal
status: pending
created: 2026-04-06T01:53:58
summary: "Comprehensive overhaul of the relay communication system addressing 7 recurring failure classes: session duplication, zombie channels, silent delivery failure, relay restart amnesia, queue rot, missing delivery confirmation, and no sender authentication."
---

# Robust Communication System — Problems, Root Causes & Solutions

**Author:** signal (communications-expert)
**Date:** 2026-04-06T01:53:58
**Requested by:** CEO
**Scope:** message-relay, channel-plugin, session lifecycle, monitoring

---

## Executive Summary

The relay communication system has been the #1 source of CEO frustration and lost productivity. In the last 4 days (Apr 2–6), the PROBLEM-LOG records **8 communication-related incidents**, 4 rated **High severity**. The relay has restarted **68 times**. Right now, as I write this, **command has 3 sessions fighting over the same channel slot** (ports 55160, 62417, 49218), which means ~33% of CEO messages to command are silently lost.

The problems are not random — they are **7 distinct failure classes** that recur because each past fix was a patch, not a systemic solution. This proposal identifies each class, its root cause, and a concrete fix. CEO has approved complexity if it yields reliability.

---

## Part 1: Problem Inventory

### Problem 1: Duplicate Session Registration (ACTIVE RIGHT NOW)
**Severity:** Critical — causes silent message loss to CEO
**Occurrences:** Apr 5, Apr 6 (ongoing)
**Symptom:** Multiple sessions register as the same agent name. Channel heartbeats (every 30s) oscillate the registered port. Messages deliver to random session — some alive, some dead.
**Current state:** command has 3 channel plugins fighting: ports 55160, 62417, 49218. Every 30 seconds the relay log shows `DUPLICATE REGISTRATION: "command" oscillating between ports`.
**Root cause:** No session identity enforcement. The relay maps agent names to ports 1:1, but nothing prevents N sessions from all claiming the same name. The 30s heartbeat makes it worse — each session keeps overwriting the others.
**Why past fix failed:** The Apr 5 fix added duplicate *detection* (oscillation alerts) but not *prevention*. Detection without enforcement just creates noisy logs.

### Problem 2: Zombie Channels (Silent Delivery Black Hole)
**Severity:** High — messages marked "delivered" but never received
**Occurrences:** Apr 4 (mass channel death), recurring
**Symptom:** Relay sends HTTP POST to channel plugin port, gets 200 OK, marks message delivered. But the MCP connection between plugin and Claude session is dead. Agent never sees the message.
**Root cause:** Channel plugin's HTTP server survives independently of the MCP connection. The `/deliver` endpoint returns 200 as long as the Bun HTTP server is alive — it doesn't check if the MCP notification actually reached Claude.
**Existing proposal:** `2026-04-03-zombie-channel-detection.md` (PENDING — never implemented)

### Problem 3: Relay Restart Amnesia
**Severity:** High — all agents go dark simultaneously
**Occurrences:** Apr 4 (machine reboot), recurring with 68 restarts
**Symptom:** Relay restarts → all channel registrations lost → messages queue silently → agents appear dead. Takes up to 30s for heartbeats to re-register, during which ALL delivery fails.
**Root cause:** Despite `_channels.json` persistence (implemented Apr 3), the relay has restarted **68 times**. Each restart has a validation window where persisted channels may be checked against dead ports from a previous session, causing them to be dropped. The 30s heartbeat gap is a guaranteed message-loss window.
**Why past fix was incomplete:** Channel persistence was implemented but the validation on startup is too aggressive — it drops channels whose ports don't respond immediately, even though the plugin may still be starting up.

### Problem 4: Silent Delivery Failure (No Confirmation)
**Severity:** High — agents claim "I contacted X" when X never received the message
**Occurrences:** Apr 4 (consul had 9 undelivered messages), ongoing
**Symptom:** `/send` always returns `{"status": "queued"}` regardless of whether delivery succeeded. Agents report false confidence. CEO thinks communication happened when it didn't.
**Root cause:** Relay has no delivery receipt mechanism. The response is fire-and-forget. There's no way for the sender to know if the recipient actually got the message.
**Existing proposal:** `2026-04-04-relay-delivery-confirmation.md` (PENDING — CEO escalation triggered it)

### Problem 5: Orphan Plugin Processes
**Severity:** Medium — causes Problem 1 (duplicate registration)
**Occurrences:** Continuous
**Symptom:** Old channel plugin Bun processes survive session restarts. Each accumulates — I found 7 Bun processes currently running. When they all heartbeat, they cause port oscillation.
**Root cause:** PID file mechanism exists (`/tmp/relay-channel-{name}.pid`) but is unreliable — if the old process was SIGKILL'd, no cleanup runs. Multiple plugins from different sessions (not just restarts of the same session) can coexist because the PID file is per-agent-name, not per-session.
**Existing proposal:** `2026-04-03-orphan-plugin-cleanup.md` (PENDING — never implemented)

### Problem 6: Queue Rot (Dead Agent Queues Growing Forever)
**Severity:** Low (for now) — will become Medium as system scales
**Occurrences:** Ongoing
**Symptom:** 32 agents tracked in relay status, but only 8 have active channels. Queue files exist for agents that will never reconnect: `cap-agent-1775390799978` (10 pending), `fail-agent-1775390795902` (1 pending), `team-lead` (15 pending), `voice-bridge` (3 pending).
**Root cause:** No TTL or pruning for agent registrations or queue files. Once an agent name appears, it persists in `/status` and on disk forever.

### Problem 7: No Sender Authentication
**Severity:** Medium — security risk on Tailscale network
**Occurrences:** Potential (not yet exploited)
**Symptom:** Any process on the machine (or Tailscale network — relay binds 0.0.0.0) can POST to `/send` and impersonate any agent.
**Root cause:** No auth on relay endpoints. `PROBLEMS.md` documents this as OPEN.
**Existing proposal:** `2026-04-03-relay-sender-auth.md` (PENDING — never implemented)

---

## Part 2: Root Cause Analysis — Why Patches Keep Failing

The 7 problems above share **3 architectural deficiencies**:

### Deficiency A: No Session Identity Layer
The relay knows agent *names* but not agent *sessions*. When `command` registers, the relay doesn't know if this is the original command session, a restarted one, or a stale duplicate. This is the root of Problems 1, 5, and 7.

**What's needed:** Every session gets a unique ID at launch. The relay tracks `(agent_name, session_id, port, last_heartbeat)` tuples. Only the most-recent session_id is authoritative. Old session_ids are rejected.

### Deficiency B: No End-to-End Delivery Verification
The relay treats channel delivery as binary: "I POSTed to a port, I got 200" = delivered. But 200 from the HTTP server doesn't mean the MCP notification reached Claude. This is the root of Problems 2, 3, and 4.

**What's needed:** A delivery receipt protocol. The agent must acknowledge receipt, not just the plugin's HTTP server.

### Deficiency C: No Lifecycle Management for Agents
Agents appear, disappear, and accumulate without any lifecycle tracking. There's no concept of "this agent is decommissioned" vs "this agent is temporarily disconnected." This is the root of Problem 6.

**What's needed:** Agent states with TTLs: `active` → `disconnected` (keep queue, 30 min TTL) → `stale` (archive queue) → `purged`.

---

## Part 3: Proposed Solutions

### Solution 1: Session Registry with Unique Session IDs
**Fixes:** Problems 1, 5, 7
**Complexity:** Medium
**Implementation:** ~200 lines relay-side, ~20 lines plugin-side

**Design:**
```
POST /register-channel
{
  "agent": "command",
  "port": 55160,
  "session_id": "uuid-from-launch-script",   // NEW — required
  "pid": 22204                                 // NEW — for cleanup
}
```

Relay behavior:
1. On register: if `session_id` matches current → update port (normal heartbeat). If `session_id` is new → **validate old session is dead** (check PID alive + health check old port). If old is dead → accept new. If old is alive → **reject with HTTP 409** and alert communications-expert.
2. Relay stores: `{ agent, session_id, port, pid, registered_at, last_heartbeat }`
3. Plugin behavior: generate `session_id` once at startup (use `crypto.randomUUID()`), include in every heartbeat.
4. Launch script: kill any existing bun processes for the agent name before starting the new plugin (`pkill -f "relay-channel.*RELAY_AGENT_NAME={name}"`).

**Bonus:** Session ID enables sender auth (Solution 5) without a separate secret.

### Solution 2: MCP-Level Delivery Receipts
**Fixes:** Problems 2, 4
**Complexity:** High
**Implementation:** ~150 lines plugin-side, ~100 lines relay-side

**Design:**
The channel plugin currently fires `mcp.notification()` and returns 200 immediately. This is the zombie vulnerability.

New flow:
1. Plugin receives `/deliver` POST
2. Plugin sends MCP notification
3. Plugin waits for Claude to call `relay_ack(message_id)` tool within 10s
4. If ack received → return `{"status": "delivered", "acked": true}` to relay
5. If timeout → return `{"status": "delivered", "acked": false}` to relay
6. Relay marks message with `acked: true/false` — re-queues unacked messages after backoff

**Alternative (simpler, 80% solution):** Plugin tracks MCP connection state. If MCP transport has errored/closed, return 503 from `/deliver` instead of attempting notification. Relay treats 503 as "zombie" and removes registration.

**Recommendation:** Implement the simpler 503-on-disconnect first. Add full ack protocol later if needed.

### Solution 3: Graceful Relay Restart with Channel Warmup
**Fixes:** Problem 3
**Complexity:** Low
**Implementation:** ~50 lines

**Design:**
On relay startup:
1. Load `_channels.json` (already done)
2. **Don't validate immediately** — wait 10s for plugins to finish their own startup
3. Then validate in parallel with **generous timeout** (5s per port, not 2s)
4. For ports that fail validation: don't drop immediately. Mark as `suspect` and retry once more after 15s
5. Only after second failure: drop registration

Also: reduce pm2 restart aggressiveness. 68 restarts suggests the relay is crashing on edge cases. Add `--max-restarts 10 --min-uptime 5000` to ecosystem config.

### Solution 4: Agent Lifecycle States with TTL
**Fixes:** Problem 6
**Complexity:** Low
**Implementation:** ~80 lines

**Design:**
```
Agent states:
  active     — has channel, heartbeat within 60s
  disconnected — had channel, lost it < 30min ago. Queue preserved.
  stale      — disconnected > 30min. Queue archived to queues/archive/
  ephemeral  — name matches pattern (cap-agent-*, fail-agent-*, test-*). Auto-purge after 5min disconnect.
```

Relay runs a lifecycle sweep every 5 minutes:
- `active` + no heartbeat for 90s → `disconnected`
- `disconnected` for 30min → `stale` (move queue to archive)
- `ephemeral` + disconnected for 5min → purge entirely
- `/status` endpoint: only show `active` and `disconnected` agents (reduce noise from 32 to ~10)

### Solution 5: Relay Authentication (Bearer Token)
**Fixes:** Problem 7
**Complexity:** Low
**Implementation:** ~40 lines

**Design:**
1. Generate `RELAY_SECRET` on first relay startup, persist to `~/.relay/secret`
2. Channel plugin reads `RELAY_SECRET` from env (launch script injects it)
3. All relay endpoints require `Authorization: Bearer {RELAY_SECRET}` header
4. Grace period: 2 weeks with warnings, then enforce
5. Bind relay to `127.0.0.1` instead of `0.0.0.0` (immediate, zero-risk)

### Solution 6: Communications-Expert Watchdog (Auto-Heal)
**Fixes:** All problems (detection + response layer)
**Complexity:** Medium
**Implementation:** Cron job + relay webhook

**Design:**
A lightweight watchdog script (`scripts/relay-watchdog.sh`) that runs every 60s:
1. `GET /channels` — verify all expected agents are registered
2. `GET /status` — check for pending message buildup (>10 = alert)
3. Check relay error log for duplicate registration warnings
4. For duplicates: identify stale PIDs and kill them automatically
5. For dead channels: notify command with specific remediation
6. For relay down: `pm2 restart message-relay` and alert CEO

This replaces the current "hope someone notices" approach. The watchdog is the first responder; communications-expert (me) handles complex cases.

---

## Part 4: Implementation Priority

| Priority | Solution | Effort | Impact | Dependencies |
|----------|----------|--------|--------|--------------|
| **P0** | Fix command's 3 duplicate sessions (NOW) | 10 min | Critical | None |
| **P1** | Solution 1: Session Registry | 1 day | Fixes 3 problems | None |
| **P1** | Solution 2 (simple): 503 on MCP disconnect | 2 hours | Fixes zombie delivery | None |
| **P1** | Solution 6: Watchdog script | 3 hours | Auto-detection | None |
| **P2** | Solution 3: Graceful restart | 2 hours | Fixes restart amnesia | None |
| **P2** | Solution 4: Agent lifecycle | 3 hours | Queue hygiene | None |
| **P2** | Solution 5: Auth | 2 hours | Security | Solution 1 |
| **P3** | Solution 2 (full): Ack protocol | 1 day | End-to-end guarantee | Solution 1 |

**Total effort:** ~3 days of focused engineering work.

---

## Part 5: Immediate Actions (Before Approval)

As communications-expert, I can do these NOW without waiting for proposal approval:

1. **Kill command's duplicate sessions** — identify the 2 stale command channel plugins and kill them. This fixes the active message-loss bug.
2. **Bind relay to 127.0.0.1** — one-line change, zero risk, closes the Tailscale exposure.
3. **Start the watchdog** — a simple `crontab` entry that checks `/channels` and `/status` every minute.

---

## Appendix: Current System Snapshot (2026-04-06T01:53)

```
Relay: online, 68 restarts, 4h uptime since last restart
Heap: 18.69 MiB (85.5% usage — monitor this)
Active channels (8): consul, productivitesse, communications-lead, system-lead, matrix, command, prism, signal
Total tracked agents: 32 (24 are ghosts with no channel)
Pending messages in dead queues: 42 total across 9 unreachable agents
ACTIVE BUG: command oscillating between 3 ports (55160, 62417, 49218)
```

### Communication Incidents (Last 4 Days)
| Date | Incident | Severity | Root Problem Class |
|------|----------|----------|--------------------|
| Apr 3 | Inbox duplicate messages | Medium | Endpoint confusion |
| Apr 3 | Session-mirror wrong from field | High | Endpoint confusion |
| Apr 3 | TASK APPROVED loop flooding | Medium | State replay bug |
| Apr 4 | Permission requests timing out | Medium | TTL too short |
| Apr 4 | Mass channel death on reboot | High | Restart amnesia (P3) |
| Apr 4 | Agent silently blocked, no signal | Low | No waiting-for-input discipline |
| Apr 4 | Approved proposals reverting | High | In-memory-only state |
| Apr 5 | CEO messages split between sessions | High | Duplicate sessions (P1) |

### Existing Pending Proposals (Communication-Related)
| Proposal | Status | Covered by this proposal? |
|----------|--------|--------------------------|
| Channel re-registration | APPROVED (implemented) | Yes — needs strengthening |
| Orphan plugin cleanup | PENDING | Yes — Solution 1 |
| Relay sender auth | PENDING | Yes — Solution 5 |
| Zombie channel detection | PENDING | Yes — Solution 2 |
| Relay delivery confirmation | PENDING | Yes — Solution 2 |
| Session exit instructions | PENDING | Orthogonal — still useful |
| Proposal vs message rules | PENDING | Orthogonal — still useful |
