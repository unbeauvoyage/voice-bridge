---
title: My Requests Board
date: 2026-04-04
status: approved
---
# Feature Design Spec Template

All features must complete this template BEFORE coding starts. No worktree, no writer agent, until the spec is approved.

---

## Feature: My Requests Board

**Status:** Draft  
**Priority:** High  
**Author:** ux-lead  
**Date:** 2026-04-04

---

## Summary (What We're Building)
One sentence: what is the solution? What does it do? Example: "A single dashboard tab showing all CEO requests with status, assigned agent, and ability to approve/dismiss directly."

---

## Problem / Why

CEO is fire-and-forget — asks something and moves on. There is currently no central view of "what did I ask, who picked it up, is it done?" This causes request duplication (CEO re-asks things already in-progress) and lost requests (no pickup confirmation visible). As the agent team grows, this gap gets worse.

---

## Desktop 3D UI (primary experience)

**Where it lives in the 3D view:**  
A dedicated **"Requests" tab** in the dashboard tab bar (alongside Inbox, Proposals, Q&A, etc.). It is not embedded inside Inbox — requests deserve their own surface because they have lifecycle state that inbox messages do not. The tab shows a live badge count of open (not-completed) requests.

**What CEO sees:**  
A vertical list of **Request Cards** rendered as 3D panels stacked in a column, newest at top. Each card is a flat rectangular mesh (~480px wide, ~80px tall) with a left-border color strip indicating status. Cards are not floating in free space — they are anchored to a list container in screen space so scanning is easy.

**Request Card anatomy (left → right):**
```
[status strip] [timestamp] [status pill] [original ask text — truncated at 60 chars] [agent avatar] [dismiss ✕]
```

- **Status color strip** (6px left border):
  - `not-picked-up` → Grey `#666`
  - `in-progress` → Blue `#3399ff` (pulsing)
  - `completed` → Green `#44cc88`
  - `cancelled` → Muted red `#993333`
- **Timestamp**: relative ("2m ago", "1h ago") with ISO tooltip on hover
- **Status pill**: small rounded badge with status label text
- **Ask text**: CEO's original message, truncated; click expands inline
- **Agent avatar**: the agent name that picked it up (or "—" if not-picked-up)
- **Dismiss ✕**: only visible on `completed` and `cancelled` cards; hover to reveal

**Completed requests** auto-collapse to half-height after 60 seconds but remain visible until explicitly dismissed. This prevents the list from being buried with done items but keeps them accessible.

**Filter bar** at top of panel: All | Open | In Progress | Done — pill toggles. Default: All.

**What CEO can do:**
- Click any card to expand full request text and any agent response/worklog link
- Click agent name to jump to that agent's node in the 3D hierarchy
- Click dismiss ✕ to remove completed/cancelled requests from view (soft-delete, archived not deleted)
- Click status pill on a `not-picked-up` request to manually cancel it
- Use filter bar to narrow the list

**Data source:**  
`GET /requests` relay endpoint — see Data Contract below.

---

## Mobile HTML UI (must match feature parity)

**Where it lives in the mobile app:**  
Bottom tab bar: **"Requests"** tab (390px iPhone). Fits between "Inbox" and "Proposals" in the tab order. Shows badge count of open requests on tab icon.

**What CEO sees:**  
A scrollable vertical list. Each request is a full-width card (~390px wide, 72px tall) with the same left-border color coding. Cards use a single-line layout:

```
[status strip] [ask text — 2 lines max] 
               [agent] · [status pill] · [timestamp]          [✕]
```

Completed requests collapse to a single line (just the ask + "Done" label) after 30 seconds. Tapping them expands back to full.

A sticky filter strip at top: `All · Open · In Progress · Done` (horizontal scroll, no wrapping).

**What CEO can do:**
- Swipe left on any card → reveals "Cancel" (for open) or "Dismiss" (for completed)
- Tap card → expands inline to show full ask text and worklog link if available
- Tap agent name → deep links to that agent's detail view
- Tap filter pills to narrow list

**Differences from desktop (if any):**
- Swipe-to-dismiss replaces hover-to-reveal ✕ button (mobile interaction norm)
- No 3D perspective — flat HTML list with CSS border-left color coding
- No click-to-jump-to-3D-node (no 3D view on mobile); agent name links to agent detail page instead

---

## Feature Parity Checklist

| Capability | Desktop 3D | Mobile HTML |
|------------|-----------|-------------|
| View all requests with status | ✓ | ✓ |
| Filter by status | ✓ | ✓ |
| Expand full request text | ✓ | ✓ |
| See assigned agent | ✓ | ✓ |
| Dismiss completed/cancelled | ✓ (✕ button) | ✓ (swipe left) |
| Cancel not-picked-up request | ✓ | ✓ |
| Live status updates via WebSocket | ✓ | ✓ |
| Open worklog link from card | ✓ | ✓ |
| Badge count on tab | ✓ | ✓ |

---

## Relay / Data Contract

**Endpoints used:**

- `GET /requests` — returns array of Request objects (see schema below), newest first, last 200 by default. Query params: `?status=open|in-progress|completed|cancelled`, `?limit=N`
- `POST /requests/:id/cancel` — CEO cancels a not-picked-up or in-progress request. Body: `{ "reason": "optional string" }`
- `POST /requests/:id/dismiss` — CEO soft-deletes a completed or cancelled request from their view. Does not delete the relay record.
- `GET /requests/:id` — full detail for a single request, includes full ask text and any agent response

**Request object schema:**
```json
{
  "id": "uuid",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "ask": "CEO's original message text",
  "status": "not-picked-up | in-progress | completed | cancelled",
  "assigned_agent": "agent-name | null",
  "picked_up_at": "ISO8601 | null",
  "completed_at": "ISO8601 | null",
  "worklog_path": "~/environment/.worklog/xxx.md | null",
  "dismissed": false
}
```

**Status lifecycle:**
```
not-picked-up
     │
     ├─ agent picks up → in-progress
     │       │
     │       └─ agent sends DONE → completed
     │
     └─ CEO cancels → cancelled
```

- Jarvis tags a relay message as a request on routing; sets `status: approved and creates the record
- When an agent sends `relay_send(to: "command", type: "status", ...)` referencing the request id, relay transitions to `in-progress`
- When agent sends `type: "done"` referencing the request id, relay transitions to `completed` and sets `worklog_path` if included
- `cancelled` is a terminal state; no further transitions

**WebSocket push:**  
Relay emits `type: "request_update"` events over the existing dashboard WebSocket when any request changes status. Payload is the full updated Request object. Dashboard merges into local state by id — no polling needed.

**Message types:**
- `type: "request_update"` — relay → dashboard WebSocket, when status changes. Payload: full Request object.

**How Jarvis tags a request:**  
CEO messages routed by Jarvis that are task directives (not questions, not Q&A) receive a `request_id` field. Jarvis calls `POST /requests` to create the record before dispatching to agents. Agents include `request_id` in their response messages so relay can match and update status.

---

## Acceptance Criteria

- [ ] Desktop: Request tab renders with live badge count of open requests
- [ ] Desktop: Status color strips match the four states correctly
- [ ] Desktop: Completed cards auto-collapse after 60 seconds; ✕ dismisses them
- [ ] Desktop: Filter pills correctly narrow the visible list
- [ ] Desktop: Clicking agent name jumps to agent node in 3D view
- [ ] Desktop: WebSocket update causes card status to update without full reload
- [ ] Mobile: Swipe left on completed card reveals Dismiss action
- [ ] Mobile: Swipe left on open card reveals Cancel action
- [ ] Mobile: Badge count shows on Requests tab icon
- [ ] Mobile: Filter strip works at 390px without overflow
- [ ] Both: Expanding card shows full ask text and worklog link if present
- [ ] Playwright test covers: create request → pick up → complete → dismiss on both viewports

---

## Out of Scope

- CEO editing or modifying request text after submission (immutable record)
- Request priority levels (out of scope for v1 — all requests are equal)
- Agent-to-agent request tracking (this board is CEO→agent only)
- Push notifications to phone OS (separate feature, post-MVP)
- Request search / full-text filter (filter by status only in v1)
- Automatic re-assignment if an agent drops a request (manual cancel + re-ask for now)
