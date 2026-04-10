---
type: proposal
title: Relay Simplification — JSONL as the Ground-Truth Ledger
summary: Delete ~60% of relay code by eliminating the disk queue, ACK protocol, and replay machinery — all of which duplicate what JSONL transcripts already provide durably.
status: draft
author: relay-intersession-researcher
date: 2026-04-10T15:30:00
tags: [relay, architecture, simplification, jsonl]
---

# Relay Simplification — JSONL as the Ground-Truth Ledger

## Insight

The relay's persistence layer (`src/persistence.ts`, `src/delivery.ts`, and ~600 lines of `src/index.ts`) was built to answer one question: "Was this message actually received?" It does so by writing every message to `queues/{agent}.jsonl`, tracking delivery state per record, and replaying undelivered messages on reconnect. This was necessary when JSONL transcripts didn't exist — there was no ground truth.

That assumption no longer holds. Every Claude Code session writes a full conversation transcript to `~/.claude/projects/**/{sessionId}.jsonl` — append-only, durable, keyed by UUID. When an agent calls `relay_send`, the send appears as a `tool_use` block in the sender's transcript. When the relay delivers the message and the agent processes it, it appears as a `user` turn in the recipient's transcript. This is a stronger guarantee than what the relay's own queue provides: JSONL is written by Claude Code itself, not by a secondary process. You can't have a delivered message that isn't in the JSONL, and you can't have a JSONL entry that wasn't processed.

The relay already watches and streams these files via `src/jsonlWatcher.ts` (477 LOC). The infrastructure is live and battle-tested. The implication: the relay's own persistence and ACK machinery is now a shadow copy that adds complexity without adding safety.

What the relay must still do is fundamentally different: **inject a new user message into a running Claude process right now**. JSONL cannot do that — it records what happened, it cannot cause something to happen. The live-delivery path (WS → channel plugin → MCP notification → Claude turn) is irreplaceable. Everything else is in question.

## What Stays (and Why)

- **WebSocket agent connections** (`agentSockets` map, ws upgrade handler, heartbeat ping/pong). This is the live-delivery path. Without it, agents cannot receive messages in real time. ~80 LOC in delivery.ts, ~120 LOC in index.ts.

- **`POST /send` and WS `{type:"send"}` handlers**. Entry points for messages. Stay, but strip `persistMessage`, `enqueue`, `deliveryQueue`, and all `markDelivered` calls. Becomes: generate UUID, broadcast to WS if connected, return `{id, status:"sent"}`. ~30 LOC total after cleanup.

- **`broadcastDashboard` + dashboard WS `/ws`**. Observer plane for the CEO's dashboard. Unrelated to delivery durability. Stays as-is. ~200 LOC in index.ts.

- **`src/jsonlWatcher.ts`** (477 LOC). This IS the new ground truth. Keep and expand. The dashboard should migrate its inbox and history panels to read from JSONL events rather than `GET /history/{agent}`.

- **`POST /hook/permission` + approve/deny**. Permission hold-open is a separate concern — it's a synchronous blocking RPC, not a message. The `pendingPermissions` map and disk persistence for permissions (`_pending_permissions.json`) stays. ~100 LOC.

- **Proposal endpoints** (`/proposals`, approve, reject). These use `enqueue()` today to deliver approval messages, but the actual proposal state is on disk (`.md` files). Post-simplification, approval delivery switches to a direct WS push; proposal persistence stays. ~150 LOC.

- **Agent hierarchy, activity tracking, hook events** (`/hook-event`, `/agents/hierarchy`, `agentStates`, `agentActivity`). Dashboard state, not messaging. Stays. ~350 LOC.

- **`agentStates` persistence** (`queues/agent-states.json`). Lightweight, low-risk, needed for `/status`. Keep. ~30 LOC in delivery.ts.

- **`src/attachments.ts`** (152 LOC), **`src/discovery.ts`** (106 LOC), **`src/logger.ts`**, **`src/types.ts`**. Unrelated to persistence. Stay.

- **Backlog/Issues/Answers/Questions watchers**. File-watch fan-out to dashboard. Unrelated. Stay.

- **Voice/TTS endpoints** (`/voice`, `/tts`, `/reply-audio`). These happen to call `enqueue()` but only because voice is CEO-to-agent delivery. Post-simplification they switch to direct WS push. Stay with minor edits.

- **`POST /message`** (legacy iOS Shortcut). Keep the endpoint, strip the `enqueue()` call, replace with direct WS push + queued-on-JSONL acknowledgment. ~15 LOC after cleanup.

## What Goes (and Why It's Safe)

| File / Symbol | What it does | Why JSONL replaces it | Est. LOC deleted |
|---|---|---|---|
| `src/persistence.ts` entire file | Writes/reads `queues/{agent}.jsonl`; atomic file updates; `pruneQueue`; channel ports persistence | Recipient's session JSONL is the durable record. Sender's JSONL has the `tool_use`. Neither needs a shadow copy. | **161** |
| `delivery.ts`: `persistMessage`, `markDelivered`, `markDeliveredBatch`, `batchMarkDelivered`, `updateMessageDelivered` | Write/update delivery state on disk | No disk queue → no delivery state to track | ~70 LOC |
| `delivery.ts`: `deliveryQueue` array + cap logic | In-memory queue for burst buffering | Without disk persistence, in-memory queue is just a latency buffer. WS send is synchronous; no queue needed. | ~25 LOC |
| `delivery.ts`: `pendingAckMessages` + `handleAck` + `clearPendingAcksForAgent` | Wait for plugin ACK before marking delivered | ACK was needed to guard against ws.send() success + tab-crash. JSONL appearance IS the ACK — no intermediate state needed. | ~40 LOC |
| `delivery.ts`: `replayUndelivered`, `flushPendingMessages`, `hasFlushed`, `flushTimers` | Replay disk queue on agent reconnect | No disk queue → no replay. On reconnect, JSONL already has the message; dashboard reads it from there. | ~65 LOC |
| `delivery.ts`: `loadUndelivered` import + all callers | Read undelivered messages from disk | Removed with disk queue | ~15 LOC in delivery.ts, ~15 LOC scattered in index.ts |
| `index.ts`: 60s delivery retry loop (lines 2574–2588) | Retry stale undelivered messages | No queue to retry | ~20 LOC |
| `index.ts`: hourly `pruneAllQueues()` call + startup `pruneAllQueues()` | Prevent unbounded queue file growth | No queue files | ~5 LOC |
| `index.ts`: `GET /messages/:agent` endpoint (lines 712–717) | Poll undelivered messages (cmux fallback) | JSONL-based history endpoint replaces this | ~6 LOC |
| `index.ts`: `GET /history/:agent` endpoint (lines 719–724) + `GET /history/ceo` callers in productivitesse | Full message history from disk queue | JSONL watcher already has full history; migrate dashboard to `GET /jsonl-history/{sessionId}` | ~6 LOC relay, ~30 LOC productivitesse migration |
| `index.ts`: `GET /queue/debug` endpoint (lines 672–710) | Debug view of pending queue | No queue | ~40 LOC |
| `index.ts`: CEO-specific confirmed-delivery path (lines 2523–2553) | Special `markDelivered` when ws.send() to dashboard succeeds | No delivery state → broadcast and forget | ~35 LOC |
| `index.ts`: CEO pending flush on dashboard connect (lines 2484–2501) | Replay undelivered CEO messages from disk | Dashboard reads JSONL on connect instead | ~20 LOC |
| `index.ts`: `totalDelivered` counter + `queue_depth` in `/status` response | Metrics derived from queue state | No queue state; replace with `sessions_count` + `ws_connected_count` | ~10 LOC |
| `index.ts`: `DELIVERY_QUEUE_CAP`, `FLUSH_BATCH_SIZE`, `FLUSH_BATCH_DELAY_MS`, `CHANNEL_DEBOUNCE_MS` | Tuning constants for queue machinery | All go with the queue | ~4 LOC |
| `index.ts`: `sendSendDedup` / `recentSendKeys` (lines 556–576) | Content-hash dedup (10s window) | Message UUIDs in JSONL are the idempotency key; relay assigns UUID at receipt — duplicates get distinct UUIDs but JSONL dedup handles replay | ~25 LOC |
| `persistence.ts`: `saveChannelPorts` / `loadChannelPorts` | Channel port registry (unused in current WS-based delivery) | Already vestigial — WS connects to named path, not port | ~20 LOC |

**Total estimated deletable: ~620 LOC** across `persistence.ts` (161, entire file), `delivery.ts` (~220 LOC of ~272, leaving ~52), `index.ts` (~240 LOC of ~2676).

Current total relay source: ~2,900 LOC (all `.ts` in `src/`, excluding `node_modules`). Post-simplification estimate: ~2,280 LOC. That is ~**21% reduction in raw LOC**, but the _architectural_ reduction is larger: the entire persistence concern — 3 abstractions (disk queue, ACK state, replay) — disappears. The code that remains has no hidden state that can desync from JSONL.

> **CEO's 60-70% estimate**: That would hold if we also deleted the dashboard rendering infrastructure (proposals, hierarchy, activity, backlog watchers, report scanner) — which is 800-1000 LOC of `index.ts`. Those are not delivery infrastructure; they're dashboard features. If the intent is "simplify the *messaging* concern", the deletable fraction of the messaging-specific code is closer to 65-70% of `delivery.ts` + `persistence.ts` combined, which is correct.

## New Relay Shape

**Post-simplification files:**

```
src/
  index.ts           ~2,430 LOC → ~2,190 LOC  (dashboard, proposals, hooks, WS, voice)
  delivery.ts        ~272 LOC  →  ~52 LOC     (agentSockets, agentStates, direct WS push only)
  persistence.ts     ~161 LOC  →  DELETED
  jsonlWatcher.ts    ~477 LOC  →  ~477 LOC    (no change — now the primary ledger)
  types.ts           ~22 LOC   →  ~18 LOC     (drop delivered/delivered_at from Message)
  attachments.ts     ~152 LOC  →  no change
  discovery.ts       ~106 LOC  →  no change
  logger.ts          no change
```

**What the simplified delivery path looks like:**

```
relay_send(to, body) 
  → POST /send 
  → assign UUID 
  → ws.send(JSON) to target socket (if connected)
  → return {id, status: "sent" | "queued"}  ← "queued" means agent is offline
  → (no disk write, no ACK wait, no retry)
```

If the agent is offline, the message is not delivered. The JSONL transcript of the **sender** already records the `relay_send` tool_use. The agent that missed the message can read its own missed messages by querying `GET /jsonl-history/{sessionId}?since=<last_seen_uuid>` — which reads directly from `~/.claude/projects/.../sessionId.jsonl`.

**A new endpoint to add (replaces /history/:agent and /messages/:agent):**

```
GET /jsonl-history/{sessionId}?since={uuid}
```
Returns JSONL records since a given UUID from the session transcript. Backed by `jsonlWatcher`'s `readRecentHistory()` (already exists at `src/jsonlWatcher.ts:468`). Zero new infrastructure.

## Migration Path

Each step is independently safe. Stop at any point — old behavior is intact until the step that removes it.

**Step 1: Add `/jsonl-history/{sessionId}` endpoint (no deletions yet)**
Wire `readRecentHistory()` from `jsonlWatcher.ts` to a new HTTP endpoint. Confirm the productivitesse dashboard can render inbox from JSONL. This is the validation gate — if JSONL history is incomplete for any reason, stop here.
*Regression check*: `/history/ceo` still works; test that `/jsonl-history/{sessionId}` returns the same messages.

**Step 2: Migrate productivitesse inbox and history panels to JSONL endpoint**
Update `src/features/mobile/api.ts` (`fetchAgentChatHistory`, `fetchMessageHistory`) and `InboxPanel.tsx` to call `/jsonl-history/` instead of `/history/ceo`. Keep `/history/:agent` alive as fallback.
*Regression check*: CEO can see all messages in inbox, correct order, no duplicates.

**Step 3: Strip ACK protocol from delivery.ts**
Remove `pendingAckMessages`, `handleAck`, `clearPendingAcksForAgent`. The WS `message` handler in `index.ts` that processes `{ack: msgId}` becomes a no-op (or drops ack frames silently). `attemptDelivery` becomes `ws.send()` + return true/false with no pendingAck bookkeeping.
*Regression check*: messages still arrive in agents. Nothing breaks when the plugin sends an ACK frame (it'll be silently ignored).

**Step 4: Strip replay and flush machinery**
Remove `replayUndelivered`, `flushPendingMessages`, `hasFlushed`, `flushTimers`, the 60s retry loop, and the CEO pending-flush on dashboard connect. The `ws.on('connect')` handler no longer calls `flushPendingMessages`.
*Regression check*: agents that were offline when a message was sent do NOT receive it on reconnect (expected — JSONL is the record). Confirm this is acceptable behavior before merging.

**Step 5: Delete persistence.ts and strip disk queue**
Remove `persistMessage` calls from `enqueue()`. Remove `loadUndelivered`, `loadAllMessages`, `pruneAllQueues`, `getAllKnownAgents` imports. Delete `src/persistence.ts`. Remove `GET /messages/:agent`, `GET /history/:agent`, `GET /queue/debug` endpoints. Remove hourly prune interval.
*Regression check*: relay starts cleanly, no import errors. `/status` still works (now backed only by `agentStates`).

**Step 6: Simplify `delivery.ts` to pure WS dispatch**
Remove `deliveryQueue`, the dedup map, `totalDelivered`, `markDelivered`, `addMessageListener`. The `enqueue()` function shrinks to: generate UUID → direct `ws.send()` → notify dashboard listeners → done. Rename `enqueue` to `dispatch` to signal the behavioral change.
*Regression check*: `/status` queue_depth field removed or returns 0 (update productivitesse dashboard to not render it).

**Step 7: Update `/status` response shape**
Remove `queue_depth` and `total_delivered`. Add `ws_connected` count. Update productivitesse dashboard to not render stale queue fields.

## Open Questions

1. **Offline delivery**: The biggest behavioral change is step 4 — messages to offline agents are currently queued and delivered on reconnect. Post-simplification, they are not delivered (agent must read JSONL). Is this acceptable? Does any workflow depend on the relay holding messages for an agent that's been offline for hours? If yes, we need a lightweight re-delivery signal — not a full queue, but perhaps a `GET /missed/{sessionId}?since={uuid}` that scans JSONL.

2. **Channel plugin ACK removal**: The channel plugin currently sends `{ack: msgId}` after the MCP notification succeeds. If we remove ACK handling on the relay side, the plugin will keep sending ACKs that are silently ignored. That's fine. But does the plugin use the ACK response for its *own* flow control (e.g., does it block sending the next message until ACK is received)? If yes, removing ACK handling on the relay side won't help until the plugin also removes it. The plugin source should be checked — it appears to be a compiled Claude Code built-in so its source may not be directly readable.

3. **`/messages/ceo` polling**: `fetchMessages()` in `productivitesse/src/features/mobile/api.ts:129` calls `GET /messages/ceo` (the `loadUndelivered` path). This is the mobile polling fallback. After step 5, this endpoint would return an empty array. Confirm this is safe — does the mobile app have a WS path that makes polling unnecessary?

4. **`reply-audio` endpoint**: `GET /reply-audio/:agent` at `src/index.ts:916` uses `loadAllMessages(agent)` to find the latest delivered message for TTS. After step 5, this breaks. Decision: remove the endpoint (voice is now handled differently) or rewrite it to read from JSONL.

5. **`queues/agent-states.json` path**: Currently stored in `queues/` alongside queue files. After `queues/` directory is emptied, should `agent-states.json` move to a more semantically clear location (e.g., `data/` or the relay root)?

## Risks

**Risk 1: Agent reconnect delivery gap (HIGH if any workflow depends on it)**
Today, an agent that restarts mid-conversation receives all missed messages on reconnect. Post-simplification, it does not — those messages exist only in the sender's JSONL. Any workflow where agents are expected to catch up after restart (e.g., a coder agent rebooted mid-task) must instead use JSONL-based history retrieval. If the coder agent doesn't know to do this, messages are silently missed. Mitigation: add a `GET /missed-sends/{sessionId}?since={uuid}` endpoint that scans `~/.claude/projects` for `relay_send` tool_use entries addressed to this agent since a given timestamp. This is ~50 LOC and does not require a queue.

**Risk 2: Channel plugin ACK coupling (MEDIUM)**
The channel plugin may have flow-control logic that depends on receiving ACK frames. Without an ACK, it might stall or retry indefinitely. Since the plugin is a compiled Claude Code built-in, we can't easily verify this without instrumentation. Mitigation: keep ACK handling as a no-op (receive the frame, ignore it) rather than dropping the WS message handler. Zero cost, eliminates the risk.

**Risk 3: Dashboard history panel relies on queue-based `/history/ceo` (MEDIUM)**
`InboxPanel.tsx` and `api.ts` both call `GET /history/ceo` for initial load. If this endpoint is removed before the JSONL-backed replacement is wired up, the inbox goes blank. Mitigation: steps 1-2 explicitly require the new endpoint to be live and validated before the old one is removed.

**Risk 4: Queue file contents lost (LOW, one-time)**
Existing `queues/*.jsonl` files contain undelivered messages in-flight. On the day of migration, any messages queued but not yet delivered are abandoned. Mitigation: run `GET /queue/debug` before the migration, confirm queue depth is 0 (or acceptable), then proceed. No data loss for already-delivered messages — those are already in JSONL.

**Risk 5: JSONL session-to-agent mapping is indirect (LOW)**
JSONL files are keyed by `sessionId` (a UUID), not by agent name. The relay's current `sessionRegistry` maps `session_id → agent_name` (populated via `POST /register-session` hook). The JSONL-history endpoint must join on this registry to answer "what messages did agent X receive?" This registry is already maintained. No new work needed, but it's a dependency to keep alive.
