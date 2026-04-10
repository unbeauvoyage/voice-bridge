---
title: "Mission Control Surface Layer — Persistent Activity Overlays on the 3D Dashboard"
proposedBy: ux-lead
agent: productivitesse
status: approved
ts: 2026-04-04T07:33:52
---

# Mission Control Surface Layer

**Submitted:** 2026-04-04T07:33:52  
**Classification:** Architectural — touches store, relay server, HoloPanels, navigation, mobile layout  
**Coordination:** system-lead flagged for data model decisions (section 5)

---

## The Problem in One Sentence

The CEO's attention and the system's information live in different places: one tab for the 3D view, another tab for proposals, another for inbox, another for Q&A answers — and fresh information lands in whatever tab it belongs to, invisible until CEO navigates there.

## The Design Principle Being Encoded

> "Agents are putting it in a post box expecting me to take care of that — no time for that, somebody has to bring it to my attention, to my table."
> — CEO, 2026-04-04

**The 3D dashboard IS the table. Results navigate to the CEO. The CEO never navigates to find results.**

Proposals, Q&A answers, explanations, messages — everything agents produce comes TO the CEO on the 3D screen. The inbox, proposals tab, questions tab are detail surfaces. The mission control screen is where every agent's output arrives and waits.

This is not a notification feature. Notifications are ephemeral — they appear and vanish. What's being designed here is the **opposite**: a persistent delivery surface where things stay until deliberately cleared. The 3D view becomes a physical space you walk into and read the walls. Items on the table stay on the table until someone picks them up.

---

## 1. Navigation Restructure: Unify Dashboard + Agents Tab

**Current problem:** CEO calls the 3D view "the dashboard," but there's a tab called "Dashboard" (2D card layout) and a separate "Agents" tab (3D scene). They're two different things named confusingly.

**Proposed change:**

| Current | New |
|---------|-----|
| `Dashboard` tab → 2D card summary | **Removed** (its content migrates onto the surface layer) |
| `Agents` tab → 3D scene + HoloPanels | **Renamed "Mission Control"** → becomes tab 1, the default landing screen |

The 2D Dashboard tab served as a snapshot of proposals + issues + backlog + agent status. Every one of those domains will live on the surface layer. Once the surface layer exists, the 2D dashboard is redundant. Remove it.

**New tab order (11 tabs → 10, with Mission Control as default):**

```
Mission Control | Inbox | Proposals | Requests | Backlog | Issues | Messages | Worklogs | Questions | Knowledge
```

(Reports can be folded into Worklogs or accessed via the knowledge panel — it's rarely CEO-facing.)

---

## 2. The Surface Layer: Four Zones, Four Domains

The 3D scene has an existing DOM overlay system: `HoloPanelLeft` (left side) and `HoloPanelRight` (right side). Currently these show backlog and system summary — static, not activity-driven.

The surface layer **replaces and expands this system** into four defined zones:

```
┌──────────────────────────────────────────────────────────────┐
│  [TOP-LEFT ZONE]                       [TOP-RIGHT ZONE]      │
│  ┌─────────────────────┐   3D SCENE    ┌──────────────────┐  │
│  │ ✦ Q&A               │               │ ✦ Proposals      │  │
│  │ Q: What is X?       │               │ • Title          │  │
│  │ A: X is a system…   │  [planets]    │   [Approve][Rej] │  │
│  │          ↩ read     │               │ • Title          │  │
│  └─────────────────────┘               │   [Approve][Rej] │  │
│  ┌─────────────────────┐               └──────────────────┘  │
│  │ ✦ Messages          │               ┌──────────────────┐  │
│  │ command → 5m ago    │               │ ✦ Issues / Status│  │
│  │ "Done — 3 files…"   │               │ HIGH: auth bug   │  │
│  │          ↩ ack      │               │ 2 agents active  │  │
│  └─────────────────────┘               └──────────────────┘  │
│                                                               │
│                  [EventLog strip — collapsed by default]      │
└──────────────────────────────────────────────────────────────┘
```

**Zone assignments:**

| Zone | Domain | Why here |
|------|--------|----------|
| Top-left | Q&A Answers + Recent Messages | Reading/learning — passive, left-to-right reading order |
| Top-right | Proposals | Action required — prominent, right hand reaches there |
| Bottom-right | Issues + System Status | Problems and health — always visible, not taking action |
| (Agent detail) | Replaces bottom-right when agent selected | Existing HoloPanelRight behavior, unchanged |

The `HoloPanelLeft` and `HoloPanelRight` components become `SurfaceLayer` — a unified overlay system with four named regions. Internally it's still two DOM panels, but conceptually it's one surface.

---

## 3. Persistence Model: Unread vs Acknowledged

### The Core Rule

> **Unread = stays at full visibility. Acknowledged = removed. No time-based auto-dismiss. No opacity decay.**

Items stay on the surface at **full opacity** until the CEO explicitly dismisses them. There is no "stale" state. A two-day-old unanswered proposal is just as prominently displayed as a five-minute-old one — because it's still pending and the CEO still hasn't seen it.

Time-based dimming is removed from the design. The original draft had "6h → 65% opacity, 24h → 50%." This is wrong — it would visually deprioritize items the CEO hasn't seen yet, which is the opposite of the goal. Items don't get quieter over time. They stay loud until the CEO picks them up.

The only visual signal that respects time: a small **age label** (e.g., `"2h ago"`, `"yesterday"`) in dim text — informational only, not a signal to ignore the item.

### Acknowledgment by Domain

| Domain | Acknowledged by | Effect |
|--------|-----------------|--------|
| Q&A answer | "↩ Read" button | Fades to 20% opacity → removes after 90s |
| Proposal | Approve or Reject button | Immediately removes from surface (decision made) |
| Message (Zone 1: waiting-for-input/escalate) | "↩ Reply" sent, or "✓ Ack" button | Fades → removes after 60s |
| Message (Zone 2: done/status) | "✓ Ack" button | Immediate remove |
| Issue | Does not appear on surface until high-priority; removed when issue closed | No CEO acknowledgment needed — system-driven |
| System Status | No acknowledgment — always shows current state | |

### "Acknowledged" State Storage

**V1: localStorage** — `surface-acknowledged: {id: timestamp}[]`

Rationale: no relay changes needed for MVP. Known limitation: acknowledging on desktop does not sync to mobile. This is acceptable for v1 since the CEO primarily reads on one device at a time.

**V2: Relay server** — `POST /surface/acknowledge {id, domain}` persisted to disk. Cross-device sync. Flagged for system-lead (section 5).

### What Appears on the Surface

Not everything — only the **most recent N items per domain**:

| Domain | Max shown | Minimum freshness to appear |
|--------|-----------|----------------------------|
| Q&A | 3 answers | Answered in last 24h |
| Proposals | All pending | Always (proposals stay until resolved) |
| Messages (Zone 1) | 3 unacknowledged | Arrived in last 6h |
| Messages (Zone 2) | 2 most recent | Arrived in last 1h |
| Issues | High-priority only, max 4 | Open and high-priority |

When more than the max exist: a "N more in [Tab]" footer link navigates to the full panel.

---

## 4. Visual Treatment by Domain

### Q&A Panel (top-left)

```
┌────────────────────────────────────────┐
│ ✦ Q&A  [2]                            │
├────────────────────────────────────────┤
│ Q What is X?                    15m ago│
│ A X is the system that manages…        │
│   …and it connects to Y.              │
│                          [↩ Read]      │
├────────────────────────────────────────┤
│ Q How does Z work?             2h ago  │
│ ⏳ Agents researching…                 │
└────────────────────────────────────────┘
```

Colors: question text `#888` (dim), answer text `#e8e8f0` (bright). The contrast itself signals "this is the answer." Unanswered questions show a pulsing `⏳` — signals work in progress.

Unanswered question appears on surface immediately when asked, stays until answered. When answered, the answer replaces the `⏳` in place — CEO sees the answer appear where the question was. This is the specific CEO scenario: "when answered, the answer should appear on the dashboard."

### Proposals Panel (top-right)

Compact version of the existing `ProposalsPanel` card — same approve/reject/voice buttons, smaller padding:

```
┌────────────────────────────────────────┐
│ ✦ Proposals  [3 pending]              │
├────────────────────────────────────────┤
│ from command   5m ago                  │
│ Build the auth middleware refactor     │
│ [Approve]  [Reject]  [🎤 Do this]     │
├────────────────────────────────────────┤
│ from productivitesse   1h ago          │
│ Add mobile 3D view tab                 │
│ [Approve]  [Reject]                   │
├────────────────────────────────────────┤
│            +1 more in Proposals →     │
└────────────────────────────────────────┘
```

Proposals **never have a freshness fade** — they stay at full opacity until resolved. A 2-day-old pending proposal is just as urgent as a 5-minute-old one. The "pending" state is what matters, not the age.

### Messages Panel (top-left, below Q&A)

Zone 1 messages (waiting-for-input, escalate) surface immediately. Zone 2 (done, status) surface only if recent (last hour) and the CEO hasn't been active. The distinction uses the existing `needsInput()` function.

```
┌────────────────────────────────────────┐
│ ✦ Messages  [1 needs input]           │
├────────────────────────────────────────┤
│ command  [BLOCKED]              8m ago │
│ Can't proceed — need approval on X     │
│            [↩ Reply]   [✓ Ack]        │
├────────────────────────────────────────┤
│ productivitesse  [DONE]         52m ago│
│ Completed the auth middleware task     │
│                            [✓ Ack]    │
└────────────────────────────────────────┘
```

Zone 1 message cards: left border accent in type color (gold for waiting-for-input, red for escalate). Zone 2 cards: no border accent, lower opacity text.

### Issues + System Status (bottom-right)

```
┌────────────────────────────────────────┐
│ ✦ System                              │
│   5 agents active  •  3 proposals     │
│   Last message: 8m ago                │
├────────────────────────────────────────┤
│ HIGH  auth-service login loop          │
│ HIGH  mobile CSS overflow on SE        │
└────────────────────────────────────────┘
```

Issues don't have acknowledgment buttons — they're status display. CEO goes to the Issues tab to act on them. The surface shows the problem; the tab is where it's resolved.

---

## 5. System-Lead Coordination: Data Model Questions

### 5a. Q&A Answer Freshness — RESOLVED

**Decision (system-lead, 2026-04-04):** The relay file-watcher does NOT currently emit a `created_at` timestamp for answer files. They are file-watched, not relay-messaged. 

**Resolution for Phase 3:** The relay file-watcher must be updated to emit the file's `mtime` as `created_at` when scanning `~/environment/answers/`. This is a relay change scoped to Phase 1. Until it ships, the surface Q&A panel shows answers without age labels (age label is informational, not structural).

### 5b. Question-to-Answer Linkage — RESOLVED

**Decision (system-lead, 2026-04-04):** Currently inferred by filename convention (`questions/q-slug.md` ↔ `answers/a-slug.md`). This is fragile — slugs can drift.

**Resolution for Phase 3:** Show **Q&A answers only** — no "⏳ Agents researching" pending state until a robust linkage mechanism exists. The long-term fix is enforcing that answer files begin with `# Answer: [question-id]` so the watcher can index by ID reliably. Once that convention is enforced, the `⏳` pending state can be added in a follow-up.

Implication: CEO will see answers when they arrive, but not a "question asked, waiting for answer" placeholder. The answer appears on the table when it lands — this still satisfies the core scenario.

### 5c. Acknowledgment Persistence — RESOLVED

**Decision (system-lead, 2026-04-04):** Prior art exists — `_pending_permissions.json` in `queues/` uses the write-on-create/delete-on-resolve pattern. A `_surface_acknowledged.json` in the same directory uses identical mechanics.

**Confirmed relay API for V2:**
```
POST /surface/acknowledge
Body: { id: string, domain: 'qa' | 'proposal' | 'message' | 'issue' }

GET /surface/acknowledged
Response: { acknowledged: Array<{ id, domain, ts }> }
```

Storage: `./queues/_surface_acknowledged.json` — same location and pattern as permission queue. The relay's existing store pattern (`permissionStore`) is confirmed prior art.

### 5d. Inbox Zone Cross-Reference — RESOLVED

**Decision (system-lead, 2026-04-04, confirmed):** A surface-acknowledged `waiting-for-input` message should drop to Zone 2 in `InboxPanel` — not require a second acknowledgment in the inbox.

**Implementation rule:** `needsInput()` result in `InboxPanel` is overridden to `false` if the message ID exists in the acknowledged set. The inbox badge counts only Zone 1 messages NOT present in the acknowledged set.

This means one acknowledgment action (on the surface OR in the inbox) clears both surfaces simultaneously.

---

## 6. Mobile Adaptation

On mobile, the 3D scene occupies the full screen with no room for side panels. The surface layer becomes a **horizontally scrollable domain strip** at the bottom of the 3D scene (above the control strip, per the earlier mobile 3D view proposal).

```
┌─────────────────────────────────────────┐
│                                         │
│           3D SCENE                      │
│                                         │
│                                         │
└─────────────────────────────────────────┘
┌─────────────┬─────────────┬─────────────┐
│ ✦ Q&A  [2] │ ✦ Props [3] │ ✦ Msgs [1] │  ← strip
└─────────────┴─────────────┴─────────────┘
[ ⟳ ] [ 3D|Top ] [ List ]
[ Voice ] [ Dash ] [ Agents ] [ Inbox ] ...
```

Each domain card in the strip shows: domain icon, badge count of unacknowledged items.

Tapping a domain card → bottom sheet slides up with the full domain surface content (same items, but in a tall scrollable sheet with acknowledgment buttons). Swiping down closes it.

**Why a strip instead of overlays?** On desktop, the panels occupy the sides of the 3D canvas without blocking the center where the agents are. On mobile (375px), any side panel would cover the agents. The strip is below the scene, never obscuring it.

---

## 7. SidePanel Architecture Changes

The current `HoloPanelLeft` and `HoloPanelRight` must be substantially redesigned:

| Current | New |
|---------|-----|
| Shows: Backlog items + Issues count | Shows: Q&A answers + Recent messages |
| Shows: System summary + Pinned section (dropdown) | Shows: Proposals + Issues + System status |
| Static data (backlog doesn't change in real-time) | Live data (new proposals, messages push updates via WebSocket) |
| No acknowledgment concept | Full acknowledgment model |
| `SidePanel` collapsible component with localStorage state | Sections expand/collapse within each panel; whole panel not collapsible |

The `SidePanel` and `SidePanelColumn` wrapper components (`SidePanel.tsx`) can remain. Content components change.

New components:
- `SurfaceQA` — renders Q&A section
- `SurfaceMessages` — renders recent messages section
- `SurfaceProposals` — compact proposals with approve/reject
- `SurfaceIssues` — high-priority issues
- `SurfaceSystemStatus` — agent count, last message time
- `useSurfaceAcknowledgments()` hook — localStorage read/write for acknowledged IDs
- `MobileDomainStrip` — horizontal strip for mobile

---

## 8. Implementation Phases

### Phase 1 — Acknowledgment Infrastructure (1 file, no UI)
- `useSurfaceAcknowledgments()` hook (localStorage)
- Types: `SurfaceAcknowledgment`, freshness utility functions
- No visible changes

### Phase 2 — Surface Content Components (no layout changes yet)
- `SurfaceQA`, `SurfaceMessages`, `SurfaceProposals`, `SurfaceIssues`
- Use existing store data, apply freshness + acknowledgment filtering
- Unit-testable in isolation

### Phase 3 — HoloPanels Redesigned (desktop surface layer live)
- Replace HoloPanelLeft content with Q&A + Messages
- Replace HoloPanelRight content with Proposals + Issues + Status
- Acknowledge buttons functional (localStorage V1)
- Q&A unanswered question tracking (depends on system-lead answer to 5b)

### Phase 4 — Navigation Restructure
- Rename "Agents" tab → "Mission Control"
- Remove "Dashboard" tab (or hide behind feature flag until surface layer is stable)
- Make Mission Control tab the default active tab

### Phase 5 — Mobile Strip
- `MobileDomainStrip` in mobile agents layout
- Domain cards → bottom sheet expansion
- Mobile acknowledgment synced to same localStorage key

### Phase 6 — Relay-Backed Acknowledgment (V2, requires system-lead)
- `POST /surface/acknowledge` endpoint
- Cross-device sync
- Migrate from localStorage fallback

---

## 9. Risk Flags

1. **Q&A unanswered state**: If question-to-answer matching isn't reliable in the current relay, the "⏳ Agents researching" state can't be shown accurately. Recommend: Phase 3 shows Q&A answers only (not pending questions) until system-lead confirms the linkage is trackable.

2. **Panel width on narrow desktop**: HoloPanels are currently 270px wide. On a 1280px laptop, 3D scene gets `1280 - 270 - 270 = 740px`. With the richer surface content (multiple sections per panel), panels may need 300px. This reduces scene width to 680px on 1280px screens. Acceptable; the scene is still readable at that size.

3. **Proposal approval on the surface**: CEO can approve proposals directly on the 3D surface layer without opening the Proposals tab. This is the intent. But the "voice Do this" button (which requires the full ProposalCard to manage voice recording state) adds complexity. Recommendation: surface layer proposals show only Approve/Reject (not voice). Voice approval is in the dedicated Proposals tab.

4. **Surface overflow**: If 20 items accumulate and CEO hasn't acknowledged any, the panels overflow. The max-N-per-domain limits (section 3) handle this, but the "N more in [Tab] →" footer must be prominently visible so CEO knows there are more items in the detail screen. The panel itself should not scroll — scrolling panels in side overlays are awkward. If a domain exceeds the limit, the footer link is the escape hatch.

5. **Store reactivity**: The surface layer reacts to WebSocket pushes (new proposals, new messages). The `HoloPanelRight` currently uses `useStore` selectors that re-render on any proposal change. With more domains on the surface, the panel will re-render more frequently. This should be fine given React's reconciliation, but worth profiling after Phase 3.
