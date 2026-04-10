# Proposal: Mobile Tab Overload & Missing Unified Action Surface

**Proposed by:** prism (UX Expert)
**Date:** 2026-04-06T01:45:12
**Status:** approved
**Affects:** productivitesse mobile layout

---

## Problem

The mobile bottom tab bar has **7 tabs**: Voice, Dashboard, Agents, Knowledge, Requests, Ideas, Inbox. This creates two critical UX failures for a fire-and-forget CEO on their phone:

### 1. Tab overload — too many choices, not enough screen
7 tabs in a bottom bar means each button is ~53px wide on an iPhone. Labels get truncated or illegible. The CEO must scan all 7 to find what they need. iOS apps cap at 5 tabs for a reason — beyond that, discoverability and tap accuracy drop sharply.

### 2. Action items are scattered across 4 tabs
The CEO must check **four separate tabs** to find everything requiring their input:
- **Inbox** → Zone 1 (waiting-for-input, escalate)
- **Ideas** → Pending proposals needing approve/reject
- **Requests** → Open requests needing follow-up
- **Knowledge** → Pending questions needing review

There is no single surface that answers: *"What needs my attention right now?"*

### 3. Inbox is the last tab (rightmost)
The most critical tab — where blockers and escalations live — is in the hardest-to-reach position. On a phone held in the right hand, the bottom-left is easiest; bottom-right requires a stretch. Inbox should be high-priority placement, not last.

---

## Proposal

### A. Reduce to 5 tabs with a unified "Action" tab

| Position | Tab | Purpose |
|----------|-----|---------|
| 1 (left) | Voice | Primary input — stays first |
| 2 | **Action** | **NEW: unified "needs your input" surface** |
| 3 | Agents | 3D view — glanceable system health |
| 4 | Inbox | All messages (updates zone, read-when-curious) |
| 5 (right) | More | Dashboard, Knowledge, Requests, Backlog |

### B. The "Action" tab — single attention surface

This tab aggregates **everything that needs CEO input** into one ranked list:
1. **Escalations** (red) — from Inbox Zone 1 where type=escalate
2. **Blockers** (gold) — from Inbox Zone 1 where type=waiting-for-input
3. **Proposals** (gold) — pending proposals needing approve/reject
4. **Requests** (blue) — open requests needing follow-up
5. **Knowledge** (amber) — pending questions needing review

Each item shows: type badge, agent name, one-line summary, and action buttons (approve/reject/reply/dismiss) — inline, no navigation required.

Badge on the Action tab = total count of all items. When 0, the tab shows a green checkmark: "All clear."

### C. "More" tab with secondary views

A simple list linking to: Dashboard overview, Knowledge board, Requests board, Backlog. These are reference views the CEO checks occasionally, not action surfaces.

---

## Tradeoffs

| For | Against |
|-----|---------|
| CEO finds all decisions in one place | Adds a new composite component to build |
| Reduces cognitive load from 7→5 tabs | "More" tab adds one tap to reach secondary views |
| Inbox becomes purely informational (less stressful) | Existing users must relearn tab positions |
| Matches iOS tab bar conventions | Proposals lose dedicated tab (but gain prominence in Action) |

---

## Recommendation

**Do this.** The CEO's phone is their primary remote interface. Every extra tap or tab-scan to find "what needs me" is friction that discourages engagement. A unified action surface is the single highest-impact mobile UX improvement available.

The desktop can keep its current tab structure — screen real estate is not the constraint there.

---

## Implementation notes
- The Action tab component pulls from the same store selectors already used by InboxPanel (zone1), ProposalsPanel (pending), RequestsPanel (open), KnowledgePanel (pending)
- No new API endpoints — all data is already in the Zustand store
- Badge count: `inboxZone1 + pendingProposals + openRequests + pendingKnowledge`
