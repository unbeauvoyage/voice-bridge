---
title: Doc Drawer (Inline Markdown Preview)
date: 2026-04-04
status: approved
---
# Feature Design Spec — Doc Drawer (Inline Markdown Preview)

**Status:** approved
**Priority:** High  
**Author:** ux-lead  
**Date:** 2026-04-04  
**Requested by:** CEO (via Jarvis)

---

## Problem / Why

Every proposal, report, worklog, and answer that matters to the CEO is a `.md` file on disk. Currently, links to these files (`~/environment/proposals/foo.md`) are inert text — CEO cannot read them without leaving the dashboard entirely. This breaks the review flow:

> CEO sees a proposal card → wants to read the full spec → has to navigate away → loses context → comes back → forgets what they were approving.

This is especially bad for proposals, where the full content is the thing CEO needs to read *before* acting on the Approve/Reject buttons.

**Goal:** Click any `.md` file reference anywhere in the dashboard → rendered markdown appears immediately in a drawer, without navigation. CEO reads, acts (approve/reject if applicable), dismisses. Never leaves the current view.

---

## What Already Exists (use it, don't duplicate)

| Existing piece | Used for |
|---|---|
| `markdownUtil.ts` → `md()` | Already renders markdown with headings, bold, code, bullets. Reuse directly. |
| `SidePanel.tsx` | Floating panel with `normal`/`tall`/`closed` size states. Reuse the visual shell. |
| `actions.ts` → `approveProposal()`, `rejectProposal()` | Already call the relay endpoints. Call them from the drawer footer. |
| `store.ts` (Zustand) | Add one slice: `docDrawer: DocDrawerState \| null` |

No new dependencies. No new markdown library. Everything is already there.

---

## Component: `DocDrawer`

A **global singleton overlay** — one instance mounted at the root layout, always present but invisible until triggered. Any component anywhere can open it.

### State slice (add to store.ts)

```ts
interface DocDrawerState {
  path: string;           // absolute path, e.g. ~/environment/proposals/foo.md
  title: string;          // display title shown in drawer header
  proposalId?: string;    // if set, shows Approve/Reject footer
  proposalStatus?: 'pending' | 'approved' | 'rejected';
}

// In store:
docDrawer: DocDrawerState | null;
openDocDrawer: (state: DocDrawerState) => void;
closeDocDrawer: () => void;
```

### Trigger — `<FileLink>` component (new, small)

Replace bare file path text everywhere with this component:

```tsx
<FileLink
  path="~/environment/proposals/ceo-knowledge-board.md"
  label="CEO Knowledge Board"       // optional display text
  proposalId="abc-123"              // optional — enables approve/reject footer
  proposalStatus="pending"          // optional
/>
```

`FileLink` renders as an underlined clickable span. On click: `store.openDocDrawer(...)`. Nothing else.

**Auto-detection in message renderer:** The `md()` utility and message body renderer should scan for `~/environment/...md` patterns and automatically wrap them as `<FileLink>` — CEO should not need anything special. Any file path becomes clickable.

### Drawer behavior

**Desktop 3D:**
- Slides in from the right edge, over the existing layout. Width: `480px`. Full viewport height.
- Background dims to `rgba(0,0,0,0.45)` — current view remains visible and partially readable.
- Clicking the dimmed background closes the drawer (same as `[Close]`).
- Header: `[×] [title]` — close button top-right.
- Body: scrollable rendered markdown via `md()`. Padding 24px. Font matches dashboard (monospace, `#ccc`).
- Footer (only when `proposalId` set and `proposalStatus === 'pending'`): sticky, two buttons + close.

```
┌──────────────────────────────────────────────────┐  ← 480px
│  × CEO Knowledge Board                           │
├──────────────────────────────────────────────────│
│                                                  │
│  # Feature Design Spec — CEO Knowledge Board     │
│                                                  │
│  **Status:** Draft                               │
│  **Author:** ux-lead                             │
│  ...                                             │
│                                                  │
│  (scrollable)                                    │
│                                                  │
├──────────────────────────────────────────────────│  ← sticky footer, proposals only
│  [Approve ✓]           [Reject ✗]   [Close]      │
└──────────────────────────────────────────────────┘
```

**Approve/Reject in drawer:**
- Calls existing `approveProposal(proposalId)` / `rejectProposal(proposalId, reason)`.
- Reject: shows a one-line text input inline in the footer (slides down). CEO types reason, clicks Reject again to confirm.
- On success: footer replaces with confirmation ("Approved ✓" or "Rejected"), drawer auto-closes after 1.5s.
- On failure: footer shows error, stays open (relay might be down).
- If `proposalStatus` is already `approved` or `rejected`: footer shows readonly status badge instead of buttons.

**Mobile (390px):**
- Bottom sheet instead of right drawer. Slides up to 88% viewport height.
- Swipe down to dismiss (touch gesture, velocity-based threshold).
- Tap outside visible region → dismiss.
- Footer: same approve/reject buttons, full width, stacked if needed.
- No dimmed background on mobile — bottom sheet is opaque, content below is hidden.

---

## Where File Links Appear (exhaustive list)

All of these should render `<FileLink>` rather than plain text:

| Location | Path type | Has proposalId? |
|---|---|---|
| Proposals panel — each card body | `~/environment/proposals/...md` | ✓ |
| Knowledge Board — cross-links to proposals | `~/environment/proposals/...md` | ✓ |
| My Requests — worklog links | `~/.worklog/...md` | ✗ |
| Inbox message bodies | any `~/environment/...md` | context-dependent |
| Event log entries | any `~/environment/...md` | ✗ |
| Relay messages containing file paths | any `~/environment/...md` | ✗ |

The auto-detection in the message renderer handles the catch-all. Individual panels (ProposalsPanel, Knowledge Board, My Requests) should pass `proposalId` explicitly when they render their own cards.

---

## File Fetching

**Endpoint:** `GET /fs?path=<encoded-path>` — relay reads the file from disk and returns `{ content: string }`. Relay already has filesystem access; this is a thin wrapper.

**Loading state:** Drawer opens immediately (showing a spinner in the body area) while the fetch is in flight. No delay before the drawer appears — the shell opens instantly, content loads in.

**Error state:** If fetch fails (file not found, relay down), body shows:
```
Could not load file.
Path: ~/environment/proposals/foo.md
```
Footer still shows approve/reject if proposalId is set (CEO can still act even if preview failed, since they may have read it elsewhere).

**Caching:** Cache fetched content in component local state keyed by path. If CEO opens the same file twice in a session, no second fetch. Invalidate on `knowledge_update` / `proposal_update` WebSocket events.

---

## What This Does NOT Do

- Does not replace the existing `ProposalsPanel` cards — they still show the summary. The drawer is for full content on demand.
- Does not handle non-markdown files in v1 (`.json`, `.log`, `.ts`). Only `.md` paths trigger `<FileLink>`.
- Does not allow CEO to edit files from the drawer.
- Does not show a file tree or directory browser.
- Does not persist drawer state across page reloads.

---

## Acceptance Criteria

- [ ] `openDocDrawer` / `closeDocDrawer` added to Zustand store
- [ ] `DocDrawer` component mounts at root layout, invisible until triggered
- [ ] `<FileLink>` component dispatches `openDocDrawer` on click
- [ ] `md()` renderer and message body renderer auto-detect `~/environment/...md` paths and wrap as `<FileLink>`
- [ ] Drawer slides in from right on desktop, bottom-sheet on mobile
- [ ] Background dims on desktop; drawer is opaque on mobile
- [ ] Clicking dim / swiping down / pressing Esc closes the drawer
- [ ] File content fetched via `GET /fs?path=...`, shown rendered with `md()`
- [ ] Spinner shown during fetch; error message on failure
- [ ] Footer with Approve/Reject shown only when `proposalId` set and status is `pending`
- [ ] Reject inline reason input works; confirm on second click
- [ ] On approve/reject success: confirmation shown, drawer closes after 1.5s
- [ ] Already-resolved proposals show readonly status badge, not action buttons
- [ ] Content cached per path within session
- [ ] Playwright test: click FileLink → drawer opens → content renders → approve → drawer closes
