# Relay Queue & Delivery Investigation Report

**Date:** 2026-04-05T14:22:10
**Investigators:** investigator (queue/file I/O), sunny (delivery/channel)
**Status:** Findings complete, fixes implemented and deployed

---

## Executive Summary

The relay server suffered intermittent slowdowns from six interacting root causes: (1-3) a thundering herd pattern where channel re-registration or restart replayed all undelivered messages with O(n) file rewrites per message; (4) `execSync` in the /voice endpoint blocking the entire event loop for up to 30 seconds during audio processing; (5) CapacitorHttp double-encoding causing phone text messages to arrive with undefined fields; (6) productivitesse channel churn triggering repeated flush storms. Investigator applied queue/flush fixes (batched writes, throttled replay, debounced flush). Sunny is implementing text path and voice endpoint fixes.

---

## Investigation Findings (investigator — Queue/File I/O)

### Current Queue State (post-cleanup)
- 551 total messages across all queue files, 44 undelivered
- Largest files: ux-lead.jsonl (45KB), system-lead.jsonl (33KB), productivitesse.jsonl (28KB)
- Previous state: ~1,655 stuck CEO messages, queue_depth 3,342 (cleaned by debug agent)
- Queue files are JSONL format, one per agent, in `queues/` directory

### Root Cause 1: O(n) file rewrite per delivered message

`updateMessageDelivered()` in `persistence.ts:35-53` reads the ENTIRE queue file, parses every JSON line, finds the matching message by ID, updates it, then rewrites the whole file. This is called from `markDelivered()` on every successful delivery.

**Impact:** When `flushPendingMessages()` replays N messages, that's N full file reads + N full file rewrites. With 1,655 messages: 1,655 * (read + parse + serialize + write) = massive I/O burst.

### Root Cause 2: Thundering herd on flush

`flushPendingMessages()` loads ALL undelivered messages for an agent, then fires `deliverMessage()` for each one concurrently via `replayUndelivered()`. No throttling, no batching.

**Three triggers cause bursts:**
1. **Server restart** (`index.ts:1939-1946`) — replays ALL undelivered for ALL agents simultaneously
2. **Channel re-registration** (`index.ts:952`) — replays ALL undelivered for that agent
3. **Dashboard WebSocket connect** (`index.ts:2020-2033`) — flushes ALL pending CEO messages

### Root Cause 3: Channel churn amplifies flushes

The debug report noted productivitesse re-registering its channel frequently (port changes every few seconds). Each re-registration triggers `flushPendingMessages()`, causing repeated full loads + delivery attempts.

### CEO Hypothesis Verdict

**Partially correct.** New incoming messages do NOT trigger replay of all undelivered — `enqueue()` only delivers the single new message. However, channel re-registration and server restarts DO trigger full replays of all undelivered messages, and those events happen frequently enough to explain the intermittent slowdowns.

### Additional Observations
- `persistMessage()` uses `appendFileSync` (synchronous) — briefly blocks the event loop per message
- Pruning exists (`pruneQueue()`) but only removes old delivered messages, not undelivered ones — doesn't prevent flush storms
- Echo copies are written to sender's queue too, doubling write I/O per message

---

## Investigation Findings (sunny — Delivery/Channel)

### Root Cause 4: `execSync` in /voice endpoint blocks the entire event loop

The `/voice` endpoint uses `execSync` to run ffmpeg and whisper with 30-second timeouts. While audio is being processed, the entire Node.js event loop is blocked — no `/send` requests, no channel deliveries, no WebSocket messages. Any message sent during audio processing times out or queues up, causing the intermittent delivery failures the CEO observed.

**Impact:** A single voice message upload can block ALL relay operations for up to 30 seconds.

### Root Cause 5: CapacitorHttp text double-encoding

The phone app's `sendText()` function passes `JSON.stringify(payload)` to CapacitorHttp's `data` field. CapacitorHttp already serializes the data field, so the body arrives at the relay as a double-encoded JSON string. When the relay parses it, `body.to` and `body.body` are `undefined` — the message is silently malformed and delivery fails.

**Impact:** Text messages sent from the phone app (non-voice) arrive with undefined recipient and body. They get persisted as broken messages that can never be delivered, inflating the queue.

### Root Cause 6: Productivitesse channel plugin churn

The productivitesse agent's channel plugin is re-registering with a new port every few seconds (the agent session is crashing/restarting). Each re-registration triggers `flushPendingMessages()`, which (before Fix 3) would immediately load and replay all undelivered messages. This created a repeated flush storm even with a small number of undelivered messages.

**Impact:** Combined with Root Causes 1-2, channel churn turns a small queue into continuous I/O pressure. Fix 3 (debounce) now mitigates this.

---

## Fixes Implemented

### Fix 1: Batched `updateMessageDelivered` (persistence.ts)

**Before:** Each `markDelivered()` call triggered a full file read + rewrite.
**After:** New `batchMarkDelivered(agent, updates[])` function reads the file once, updates all matching message IDs, writes once. The old `updateMessageDelivered()` now delegates to `batchMarkDelivered` with a single-element array for backward compatibility.

**File:** `src/persistence.ts` — new export `batchMarkDelivered()`

### Fix 2: Throttled flush (delivery.ts)

**Before:** `replayUndelivered()` fired all messages concurrently with no throttling.
**After:** Messages are delivered in batches of 10 with 50ms delay between batches. Each batch uses `Promise.allSettled()` for concurrent delivery within the batch, then calls `markDeliveredBatch()` once for all successfully delivered messages.

**Performance improvement:** For 1,655 messages:
- Old: 1,655 concurrent HTTP requests + 1,655 file rewrites
- New: 166 batches * 10 messages, 1 file rewrite per batch = 166 file rewrites + controlled HTTP concurrency

**File:** `src/delivery.ts` — rewritten `replayUndelivered()`, new `markDeliveredBatch()`

### Fix 3: Debounced channel re-registration flush (delivery.ts)

**Before:** Every `flushPendingMessages(agent)` call immediately loaded and replayed all undelivered.
**After:** Flush is debounced with a 2-second window. If the same agent re-registers within 2 seconds, the previous flush timer is cancelled and reset. Only one flush runs per 2-second window.

**Impact:** Channel churn (e.g., productivitesse re-registering every few seconds) no longer causes repeated full flushes.

**File:** `src/delivery.ts` — rewritten `flushPendingMessages()` with `flushTimers` Map

### Deployment

- Built with `bun run build` (TypeScript compiled successfully)
- Restarted via `pm2 restart message-relay`
- Verified: relay online, queue_depth 48, serving requests

---

## Constants Reference

| Constant | Value | Purpose |
|----------|-------|---------|
| `FLUSH_BATCH_SIZE` | 10 | Messages per replay batch |
| `FLUSH_BATCH_DELAY_MS` | 50 | Delay between batches (ms) |
| `CHANNEL_DEBOUNCE_MS` | 2000 | Debounce window for flush (ms) |
| `DELIVERED_KEEP` | 50 | Max delivered messages kept per agent after pruning |

---

## Remaining Risks

1. **Synchronous `appendFileSync` in `persistMessage()`** — still blocks event loop briefly per message. Could be converted to async for high-throughput scenarios.
2. **No cap on undelivered messages per agent** — if an agent is offline for days, undelivered messages accumulate without limit. Pruning only removes delivered messages.
3. **Startup replay is still unbounded** — `index.ts` startup loop replays all agents sequentially but doesn't await the async `replayUndelivered`. This is fire-and-forget which is fine, but multiple agents' replays run concurrently.
4. **No persistent delivery tracking** — `totalDelivered` counter resets on restart (currently at 0 after restart).

---

## Files Modified

- `src/persistence.ts` — added `batchMarkDelivered()` export, refactored `updateMessageDelivered()` to use it
- `src/delivery.ts` — added throttled `replayUndelivered()`, debounced `flushPendingMessages()`, added `markDeliveredBatch()`
