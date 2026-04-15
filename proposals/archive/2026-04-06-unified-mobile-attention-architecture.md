---
status: archived
archived_at: 2026-04-16
archived_reason: no action 13+ days
---
# Proposal: Unified Mobile Attention Architecture — Combining 6 Overlapping Proposals

**Proposed by:** prism (UX Expert)
**Date:** 2026-04-06T01:48:30
**Status:** approved
**Affects:** productivitesse mobile + desktop navigation

---

## The Observation

Six existing proposals all attack the same root problem — **the CEO's action items are scattered across multiple surfaces with no single "what needs me?" view** — but from different angles:

| # | Proposal | Core idea | Status |
|---|----------|-----------|--------|
| 1 | **Voice Page Command Center** (2026-04-05) | Voice page becomes high-density action surface with Act Now / Decide / Context layers | pending |
| 2 | **Mission Control Surface Layer** (2026-04-04) | Desktop 3D view gets persistent overlays for Q&A, proposals, messages, issues | pending |
| 3 | **Mobile Tab Overload & Unified Action Surface** (2026-04-06, mine) | Reduce 7 mobile tabs to 5, add Action tab | pending |
| 4 | **Mobile Notifications Bottom Sheet** (2026-04-04) | Full-width mobile notification card, swipe dismiss, urgency tinting | pending |
| 5 | **NavBar Overflow** (2026-04-04) | Desktop 12 tabs → 5 primary + "More" menu | pending |
| 6 | **Notification Urgency Differentiation** (2026-04-04) | Sort notification stack by urgency, auto-dismiss done | approved |

Plus two already-resolved proposals that fed into this:
- **Mobile Proposals Gap** (done) — added Proposals tab to mobile
- **Inbox Timestamp + Badge** (pending) — fix Zone 1 badge count

---

## The Conflict

These proposals, if implemented independently, would create **competing attention surfaces**:

- The Voice Page Command Center puts action items on the Voice tab
- My Action tab proposal puts them on a new dedicated tab
- The Mission Control Surface Layer puts them on the 3D view overlays
- The Mobile Notifications Bottom Sheet puts them in a swipeable tray
- The Attention Bar (Part 2 of Voice Page proposal) puts them in a persistent strip above the tab bar

That's **five different surfaces** all trying to show the same data. If all were built, the CEO would have action items on the Voice page AND in notifications AND on the 3D overlays AND in the Inbox AND in a dedicated Action tab. The scatter problem would be worse, not better.

---

## The Synthesis: One Architecture, Two Modes

The proposals are not wrong — they're all good designs solving real problems. They just need to be **one system, not six**.

### The Core Principle

> **There is exactly ONE action surface per platform mode. Everything else is a detail view.**

### Mobile: Voice Page IS the Action Surface

The Voice Page Command Center proposal (2026-04-05) is the most complete and best-designed of the mobile proposals. It already includes:
- Act Now layer (escalations + blockers)
- Decide layer (pending proposals)
- Context layer (agent status)
- Voice as primary interaction
- Gesture-count-optimized flows

**My "Action tab" proposal is redundant if the Voice Page becomes the command center.** The Voice tab already exists, is already the default landing page, and is already where the CEO naturally goes. Adding a separate Action tab would split attention between two tabs that show the same data.

**The Mobile Notifications Bottom Sheet becomes the Attention Bar + Message Tray** — which is already Part 2 of the Voice Page proposal. These are the same feature.

### Desktop: Mission Control IS the Action Surface

The Mission Control Surface Layer proposal handles desktop. The 3D view gets persistent overlays for all action items. The NavBar overflow proposal's "reduce to 5 primary tabs + More" aligns perfectly — Mission Control becomes tab 1.

### What Gets Combined

| Independent proposal | Becomes | In which system |
|---------------------|---------|-----------------|
| Voice Page Command Center (Part 1) | **The mobile action surface** | Voice tab on mobile |
| Mobile Tab Overload (mine) | **Superseded** — Voice tab already serves this role | — |
| Mobile Notifications Bottom Sheet | **Part 2 of Voice Page** — Attention Bar + Message Tray | Notification layer on all mobile tabs |
| Notification Urgency Sort (approved) | **Urgency ordering** used by both Voice Page and Attention Bar | Both mobile and desktop |
| Mission Control Surface Layer | **The desktop action surface** | 3D tab on desktop |
| NavBar Overflow | **Tab consolidation** — Mission Control becomes default, "More" hides secondary tabs | Desktop NavBar |
| Inbox Timestamp + Badge | **Badge logic** feeds into both Attention Bar and tab badges | Both |

### The Tab Structure After Combining

**Mobile (5 tabs):**

| Position | Tab | Role |
|----------|-----|------|
| 1 | **Voice** (Command Center) | Primary action surface + voice input — where CEO lives |
| 2 | Agents | 3D view with mobile domain strip for spatial awareness |
| 3 | Inbox | Full message history (detail view, not action surface) |
| 4 | Requests | CEO-initiated task tracking |
| 5 | More | Proposals (full panel), Knowledge, Backlog, Issues |

The Voice tab shows ALL action items (blocked agents, proposals, escalations). CEO never needs to leave Voice to act. Other tabs are for depth only.

Note: Proposals gets a dedicated tab in the current layout. In this combined model, proposals needing approval appear directly on the Voice Page (Decide layer), and the full Proposals panel lives under "More" for reviewing history and reading proposal bodies. This is a net improvement — proposals are MORE visible (on the landing page) not less.

**Desktop (5 primary + More):**

```
Mission Control | Inbox | Proposals | Requests | Agents 3D | More ▾
```

Mission Control is the default tab. Its surface overlays show the same data as the mobile Voice Page layers.

---

## What This Means for Implementation

Instead of 6 independent features, there are **3 work streams**:

### Stream 1: Shared Action Data Layer
- `useActionItems()` hook — aggregates Zone 1 messages + pending proposals + open requests + pending knowledge into one ranked list
- Urgency sort (from approved notification proposal)
- Acknowledgment model (from Mission Control proposal, Section 3)
- This hook feeds BOTH the mobile Voice Page and desktop Mission Control

### Stream 2: Mobile — Voice Page Command Center
- Implement the full Voice Page proposal (Part 1 + Part 2)
- Reduce tabs from 7 → 5
- The Voice Page consumes `useActionItems()` for its Act Now and Decide layers

### Stream 3: Desktop — Mission Control Surface Layer
- Implement the Mission Control proposal (Phases 1–4)
- NavBar consolidation (5 primary + More)
- Surface overlays consume `useActionItems()` for their panels

### Ordering
Stream 1 first (shared data layer, no UI). Then Stream 2 and Stream 3 can proceed in parallel.

---

## Proposals to Close/Supersede

If this combined architecture is approved:

| Proposal | Action |
|----------|--------|
| Voice Page Command Center | **Keep as-is** — it becomes the mobile spec |
| Mission Control Surface Layer | **Keep as-is** — it becomes the desktop spec |
| Mobile Tab Overload (mine) | **Supersede** — Voice Page covers this |
| Mobile Notifications Bottom Sheet | **Merge into** Voice Page Part 2 |
| NavBar Overflow | **Merge into** Mission Control Phase 4 |
| Notification Urgency Sort | **Keep** (approved) — feeds into both |
| Inbox Timestamp + Badge | **Keep** — independent fix, compatible with everything |

---

## Recommendation

**Approve this as the architectural umbrella.** The individual proposals are detailed specs — they don't need rewriting. They need a declaration that they are ONE system, not six competing features, and that the shared action data layer (`useActionItems()`) is built first.

Without this umbrella, different agents will build overlapping surfaces that confuse the CEO rather than helping them. With it, every proposal finds its place in a coherent whole.
