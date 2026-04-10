# Feature Design Spec: Inbox Reply Parity

**Status:** Draft  
**Priority:** Medium  
**Author:** productivitesse  
**Date:** 2026-04-03

---

## Problem / Why

CEO needs to reply to agent messages from both desktop and iPhone without context-switching. The reply mechanism (QuickReplyBar) exists in the desktop Inbox tab, but the mobile experience of the same Inbox tab is functionally identical — the issue is ergonomics, not capability gaps. On a 390px screen, tap targets are small, the NavBar tab label "CEO Inbox" is crowded, and the QuickReplyBar input is narrow. CEO should be able to act on messages fluidly from the phone.

---

## Current State (what exists)

- Desktop and mobile both render the same `InboxPanel` component (mobile uses `ResponsiveApp` → `MobileLayout` → `DashboardPage` → `DashboardApp` → `InboxPanel` when `activeTab === 'inbox'`)
- InboxPanel: tap sender name to open QuickReplyBar inline, tap row to expand body
- QuickReplyBar: text + mic button, sends via relay, closes on success
- Feature parity already exists technically — the gap is mobile UX ergonomics

---

## Desktop 3D UI (primary experience)

**Where it lives:** NavBar tab "CEO Inbox" (cyan badge with count)

**What CEO sees:**
- List of messages addressed to CEO, newest first
- Each row: sender name (clickable), type badge, timestamp
- Body collapsed to 4 lines; tap row to expand fully
- Tapping sender name opens QuickReplyBar inline below the message
- QuickReplyBar: pre-filled context `[RE: …]`, text input + mic + send button

**What CEO can do:**
- Read full message (tap to expand)
- Reply inline (tap sender name → QuickReplyBar)
- Send voice reply (mic button in QuickReplyBar)

**Data source:** `GET /history/ceo` + WS `message` events filtered to `to === 'ceo'`

---

## Mobile HTML UI (must match feature parity)

**Where it lives:** Bottom tab bar → "Dashboard" → NavBar tab "CEO Inbox"

**Current issue:** Two navigation hops on mobile (bottom tab then NavBar tap) and tap targets in the NavBar are ~36px wide on a 390px screen — marginal for one-handed use.

**Proposed improvement:** Add "Inbox" as a direct bottom tab in `MobileLayout` alongside Voice and Dashboard. This makes Inbox a one-tap destination on iPhone instead of two-tap.

**What CEO sees:**
- Same message list as desktop
- Rows have larger tap targets (min 52px height)
- Sender name and reply button are separated: sender on left, explicit "Reply" pill button on right (avoids accidental reply on name tap)
- Expanded message shows full body with scroll
- QuickReplyBar renders full-width below the expanded message; on open, `scrollIntoView()` is called so it's always visible regardless of message length
- Future option (not this spec): fixed bottom-sheet reply bar docked to screen bottom, message highlighted — cleaner on very long messages

**What CEO can do:**
- Read full message (tap row to expand/collapse)
- Reply inline (tap "Reply" button → QuickReplyBar opens below)
- Send voice reply (mic button in QuickReplyBar)
- Dismiss reply (tap away or "✕" button)

**Differences from desktop:**
- Explicit "Reply" pill button instead of tapping sender name (clearer affordance on touch)
- One-tap access via dedicated bottom tab
- Larger touch targets throughout
- Keyboard-aware scroll (iOS input focus scrolls correctly)

---

## Feature Parity Checklist

| Capability | Desktop 3D | Mobile HTML |
|------------|-----------|-------------|
| View CEO messages | ✓ | ✓ |
| Expand full message body | ✓ | ✓ |
| Reply via text | ✓ | ✓ |
| Reply via voice (mic) | ✓ | ✓ |
| Context pre-filled in reply | ✓ | ✓ |
| One-tap access from main UI | ✓ (NavBar badge) | proposed: bottom tab |
| Touch-optimized tap targets | n/a | proposed |

---

## Relay / Data Contract

**Endpoints used:**
- `GET /history/ceo` — returns `{ messages: RelayMessage[] }` for full history
- `POST /messages` — send reply message via `sendMessage()` helper

**Message types:**
- WS `message` event with `to: "ceo"` — live inbox updates (already handled)

**No relay changes needed.** All data contracts already exist.

---

## Implementation Plan

Two small changes:

**1. MobileLayout.tsx** — add "Inbox" bottom tab (alongside Voice, Dashboard), renders InboxPanel directly. Inbox tab shows a badge count (unread messages to ceo since last view).

**2. InboxPanel.tsx** — add `isMobile` prop or detect via `window.innerWidth` to conditionally render:
- Larger row min-height (52px vs current ~38px)
- Explicit "Reply" button pill instead of relying on sender name click
- The existing QuickReplyBar remains unchanged

Total: ~40 lines of code across 2 files. No new components needed.

---

## Acceptance Criteria

- [ ] Desktop: Inbox tab accessible via NavBar, reply via sender-click → QuickReplyBar, unchanged
- [ ] Mobile: Inbox accessible via bottom tab (one tap from any screen)
- [ ] Mobile: "Reply" button visible per message row (not just sender name)
- [ ] Mobile: QuickReplyBar text input and mic button fully usable on iPhone keyboard
- [ ] Mobile: Message body fully readable when expanded (no clipping)
- [ ] Both: Sending a reply shows "✓ Sent" then closes QuickReplyBar

---

## Out of Scope

- Push notifications for new inbox messages (separate spec)
- Message threading / conversation view
- Read/unread tracking beyond the badge count
- Agent popover (separate spec)
