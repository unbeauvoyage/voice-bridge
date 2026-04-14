---
title: "Dashboard: Show Known-but-Absent Agents as Offline"
proposedBy: prism
agent: productivitesse
status: proposed
ts: 2026-04-07T08:55:40
updated: 2026-04-07T08:55:40
summary: "After the relay WebSocket refactor, agents are either connected or absent from /channels. The dashboard should cross-reference the relay's known-agent registry against live connections to display expected-but-missing agents as 'offline' rather than simply not showing them — giving the CEO a meaningful, actionable status signal."
---

# Dashboard: Show Known-but-Absent Agents as Offline

**Submitted:** 2026-04-07T08:55:40  
**Author:** prism (ux-expert)  
**Surface:** Dashboard — agent status panel  
**Scope:** Frontend rendering change only — no relay changes required

---

## Context

The relay WebSocket refactor (2026-04-07) replaced the registration/heartbeat system with persistent WebSocket connections. This eliminated 90 seconds of uncertainty during relay restarts, removed ~200 lines of complexity, and made agent liveness a clean binary: **connected** (WS open) or **absent** (not in `/channels`).

The relay already maintains `autoRegisterHierarchy` — a registry of every agent it has ever seen. This is exposed to the dashboard as a superset of known agents. The relay does not need to change.

---

## Problem

Currently, "absent" conflates three distinct situations the CEO needs to distinguish:

| Situation | Meaning for CEO | Current display |
|-----------|----------------|-----------------|
| Agent never launched | Expected — not relevant | Not shown |
| Agent crashed / killed | Problem — needs attention | Not shown (identical) |
| Agent running non-interactively (no WS) | Fine — background agent | Not shown (identical) |

A crashed agent and a never-started agent look identical. The CEO cannot tell whether to act.

Additionally, a panel that shows stale or misleading state trains the CEO to distrust it. The old "unknown" state during heartbeat expiry was actively worse than no status — it signaled that the system itself did not know. The new binary is better, but we can go further.

---

## Proposal

**Cross-reference `/channels` (live connections) against the relay's known-agent registry.**

Agents known to the relay but not in `/channels` should display as **offline** rather than being absent from the list. Agents never seen by the relay simply do not appear.

### Visual treatment

| State | Display | Color/indicator |
|-------|---------|-----------------|
| Connected | Agent name + status | Green dot |
| Offline (known, absent) | Agent name + "offline" | Grey dot, dimmed |
| Never seen | Not shown | — |

### Optional: SESSIONS.md cross-reference

For stronger signal, the dashboard can additionally cross-reference `SESSIONS.md`. Agents listed in SESSIONS.md but offline could be flagged more prominently (amber rather than grey) — indicating they were expected to be running.

This is optional and can be a follow-up. The core proposal (known-agent registry → offline state) is sufficient and self-contained.

---

## Implementation

**Data source:** `GET /channels` returns live connections. The relay's known-agent registry (autoRegisterHierarchy) is already accessible — confirm exact endpoint with matrix if needed (may be embedded in `/status` or `/channels` response).

**Change scope:** Dashboard frontend only. One rendering pass: for each known agent not in the live set, render as offline. No relay API changes. No backend changes.

**Estimated size:** Small — one data join, one new visual state in the agent card component.

---

## CEO Experience Outcome

Before: "I don't see sentinel in the list — was it ever running? Did it crash?"  
After: "Sentinel shows offline — it was running before, something happened."

The CEO gets a status panel they can trust. Known agents are always visible. Connected vs offline is always meaningful. The panel never lies by omission.

---

## Tradeoffs

| Option | Pros | Cons |
|--------|------|------|
| **This proposal** — known-registry + offline state | Actionable, zero relay changes, small scope | Requires confirming registry endpoint |
| Status quo — absent = invisible | No work | CEO cannot distinguish crash from never-started |
| Add SESSIONS.md cross-ref now | Maximum signal | More moving parts, bigger scope |

**Recommendation:** Implement the core proposal. Defer SESSIONS.md cross-ref as a follow-up if needed.
