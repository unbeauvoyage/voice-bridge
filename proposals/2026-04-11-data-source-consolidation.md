---
type: proposal
title: Data Source Consolidation — JSONL as the Agent/Inbox/Message Truth
summary: Consolidate agents grid, 3D view, graph, mobile grid, CEO inbox, and messages tab onto a single JSONL-derived source. Voice page stays. Proposals/backlog/knowledge unchanged. Delete ~1300 LOC of relay in-memory state + 10 WS events. Session liveness via http-plugin port files; delivery failures via HTTP status codes.
status: READY
author: agentflow-expert
date: 2026-04-11T05:52:32
tags: [architecture, relay, jsonl, productivitesse, consolidation]
---

# Data Source Consolidation

## CEO corrections baked in

Before the first draft landed, CEO clarified four points that shrink the plan:

1. **CEO Inbox can come from JSONL** — every relay message delivered to an agent lands in that agent's JSONL as a channel-wrapped user turn; every outgoing reply lands as a `relay_reply` tool_use turn. "To whom" is in the data. Scanning all JSONLs = full message graph.
2. **Proposals, backlog, knowledge, issues, Q&A stay exactly as they are.** Our own file-watcher plumbing. Out of scope.
3. **Voice page stays unchanged.** Whisper transcription, recording UI, `/voice` endpoint, `/ceo-active` — all stay. The ONLY change: after transcription, the dispatch uses the http-plugin HTTP call to the target agent's port (routed by session id, not name) instead of the WebSocket `message` frame. This is just the existing http-plugin cutover applied to the voice dispatch path.
4. **Cross-session routing isn't a separate problem.** See §5 — it's solved by the files Claude Code and the http-plugin already write.

So the scope is: **agents + inbox + messages**, not "everything."

---

## The honest framing

Two planes, one thin relay:

- **Observer plane** — read-only. Pure file watchers + JSONL stream fan-out. Agent list, session state, message history, inbox all derive from files on disk.
- **Injector plane** — minimal writes. `POST /send` (HTTP plugin proxy), `POST /voice`, `POST /ceo-active`, mutation endpoints (approve / archive / cancel), permission hooks.

The relay survives, but everything that held in-memory state for pushing to clients gets deleted.

---

## Phase 1 — Agents from JSONL (biggest win)

**Goal:** `s.agents` array populated entirely from `useJsonlStore`. The legacy `Agent` type becomes a thin projection over JSONL sessions + `deriveAgentStatus` + `customTitle`.

**Work:**
1. New file `src/features/jsonl-sessions/useAgentsFromSessions.ts`:
   ```ts
   (sessions: JsonlSession[], now: number) => Agent[]
   ```
   - One `Agent` per active JSONL session
   - `name = customTitle ?? uuid-slice` (via `feature/session-names`)
   - `status = deriveAgentStatus(session, now)` (via `feature/mobile-grid-jsonl`)
   - `lastActivity = session.lastActivityTime`
   - `model` parsed from JSONL env line
   - `color` from `.claude/agents/{name}.md` schema (one-time read)
   - `sessionId` = the UUID (critical — this is the routing key for `/send`)
2. Replace `s.agents` reads in:
   - `Scene.tsx` (3D galaxy)
   - `DashboardView.tsx` (status bar)
   - `IssuesPanel.tsx` (agent dropdown)
   - `control.ts` (switchToAgent lookup)
   - `useAgentGraph.ts` (graph page)
   - `AgentGrid.tsx` — mobile grid (already done on `feature/mobile-grid-jsonl`)
3. Delete from `useWebSocket.ts` + `message-relay/src/index.ts`:
   - `agent_update`
   - `agent_activity`
   - `agent_activity_snapshot`
   - `agent_state_changed`
   - `agent_spawned`
   - `agent_removed`
   - `hierarchy_state`
4. Keep the legacy `Agent` type as a type alias over the projection for one release to minimize UI churn; remove in a cleanup sweep later.

**Risk:** Low. Pure refactor behind a projection boundary.

**Win:** The largest coupling point in the app collapses. 7 WS events deleted, ~800 LOC of relay hook-event tracking deleted. Every view that shows agents now renders from the same JSONL truth.

**Sequencing:** Needs `feature/mobile-grid-jsonl` (deriveAgentStatus) and `feature/session-names` (customTitle) landed first.

---

## Phase 2 — CEO Inbox and Messages tab from JSONL

**Goal:** Delete `s.messages`, `/history/ceo`, and the relay in-memory message ring buffer. InboxPanel and MessageFeed become selectors over `useJsonlStore`.

**Insight:** Every relay message that flows through the system leaves a trail in JSONL:

| Direction | JSONL record |
|---|---|
| **Incoming to an agent** (from CEO, from another agent) | Channel-wrapped user turn: `<channel source="relay" from="..." type="..." message_id="...">body</channel>` |
| **Outgoing from an agent** (to CEO, to another agent) | `tool_use` turn on `relay_reply` with `{to, message, type}` in the args |

Both are already parseable. `messages-view-coder` already shipped `channelParser.ts` for the incoming side. A small sibling `relayReplyExtractor.ts` covers the outgoing side.

**Work:**
1. New file `src/features/jsonl-sessions/relayReplyExtractor.ts`:
   ```ts
   (turn: ToolCallTurn) => { to: string; type: string; message: string; ts: number } | null
   ```
   Matches `tool_name === 'relay_reply'` and extracts args.
2. New selector `src/features/jsonl-sessions/useMessageLog.ts`:
   ```ts
   useMessageLog(filter: { to?: string; from?: string; agent?: string }) => MessageEntry[]
   ```
   Scans all sessions in `useJsonlStore`, extracts incoming via `channelParser` and outgoing via `relayReplyExtractor`, filters, returns chronologically sorted.
3. CEO Inbox becomes `useMessageLog({ to: 'ceo' })`.
4. Messages tab (from `feature/messages-view`) becomes `useMessageLog({ agent: selectedAgent })`.
5. Mobile grid unread count: `useMessageLog({ to: 'ceo' })` filtered by last-seen timestamp per sender.
6. Delete:
   - `s.messages` in `dashboard/store.ts`
   - `addMessage` action
   - localStorage message persistence
   - Relay: `messageHistory` array, `GET /history/ceo`, the `message` WS event (emission only — recipients still receive via MCP/http-plugin, that's unchanged)
7. `POST /send` keeps working — it's a proxy to the http-plugin. The resulting turn appears in the recipient's JSONL naturally, and the observer plane picks it up.

**Risk:** Medium. This is the first time the inbox reads from JSONL instead of a ring buffer. Main worry: rendering latency. Mitigation: `useMessageLog` is memoized and only re-runs when the relevant sessions update, not on every turn.

**One edge case:** Messages where the sender is "ceo" and the recipient's JSONL hasn't loaded yet (e.g., cold start). The message will appear once that session's JSONL is tailed. Acceptable — same as today's WS-dropped-on-reconnect behavior, but now durable.

**Another edge case:** CEO's own outgoing messages (sent from the dashboard) don't have a "ceo" JSONL. They only appear once the recipient's JSONL logs them. Solution: the dashboard's send path also writes an optimistic local entry tagged "pending" until the recipient's JSONL confirms. Same pattern a chat UI uses everywhere.

**Win:** ~500 LOC of relay message-buffer code deleted. InboxPanel and Messages tab share the same source. Messages become durable (in JSONL) and grep-able. No more `localStorage` message persistence hack.

---

## Phase 3 — Voice dispatch via http-plugin + session id

**Goal:** Voice page works exactly as today, except dispatch routes via HTTP plugin using session id instead of agent name.

**Context (CEO's quote):** *"After whisper transcripts the voice, it used to send it to the agent through websocket, now it will use http call and call agent's mcp endpoint and use the id instead of the name to find the agent."*

**Work:**
1. `POST /send` (already thin after http-plugin cutover) accepts either `to: agentName` OR `toSessionId: uuid`. If both given, `toSessionId` wins.
2. Relay's port-file lookup: new file `~/.claude/relay-channel/by-session/{uuid}.port` written alongside the existing `{name}.port` by the http-plugin. Relay picks whichever key is provided.
3. Voice page `postVoice()` already sends `to` — change it to send `toSessionId` using the session UUID it already has from `useJsonlStore`.
4. Benefit: two sessions with the same name (which currently cause the 50/50 split bug from PROBLEM-LOG 2026-04-05) no longer ambiguous for voice dispatch.
5. No UI changes. No Whisper changes. No `/voice`, `/ceo-active`, or recording-state changes.

**Risk:** Very low. This is a one-field API extension.

**Win:** Voice dispatch becomes deterministic even when agent names collide. Works cleanly on top of the http-plugin cutover.

---

## Phase 4 — Cleanup sweep

After Phases 1-3 stabilize:
- Delete the legacy `Agent` type alias, replace with the projection's return type
- Delete `sessionRegistry`, `agentActivityLog`, any remaining in-memory tracking the earlier phases obsoleted
- Delete the `requests` in-memory table → rewrite requests as files under `~/.claude/relay-requests/*.json`
- Measure: target relay `src/` at ≤ 1200 LOC (down from ~3000)

Low risk, purely subtractive.

---

## 5 — Cross-session routing and liveness (answering CEO's question)

CEO asked: *"How does agentflow find the sessions? Can't we just auto detect? Can't agents know which sessions are alive? Can't agents know if a message reached its destination when they get an error from that agent's mcp endpoint?"*

**Yes to all of it. It's already solved by files and HTTP status codes.**

| Question | Answer |
|---|---|
| How are sessions discovered? | Tail `~/.claude/projects/{encoded-cwd}/*.jsonl` — Claude Code writes these automatically. Already happening — that's why the Sessions page shows them. |
| How are sessions matched to names? | `custom-title` line in the JSONL carries the `--name` flag value. Shipped in `feature/session-names`. |
| How do agents know which sessions are alive? | After http-plugin cutover, each live session writes `~/.claude/relay-channel/{agent}.port` on startup, removes it on shutdown. Port file exists = session is alive. Any agent (or the dashboard) can check by listing that directory. |
| How do agents know if delivery succeeded? | `POST /send` under http-plugin returns an HTTP status code from the actual `fetch()` to the recipient's port. 200 = delivered. ECONNREFUSED = recipient not alive (port file is stale). 500 = recipient error. Caller gets real feedback immediately — no separate ACK protocol needed. |
| What if two sessions share a name? | Phase 3 lets the sender specify `toSessionId` to disambiguate. Without it, relay falls back to "first live port file matching the name." |

The thing I called "cross-session routing state" in the initial framing was me carrying over old relay thinking. CEO is right — it isn't a separate problem. The filesystem (JSONL + port files) IS the truth, and HTTP errors ARE the delivery signal.

---

## What stays unchanged

Per CEO directive:

| Area | Status |
|---|---|
| Proposals panel | Unchanged — relay serves `proposals_update` + file writes |
| Backlog board | Unchanged |
| Knowledge panel | Unchanged |
| Issues panel | Unchanged |
| Q&A (questions/answers) | Unchanged |
| Worklogs/reports | Unchanged |
| Voice page UI, Whisper transcription | Unchanged |
| `/voice`, `/ceo-active`, `/hook/permission/*` | Unchanged |
| File watchers for proposals/knowledge/backlog | Unchanged |

The relay keeps all the file-watching and mutation code for "our own stuff." Only the agent/message plumbing consolidates.

---

## Sequencing with in-flight branches

| Branch | Role in this plan | Status |
|---|---|---|
| `feature/http-plugin` | Prerequisite for Phase 3 | Ready, awaiting cutover |
| `feature/mobile-grid-jsonl` | Provides `deriveAgentStatus` for Phase 1 | Ready |
| `feature/session-names` | Provides `customTitle` for Phase 1 | In progress |
| `feature/messages-view` | Provides `channelParser` for Phase 2 | Ready |
| `feature/graph-mvp` | Will benefit from Phase 1 | Ready |

Recommended order once CEO approves:

1. Merge the four ready branches onto `jsonl-data-source`
2. Land http-plugin cutover
3. Execute Phase 1 (new branch off consolidated `jsonl-data-source`, ~1 day coder work)
4. Execute Phase 2 (~1-2 days — inbox + messages tab behind a flag for A/B comparison)
5. Execute Phase 3 (~half day — just the `toSessionId` plumbing)
6. Phase 4 cleanup (~half day)

Total: ~3 days of focused coder work after prerequisites land.

---

## Open questions for CEO

1. **Phase 2 rollout:** should I ship it behind a feature flag so you can toggle "old inbox" vs. "JSONL inbox" for a day to compare? Adds safety at the cost of extra plumbing.

2. **Optimistic local entries:** CEO dashboard-sent messages briefly show as "pending" until the recipient's JSONL records them. Is that OK, or do you want the dashboard to feel instantaneous (which requires an optimistic local store that later reconciles with JSONL)?

3. **Known-agents registry:** do we need any concept of an agent that has never had a Claude session (pure file-watchers, voice-bridge, etc.)? If yes, I'll add a `.claude/agents/*.md` scan to `useAgentsFromSessions` so those agents still show up in the UI.

---

## Recommendation

**Approve Phase 1 first.** It's the biggest single win, has the lowest risk, and unlocks Phase 2. I'll wait for merge of the four ready branches, then brief a coder on Phase 1 with a detailed spec.

**Phase 2** can follow immediately — two or three days later, depending on how Phase 1 shakes out.

**Phase 3** is trivial and can be bundled with the http-plugin cutover plan when convenient.

Ready to execute when you give the word.
