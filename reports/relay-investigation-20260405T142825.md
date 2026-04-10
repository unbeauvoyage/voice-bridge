# Relay Investigation — Joint Report

**Date:** 2026-04-05T14:28:25
**Investigators:** sunny (delivery/WebSocket/text path), investigator (queue/file I/O)
**Status:** 3 fixes deployed, 4 remaining issues documented

---

## Executive Summary

The relay server has variable delivery reliability due to multiple compounding issues. The CEO's specific problem — typed text messages from the mobile app not reaching Command while audio works — is caused by a CapacitorHttp double-encoding bug (now fixed). General reliability issues stem from blocking synchronous calls on the event loop (now fixed), channel plugin churn, and thundering-herd replay behavior on re-registration.

---

## Issues Found

### FIXED: Text Messages Not Reaching Relay (Root Cause)

**File:** `productivitesse/src/features/mobile/api.ts:118-124`

Audio messages go through voice-bridge (port 3030) which calls relay `/send` via standard Node `fetch()` with proper JSON. Text messages go directly from the phone via `CapacitorHttp.post()` to relay `/send`.

The `sendText()` function passed `data: JSON.stringify({...})` to CapacitorHttp. CapacitorHttp auto-serializes the `data` field when Content-Type is `application/json`, so passing a pre-stringified string causes double-encoding. The server receives a JSON string literal instead of an object, `body.to` and `body.body` are `undefined`, and the server returns 400.

**Fix applied:** Changed to `data: { from: 'ceo', to, body, type: 'message' }` (removed `JSON.stringify`).

### FIXED: Blocking execSync on Event Loop

**File:** `message-relay/src/index.ts:734-740`

The `/voice` endpoint used `execSync` for both ffmpeg conversion (30s timeout) and whisper transcription via curl (30s timeout). These block the entire Node.js event loop — while processing audio, no other requests are handled: not `/send`, not `/register-channel`, not WebSocket messages. pm2 error logs confirm ffmpeg failures (exit code 183).

**Fix applied:** Replaced both with async `execFileAsync` (promisified `execFile`).

### FIXED: playSound() Blocking

**File:** `message-relay/src/delivery.ts:31-36`

`playSound()` used `execSync('afplay ...')` which blocks the event loop on every escalate/waiting-for-input message delivery.

**Fix applied:** Replaced with `spawn('afplay', [...], { detached: true, stdio: 'ignore' })` + `child.unref()`.

### OPEN: Channel Re-registration Churn (CRITICAL)

pm2 logs show productivitesse re-registering its channel port every few seconds with a DIFFERENT port each time. The channel plugin heartbeat is 30 seconds (`channel-plugin/index.ts:166`), but the port changes mean the plugin process is crashing/restarting repeatedly. Each re-registration triggers:

1. `channelPorts.set(agent, port)` — replaces the delivery target
2. `saveChannelPorts()` — writes `_channels.json` to disk
3. `flushPendingMessages(agent)` — reads entire queue file, replays all undelivered

This creates a delivery race condition: a message targets port X, the plugin restarts on port Y before the HTTP request completes, delivery fails, the channel is deleted from the map, and the message sits undelivered until the next re-registration triggers another flush.

**Root cause:** Unknown — needs investigation into why the productivitesse channel plugin keeps dying.

**Recommended fix:**
- Investigate and fix the plugin crash loop
- Add re-registration cooldown (skip flush if same agent re-registers within 5 seconds)
- Add port-change detection (only flush when port actually changes)

### OPEN: Thundering Herd on Replay (HIGH)

**File:** `message-relay/src/delivery.ts:137-151`

`replayUndelivered()` fires `deliverMessage()` for ALL undelivered messages simultaneously. Each message retries up to 10 times with 500ms sleep (5 seconds total). With N undelivered messages, this creates N concurrent HTTP requests to the channel plugin, plus N concurrent `updateMessageDelivered()` file rewrites.

Previously, with 1,655 stuck CEO messages, this meant 1,655 concurrent delivery attempts + file rewrites on every trigger.

**Triggers:**
1. Server restart — replays ALL undelivered for ALL agents
2. Channel re-registration — replays ALL undelivered for that agent
3. Dashboard WebSocket connect — flushes ALL pending CEO messages

**Recommended fix:** Batch replay with concurrency limit (e.g., 5 at a time with sequential processing).

### OPEN: O(n) Persistence Per Delivery (MEDIUM)

**File:** `message-relay/src/persistence.ts:35-53`

`updateMessageDelivered()` reads the ENTIRE queue file, parses every line, updates the matching message, and rewrites the entire file. Called once per successful delivery. During a flush of N messages, that's N full read/parse/rewrite cycles of the same file.

**Recommended fix:** Either batch delivery updates (collect IDs, rewrite once) or maintain an in-memory index of delivered status with periodic flush to disk.

### OPEN: Synchronous File I/O in persistMessage (LOW)

**File:** `message-relay/src/persistence.ts:23-33`

`persistMessage()` uses `fs.appendFileSync` which briefly blocks the event loop on each message. Low impact individually but compounds under load.

**Recommended fix:** Switch to `fs.promises.appendFile` or buffered writes.

### CONFIRMED NON-ISSUE: CORS

CORS hook at `index.ts:422-429` reflects the request origin, allows all methods/headers including custom X-To/X-From/X-Lang, handles OPTIONS preflight. Working correctly.

---

## CEO's Hypothesis Assessment

The CEO suspected queue bloat causing slow delivery. This was **partially correct**:
- Queue bloat (1,655 stuck CEO messages) was real and has been cleaned up by a prior debug agent
- The bloat caused thundering-herd replays on every trigger, degrading performance
- But the specific text-not-reaching issue was a client-side double-encoding bug, not a server-side queue problem
- The intermittent reliability issues are caused by execSync blocking (now fixed) and channel plugin churn (still open)

---

## Fix Priority

| Priority | Issue | Status |
|----------|-------|--------|
| P0 | Text double-encoding | FIXED |
| P0 | execSync blocking event loop | FIXED |
| P1 | playSound() blocking | FIXED |
| P1 | Channel plugin crash loop | OPEN — needs investigation |
| P2 | Thundering herd on replay | OPEN — needs batching |
| P3 | O(n) persistence per delivery | OPEN — needs batching |
| P4 | Sync file I/O in persistMessage | OPEN — low priority |
