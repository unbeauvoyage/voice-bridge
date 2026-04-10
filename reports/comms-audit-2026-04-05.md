# Communications System Audit
**Author:** communications-lead  
**Date:** 2026-04-05T20:58:18  
**Scope:** ~/environment/message-relay/ — full architecture review

---

## 1. Failure Points and Crash Vectors

### 1.1 pm2 Memory Restart (ACTIVE RISK)
`max_memory_restart: '200M'` in `ecosystem.config.js`. The relay has **66 restarts** since 2026-04-05T11:07:51 (under 10 hours). Cause unknown but restart count is high — may indicate memory pressure or an unhandled exception pattern. Each restart causes a delivery gap until agents' 30s channel pollers re-register.

**Root risk:** In-memory `deliveryQueue: Message[]` in `delivery.ts` is written to on every `enqueue()` but never drained or bounded. It is not consumed by any worker loop — messages are delivered via fire-and-forget `deliverMessage()` calls. The array grows monotonically for the lifetime of the process. On a busy day with hundreds of messages, this could push the process over the 200MB threshold and trigger pm2 restart.

### 1.2 Node.js Single-Thread Blocking on File I/O
`batchMarkDelivered()` in `persistence.ts` reads the entire JSONL file and rewrites it on every delivery confirmation. With `ux-lead.jsonl` at 45KB and ~10 messages/minute, this is repeated synchronous file I/O on the hot path. Node's event loop blocks during `readFileSync`/`writeFileSync` — high traffic can cause latency spikes and event loop starvation.

### 1.3 Unhandled Promise Rejections in Delivery Loop
`deliverMessage()` is called via `.catch(err => console.error(...))` but if the `fetch()` call throws a non-network error (e.g., unexpected object shape), the rejection is logged but delivery silently stops for that message. The message stays persisted but is not retried unless an agent re-registers.

### 1.4 Port 8765 Conflict
If another process binds port 8765 before pm2 restarts the relay, the relay fails to start. pm2's `autorestart: true` will keep retrying but the relay stays down. No alert is sent (relay is the alerting mechanism).

### 1.5 0.0.0.0 Binding — No Authentication (OPEN SECURITY ISSUE)
Hub listens on all interfaces. Any host on the Tailscale network can POST arbitrary messages to any agent queue with no authentication token. Documented in PROBLEMS.md but not fixed. Risk: message injection, queue flooding.

### 1.6 `afplay` Sound on Every Escalate/WFI Message
`playSound()` in `delivery.ts` spawns `afplay` detached for every `escalate` or `waiting-for-input` message. Under failure conditions where these message types flood in, this can create many zombie afplay processes. Low probability but worth noting for noisy failure modes.

### 1.7 100MB Per-Agent File Guard is Too Late
The `loadUndelivered()` function checks if a queue file exceeds 100MB before triggering a prune. At that size, `readFileSync()` will allocate ~100MB in memory for a single agent. With 20+ active agents, a simultaneous load (e.g., after relay restart) could briefly allocate 2GB+.

---

## 2. Message Blockage Causes

### 2.1 Duplicate Channel Registration Oscillation (ACTIVE — CRITICAL)
**Currently affecting: command, productivitesse, system-lead, communications-lead.**

The error log contains thousands of lines like:
```
[channel] DUPLICATE REGISTRATION: "command" oscillating between ports [60693, 62242] — two sessions fighting
```

Cause: each long-running claude session accumulates multiple bun channel plugin processes (new process spawned on every MCP server restart). All poll `/register-channel` every 30s. After relay restart, all fire simultaneously and race. Hub's session_id priority logic partially mitigates this but re-registration without session_id falls through to the 409 path — which the plugin apparently doesn't respect, causing infinite re-registration churn.

**Impact:** Error log is completely saturated with duplicate registration noise. Real errors are invisible. Additionally, oscillation causes brief windows where the wrong port is registered — messages delivered to a dead plugin, then retried, causing latency spikes.

### 2.2 30-Second Re-Registration Window After Relay Restart
After each relay restart (66 so far), there is a ~30s window before all channel plugins re-register. Messages sent during that window are queued on disk and flushed on re-registration, but are not actively pushed — push delivery is paused for the window duration.

### 2.3 At-Most-Once Delivery (Acknowledged Design Gap)
Channel plugin returns HTTP 200 → relay marks delivered → but Claude session could crash between receiving the MCP notification and processing it. Message is permanently lost. No ack-after-processing mechanism exists. Documented in PROBLEMS.md as a known accepted risk.

### 2.4 MAX_CHANNEL_RETRIES = 10 × 500ms = 5 Seconds
If a channel is temporarily slow (e.g., Claude session is busy processing a long tool call), 5 seconds may not be enough. After 10 failures, the message is left on disk and waits for the next re-registration flush. This can cause apparent "stuck" delivery for busy agents.

### 2.5 Agents Without Channel Plugin (Legacy / No-Channel Agents)
Queue files exist for: `voice-bridge`, `hq`, `agency-biz`, `agency-routers`, `team-lead`, `satellite-team`, `knowledge-base`, `cline-researcher`, `debug-agent`, `agent`, `voice`. None have channel registrations. Messages sent to these agents queue indefinitely and are never flushed. `voice-bridge.jsonl` at 31KB is the largest undeliverable queue.

### 2.6 CEO Queue Growing (22KB)
`ceo.jsonl` at 22KB has no channel registration. Messages sent to "ceo" are silently queued forever. If command sends status updates to "ceo", they stack up.

---

## 3. Storage Model Assessment: JSON/JSONL vs Alternatives

### Current Model
- Per-agent append-only JSONL files in `queues/`
- `_channels.json` and `_pending_permissions.json` as special JSON state files
- Atomic writes via tmp-then-rename
- Prune on startup and hourly: keeps all undelivered + last 50 delivered

### Strengths
- Zero external dependencies
- Survives crashes cleanly (atomic writes)
- Human-readable, trivially inspectable
- Simple to implement and reason about

### Weaknesses
| Issue | Impact |
|-------|--------|
| Full-file rewrite on every `batchMarkDelivered` | O(n) I/O per delivery, event loop blocking |
| Linear scan on `loadUndelivered` | O(n) per poll, no index on `delivered` field |
| Files grow until pruned | Prune keeps 50 delivered but undelivered accumulate; no TTL |
| Two separate writes per send (to + from echo) | 2× I/O on hot path |
| No WAL on JSONL | Concurrent writes from multiple processes would corrupt (mitigated by relay being single-process) |

### SQLite Verdict: **Recommended for next iteration**
SQLite's WAL mode would provide:
- Indexed `WHERE delivered=0` query — O(log n) vs O(n)
- Single `UPDATE SET delivered=1` per message — no full-file rewrite
- Single file with all agents — no per-agent file management
- Built-in TTL via `DELETE WHERE delivered=1 AND delivered_at < datetime('now', '-7 days')`
- Concurrent read support (dashboard, delivery, MCP all reading simultaneously)

**Migration risk is moderate.** Should run SQLite in parallel alongside JSONL (writing to both) for a session before cutting over, per the infrastructure policy. The JSONL model is not a current emergency — files are small (largest is 45KB) — but will degrade as message volume grows.

### In-Memory (pure): Not recommended
Would lose all undelivered messages on relay crash. The 66-restart history makes this untenable.

### Redis: Overkill
Another daemon to manage. SQLite provides the same query benefits without the operational overhead.

---

## 4. Stale Session Situation

### 4.1 Actively Running Sessions (confirmed via ps)
| Agent | PID | Uptime | Channel Port | Status |
|-------|-----|--------|--------------|--------|
| ux-lead | 28533 | ~15h | 51345 | OK |
| system-lead | 28559 | ~15h | 51366 | DUPLICATE (also 56593) |
| jarvis | 61080 | ~17h | 61325 | OK |
| productivitesse | 91514 | ~19h | 49716 | DUPLICATE (also 49668) |
| agentflow-expert | 61117 | ~17h | 61343 | OK |
| cline-kanban-expert | 61152 | ~17h | 61358 | OK |
| communications-lead | 15715 | <1h | 63769 | DUPLICATE (also 64811, this session) |
| command | unknown | ~9h | 60693 | DUPLICATE (also 62242) |
| consul | unknown | unknown | 53748 | Registered, process uncertain |

### 4.2 Dead Agents With Registered Channels
None — all 9 registered channels correspond to apparently-running processes.

### 4.3 Dead Agents With Undelivered Queue Files (Stale Queues)
These agents have queue files but no channel registration. Messages addressed to them are permanently stuck unless the queue is pruned or the agent restarts.

| Agent | Queue Size | Last Activity | Notes |
|-------|-----------|---------------|-------|
| voice-bridge | 31KB | Apr 5 01:30 | Was active, now dead, large stale queue |
| hq | 2.5KB | Apr 3 20:45 | Old session |
| agency-biz | 11.7KB | Apr 3 22:37 | Project-specific, probably done |
| agency-routers | 10.9KB | Apr 5 03:09 | Recent-ish, probably dead |
| team-lead | 4.3KB | Apr 5 03:07 | Dead |
| satellite-team | 4.3KB | Apr 4 01:08 | Dead |
| knowledge-base | 1.6KB | Apr 5 01:30 | Dead |
| cline-researcher | 556B | Apr 3 18:02 | Dead |
| debug-agent | 530B | Apr 5 13:38 | Dead |
| agent | 457B | Apr 3 01:46 | Dead |
| voice | 408B | Apr 2 23:35 | Dead |
| ceo | 22KB | Apr 5 20:56 | No channel — messages silently queuing |

**Action required:** Prune or acknowledge stale queues for dead agents. Most critically: `voice-bridge` (31KB, likely has unread messages from active period) and `ceo` (22KB, ongoing accumulation).

### 4.4 Duplicate Channel Plugins (Root Cause of Log Spam)
4 agents have two bun plugin processes each (2 ports fighting):
- command: 60693 ↔ 62242
- productivitesse: 49716 ↔ 49668
- system-lead: 51366 ↔ 56593
- communications-lead: 63769 ↔ 64811

Error log is flooded — **all real errors are invisible.** This needs immediate cleanup.

---

## 5. Recommendations (Priority Order)

### P0 — Immediate
1. **Kill stale duplicate bun channel plugins** for command, productivitesse, system-lead. Use `lsof -i :PORT` to identify PIDs, kill the stale one. The error log spam will stop immediately and real errors will become visible again.
2. **Investigate the 66 restarts** — check pm2 error log for crash stack traces before the restart events to identify if there's a recurring exception.

### P1 — This Week
3. **Bound the `deliveryQueue` array** in `delivery.ts` — it grows forever and is the most likely cause of memory pressure triggering the 200MB pm2 restart.
4. **Prune stale queue files** for dead agents (voice-bridge, hq, agency-biz, agency-routers, etc.) — they'll never be delivered and occupy disk space.
5. **Fix 0.0.0.0 binding** — change to `127.0.0.1` unless Tailscale access is intentional.

### P2 — Next Sprint
6. **Add `?since=` cursor to `/messages/:agent`** and implement the UserPromptSubmit fallback for command (documented in PROBLEMS.md) — closes the 30s gap window.
7. **Plan SQLite migration** — parallel write, then cut over. Will eliminate full-file rewrites on delivery and prevent future file-growth issues.
8. **Kill-old-plugins on session launch** — add to spawn scripts: before launching, kill all bun processes matching that agent name. Prevents duplicate accumulation.

---

## Appendix: Key Metrics at Audit Time (2026-04-05T20:58:18)

| Metric | Value |
|--------|-------|
| Relay uptime | 48 minutes (restarted ~21:00 today) |
| Total restarts | 66 |
| Queue directory size | 372KB |
| Largest queue | ux-lead.jsonl (45KB) |
| Registered channels | 9 agents |
| Duplicate registrations | 4 active (spamming error log) |
| Pending permissions | 0 |
| Node heap usage | 65.92% of 30.09 MiB |
| Event loop p95 latency | 13.74ms |
