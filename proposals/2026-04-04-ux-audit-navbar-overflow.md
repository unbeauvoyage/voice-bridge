---
title: "UX Audit: NavBar — 12 Tabs Overflow Without Discovery Affordance"
proposedBy: ux-lead
agent: productivitesse
status: approved
ts: 2026-04-04T06:23:46
---

# NavBar — 12 Tabs Overflow Without Discovery Affordance

**Submitted:** 2026-04-04T06:23:46  
**Priority:** P1 — CEO may not know half the tabs exist

## Finding

The desktop NavBar exposes 12 tabs in a single horizontal scrollable row:

> inbox · dashboard · agents · proposals · messages · reports · backlog · worklogs · issues · questions · knowledge · requests

The tabs container uses `scrollbarWidth: 'none'` — the scrollbar is hidden. On any viewport narrower than ~1200px, the right-side tabs overflow out of view with **no visual hint that more tabs exist**. CEO sees the first 7–8 tabs and believes that is everything.

The current tab order buries "Proposals" at position 4 — below Inbox, Dashboard, and Agents. On a 1024px screen, Proposals may not be visible without scrolling.

## Current Tab Order (as coded)

```
1  inbox       ← correct, primary
2  dashboard   ← correct
3  agents      ← 3D view, secondary
4  proposals   ← high priority, buried
5  messages    ← raw feed, low priority
6  reports     ← low priority
7  worklogs    ← developer concern
8  backlog     ← frequently needed
9  issues      ← frequently needed
10 questions   ← reference
11 knowledge   ← reference
12 requests    ← medium priority (CEO-initiated tasks)
```

CEO primary workflow: **Inbox → Proposals → Requests → Agents → Backlog**.  
Three of these five are not visible without scrolling on a standard laptop.

## Proposed Fix

### Option A: Reorder + visual separator (minimal change)
Reorder tabs to: `inbox, proposals, requests, dashboard, agents, backlog, issues | messages, worklogs, questions, knowledge, reports`

Add a faint vertical divider after "issues" to signal "primary" vs "secondary" tabs. Secondary tabs can render at lower opacity (color: #555 vs #888) to indicate they are less important.

### Option B: Primary + "More" overflow menu (cleaner)
Primary tabs (always visible): `inbox, proposals, requests, agents, dashboard`  
"More ▾" dropdown exposes the rest.

This guarantees the 5 most-used panels are always reachable without scrolling, on any screen size.

### Recommended: Option B
It solves both the overflow and the priority problems simultaneously. The "More" button can show a count badge if any secondary panel has activity (e.g., 2 open issues, new knowledge entries).

## Side Benefit

With fewer primary tabs, each tab label can be slightly larger (fontSize 13–14 instead of 12), improving readability.

## Note for system-lead

This touches the NavBar component structure. If a dropdown overlay is added, needs to not conflict with the notification stack position (bottom-right, 80px up). Mentioning this in case system-lead has opinions on z-index or overlay architecture.
