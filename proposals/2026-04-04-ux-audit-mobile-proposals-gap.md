---
title: "UX Audit: Proposals Panel Missing from Mobile"
proposedBy: ux-lead
agent: productivitesse
status: done
ts: 2026-04-04T06:23:46
---

# Proposals Panel Missing from Mobile — Critical Functional Gap

**Submitted:** 2026-04-04T06:23:46  
**Priority:** P0 — CEO is blocked from approving proposals when on phone

## Finding

The mobile layout (`MobileLayout.tsx`) exposes 5 tabs: Voice, Dashboard, Knowledge, Requests, Inbox.  
**Proposals is absent.** This means when the CEO is away from their desk — which is when mobile use happens — they cannot approve or reject any agent proposals.

Agents can propose work and wait indefinitely for approval while CEO is mobile. The system stalls.

## Evidence

```tsx
// MobileLayout.tsx — tabs defined
type Tab = 'voice' | 'dashboard' | 'inbox' | 'knowledge' | 'requests';
```

`ProposalsPanel` is imported and used in desktop `App.tsx` only — never mounted in mobile.

## Impact

- Any proposal submitted while CEO is on phone sits unanswered
- CEO on dashboard mobile tab sees "N proposals pending" but cannot act on them
- `waiting-for-input` messages that stem from blocked proposals accumulate in inbox with no resolution path

## Proposed Fix

Add a **Proposals tab** to `MobileLayout` — 6th tab in the bottom bar.  
The `ProposalsPanel` component already exists and supports mobile-sized viewports (cards are responsive).  
The approve/reject/voice buttons are already touch-sized (5px padding + 16px padding, readable at finger scale).

Alternatively, embed a compact approval flow directly in the Dashboard mobile tab below the agent status bar, so CEO sees and acts on proposals in one place without a tab switch. This may be better for the "one glance" mobile use case.

**Recommendation:** Add the Proposals tab first (one line change) then iterate the mobile card layout if needed.

## Implementation

`MobileLayout.tsx`:
- Add `'proposals'` to the `Tab` union
- Add import for `ProposalsPanel`
- Add `{activeTab === 'proposals' && <ProposalsPanel />}` block
- Add tab button with label "Proposals" and icon "📋" (move Requests to a different icon)
- Show pending count badge on the tab label (pattern already exists for Inbox)

Tab bar will have 6 tabs. At 375px this is tight — recommend using shorter labels ("Voice", "Status", "Ideas", "Tasks", "Inbox") or an overflow menu for the 6th.
