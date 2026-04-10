---
title: "UX Audit: Type Scale Chaos + Duplicated Button Styles"
proposedBy: ux-lead
agent: productivitesse
status: pending
ts: 2026-04-04T06:23:46
---

# Type Scale Chaos + Duplicated Button Styles

**Submitted:** 2026-04-04T06:23:46  
**Priority:** P2 — visual debt accumulating as codebase grows

## Finding 1: No Consistent Type Scale

The dashboard uses font sizes ranging from 7px to 15px with no governing system:

| Size | Found in |
|------|----------|
| 7px  | Badge text in `HoloPanelRight` pinned section rows |
| 8px  | Status badge text (ProposalsPanel), priority badge (DashboardView) |
| 9px  | Zone header labels (InboxPanel), type badge text, expand hints |
| 10px | Tab badge text, header counts, timestamps, many secondary labels |
| 11px | Agent name in inbox, proposal body preview |
| 12px | NavBar tab text, message body, issue title |
| 13px | Primary body text in DashboardView, some proposals |
| 14px | Proposal card titles |
| 15px | Panel headers (InboxPanel, ProposalsPanel) |

Seven meaningful font sizes is three too many. The 7px badges are unreadable at any normal viewing distance. The 8px status badges are borderline.

The intended hierarchy appears to be:
- **Header** (panel title) — 15px, weight 700
- **Body** (primary reading text) — 13px, weight 400–600
- **Label** (secondary, metadata) — 11px, weight 600
- **Badge** (count, status) — 10px, weight 700, min-width enforced

Anything below 10px should be reconsidered. Badges below 10px are better addressed with padding and spacing than smaller text.

## Finding 2: `approveBtn`/`rejectBtn` Defined 3 Times

The same Approve/Reject button pattern appears in:

1. `DashboardView.tsx` — `approveBtn` (padding: 3px 12px, fontSize: 10)
2. `ProposalsPanel.tsx` — `approveBtn` (padding: 5px 16px, fontSize: 11)
3. `HoloPanelRight.tsx` — `approveBtn` (padding: 2px 8px, fontSize: 8)

All three have slightly different sizes. The core style (green tint, green border, uppercase mono font) is the same but values drift. When a design decision changes (e.g., "make approve buttons slightly more prominent"), it must be updated in 3 places and will inevitably diverge.

## Proposed Fix

### Fix 1: Document a type scale in `DESIGN-SYSTEM.md`

Add explicit scale definition:
```
--size-badge:   10px  (min, use with adequate padding)
--size-label:   11px  (metadata, secondary info)
--size-body:    13px  (primary reading)
--size-title:   15px  (panel headers)
```

Flag any size below 10px as a code smell requiring explicit justification.

### Fix 2: Create shared button style tokens

Create `src/features/dashboard/styles/buttons.ts` exporting:
```ts
export const approveBtn: React.CSSProperties = { ... };
export const rejectBtn: React.CSSProperties = { ... };
```

All three panels import from this shared file. Sizing variants can be handled via `size: 'compact' | 'default'` prop on a thin wrapper component, rather than 3 separate style objects.

### Priority

Fix 2 is a quick refactor (1 file created, 3 files updated, no behavior change) and eliminates the divergence risk. Fix 1 (documentation) should happen simultaneously.

The 7–8px font sizes in badges should be bumped to 10px with padding reduced to compensate — a one-line change per badge that materially improves readability on non-retina screens and for any CEO over 40.
