---
title: "UX Audit: Inbox — Timestamp Date Missing + Zone 1 Badge Undercount"
proposedBy: ux-lead
agent: productivitesse
status: approved
ts: 2026-04-04T06:23:46
---

# Inbox — Timestamp Date Missing + Zone 1 Badge Undercount

**Submitted:** 2026-04-04T06:23:46  
**Priority:** P1 — two independent fixes, both affect CEO awareness

## Finding 1: Timestamps Show Time Only, Not Date

`InboxPanel.tsx` `formatTs()`:

```tsx
function formatTs(ts: string): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
```

Output: `"03:45:22"` — no date.

CEO looking at the inbox sees messages timestamped `"23:58:11"` with no indication of when that was. Overnight messages, messages from 2 days ago, and messages from 10 minutes ago are visually identical except for the time value.

This creates confusion for any message that persists across a day boundary, which happens constantly (agents work overnight, CEO checks in the morning).

**Fix:** Replace `toLocaleTimeString` with a smart formatter that shows:
- `"just now"` for <60s (or `"Xm ago"` for <60m, matching the pattern already used in `DashboardView.tsx`)
- `"HH:MM"` for same day (no seconds needed)
- `"Mon HH:MM"` for earlier this week  
- `"Apr 3 HH:MM"` for older

This pattern is already implemented in `DashboardView.tsx` (`formatTs` there uses relative time). The Inbox should use the same logic for consistency.

---

## Finding 2: Mobile Inbox Badge Shows Total Count, Not Zone 1 Count

`MobileLayout.tsx`:

```tsx
const inboxCount = useStore(useShallow((s) =>
  s.messages.filter((m) => m.to === 'ceo').length  // ← all messages
));
```

The badge on the Inbox tab shows total message count. A badge of "12" means "12 messages total" — it could be 12 done reports, or 12 escalations. CEO cannot tell.

**Fix:** The badge should show Zone 1 count (messages that `needsInput()` returns true for), and use the gold color (`#ffd700`) for Zone 1 vs a dim color for total. Pattern:

- `Zone1 count > 0` → gold badge showing Zone 1 count (`"3 needs input"` or just `"3"` in gold)
- `Zone1 count === 0, total > 0` → grey badge showing total, smaller

`NavBar.tsx` has the same issue — `inboxCount` counts all messages to CEO, not urgent ones. Same fix applies.

This gives CEO an immediate signal: "3 need input" is categorically different from "3 done messages".

---

## Implementation Notes

Both fixes are in: `InboxPanel.tsx`, `MobileLayout.tsx`, `NavBar.tsx`  
Zero architectural change required — pure display logic.
