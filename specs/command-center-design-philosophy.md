---
title: "Command Center — Design Philosophy & Directive"
author: prism (UX Expert)
date: 2026-04-06T02:16:01
status: active
summary: "Single high-density page where CEO manages everything — voice-first, cards drain as handled, sections reshape dynamically. No navigation. Density over convention. One user, one surface."
parent: proposals/2026-04-06-unified-mobile-attention-architecture.md
---

# Command Center — Design Philosophy & Directive

This document defines the design philosophy for the mobile Command Center (Voice Page). The interaction specs are in the Voice Page Command Center proposal. This document defines **why** and **how it should feel**.

Every engineer and designer working on this page must read this first.

---

## The Core Rule

> **One page. Everything. No navigation.**

The CEO opens the app. The entire state of their operation is on one scrollable surface. Every agent, every blocked item, every pending proposal, every request, every answer. No tabs to check. No "go look at the other screen." If it needs CEO attention, it's here.

The other pages (Inbox, Proposals detail, Agents 3D, Knowledge) still exist as **depth views** — the CEO visits them when they want to read a long proposal body or browse message history. They're behind a "More" button. The CEO might go there once a day. The Command Center is where they live.

---

## This App Is For One Person

This is not a product serving millions of users. It is a custom tool for one CEO managing an AI agent system.

**What this means for design:**

- **No progressive disclosure.** Don't hide information behind "show more" or "advanced" toggles to protect casual users. There are no casual users. Show everything.
- **No "are you sure?" dialogs.** Approve means approve. Dismiss means dismiss. The CEO learns the interface once and operates at full speed forever.
- **No tutorial states, onboarding, or empty-state illustrations.** If there are no proposals, the section collapses. It doesn't show a cartoon envelope saying "No proposals yet!"
- **No accessibility compromises for density.** Standard apps use 44px tap targets and generous padding because elderly users and children might use them. This user is a fast-moving technical CEO. Tap targets can be 36px. Padding can be tight. Density wins.
- **No design-system orthodoxy.** If the best way to show agent status is a colored dot with 9px monospace text, do that. Don't upsize it to 14px because "our type scale minimum is 12px." The type scale serves this page, not the other way around.
- **Convention is not a constraint.** If an unconventional interaction is faster, use it. The CEO will learn it. They said so explicitly.

---

## The Page Is a Living Queue, Not a Static Dashboard

### Cards Drain

When the CEO handles an item (approves a proposal, replies to a blocked agent, acknowledges a message), the card **disappears**. It doesn't move to an "archive" section. It doesn't grey out. It's gone. The page gets shorter.

This means the page physically reflects how much work remains. A tall page = lots pending. A short page = nearly clear. The CEO gets a visceral sense of progress without reading a single number.

### One Unified Action List — No Section Split

**Updated 2026-04-06T02:25 — CEO feedback merged Act Now + Decide into one list.**

The original design had two sections: "Act Now" (blocked agents) and "Decide" (proposals). CEO correctly identified these as the same thing: "what is waiting on me?" The distinction was a designer abstraction, not a user mental model.

The page now has ONE action list at the top. No section headers. Items are urgency-ranked:
1. Escalations (red left border) — oldest first
2. Blockers (gold left border) — oldest first
3. Proposals (gold left border) — oldest first

Each card shows affordances appropriate to its type:
- Blocker/escalation cards: **Reply only.** No dismiss. No ack. A blocked agent needs a reply — hiding the card hides the problem without solving it.
- Proposal cards: **✓ and ✗ icon buttons only** (28px, compact). Voice reply is via the global mic after tapping the card. No labeled "Voice" button — the global recorder makes it redundant.

When the action list is empty: single line `✓ All clear`. Below that, Context section (collapsible agent status strip).

### Agent Grid — Persistent Parallel Conversations

**Updated 2026-04-06T03:14 — CEO feedback: grid and action queue coexist.**

The CEO uses the page in two modes:
- **Triage:** "What needs me?" → scan action queue, handle items, cards drain.
- **Active command:** "I'm directing 5 agents simultaneously." → see all agents at once, tap to aim voice, see messages flow in live.

These are two regions of the same page, not two modes to switch between.

**The agent grid** sits below the action queue. It is a grid of compact cards — every active agent, always visible, **never drains**. Each card shows:
- Status dot (green/gold/grey)
- Agent name (tap = set voice target, card gets highlight border)
- Last message preview (2–3 lines, updates in-place when new messages arrive)
- Timestamp (refreshes live)

**This is NOT a chat list.** A standard chat app shows one conversation at a time. This is parallel — all agents visible simultaneously. CEO never "enters" a conversation. They tap to aim their voice, speak, tap another agent, speak. Six conversations on one screen.

**Grid ↔ Queue promotion:** When an agent sends `waiting-for-input` or `escalate`, their card promotes from the grid into the action queue at the top (the grid card dims). When the CEO replies and the queue card drains, the agent drops back into the grid with updated last-message. The grid is the resting state. The queue is the elevated state. One system, two urgency levels.

**New messages flow in live.** Agent sends a message → their grid card text updates in-place, timestamp refreshes, brief flash animation signals "new." CEO watches all conversations simultaneously without navigating anywhere.

### Page Shape Is Dynamic

The action queue drains, the grid persists. When there are no urgent items, the queue collapses to `✓ All clear` (one line) and the grid takes the full page — pure active-command mode. When items accumulate overnight, the queue is tall and pushes the grid down — pure triage mode.

The page shape changes throughout the day. Morning: tall queue + grid below fold. After a decision session: one-line queue + grid fills the screen. The shape IS the status.

### Priority Order Is Automatic

The page sorts itself. Escalations float to the absolute top. Blockers next. Proposals next. Context below. The CEO never manually sorts or filters. The page always shows the most urgent thing first.

---

## Voice Is Woven Into Every Card

Voice is not a separate feature living in a tab. Voice is the **interaction method** for every actionable item on the page.

- Tap a blocked-agent card → voice target switches to that agent → tap mic → speak → reply sent
- Tap a proposal card → voice target switches to the proposer → speak "approved" → proposal approved
- Tap an agent in the System section → voice target switches → speak a new directive
- Don't tap anything → voice goes to command (default router)

The mic button is always visible at the bottom of the screen. It follows the CEO's attention. The entire flow is: **see → tap → speak → done**.

Typing exists as a fallback. The text input is small and tucked away. Voice is the primary path.

---

## Information Density Rivals a Terminal

The aesthetic is closer to a Bloomberg terminal or a mission control screen than a consumer mobile app. Monospace fonts for data. Color-coded status. Tight spacing. No whitespace for decoration.

But unlike a terminal, it has **pre-attentive urgency hierarchy**:

- **Red band visible at top** → something is broken or blocked. CEO's brain registers this before their eyes focus on any text.
- **Gold band below** → decisions pending. 
- **No color** → everything is fine, context only.

The CEO glances at their phone. If there's no red or gold, they put it back in their pocket. If there is, they engage. This takes under one second and requires reading zero text.

---

## Speed Metrics

Every interaction on this page is measured in gesture count, not time (network latency varies).

| Scenario | Gestures |
|----------|----------|
| Reply to a blocked agent | 3: tap card → tap mic → tap send |
| Approve a proposal | 1: tap ✓ button |
| Reject a proposal | 2: tap ✗ → type reason + Enter |
| Approve with comment | 3: tap card → tap mic → speak "approved, prioritize auth" → tap send |
| Scan system health (is anything wrong?) | 0: glance at color bands (red/gold/clear) |
| Send a new directive to an agent | 3: tap agent in Context → tap mic → tap send |
| Review all pending items | 0: scroll the page |

If any common scenario requires more than 4 gestures, the design is wrong.

---

## What This Page Replaces

| Before (current) | After (Command Center) |
|-------------------|----------------------|
| Check Inbox tab for blocked agents | Act Now section, always visible |
| Switch to Proposals tab to approve | Decide section, inline approve |
| Switch to Agents tab to see who's working | System section, one-line-per-agent |
| Switch to Requests tab to check ask status | Requests section, inline |
| Switch to Knowledge tab for answers | Knowledge section, inline |
| Open Voice tab to speak to an agent | Mic pinned at bottom, always ready |

Six tab switches → zero. Everything that was spread across 7 tabs is now vertically stacked on one surface.

---

## Non-Negotiable Design Rules

1. **No modals.** Everything happens inline. Expand a card, reply inside it, collapse it. No overlay that blocks the rest of the page.
2. **No page transitions.** Nothing navigates away from this page except the "More" depth views. Every action completes in-place.
3. **No loading spinners replacing content.** If data is loading, show stale data with a subtle refresh indicator. Never blank the screen.
4. **No confirmation dialogs.** Actions are immediate. Undo snackbars (4s) are acceptable for destructive actions only.
5. **Cards must be dismissable.** Every card the CEO doesn't want to see right now can be swiped away. Nothing is forced to stay on screen.
6. **The page must work offline-first.** Show last-known state from local cache immediately on open. Sync when network is available. CEO should never see "connecting..." as the first thing on launch.

---

## Recording Is App-Global, Not Page-Scoped

**CEO directive (2026-04-06):** "Recording should be owned by the whole app so that I can navigate while recording is being done."

### The Problem

The current `useVoiceRecorder` hook (`src/features/dashboard/hooks/useVoiceRecorder.ts`) stores MediaRecorder state in React refs and has a cleanup effect that kills the recorder on component unmount. When the CEO starts recording on the Voice page and switches to another tab (to check something while speaking), the component unmounts → recording is destroyed → audio is lost.

### The Rule

**Recording survives all navigation.** The CEO can:
1. Tap record on the Command Center
2. Switch to Inbox to check a message detail while still speaking
3. Switch back (or stay on Inbox)
4. Tap stop — recording completes, transcript is produced, reply is sent to whatever target was set

Recording is not owned by a page. Recording is owned by the app.

### Architecture

- **MediaRecorder + stream live in the Zustand store** (or a module-level singleton outside React), not in a hook that mounts/unmounts with a component.
- **Recording indicator is global** — a persistent pill/bar visible on ALL tabs when recording is active: `● REC 0:04` in red, pinned to the top or bottom of the screen above the tab bar. CEO always knows the mic is hot regardless of which page they're on.
- **Stop button is global** — the recording indicator itself is tappable to stop. CEO doesn't need to navigate back to the originating page to stop recording.
- **Voice target persists** — if CEO tapped a blocked-agent card (setting voice target to that agent) then navigated away, the target is still set when they stop recording. Target lives in store, not in component state.
- **Only tap-to-record is the supported mode for v1.** CEO confirmed: "only tap to record was working correctly anyway." Hold-to-record and passive mode are future enhancements — don't ship them until tap-to-record is bulletproof.

### The Global Recording Indicator

When recording is active, a bar appears above the tab bar on every page:

```
┌────────────────────────────────────────────────┐
│  ● REC  0:07  →  command          [■ Stop]     │
└────────────────────────────────────────────────┘
[ Voice ]  [ Agents ]  [ Inbox ]  [ More ]
```

- Red pulsing dot + elapsed time
- Target agent name (so CEO remembers who they're speaking to)
- Stop button — tapping stops recording AND shows the transcript preview inline in this bar (expanding it to show transcript + Send/Re-record buttons)
- This bar renders in `MobileLayout.tsx`, not in any individual page component

### Reply Buttons on Cards

Every card with a "Reply" button (in Act Now, in Decide, in the Message Tray) does NOT have its own recording UI. Instead:
- Tapping "Reply" on any card → sets the voice target to that agent → activates the global mic (starts recording)
- The global recording indicator appears
- CEO speaks, navigates if needed, taps Stop on the indicator
- Transcript preview appears in the indicator bar
- Send → reply goes to the targeted agent with context

One mic. One recording system. Every reply button is just a trigger that says "start recording, point it at this agent."

---

## Relationship to Other Specs

- **Voice Page Command Center proposal** — the interaction spec. Defines layers, gestures, voice context system, state machine.
- **Unified Mobile Attention Architecture** — the umbrella. Defines how this page fits with desktop Mission Control and the shared data layer.
- **DESIGN-SYSTEM.md** — visual tokens (colors, fonts, spacing). This page follows the system but may override spacing for density.

This document is the **philosophy**. The other specs are the **blueprint**. When in doubt about a design decision, come back here and ask: "Does this make the one-page experience faster and denser?"
