---
title: Layout Message Deduplication + Card Deck Notifications
date: 2026-04-04
status: approved
---
# Feature Design Spec — Layout Message Deduplication + Card Deck Notifications

**Status:** approved
**Priority:** High  
**Author:** ux-lead  
**Date:** 2026-04-04  
**Requested by:** CEO (via Jarvis)

---

## Problem / Why

The same messages appear in three places simultaneously:

| Surface | File | Location |
|---|---|---|
| `HoloPanelLeft` "Messages" panel | `HoloPanelLeft.tsx:173` | Left sidebar in Agents tab |
| `DashboardView` "Recent Messages" | `DashboardView.tsx` | Dashboard tab, right column |
| `NotificationStack` | `NotificationStack.tsx` | Fixed overlay, bottom-right |

Additionally:
- `AgentNotification` balloons float above each agent planet (3D scene) — this is the CEO's *preferred* primary display
- `NotificationStack` renders cards as a vertical column with `gap: 6` — when multiple arrive, they stack vertically and can overflow/overlap rather than behaving like a coherent inbox

**Root cause:** Three message surfaces were added incrementally. No one removed the old ones when new ones appeared.

---

## Target Architecture

| Surface | Keep / Remove / Redesign | New role |
|---|---|---|
| `AgentNotification` balloons (3D) | **Keep + Enhance** | Primary message display — messages live on the agent that sent them |
| `NotificationStack` | **Redesign** | Card deck — latest on top, peek behind, dismiss one-by-one |
| `HoloPanelLeft` "Messages" panel | **Remove** | Eliminated — duplicates balloons and NotificationStack |
| `DashboardView` "Recent Messages" | **Remove** | Eliminated — duplicates NotificationStack |
| `HoloPanelRight` | **Repurpose** | Context panel — shows detail for whatever CEO clicked (agent, proposal, report) |
| `MessageFeed` tab | **Keep** | Full archive of all messages — deep history, search. Separate tab, unchanged. |
| `InboxPanel` tab | **Keep** | CEO attention queue (`waiting-for-input`, `escalate`). Unchanged. |

---

## Change 1 — Remove Duplicate Message Surfaces

**`HoloPanelLeft.tsx`:** Delete the "Messages" `SidePanelColumn` block (lines ~143–186). Left panel retains: Backlog section, Issues section. This is purely subtraction — no new UI needed.

**`DashboardView.tsx`:** Delete the `MessagesSection` component and its `<MessagesSection />` usage in the two-column layout. Dashboard retains: Agent Status Bar, Proposals, Issues, Backlog.

These removals immediately eliminate the duplication. CEO sees messages on agent balloons and the card deck — not in three places.

---

## Change 2 — Card Deck Notification Stack

**What changes:** `NotificationStack.tsx` — replace the vertical column layout with a physical card deck.

### Visual design

```
bottom-right corner, fixed position:

      ┌─────────────────────────────────┐  ← card 0 (latest) — fully visible
      │  command  →  ceo    DONE  [×]  │
      │  Finished the knowledge board…  │
      │  [View full message]            │
      └─────────────────────────────────┘
    ┌──────────────────────────────────┐    ← card 1 — peeking (4px offset, 0.7 opacity)
  ┌─────────────────────────────────┐       ← card 2 — peeking (8px offset, 0.5 opacity)
     [ +5 more ]                            ← badge if >3 cards total
```

**Card 0 (top):** Fully rendered. All content visible. Dismiss button active. Click-to-expand works.

**Card 1:** Positioned `4px` lower and `2px` to the right, `scale(0.97)`, `opacity: 0.7`. Shows only the top edge (header bar). Click on it → promotes it to top (swaps with card 0 after card 0 is dismissed, or immediately on click).

**Card 2:** Positioned `8px` lower and `4px` to the right, `scale(0.94)`, `opacity: 0.5`. Shows only the top edge.

**Cards 3+:** Not individually rendered. A pill badge behind card 2 reads `+N more`.

**Dismiss behavior:**
- Click ✕ on top card → card 0 animates out (`translateY(-10px) + fadeOut`) → card 1 slides up to become the new top card with a spring animation → badge count decrements
- "Dismiss all" toolbar button remains (now in a collapsed gear menu below the stack, not above it, so it doesn't visually lead the stack)

**Positioning:**
```
position: 'fixed'
bottom: 80px
right: 24px
width: 308px
```
Same as current. The stack grows upward (card 0 at bottom, peeking cards above it) — wait, no. Physically a card deck is viewed from the side. Let me be precise:

- **Card 0 (top of the deck, latest):** rendered at the bottom of the stack container
- **Card 1 (second from top):** rendered above card 0 with a positive `translateY` offset, but with lower z-index — appears to be *behind* card 0
- The visual effect: you see card 0 completely, and the tops of cards 1 and 2 peeking above it like a fanned deck

Actually the correct physical metaphor for a card deck where "latest is on top" should show the card face you interact with at the bottom-right position, with previous cards peeking *behind* it. Implementation:

```
container: position fixed, bottom 80, right 24, width 308
  card-1 (behind): position absolute, top 0, left 0, transform: translateY(-4px) translateX(-2px), z-index: 1, opacity 0.5, scale(0.97)
  card-2 (behind): position absolute, top 0, left 0, transform: translateY(-8px) translateX(-4px), z-index: 2, opacity 0.7, scale(0.985)
  card-0 (front):  position absolute, top 0, left 0, z-index: 3, opacity 1, scale(1)
  
container height = card-0 height
```

Cards behind peek out from the top of the front card — exactly like a physical deck.

**Interaction:** clicking a peeking card (card 1 or 2) dismisses card 0 early and brings that card to front. This lets CEO "reach past" the latest notification to get to an earlier one if needed.

### What does NOT change about NotificationStack

- Auto-dismiss toggle (keep in gear menu)
- Quick Reply bar on cards (keep)
- "View full message" → opens `MessageFeed` tab (keep)
- Message type color coding (keep)
- Animation timing (keep `notifFadeOut`)

---

## Change 3 — Agent Balloon Click-to-Expand

**Current state:** `AgentNotification.tsx` — `NotifBalloon` is a 220px wide card floating above the agent planet. It has an `onClick` dismiss button and a "→ inbox" link. It shows a 120-char preview of the message.

**New behavior:** Clicking the balloon body (not the ✕ button) expands it inline to show the full message text.

**Implementation:**
- Add `expanded` boolean state to `NotifBalloon`
- When `expanded: false`: show 120-char preview (current behavior)
- When `expanded: true`: show full `notif.message` text, rendered with `md()`, in a scrollable div (max-height 320px, overflow-y auto)
- The balloon width expands from 220px to 340px when expanded
- Click anywhere on the body toggles expand; ✕ still dismisses

This makes the 3D balloon the primary reading interface for messages — CEO can read the full content without leaving the 3D view.

**No pointer-events change needed** — the inner `div` already has `pointerEvents: 'auto'`.

---

## Change 4 — Right Panel: Context-Driven

**Current state:** `HoloPanelRight.tsx` — always shows Proposals and Reports (two fixed sections).

**Problem:** Right panel content is static regardless of what CEO is focused on. And with the Doc Drawer proposal approved, proposals and reports will have inline preview — so a persistent panel for them is less needed.

**New design:** Right panel becomes a **context panel** — it shows detail for whatever the CEO last interacted with.

**Three states:**

**State A — Agent selected (CEO clicked a planet):**
```
┌─ [agent-name] ──────────── [×] ┐
│  Status: working               │
│  Current task: "Design Q&A…"   │
│                                │
│  Recent messages (last 3):     │
│  ← jarvis: "New design task"   │
│  → command: "Spec filed"       │
│                                │
│  [Open Detail Panel ↗]         │
└────────────────────────────────┘
```

**State B — No selection (default):**
```
┌─ System ────────────────────── ┐
│  3 agents active               │
│  2 proposals pending           │
│  0 high-priority issues        │
│  Last message: 4m ago          │
│                                │
│  Pinned: [Backlog ▼]           │
└────────────────────────────────┘
```
"Pinned" is a dropdown where CEO can pin a section: Backlog | Proposals | Issues | Reports. The pinned section renders below the system summary. This is the "customizable" behavior CEO asked for.

**State C — Doc Drawer open:**
Right panel collapses to a slim strip (40px wide, shows only a "◀" expand button). Drawer takes the space. When drawer closes, right panel re-expands.

**How state changes:**
- `store.selectedAgentId` is already tracked — right panel reads it
- Clicking a planet sets `selectedAgentId` → panel switches to State A
- Clearing selection → State B
- `store.docDrawer !== null` → State C

This is a 3D-tab-only feature. `HoloPanelRight` is only mounted inside the `agents` tab layout.

---

## Before / After Summary

**Before:**
- CEO sees: notification stack (vertical column of full cards) + left sidebar messages + dashboard "Recent Messages" + agent balloons
- 4 surfaces showing the same message data
- Notifications overlap when multiple arrive

**After:**
- CEO sees: agent balloons (primary, click to expand) + card deck (latest on top, peeks behind, dismiss one-by-one)
- 2 surfaces, no duplication
- Right panel is context-driven and optional-customizable
- Full history still accessible via MessageFeed tab

---

## Acceptance Criteria

**Removal:**
- [ ] `HoloPanelLeft` "Messages" panel is removed; left panel shows only Backlog and Issues
- [ ] `DashboardView` "Recent Messages" section is removed
- [ ] No regression: existing data (backlog, issues, proposals) still renders correctly in both panels

**Card deck:**
- [ ] NotificationStack renders cards in deck formation — card 0 at front, cards 1–2 peeking behind
- [ ] Peeking cards show only their top edge (header bar), not full content
- [ ] Dismissing card 0 causes card 1 to slide to front with animation
- [ ] `+N more` badge appears when 3+ cards in stack
- [ ] Clicking a peeking card immediately promotes it to front (skipping card 0)
- [ ] "Dismiss all" moves to gear menu below the stack
- [ ] Stack container height = card 0 height (deck does not grow vertically as cards pile up)

**Agent balloons:**
- [ ] Clicking balloon body toggles expanded state
- [ ] Expanded state shows full message text rendered with `md()`, scrollable
- [ ] Balloon width increases from 220px to 340px when expanded
- [ ] ✕ button still dismisses (does not just collapse)

**Right panel:**
- [ ] Panel shows agent detail when `selectedAgentId` is set
- [ ] Panel shows system summary + pinned section when no agent selected
- [ ] CEO can change pinned section via dropdown: Backlog | Proposals | Issues | Reports
- [ ] Panel collapses to strip when DocDrawer is open
- [ ] Pinned section choice persisted to localStorage

**Playwright:**
- [ ] Test: receive 4 notifications → deck shows 3 cards + `+1 more` → dismiss top → deck updates → count decrements
- [ ] Test: click balloon body → expands → click again → collapses
- [ ] Test: click agent planet → right panel shows agent detail
