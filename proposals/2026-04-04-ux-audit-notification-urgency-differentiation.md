---
title: "UX Audit: Notification Stack — Escalations Invisible Among Updates"
proposedBy: ux-lead
agent: productivitesse
status: approved
ts: 2026-04-04T06:23:46
---

# Notification Stack — Escalations Invisible Among Updates

**Submitted:** 2026-04-04T06:23:46  
**Priority:** P1 — a fire alarm that looks identical to a progress report

## Finding

`NotificationStack.tsx` displays a card deck in the bottom-right corner. The front card is fully visible; cards behind it show as offset "ghost" cards with agent name only.

The stack is **purely chronological** (newest first). An `escalate` notification (crash, security issue) that arrives after three `done` notifications gets **buried three cards deep**. The front card shows a routine "DONE" message. The escalation is hidden.

The deck ghost cards show only agent name — not type. CEO sees stacked cards and reads only the front one. The escalation is invisible until they dismiss the top three cards.

Additionally, `auto-dismiss` is **off by default** — so DONE cards never self-clear and stack up, burying escalations further.

## Evidence

```tsx
// NotificationStack.tsx
const sorted = [...notifications].reverse(); // newest first — no urgency sorting
const topNotif = sorted[0]!;
```

No sort by `msgType` priority anywhere.

## Proposed Fix

### Fix 1: Sort by urgency before chronological order

Priority order within the stack:
1. `escalate` 
2. `waiting-for-input`
3. `status`, `message`
4. `done`

Within each priority group, maintain reverse-chronological order.

```ts
const PRIORITY = { escalate: 0, 'waiting-for-input': 1, status: 2, message: 2, done: 3 };
const sorted = [...notifications]
  .sort((a, b) => (PRIORITY[a.msgType] ?? 2) - (PRIORITY[b.msgType] ?? 2) || b.ts - a.ts);
```

This ensures the front card is always the most urgent thing waiting for CEO attention.

### Fix 2: Show type color on ghost cards

The "behind" cards currently show only agent name in grey. Add the type badge color to the ghost card's accent bar:

```tsx
// Ghost card accent bar — use type color instead of white
<div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${typeColor}bb, transparent)` }} />
```

CEO glancing at the deck can now see "red bar, gold bar, green bar" and know the stack contains an escalation, a blocked message, and a done update — before reading any text.

### Fix 3: Auto-dismiss default ON for `done` type only

Change default: `done` notifications auto-dismiss after 6s; `waiting-for-input` and `escalate` never auto-dismiss.

This prevents routine completions from piling up and requires explicit CEO action only for what matters.

## Implementation

All changes in `NotificationStack.tsx`. No API or store changes needed.
