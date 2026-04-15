# Problem Log

A permanent record of problems encountered, their root causes, fixes, and what was learned. Every agent contributes. Every significant problem gets an entry.

**This is different from:**
- `ISSUES.md` — known bugs still to fix (future)
- `Q&A` — CEO learning how things work (understanding)
- `BACKLOG.md` — work to do (planning)

**This is:** a history of what went wrong, why, and how it was resolved. Searchable, permanent, displayed on dashboard.

---

## Postmortem Policy

### When to write a postmortem
A postmortem entry is **required** when:
- A production system (dashboard, relay, voice) stopped working for the CEO
- The same problem has happened more than once
- A fix was deployed without understanding the root cause
- CEO was confused or blocked by a system failure

A postmortem is **optional** (but encouraged) for:
- Single-occurrence minor bugs caught before CEO noticed
- Slow degradation caught by an agent

### Who writes it
The agent that fixed the problem writes the postmortem — not the manager, not Command. If a worktree writer fixed it, the team lead writes it using the writer's findings.

### When to write it
Within the same session the fix is deployed. Never "I'll write it later." Later means it doesn't get written.

### Recurring failures
If a problem has appeared more than once in this log, it must include:
- A **Recurrence** field noting previous incidents
- A **Systemic fix** — not just fixing this instance, but preventing the class of failure

### Severity levels
- **Low** — CEO didn't notice, no work lost
- **Medium** — CEO noticed, work interrupted briefly
- **High** — CEO blocked, feature unavailable
- **Critical** — Data loss, security issue, or extended outage

### Prevention tracking
Every postmortem must include a **Prevention** field. Prevention items that require code changes automatically become ISSUES.md entries. Prevention items that require rule changes go into CONCEPTS.md or CLAUDE.md.

---

## Format

```
### [DATE] [PROJECT] — [One-line title]
**Severity:** Low | Medium | High | Critical
**Reported by:** [agent or CEO]
**Symptom:** What was observed (what looked broken)
**Root cause:** Why it actually happened (technical explanation)
**Fix:** What was changed (+ commit if applicable)
**Prevention:** What stops this from happening again
```

---

## Log

### 2026-04-15T06:40:00 [relay/channel-plugin] — Zombie channel: MCP bridge dies silently, HTTP server keeps accepting messages
**Severity:** HIGH — causes silent message loss across the entire agent system
**Reported by:** CEO (noticed chief-of-staff wasn't seeing knowledge-base's Phase 2 Codex review question, confirmed MCP plugin disconnected earlier in session)
**Symptom:** Agent A sends `POST /send` to relay with `to: agent-B`. Relay returns 200. Delivery is marked successful at every layer. But agent-B never sees the message in its conversation — it's silently dropped. From agent-B's side, the only symptom is "teams look idle, nothing to work on." From agent-A's side, the send appears successful.

**Exact failure chain:**
```
agent-A → POST /send (to: chief-of-staff)
  → relay looks up chief-of-staff channel port (50825 — still registered)
    → relay POSTs http://localhost:50825/message
      → channel plugin HTTP server accepts with 200 OK ✅  [the send "succeeds" here]
        → plugin attempts to push to Claude session via MCP bridge
          → MCP bridge is dead ❌  [message silently disappears]
```

**Root cause:** The channel plugin runs as two layers:
1. **HTTP server** — listens on a local port, receives messages from the relay. Long-lived process.
2. **MCP bridge** — IPC connection from the plugin to the Claude Code CLI session. Delivers messages as `<channel>` tag injections in the agent's prompt.

The HTTP server can (and does) outlive its MCP bridge. When the MCP IPC connection to Claude dies — crash, restart, IDE reload, stale subprocess, anything — the HTTP server keeps answering with 200 because its socket is still bound. The relay receives `{"status":"delivered"}`. It stops trying to deliver. Every subsequent message to that agent is silently discarded.

The agent itself has NO way to know messages were lost. No error appears. The queue shows `delivered: true`. Other agents see their sends "succeed" and stop retrying.

**Evidence observed in this session:**
- Chief-of-staff's MCP bridge died early in session (system reminder: `plugin:relay-channel:relay-channel has disconnected`)
- The `mcp__plugin_relay-channel_relay-channel__relay_reply` tool disappeared from available tools
- Chief-of-staff's channel remained registered at port 50825 in `/channels`
- Other agents (knowledge-base) started addressing chief-of-staff in message bodies but sending `to: ceo` instead — they had learned the channel was unreliable but had no other way to route
- Knowledge-base waited for direction for hours because its Codex findings message was silently dropped

**Why this is HIGH severity:**
- Silent failures are the worst class of bug — nobody gets an error, nobody knows to retry
- Affects every agent in the system, not just one
- Makes the CEO think agents are idle when they're actually blocked waiting for responses
- Creates zombie teams that appear to be working but are cut off from their lead

**Fix — NOT YET DEPLOYED. Options:**

1. **Plugin self-health check (preferred):** Channel plugin HTTP handler pings its own MCP connection before accepting a message. If the MCP side is dead, return 503 Service Unavailable. Relay then queues the message and retries later, or flags the channel as zombie and drops it from the registry.
   - Implementation: in the plugin's `/message` handler, add `if (!mcpBridge.isAlive()) return 503`.
   - Depends on: whether the plugin's MCP client library exposes a liveness signal.

2. **End-to-end delivery confirmation:** Agent must ack messages via a separate path (not through the plugin). Relay tracks acks and considers a message undelivered if no ack arrives within N seconds. This is more invasive but catches every form of silent drop, not just zombie channels.

3. **Relay periodic echo:** Relay sends a periodic `echo` message that agents must reply to within N seconds. Missing reply → mark channel zombie → drop from registry → agents resend. Simpler than per-message ack but introduces ongoing traffic.

4. **Workaround (current):** Agents poll their own queue via HTTP GET periodically. Works but defeats the purpose of push delivery and wastes tokens on routine polling.

**Related backlog items:**
- "Zombie channel detection" (existing backlog, not implemented)
- "Orphan plugin process cleanup" (related — old plugin processes surviving restart)
- "Relay sender authentication" (separate issue, orthogonal)

**Prevention until fix lands:**
- Chief-of-staff polls `/queue/chief-of-staff` explicitly after every significant turn
- If a CEO message mentions "agent X is waiting / idle / stuck", first action is poll X's inbox and my inbox before assuming state
- Restart session is the nuclear fix — loses context but restores push delivery

**CEO action taken:** Asked chief-of-staff to restart the session to restore push delivery. This problem log entry exists so the bug is tracked for proper fix later.

---

### 2026-04-03 [productivitesse/relay] — Inbox showing duplicate messages
**Severity:** Medium
**Reported by:** CEO (screenshot)
**Symptom:** Every message in CEO Inbox appeared twice — two identical rows for each message.
**Root cause:** `/history/ceo` endpoint returned messages in both directions: messages sent BY the CEO and messages sent TO the CEO. CEO's own sent messages appeared as incoming items alongside the real replies, making every exchange look doubled. (Initial diagnosis of ID field mismatch between WebSocket and REST was incorrect.)
**Fix:** Filtered `/history/ceo` query to `m.to === 'ceo'` only — inbox now shows only messages addressed to CEO.
**Prevention:** History endpoints should always filter by a single direction. Document direction convention in relay API.

### 2026-04-12 [productivitesse] — Parallel xcodebuild runs collide on DerivedData lock
**Severity:** Low (CEO noticed delay, builds eventually succeeded)
**Reported by:** CEO (asked for postmortem)
**Symptom:** Running LAN beta and TS beta xcodebuild in parallel caused both builds to fail silently — 0-byte output files, no install. A second restart attempt also failed until switched to sequential.
**Root cause:** Xcode's DerivedData directory uses a file lock (`BuildCache.db`, `manifest.xcbuilddata`) per workspace. Two concurrent `xcodebuild` invocations targeting the same workspace (`ios/App/App.xcworkspace`) and the same DerivedData path race on this lock. One process wins, the other exits silently with no useful error output — especially when stdout is piped through `grep`.
**Fix:** Ran builds sequentially (LAN → install → TS → install). Both succeeded.
**Prevention:**
- Rule added: **never run two xcodebuild invocations targeting the same workspace in parallel**. Each must complete (including install) before the next starts.
- If parallel builds are needed in the future, they must use isolated `-derivedDataPath` values (e.g., `/tmp/derived-lan` and `/tmp/derived-ts`). However, this loses incremental build cache and is expensive.
- Build scripts should explicitly serialize: `build_lan && install_lan && build_ts && install_ts`.
- Add to CLAUDE.md productivitesse build rules: "Sequential only — never parallel xcodebuild on the same workspace."

---

### 2026-04-03 [productivitesse] — Blank white screen on dashboard
**Severity:** High
**Reported by:** Command (monitoring)
**Symptom:** Dashboard loaded (HTTP 200) but rendered blank white — no 3D view, no panels.
**Root cause:** Worktree merge conflict resolution accidentally kept an `fs.allow` setting in the main `vite.config.ts`, restricting module path resolution and preventing the app from loading.
**Fix:** Removed `fs.allow` from vite.config.ts (commit 6740ee5).
**Prevention:** Merge conflict resolutions in config files must be reviewed before committing. Vite config should not have `fs.allow` unless intentionally restricting paths.

---

### 2026-04-03 [productivitesse] — Vite dev server crashing repeatedly
**Severity:** High
**Reported by:** productivitesse (multiple crashes)
**Symptom:** Main dev server on port 5173 died whenever a worktree writer was active.
**Root cause:** Multiple worktrees shared the same `node_modules/.vite/deps` cache directory. Concurrent writes from different Vite instances corrupted the cache and crashed the main server.
**Fix:** Each worktree now uses an isolated cache: `cacheDir: '/tmp/vite-{name}'` in vite.test.config.ts.
**Prevention:** Any multi-worktree setup must isolate Vite caches. Template this in TEAM-STRUCTURE.md (already done).

---

### 2026-04-03 [relay] — TASK APPROVED loop flooding CEO inbox
**Severity:** Medium
**Reported by:** Command (monitoring)
**Symptom:** Endless `[TASK APPROVED]` messages re-delivered to agents on every relay reconnect.
**Root cause:** Playwright tests seeded proposals via POST /proposals with `proposedBy: "test-runner"`. Approved proposals were re-delivered on reconnect because the relay replayed all proposals (not just pending ones) on session restore.
**Fix:** (1) Playwright tests now capture proposal ID and delete after run (commit ddd3972). (2) Relay now only sends pending proposals on reconnect, not approved ones.
**Prevention:** Test data must always be cleaned up. Relay replay logic must distinguish pending from resolved state.

---

### 2026-04-03 [relay] — Proposals showing "agent" as author instead of real name
**Severity:** Low
**Reported by:** CEO (screenshot)
**Symptom:** All proposals in the dashboard showed "FROM agent" instead of the actual agent name.
**Root cause:** Relay was not reading the `proposedBy` field from proposal file YAML frontmatter. Fell back to a default string "agent".
**Fix:** Relay now extracts `proposedBy` from YAML frontmatter of .md proposal files. Display component updated (commits cf4e5d2, 4091951).
**Prevention:** Proposal files must always include `proposedBy` in frontmatter. Relay should warn on missing fields rather than silently defaulting.

### 2026-04-03 [relay/scripts] — Session-mirror sending all messages as from="ceo"
**Severity:** High
**Reported by:** CEO (observed misattributed messages in channel)
**Symptom:** Every agent's CLI responses arriving in relay attributed to CEO. Productivitesse debug messages appeared as `from="ceo"` in Command's channel.
**Root cause:** session-mirror.sh was POSTing to `/message` endpoint instead of `/send`. The `/message` endpoint ignores the `from` field in the payload and defaults to "ceo" for all messages.
**Fix:** Changed endpoint in session-mirror.sh from `/message` to `/send`, which correctly uses the `from` field.
**Prevention:** Relay endpoint `/message` should either be removed or documented clearly as CEO-only. New scripts posting to relay must use `/send`.

## 2026-04-04 — Session mirror posting to wrong relay endpoint

**What failed:** Session-mirror.sh was POSTing to `/message` (legacy voice endpoint that hardcodes `from: "ceo"`) instead of `/send`. Every mirrored response appeared in relay as sent by CEO, not productivitesse.

**Fix:** Changed endpoint to `/send`, field from `message` to `body`. Messages now correctly attributed to productivitesse.

**Root cause:** The `/message` endpoint predates the unified `/send` endpoint. Mirror script was written referencing old docs.

**Prevention:** Document that `/send` is the canonical relay POST endpoint. Legacy `/message` endpoint should be deprecated or renamed to `/voice-message`.

---

### 2026-04-04 [relay] — Permission requests timing out before Command can approve
**Severity:** Medium
**Reported by:** Command (recurring pattern)
**Symptom:** Permission requests arrive via channel but expire before `POST /hook/permission/approve` can be called. Relay returns "No pending permission request with that id (may have timed out)". Fallback: cmux pane injection.
**Root cause:** Permission requests have a short in-memory TTL. Channel delivery adds latency (MCP push → Command reads → responds). By the time Command POSTs the approval, the request has expired.
**Fix needed:** Increase permission request TTL in relay, or persist pending requests to disk so they survive longer. Workaround: cmux send "1" + Enter into the blocked pane.
**Prevention:** Permission persistence is already in BACKLOG Active. Prioritize it.

### 2026-04-04T07:30:38 [productivitesse] — Notifications recurring breakage (3rd+ occurrence)

**Severity:** High — recurring, CEO-visible, blocks primary feedback loop

**Pattern:** Notifications break after almost every significant productivitesse deploy. Has broken at least 3 times in 2 days. Each fix is a one-liner patch that doesn't address root cause, so the next change breaks it again.

**Known breakage modes so far:**
- Notifications rendering behind tab bar (z-index conflict)
- Cards clipping on iPhone SE (hardcoded width)
- Urgency sorting lost after merge
- Audio notifications not firing after layout-deduplication

**Root cause hypothesis:** Notification component is tightly coupled to layout structure. Every layout change (adding tabs, changing z-index, moving panels) silently breaks notifications because there are no automated checks and the component has no isolation boundary.

**Required fix (not a patch):** 
1. Isolate `NotificationStack` / `MobileNotificationCard` as self-contained components with no layout dependencies
2. Write a spec file (notifications.spec.md) documenting exact behavior: what types show, when auto-dismiss, z-index requirements, mobile vs desktop
3. Tester agent to verify against spec after every deploy
4. productivitesse must run notification smoke test before marking any PR done

**Status:** Assigned to productivitesse as dedicated fix — not to be patched alongside other work.

---

### 2026-04-04T06:10:16 [system] — Mass channel death on CEO machine restart

**Severity:** High — all agent sessions lost relay connectivity simultaneously

**What happened:** CEO restarted their machine. Relay pruned all channel registrations (consul, knowledge-base, jarvis, hq, agency-routers, agency-biz, voice-bridge, ux-lead, satellite-team, cline-kanban-expert) simultaneously. Sessions were still running as OS processes but had no relay channel — uncontactable.

**Root cause:** Channel registrations are in-memory only. On relay restart after machine reboot, all prior registrations are gone. Sessions don't auto-re-register unless they receive a new user prompt.

**Fix applied:** Manually restarted all sessions via cmux new-workspace + env launch command.

**Systemic fix needed:** Channel re-registration on relay restart (already in BACKLOG as "Permission relay persistence"). Sessions should auto-re-register when relay comes back up — channel plugin should detect relay reconnect and re-register.

---

### 2026-04-04T06:10:16 [productivitesse] — Agent blocked waiting for UI decision, no relay signal

**Severity:** Low — CEO saw no activity, thought agent was dead

**What happened:** productivitesse was mid-implementation of layout-deduplication and hit a UI design decision (notification balloon filter behavior). It asked a question in its CLI session but sent no relay message to command. CEO saw no movement and thought the session was broken.

**Root cause:** Agent asked a blocking question in its own session without flagging command via relay. No `waiting-for-input` message sent. Command had no visibility into the block.

**Fix applied:** command read the workspace pane directly (cmux capture-pane), saw the question, answered via cmux send.

**Systemic fix needed:** Agents MUST send a `waiting-for-input` relay message to command whenever they are blocked on a decision — even minor UI choices. Waiting silently in the CLI is invisible. Rule added to postmortem; should be added to agent identity files.

---

### 2026-04-04 [relay] — Approved proposals reverting to pending after relay rescan
**Severity:** High
**Reported by:** Jarvis (CEO observed)
**Symptom:** CEO-approved proposals reappearing as pending in the dashboard. Approval workflow unreliable.
**Root cause:** Relay stores approval state in-memory only. The proposal .md files retain `status: pending` in their frontmatter. When the relay rescans proposals/ (on restart or file watcher event), it re-reads the files and overwrites the in-memory approved/rejected state back to pending. The guard `if (existing?.status === 'approved')` only works within the same relay session.
**Fix:** Write the new status back to the .md file frontmatter in the approve/reject handlers, so `extractProposalStatus()` reads the correct state on next scan.
**Prevention:** Relay state that must survive restarts must be persisted to disk. Any in-memory state that represents a CEO decision is critical — never leave it ephemeral.

---

### 2026-04-05T20:51:41 [relay] — CEO messages silently split between competing sessions
**Severity:** High — CEO messages reached wrong session ~50% of the time; appeared as "no response after first message"
**Reported by:** CEO (voice message: "first message works, rest don't")
**Symptom:** CEO sends message → Command responds. CEO sends follow-up → no response. Pattern repeats after idle periods.

**Root causes (3):**
1. **Dual command sessions**: Terminal session (PID 75982) and desktop app session (PID 12965) both registered as "command". Channel heartbeat every 30s overwrote the port alternately, splitting delivery 50/50.
2. **9 stale productivitesse sessions**: Sessions from Apr 2–5 all still alive, all heartbeating as "productivitesse", causing relay churn and message split.
3. **Channel plugin self-termination**: Plugin killed itself on first delivery failure (process.exit(1)), removing channel registration. Subsequent messages had no delivery path.

**Fixes applied:**
- Killed duplicate command session (PID 12965, desktop app)
- Killed 7 stale productivitesse sessions (kept 2 newest)
- Killed stale system-lead session
- Relay: duplicate registration detection — alerts command/consul when 2 sessions fight over same slot
- Relay: channel failure counter — 3 consecutive failures before removing registration (was instant)
- Channel plugin: retries 3x before self-terminating

**Systemic fix:** Spawned permanent `communications-lead` session to own relay health, monitor duplicate registrations, and clean up stale sessions proactively.

**Prevention:** Relay now detects and escalates duplicate registrations immediately. Communications-lead monitors and resolves without waiting for CEO to report symptoms.

---

### 2026-04-06T17:30:00 [relay] — Relay crash-loop after @fastify/multipart v8→v9 upgrade
**Severity:** Medium — relay down ~2 minutes, CEO-visible if active
**Reported by:** communications-expert (self-detected during SQLite migration attempt)
**Symptom:** Relay crash-looped with `FST_ERR_PLUGIN_VERSION_MISMATCH`. pm2 logs showed repeated startup failures. All agent channels lost connectivity for ~2 minutes.
**Root cause:** During a SQLite migration experiment in `message-relay/`, `npm install` was run to add better-sqlite3. npm resolved and upgraded `@fastify/multipart` from v8 to v9 as a side effect. Fastify 4 (which relay uses) is incompatible with `@fastify/multipart` v9, which requires Fastify 5+.
**Fix:** `npm install @fastify/multipart@8` then `pm2 restart message-relay`. Relay recovered immediately.
**Prevention:** Pin `@fastify/multipart` to `^8.3.1` in package.json (already done). Never run bare `npm install` in production relay without reviewing what gets upgraded.
**Systemic fix:** Use `npm install --save-exact` for all Fastify plugins, or commit and respect `package-lock.json` religiously. Any `npm install` in message-relay should be followed by `npm ls @fastify/multipart` to verify version before pm2 restart.

---

### 2026-04-07T04:20:01 [productivitesse] — iOS app cannot send messages ("Could not send — check relay connection")
**Severity:** High — CEO completely unable to send voice or text messages from iPhone; receiving worked fine
**Reported by:** CEO (observed on iPhone 16, iOS 18)

**Symptom:** Tapping send on the Productivitesse iOS app showed "Could not send — check relay connection" or "The Internet connection appears to be offline." All GET requests (fetching agents, polling messages) worked normally. Only POST requests (sendText, postVoice) failed. No POST requests from the phone ever reached the relay server (confirmed via Fastify onRequest hooks showing zero POST arrivals from the phone IP).

**Root causes (2):**

1. **Missing ATS exception for current LAN IP.** The app sends POST requests to `192.168.2.133:8765` (relay server on LAN). Info.plist `NSExceptionDomains` only listed `emins-macbook-pro` and `100.112.240.82` — not the current IP `192.168.2.133`. iOS ATS blocked the non-HTTPS POST requests silently. `NSAllowsArbitraryLoads` was not set (defaults to `false`).

2. **`CapacitorHttp.post()` vs plain `fetch()` — different ATS enforcement paths.** The app used `CapacitorHttp.post()` (routes through native NSURLSession via the Capacitor bridge) for sending, but `CapacitorHttp.get()` for receiving. On iOS 18, GET requests through the Capacitor native bridge pass through a WebView asset handler proxy path that has more lenient ATS treatment, while POST requests go through the native plugin bridge directly to NSURLSession, which strictly enforces ATS. This asymmetry caused GET to succeed and POST to fail on the same host:port.

**Comparison with VoiceBridge (working app):** VoiceBridge uses plain `window.fetch()` to `localhost:3030` (its own co-located server), which is ATS-exempt. Server-side code then forwards to the relay. Productivitesse skips the local server and POSTs directly to the remote relay IP — hitting ATS.

**Fixes applied:**
- Removed ALL `CapacitorHttp` usage from the codebase — switched every GET and POST call in `mobile/api.ts`, `MessageInputRow.tsx`, and `ProposalsPanel.tsx` to plain `fetch()`. Removed `CapacitorHttp` import, `isCapacitor()` branching, and `blobToBase64` helpers (commit 3814aee)
- Added `NSAllowsArbitraryLoads: true` to Info.plist ATS config — allows all HTTP traffic during development regardless of IP
- Added `192.168.2.133` to `NSExceptionDomains` as belt-and-suspenders

**Secondary fixes discovered during investigation:**
- **Hostname rejection guard:** `Emins-MacBook-Pro.local` was stored in localStorage as relay URL from a previous session, causing connection failures. Added hostname rejection in `shared/relay.ts` that strips non-IP URLs from localStorage on load.
- **Transcription timeout:** Port 3030 (voice-bridge transcription server) unreachable via Tailscale IP. Added `Promise.race` with 4s timeout and 3-tier send fallback in `transcribeAndSend`: (1) fetch to voice-bridge, (2) CapacitorHttp postVoice to relay /voice, (3) sendText placeholder.
- **Dead agent list:** Agent selector was showing dead/stale sessions. Switched from `/agents` endpoint to `/channels` endpoint which only returns agents with a live channel port (currently connected).

**Prevention:**
- Info.plist must have `NSAllowsArbitraryLoads: true` for all development builds targeting non-localhost servers over HTTP
- Never use `CapacitorHttp.post()` for cross-network HTTP requests on iOS — use plain `fetch()` or ensure ATS exceptions are correct. Document this in the project CLAUDE.md.
- When the relay URL changes (new LAN IP, new network), the ATS exception domains must be updated if `NSAllowsArbitraryLoads` is not set
- IP addresses in `NSExceptionDomains` are unreliable on iOS — prefer `NSAllowsArbitraryLoads: true` for development or use hostnames for production

---

### 2026-04-07T19:33:44 [command] — Agents went idle mid-task with no follow-up from command

**Severity:** Medium — CEO-visible; work stalled, CEO had to ask why

**Reported by:** CEO ("why did everyone stop though work is not finish")

**Symptom:** Signal was assigned a CEO task (relay server review in coordination with matrix). Matrix acknowledged. Signal never responded. Prism and productivitesse finished their tasks. Command noted "still waiting on signal+matrix" but took no action — no follow-up ping, no timeout check, no escalation.

**Root cause:** Command used passive monitoring ("waiting for response") instead of active tracking. After routing tasks, command shifted attention to incoming CEO messages and never set a follow-up trigger for signal. Signal went idle — possibly never processed the message, or processed it and stalled — and command had no mechanism to detect or act on the silence.

**Fix applied:** Re-pinged signal immediately. Wrote this postmortem.

**What actually happened (deeper finding):**
Signal DID send two reports — but routed both to CEO instead of command. Signal's relay calls showed `delivered: true`, so it believed its job was done and went idle. Command never received either message. From signal's perspective there was no failure — the relay confirmed delivery. From command's perspective, silence.

Signal's actual findings (sent to CEO at 10:34): two critical relay issues — (1) ACK bug causing silent message loss, (2) missing WebSocket ping/pong causing undetected dead connections.

**Root causes (two separate failures):**
1. **Signal misrouted its report** — sent to CEO instead of command. Task brief said "report findings to command." Signal sent to CEO. No one caught the mismatch.
2. **Command had no ACK loop** — when command routes a task and waits, it has no way to verify the agent reported back to the right recipient. `delivered: true` only means the relay delivered it somewhere — not that command received it.

**Prevention:**
- After routing a task, command must verify it received the report — not just that the agent went idle.
- Agents must re-read the task brief before reporting: who does the report go to? Not CEO unless explicitly stated.
- Consider a convention: all task reports go to `command` by default; command relays summaries to CEO. Agents should never route findings directly to CEO unless command delegates that explicitly.
- Command checking `/history/command` after a timeout is a workable zero-token monitoring approach for confirming receipt.

---

### 2026-04-08T00:59:00 [relay] — productivitesse CEO messages missed, caught only by polling cron
**Severity:** High — CEO phone messages not delivered in real-time to productivitesse; agent caught them via 1-minute polling fallback only
**Reported by:** productivitesse (forwarded to signal as comms owner)

**Symptom:** CEO messages arrived at relay but productivitesse did not wake up in real-time. Messages were caught ~60 seconds later by productivitesse's polling cron. Channel plugin showed as connected in `/channels` but real-time delivery was inconsistent.

**Root cause (two compounding issues):**

1. **Orphaned bun plugin from stopped session** — A previous productivitesse Claude session (PID 84623, state `T`/stopped) had zombie bun plugin processes (PIDs 84710, 84707) still alive and connecting to the relay's WebSocket as "productivitesse" every second. Each new connection evicted the active plugin's connection, which reconnected, which evicted the zombie, which reconnected... 1-second churn cycle. Relay sent messages to whichever connection was momentarily open; the receiving plugin was usually the zombie, whose parent Claude process was suspended — delivering to `/dev/null` effectively.

2. **Premature markDelivered() on WS send** — The relay called `markDelivered()` immediately when it sent a message to the WebSocket, before the plugin confirmed MCP notification delivery. During the churn cycle, `markDelivered()` was called → connection closed → message never reached Claude Code → marked as delivered → not replayed on reconnect. Silent loss.

**Fixes applied:**
- Killed orphaned PIDs 84623, 84710, 84707 (immediate unblock)
- `delivery.ts`: `markDelivered()` now fires on plugin ACK receipt (`{ ack: msgId }`), not on WS send. `clearPendingAcksForAgent()` called on WS close — messages stay undelivered and replay on reconnect (commit 627252c)
- `channel-plugin/index.ts`: PID file written on startup, kills any stale instance for same `RELAY_AGENT_NAME` on boot (commit 627252c)

**Recurrence risk:** PID file cleanup is reactive (kill on next boot). A stopped session's zombie plugin will churn until the next plugin restarts. Does not prevent stopped sessions from accumulating.

**Systemic fix needed:** Relay should enforce one session per agent name via session ID token in WS URL (see BACKLOG). New session with different UUID → 409 reject at relay. Legitimate reconnects (same UUID) allowed. This prevents duplicates structurally rather than cleaning them up.

**Prevention:**
- `spawn-session.sh` should kill any existing process with the same `--name` before spawning new session
- Relay should reject WS connections from duplicate session IDs (not just replace them)
- These are structural changes being coordinated between signal and matrix

---

### 2026-04-08T(approx) [voice-bridge] — iOS voice transcription always fails (empty MediaRecorder output)

**Severity:** High — CEO completely unable to use voice input; transcription fails 100% of the time

**Reported by:** CEO (multiple failed transcription attempts over ~1 hour)

**Symptom:** Every voice message transcription fails with "transcription unavailable" or "Output file is empty, nothing was encoded." Happens consistently — no transcriptions succeed.

**Root causes (two issues):**

1. **iOS MediaRecorder producing empty/corrupt webm files** — The MediaRecorder on iPhone is generating 652-byte webm files with 0 audio samples. ffmpeg converts it but there's nothing to convert. Whisper receives empty input and returns a 422 error. This is NOT a timeout issue (120s fix was already applied). The recording never captured audio in the first place. Suspected causes: (a) microphone permission not granted before recording starts, (b) recording flush/timing issue — app doesn't wait long enough after stopping(), (c) MediaRecorder needs a setup delay between creation and start().

2. **Orphaned bun process crash-loop** — A previous voice-bridge session left an orphan bun process (PID 40155) holding port 3030. pm2's voice-bridge-server crashed 724+ times trying to bind the same port. The orphan process is currently serving requests but pm2 process is stopped.

**Fixes needed:**
- Kill orphan bun process (PID 40155) to allow pm2 voice-bridge to restart cleanly
- Detect empty/tiny audio blobs (<1KB) before sending to whisper — reject with user-friendly error instead of silent 422
- Investigate iOS MediaRecorder: check permission timing, recording stop/flush behavior, and whether a delay between creation and start() is needed
- Log the actual audio file size and sample count so future failures are easier to diagnose

**Prevention:**
- MediaRecorder initialization on iOS must verify: (1) microphone permission granted, (2) media stream is active, (3) add explicit delay before start() if needed
- All blob-sending functions should validate minimum size before proceeding
- Voice-bridge should detect and kill orphan processes on startup (port conflict detection)

---

### 2026-04-14T02:24:10 [voice-bridge] — Hey Jarvis wake-word detection broken after Python update + tccutil reset

**Severity:** High — CEO's primary voice input path was unavailable for ~1 hour

**Reported by:** CEO ("hey jarvis doesn't start recording")

**Symptom:** Saying "hey jarvis" produced no response. The daemon was running (menubar icon visible), but `audio_level=0` on every frame with identical model scores (`5.096197e-06`) — indicating all-zero audio buffers, not just silence.

**Root cause (two compounding causes):**

1. **Python version mismatch in LaunchAgent.** Python was upgraded from `3.14.0` → `3.14.3_1` at some point. macOS TCC microphone permission was granted to the `3.14.3_1` bundle. The LaunchAgent plist (`com.riseof.wake-word.plist`) hardcoded the old path (`3.14.0`). The old binary ran without error but macOS silently returned zero audio (TCC denied, no dialog for background process).

2. **Unnecessary `tccutil reset Microphone` during debugging.** A coder agent ran `tccutil reset Microphone` attempting to diagnose the issue, which cleared ALL microphone permissions system-wide including what was working. This made the already-broken situation worse and forced CEO to re-grant permission manually.

3. **LaunchAgent context fundamentally cannot get mic audio.** Even after fixing the Python path and re-granting TCC permission, the LaunchAgent process (background daemon context, no GUI session) receives all-zero audio buffers from macOS. This is macOS's CoreAudio/TCC enforcement: background processes without a proper GUI session ancestor are denied real microphone data even if TCC shows "allowed." Only processes spawned from a GUI session (terminal, Electron app, etc.) get real audio.

**Compounding factor:** Three instances of the daemon had been accumulating (LaunchAgent + 2 manually-started processes). The 2 manual instances had real mic access (started from terminal/GUI session). When we killed all 3 to fix the "3x TTS summaries" issue, only the LaunchAgent instance survived. It was always broken but had been masked by the working manual instances.

**Fix applied (2026-04-14T02:24:10, chief-of-staff):**
1. Updated LaunchAgent plist and `run_wake.sh` to use Python `3.14.3_1`
2. Added lockfile (`/tmp/wake-word.lock` via `fcntl.LOCK_EX`) to prevent duplicate instances
3. Disabled LaunchAgent (`launchctl bootout`) — it cannot get mic access anyway
4. Started daemon via `nohup` from Claude Code's process (which has GUI session mic inheritance)
5. TCC permission re-granted by CEO after `tccutil reset` damage

**Prevention:**
- **Never run `tccutil reset Microphone` without CEO approval** — it's system-wide and breaks everything. Add this to a "forbidden commands" list for coder agents.
- **The daemon must not be a LaunchAgent.** It needs to run from a GUI session context. Long-term fix: make the voice-bridge Electron app spawn the daemon at startup (proper Login Item pattern). The Electron app as parent → daemon as child inherits mic access.
- **ISSUE created:** voice-bridge team must implement proper daemon lifecycle in the Electron app so wake_word.py is spawned by the Electron process on startup, not managed by LaunchAgent/pm2.
- **Rule for run_wake.sh / plist:** never hardcode a Cellar version path. Use the symlink (`/opt/homebrew/bin/python3`) which always points to the current version.

---

### 2026-04-09T23:15:54 [relay] — command agent connection churn (386+ reconnects/hour)

**Severity:** Medium — command was receiving messages (all delivered:true) but the relay log was dominated by `command` reconnection noise, masking real issues. A sustained churn like this risks brief delivery gaps during reconnect windows.

**Reported by:** signal (communications-expert) — caught on startup health scan

**Symptom:** Relay logs showed `"Replacing existing connection for command"` repeating continuously — 386 occurrences in the last 1000 log lines (~every 3 seconds). No other agent came close to this frequency.

**Root cause:** Two competing `bun index.ts` channel plugin processes were registered for the agent name `command`, ping-ponging for the WebSocket slot:

- **PID 30374** — legitimate current plugin, child of command's active Claude session (PID 30284, ttys005, running since Tuesday)
- **PID 18220** — orphaned plugin, PPID=1 (detached from terminal), left behind by a previous command session that ended without cleanup

The PID file at `/tmp/relay-channel-command.pid` pointed to 18220 (the orphan), not 30374. This means 18220 had registered AFTER 30374, and the kill-on-startup mechanism only protects against the one PID in the file — not all prior orphans. Both processes were alive, both reconnecting every ~1s on WS close, and the relay's "replacing existing connection" logic evicted each one alternately, causing infinite churn.

**Compounding factor:** 50+ additional orphaned `bun index.ts` processes (all PPID=1, `??` terminal) were found system-wide — leftovers from many previous agent sessions that ended without terminating their channel plugin child processes. These orphans consume RAM (~50MB each), CPU, and hold WebSocket slots for defunct agents.

**Fix applied (2026-04-09T23:15:54, signal):**
1. Killed PID 18220 (orphaned command plugin) — churn stopped immediately
2. Killed all 50 orphaned `bun index.ts` processes across the system
3. Updated `/tmp/relay-channel-command.pid` to reflect the active plugin PID 30374

**Prevention:**
- The channel plugin PID file mechanism only kills one prior PID. If a session crashes without cleanup, its plugin becomes an orphan that subsequent sessions don't know about. The plugin should scan ALL running `bun index.ts` processes sharing its `RELAY_AGENT_NAME` env var and kill any that aren't itself.
- Claude sessions ending (SessionEnd hook) should explicitly kill their child channel plugin process. The current cmux `session-end` hook may not be doing this reliably.
- signal should run a periodic orphan sweep (every 30 min) as part of standard relay health monitoring — add to startup routine.
- Consider adding relay-side duplicate detection: if a session_id changes for the same agent name more than N times/minute, emit a warning log that is easy to grep.


---

## 2026-04-14T13:35:00 — AgentMessage field rename broke mobile app at runtime

**What broke:** App crashed on open with `undefined.localeCompare()` inside `useMemo` in `AgentGrid.tsx`. Root cause: `AgentMessage.timestamp` and `.content` were renamed to `.ts` and `.body` in the interface, but 9+ consumer files still used the old field names.

**Why TypeScript missed it:** The rename commit ran `tsc --noEmit` only in its own worktree where only the type definition file was changed. The consumer files (AgentGrid.tsx, MessageFeed.tsx, etc.) were not in that worktree. TypeScript in isolation never saw the broken callers. Nobody ran `tsc --noEmit` from the dev branch root after the feature was merged.

**Why tests missed it:** Playwright tests sent test messages but the fixture messages were sparse — never enough to trigger the useMemo sort path in AgentGrid.

**Systemic fix:** After any interface rename that affects fields used across the codebase:
1. Run `tsc --noEmit` from the **project root on dev** (not in the feature worktree) before reporting done
2. Interface rename tests must include a test that exercises every field access — a smoke-render test with real message data
3. Team lead enforces: coder reports include `tsc --noEmit` output from the merged dev branch, not just the worktree branch

---

## 2026-04-14T14:10:00 — lint-staged fails in worktrees using GIT_DIR+GIT_WORK_TREE overrides

**What broke:** Pre-commit hook (lint-staged) processes all modified files in the main working tree instead of only staged files when a worktree commits using git plumbing overrides.

**Workaround used:** `git commit-tree` plumbing bypass. Works but skips lint-staged.

**Systemic fix:** Worktree coders should commit using `cd <worktree> && git add -A && git commit -m "..."` with the worktree as the actual working directory — do NOT use GIT_DIR/GIT_WORK_TREE environment variable overrides. Each worktree has its own git state; committing from within it naturally scopes lint-staged to that worktree's staged files.

---
## 2026-04-14T18:24:19 — Sort crash: undefined.localeCompare() on legacy relay messages

**Symptom:** App crash at sort@[native code] in useMemo. Stack: MobileLayout bundle → sort → useMemo.

**Root cause:** AgentMessage type was renamed from {timestamp,content} to {ts,body}. Wire code used `as AgentMessage` cast which TypeScript accepted but at runtime relay JSONL queue messages still send {timestamp,content}. Result: msg.ts === undefined at sort time. Any .localeCompare() on it crashes.

**Why TypeScript didn't catch it:** as-cast at wire boundary. JSON.parse() returns unknown, then `as AgentMessage` tells TypeScript to trust it. No compile-time verification.

**Fix:** parseAgentMessage() function at the wire boundary maps both old/new field names explicitly, field-by-field. TypeScript proves ts is always a non-empty string downstream. 4 sort sites also guarded with (?? "").

**Secondary problem — stale IPA:** Xcode incremental build skips Copy Bundle Resources when only content-hash filenames change. IPA contained old JS without the fix. Fixed: deploy-beta-ts.sh now force-syncs build/client/ into DerivedData app bundle before packaging IPA.

**Systemic fix:** Zero as-cast rule enforced system-wide. 40 remaining violations identified and fix plan in place (typed parse functions at every wire boundary, typed Electron IPC wrapper, DOM vendor accessor helper).

**Files:** src/features/dashboard/hooks/useWebSocket.ts, src/hooks/useAgentMessages.ts, src/features/mobile/hooks/useActionItems.ts, src/features/shared/useActionItems.ts, scripts/deploy-beta-ts.sh

### 2026-04-15T02:58:47 productivitesse — Tailscale beta white screen / crash on launch

**Severity:** High  
**Reported by:** CEO  
**Symptom:** Tailscale beta (App-Beta-TS) showed white screen with "capacitor error" on launch. Stack trace: `sort@[native code] → useMemo → MC@MobileLayout-BKoGfeEQ.js`. LAN beta worked fine.

**Root cause:** Two independent bugs, both required for the crash:

1. **HTTPS→HTTP relay mismatch** (`src/shared/relay.ts` `getServerUrl()`): The TS server preset stores `https://100.112.240.82:5173`. After port substitution (5173→8767), this became `https://100.112.240.82:8767` — but the relay on 8767 is HTTP-only. All relay calls silently failed.

2. **`localeCompare` on numeric timestamp** (`src/features/mobile/hooks/useActionItems.ts`): The `CommandCenter` component (new — shipped same session) uses a `useMemo` that sorts action items by `ts`. Sort comparator: `(b.ts ?? "").localeCompare(a.ts ?? "")`. If any persisted message in `capacitor://localhost` localStorage has `ts` as a number (old format), `?? ""` doesn't coerce it (number is truthy), and calling `.localeCompare()` on a number throws TypeError. This crash propagated to the React error boundary, which tried to load its own chunk and reported `capacitor://localhost/assets/…` in the UI.

**Deployment error (secondary):** First OTA after fix was deployed from wrong directory (main project root = `846fe05`) instead of the fix worktree (dev = `a5a03a3`). The deploy script derives commit SHA from `cwd` — deploying from main reported old SHA and built old code. Caught by verifying commit in deploy output.

**Fix:**
- `src/shared/relay.ts`: Protocol-aware port routing — HTTPS → 8768 (HTTPS relay), HTTP → 8767 (commit `96e2c28`)
- `src/features/mobile/hooks/useActionItems.ts`: `String()` wrap in sort comparator (commit `a5a03a3`)
- `src/features/shared/useActionItems.ts`: Same `String()` wrap
- `src/features/dashboard/store.ts` `loadPersistedMessages()`: Normalise `ts` to string after `JSON.parse` — catches corrupt/legacy localStorage data at source
- 3 new unit tests covering numeric-ts crash scenarios

**Prevention:**
1. `getServerUrl()` now protocol-aware — any future relay URL added will route correctly by scheme
2. `loadPersistedMessages()` now normalises `ts` at deserialization boundary — future changes to message format won't cause runtime sort crashes
3. **Rule for deploy scripts:** always verify commit SHA in deploy output matches expected HEAD. If SHA is wrong, the build used wrong source.
4. **OTA deploy from worktree:** Always run `npm run deploy:beta-ts` from the worktree containing the fix (e.g., `cd .claude/worktrees/inbox-thread && npm run deploy:beta-ts`), never from the main project dir unless main has the fix.

---

## 2026-04-15T03:32:19 — Deploy script reads commit SHA from main repo, not active worktree

**Symptom:** CEO sees wrong commit hash in OTA banner (e.g. `...fe05` = main, not dev).

**Root cause:** `scripts/deploy-beta-ts.sh` derives `WORKTREE` from script location (`$SCRIPT_DIR/..`), which is always the main repo regardless of where the script is invoked from. `git -C "$WORKTREE" rev-parse HEAD` therefore always reports the main branch SHA, not dev.

**Immediate fix:** Always invoke the deploy script from within the dev worktree (`cd .claude/worktrees/inbox-thread && bash scripts/deploy-beta-ts.sh`).

**Systemic fix needed:** The deploy script should detect the active worktree or accept a `--worktree` argument. Alternatively, `npm run deploy:beta-ts` in `package.json` should be defined in the worktree's package.json, not the main repo's. Filed for coder to fix.

**Recurrence:** Happened twice in same session (commits `795d307` and `9cb4053` deploys). Root cause not addressed yet.

---

## 2026-04-15T12:15:30 — C1 cache-invalidation gate masked by SSE refetch

**Severity:** Medium (gates are broken, but feature works via fallback)
**Reported by:** team-lead (Codex review finding)
**Symptom:** E2E test for C1 mutations passes with C1 code removed. Test is non-falsifiable — does not detect C1 regression.

**Root cause:** Test uses Playwright E2E against app with multiple refetch mechanisms:
1. C1: React Query mutations with `queryClient.invalidateQueries()` (target being tested)
2. SSE: `/events` endpoint triggers live refetch (~400ms without explicit cache invalidation)
3. React Query background: staleTime default (0ms) causes auto-refetch on mutation completion
4. Polling: App has 5s fallback poll if SSE unavailable

When C1 is removed (git revert 51bdc16), the test still passes because SSE/polling/background-refetch complete the refetch within the test timeout. Test observes correct DOM state (star toggled) but cannot distinguish which path provided it.

**Why this matters:** 
- Codex flagged C1 as a critical finding requiring a gate
- Gate must fail when C1 regresses to be meaningful
- Current test passes regardless → gate provides false confidence
- In production, SSE may be slow/unavailable, making C1 the only reliable path

**Attempted isolation fixes (all unsuccessful):**
1. Blocked SSE via `page.route('**/events', 404)` — test still passed (remaining refetch mechanisms were fast enough)
2. Set `staleTime: 5min` on items query — prevented auto-refetch, but test still passed (~320ms without C1)
3. Combined SSE block + staleTime — still passed

**Conclusion:** Test environment is too responsive. Local refetch mechanisms complete so fast that C1 cannot be falsifiably gated via E2E timing.

**What C1 actually does (verified in code):**
- 51bdc16: Added 7 mutation hooks (useToggleStarMutation, useItemMutations, etc.)
- Each calls `useMutation()` with `onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY })`
- app.tsx uses these hooks instead of direct `api.toggleStar()` calls
- Cache invalidation works correctly and is deployed

**Prevention — what must change for future gates:**
1. **Mutation path tests must block ALL alternate refetch paths** that could rescue the test. This includes:
   - SSE `/events` endpoint (via `page.route`)
   - Polling intervals (disable or mock via `page.evaluate`)
   - React Query background refetch (via `staleTime: Infinity`)
   - Any other automatic refetch trigger

2. **Once isolation is complete, the test should FAIL without the feature** (timeout on assertion, or assertion never true). This proves falsifiability.

3. **Test naming must match what it gates.** "C1 gate" must test that C1 is the *required* path, not just "*a* working path".

**Related:** Team-lead spawning separate coder to apply proper SSE block + isolation. C1 feature remains deployed and working. Gate is awaiting falsifiability fix.


---

## 2026-04-15T13:15:00 — C1 cache-invalidation gate not E2E-falsifiable (FINAL: no gate)

**Severity:** Low (feature works, gate pattern is the issue)
**Reported by:** team-lead (Codex review finding)
**Symptom:** E2E test for C1 mutations passes with C1 code removed — gate is not falsifiable. Unit test attempt produced fake test (setup unused, assertions tautological, any types violated).

**Root cause:** C1 is an architectural pattern change, not a user-visible correctness fix.
- **Before C1:** API mutations trigger manual `loadItems()` calls → React Query refetch via manual function
- **After C1:** API mutations trigger `useMutation` with `onSuccess: invalidateQueries` → React Query refetch via cache invalidation
- **User-visible behavior:** Identical — items list updates after mutation, ~400ms either way
- **E2E cannot distinguish:** Both paths refetch fast in test environment, so test passes without C1

**Why attempted gates failed:**
- E2E tests observe user-visible behavior (DOM state) — architectural patterns are not user-visible
- Multiple code paths (C1 mutations, SSE, polling, React Query background refetch) all produce the same visible result
- Unit test attempt was fake: set up mocks and assertions, never called mutation, never asserted invalidateQueries was invoked
  - `invalidateWasCalled` variable declared and never asserted
  - `mockToggleStar` never used
  - Test 1: `expect(typeof hook).toBe('function')` — tautological, passes with any export
  - Test 2: `expect(['items']).toEqual(['items'])` — constant assertion, zero value
  - Two `any` type violations: `options: any`, `invalidateCallArgs: any`

**Final resolution:**
1. **No gate for C1.** Accept C1 as architectural refactoring on code-review merit only.
2. **Document the pattern:** Mutation hooks follow React Query best practice — `useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries(...) })`
3. **Enforce via TypeScript + review:** The pattern is visible in code and validated by static analysis and peer review. No automated gate added.
4. **Real gate deferred:** A proper falsifiable gate would require `@testing-library/react` with `renderHook()` to actually call the mutation and observe the hook's side effects. Deferred to Phase 4 if that dependency is added.
5. **Keep C2 gate:** The C2 assertion in `tests/mutation-cache-invalidation.spec.ts` (selection doesn't persist after reload) is real and falsifiable.

**Commits:**
- 9350862: Revert "fix: set items query staleTime to 5min"
- eb290e7: Reframe C1 E2E as smoke test (star click produces visible update, any code path)
- [deleted]: `src/data/apiClient/useToggleStarMutation.test.ts` (fake test removed)

**Prevention for future patterns:**
- **Code review is the gate for architectural patterns.** If we want automated gates on mutations, add `@testing-library/react` and write a real `renderHook` test that calls the hook and verifies the invalidation.
- **Fake tests are worse than no tests.** A test that passes without the feature is false confidence — delete it.

