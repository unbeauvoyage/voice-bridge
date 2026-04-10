---
title: "Voice Page: High-Density Command Center + Notification UX Redesign"
proposedBy: ux-lead
agent: productivitesse
status: approved
ts: 2026-04-05T03:27:03
updated: 2026-04-05T03:27:03
---

# Voice Page: High-Density Command Center

## Document Structure

**Part 1 — The Command Center Vision** ← new, covers the full Voice Page redesign  
**Part 2 — Notification & Messaging UX** ← original spec, now the messaging subsystem of Part 1

**Submitted:** 2026-04-05T03:27:03  
**Updated:** 2026-04-05T03:27:03  
**Author:** ux-lead  
**Surface:** Mobile app — Voice Page (primary) + notification subsystem

---

# Part 1 — The Command Center Vision

## The Brief

The Voice Page becomes the one place where the CEO can see everything happening in the system and act on anything — primarily through voice — without switching tabs. High information density. Low cognitive overhead. Maximum action speed.

The other tabs (Inbox, Proposals, Requests, etc.) still exist for deep work. The Voice Page is the **rapid-response surface** — the control room CEO checks when they pick up their phone, and the place they stay when they need to move fast.

---

## What Information Does the CEO Actually Need at a Glance?

Ranked by frequency of need and urgency:

| Rank | Information | Why |
|------|-------------|-----|
| 1 | **Blocked agents / waiting-for-input** | Work has stopped. CEO is the bottleneck. Every minute costs real time. |
| 2 | **Escalations** | Something is broken or at risk. Needs immediate attention. |
| 3 | **Pending proposals** | Agents want approval to start work. Queue builds up fast. |
| 4 | **Agent status** — who's working, who's idle | Situational awareness. Is the system active or stalled? |
| 5 | **Recent Q&A answers** | Information CEO asked for has arrived. |
| 6 | **Done completions** | Confirmation that things are moving. Low urgency but reassuring. |
| 7 | **Open high-priority issues** | Problems that haven't been assigned yet. |
| 8 | **Active backlog** | What's in flight. Reference, not action. |

Items 1–3 require CEO action. Items 4–8 are situational awareness — good to see, don't need to touch.

**Design implication:** The page is split into two vertical halves. Top half = action items (must respond). Bottom half = context (good to know). The voice control lives at the very bottom — always accessible from either zone.

---

## The Layout: Three Layers

```
┌────────────────────────────────────────────────────────────┐
│  ⬡ Mission Control              ⚙           ●●●● 6 agents  │
│  last update: just now                          active: 4  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [ ACT NOW — 2 ]                                           │  ← LAYER 1
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ● command  [BLOCKED]                          8m ago  │  │
│  │   Need approval on auth migration, option A or B?    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ● voice-bridge  [ESCALATE]                   12m ago  │  │
│  │   Transcription service down — fallback active        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [ DECIDE — 1 ]                                            │  ← LAYER 2
│  ┌──────────────────────────────────────────────────────┐  │
│  │  productivitesse → auth middleware refactor           │  │
│  │  [✓ Approve]  [✗ Reject]  [🎤 Voice response]        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [ CONTEXT ]                                ▾ collapse    │  ← LAYER 3
│  ● command          working — auth schema…                 │
│  ● knowledge-base   done — answered Q: relay latency       │
│  ● productivitesse  working — mobile 3D view               │
│  + 2 more  →                                               │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  ──────────────── ▬▬▬ ────────────────                    │  ← drag handle
│  Speaking to: command ▾                                    │  ← voice target
│                                                            │
│  ╭──────────────────────────────────────────────────────╮  │
│  │              🎙  Tap to speak                        │  │  ← VOICE AREA
│  ╰──────────────────────────────────────────────────────╯  │
│  [ 👁 Passive ]                   [ 📋 Recent ]            │
└────────────────────────────────────────────────────────────┘
[ Voice ] [ Dashboard ] [ Agents ] [ Inbox ] [ Requests ]
```

### Layer 1 — Act Now (red tint)

Messages requiring immediate CEO response. Blocked agents and escalations. Sorted: escalate first, then waiting-for-input. Within each type: oldest first (they've been waiting longest).

These cards do not collapse or hide. They are always visible when present. CEO cannot scroll past them to "ignore" — they must be explicitly acknowledged or replied to.

### Layer 2 — Decide (gold tint)

Pending proposals. Compact version: title + proposedBy + three buttons. No body text visible until tapped. Three actions available directly on the card:
- **✓ Approve** — one tap, no confirm
- **✗ Reject** — one tap (triggers compact reject reason input inline, identical to the desktop ProposalsPanel two-tap pattern)
- **🎤 Voice response** — records voice reply and approves (existing "Do this" pattern from ProposalsPanel, brought to mobile)

When more than 3 proposals exist: show 3, "+N more in Proposals →" link.

### Layer 3 — Context (neutral, collapsible)

One-line status per agent. Color dot + name + current state + task preview (truncated). Not actionable — no buttons. Tap an agent row → opens agent detail bottom sheet (same pattern as the mobile 3D view proposal).

Collapse button folds this section to a single summary line ("6 agents: 4 working, 2 idle") to reclaim vertical space when CEO only needs action items.

---

## Voice as the Primary Interaction Method for ALL Actions

The existing VoicePage handles one use case: speak → transcribe → send to selected agent. The command center expands this into a **context-aware voice system** where the voice area understands what's currently on screen.

### The Context Stack

The voice area has a **target state** that changes based on what CEO is looking at:

| Situation | Voice target shows | Tap to speak does |
|-----------|--------------------|-------------------|
| Default (nothing focused) | "Speaking to: command ▾" | Sends to command |
| CEO tapped an Act Now card | "Speaking to: [agent] ▾" | Replies to that agent |
| CEO tapped a Proposal card | "Speaking to: [proposedBy] ▾ · about [proposal]" | Voice-approves that proposal |
| CEO tapped an agent in Context strip | "Speaking to: [agent] ▾" | Sends to that agent |
| CEO taps target label ▾ | Dropdown: all active agents | Changes routing |

Tapping any card in Layer 1 or 2 **focuses** it — subtle highlight (2px border in type color) and the voice target updates. One more tap on the record button speaks directly to that context. **Tap card → speak → send** is the entire flow.

### Passive Mode — Hands-Free

The existing `startPassive()` in `VoicePage.tsx` already implements hands-free voice activation via RMS threshold detection. On the command center, the passive mode toggle activates this system-wide:

When passive mode is on:
1. Mic is open, listening continuously (low battery cost — analyser only, no recording)
2. On speech detected above threshold: auto-starts recording
3. On silence detected (1.5s): auto-sends

The `[ 👁 Passive ]` button in the voice area toggles this. When active: a subtle ambient indicator (pulsing dot) shows the mic is listening. No visual noise — just enough to confirm it's live.

CEO can talk to the system entirely without touching the screen. In passive mode, the voice target is "command" unless they've tapped a specific context.

### Voice Command Recognition

For common actions, the voice system attempts lightweight client-side intent detection on the transcript **before** sending. This is not full NLP — it's pattern matching on a small vocabulary:

| Spoken | Detected pattern | Action |
|--------|-----------------|--------|
| "Approve" / "approve it" / "yes, do it" | `/^(approve|yes|go ahead|do it)/i` | Approves focused proposal |
| "Reject" / "no, don't" | `/^(reject|no|don't|cancel)/i` | Rejects focused proposal |
| "Got it" / "acknowledged" / "ok" | `/^(got it|ack|ok|noted|understood)/i` | Acknowledges focused message |
| "Tell [agent]..." | `/^tell (\w+)/i` | Routes to named agent |
| Anything else | — | Sends as message to current target |

**When an intent is detected:** The preview step shows the transcript PLUS a suggestion:

```
╭──────────────────────────────────────────────────────╮
│  You said: "approve it"                              │
│                                                      │
│  → Detected: APPROVE proposal from productivitesse  │
│                                                      │
│  [✓ Confirm]      [Send as message instead]          │
╰──────────────────────────────────────────────────────╯
```

CEO sees the detected intent and either confirms or overrides. This prevents misfires ("approve" when CEO meant to say "I'll approve the time for this later"). The confirm step is one tap.

**Why client-side matching, not Claude?** Round-trip to Claude adds 1–3s of latency. For a "consume fast, act fast" interface, sub-second feedback on a "tap stop → see transcript" flow is critical. The pattern matching is deterministic and fast. For ambiguous commands, CEO uses the text.

---

## How to Show High Information Density Without Cognitive Overload

Information density and cognitive load are not the same thing. A page can show many items and remain easy to parse if it respects three rules:

### Rule 1: Visual urgency hierarchy is pre-attentive

The page uses **color zones** that the brain reads before the eyes focus:
- **Red band** at top of Act Now section: peripheral vision detects it before reading begins
- **Gold band** at top of Decide section: different hue, same signal
- **No color** in Context: neutral = no action required

CEO glances at the screen. If there's red, they know immediately: something is broken or waiting. No reading required. This is the fire alarm principle — the alarm does not need to be read.

### Rule 2: Only the primary action is visible by default

Each card shows exactly one affordance in compact state:
- Act Now cards: one "Reply" affordance (swipe-right gesture)  
- Decide cards: three buttons (approve/reject/voice)
- Context rows: no affordance (tap for detail)

There is no visual clutter from secondary actions. Secondary actions (reject reason, full message body, worklog path) appear only after deliberate expansion.

### Rule 3: Collapsibility respects the CEO's current focus

When CEO is responding to a blocked agent, they don't need to see 8 rows of context strip. The collapse button lets CEO reduce visible information to only what they're working with right now.

The **collapsed Context strip** shows one summary line:
```
6 agents: 4 working · 2 idle · last update 2m ago         ▸
```

Expands on tap. State persists in localStorage (if CEO collapsed it last session, it opens collapsed).

---

## "Acting Fast" — Gesture Counts for Common Scenarios

The measure of speed is gestures-to-completion, not time (which depends on network). Each scenario below counts deliberate finger movements.

### Most common: "agent is blocked, CEO decides"
1. See red card in Act Now zone
2. Tap card (sets voice context to that agent)
3. Tap mic (starts recording)
4. Speak decision
5. Tap stop
6. Tap Confirm
**= 4 taps + speaking.** Card gone. Agent unblocked.

### Fast path with passive mode on:
1. See red card in Act Now zone
2. Tap card (sets context)
3. Speak (passive mode auto-triggers)
4. Silence → auto-sends (no stop tap, no confirm in passive mode — see below)
**= 1 tap + speaking.** This is the fastest possible path.

*Note: In passive mode, the confirm step is skipped (too many pauses in natural speech would cause false confirms). Passive mode is for CEO who knows what they're doing and accepts that "approve it" will fire immediately.*

### Second most common: "approve a proposal"
1. See gold card in Decide zone
2. Read title (is it the one they want?)
3. Tap ✓ Approve directly on the card
**= 1 tap.** Done. No navigation.

### Responding to an update (Zone 2):
1. See message in Context (if promoted) or notification bar
2. Tap → expand
3. Swipe-right or tap voice reply
4. Speak
5. Tap stop
6. Confirm
**= 4 taps + speaking.**

### Scanning the system state:
1. Open Voice Page (app was backgrounded)
2. Read the three sections: Are there red cards? Gold cards? How many agents active?
**= 0 taps.** All visible on open.

---

## The Voice Area in Detail

The bottom section of the page is fixed — it doesn't scroll away. This ensures CEO always has voice access regardless of how much content is above.

```
┌────────────────────────────────────────────────────────────┐
│  ▬▬▬▬▬▬  (drag handle — this section is fixed-height)     │
│                                                            │
│  Speaking to: command ▾         [Mode: Push-to-Talk ▾]    │
│                                                            │
│  ╭──────────────────────────────────────────────────────╮  │
│  │                                                      │  │
│  │              🎙  Tap to speak                        │  │  (idle)
│  │                                                      │  │
│  ╰──────────────────────────────────────────────────────╯  │
│                                                            │
│  [ 👁 Passive mode: off ]             [ 📋 last: 8m ago ]  │
└────────────────────────────────────────────────────────────┘
```

**While recording:**
```
│  Speaking to: command                                      │
│                                                            │
│  ╭──────────────────────────────────────────────────────╮  │
│  │  ● ● ●  Recording…                           0:04    │  │
│  │  [tap anywhere to stop]                               │  │
│  ╰──────────────────────────────────────────────────────╯  │
│                                                            │
│  [✕ Cancel]                                               │
```

**After stop — preview:**
```
│  → command                                                 │
│                                                            │
│  ╭──────────────────────────────────────────────────────╮  │
│  │  "Go with option B for the auth migration."           │  │
│  │                                                       │  │
│  │  → Detected: plain message (no command)               │  │  (or shows detected intent)
│  ╰──────────────────────────────────────────────────────╯  │
│                                                            │
│  [⟳ Re-record]                             [↑ Send →]     │
```

**Mode selector (tap "Push-to-Talk ▾"):**
Three modes in a compact picker:
- **Push-to-Talk** (default) — tap to start, tap to stop
- **Hold-to-Talk** — press and hold the mic button (useful when CEO wants short burst replies without going through preview)
- **Passive** — always-on voice activation

Hold-to-Talk skips the preview step for speed — it's the "I know what I'm saying" mode. In Hold-to-Talk, the transcript is sent immediately on release. The only undo is a "Sent ✓ — Undo" snackbar that appears for 4 seconds.

**[ 📋 last ]** button: shows the last 3 sent messages in a quick popover. CEO can confirm a message went out without navigating to Inbox.

---

## Relationship to the Other Tabs

The Voice Page is **not a replacement** for the detail tabs. It's the rapid-response layer.

| Tab | Still needed for |
|-----|-----------------|
| Inbox | Full message history, sorting, reading long messages |
| Proposals | Reviewing proposal bodies before approving, seeing resolved history |
| Requests | Tracking CEO-initiated tasks, filtering by status |
| Agents 3D | Spatial view of system, sub-agent visibility, EventLog |
| Backlog | Full backlog management, adding/reordering items |

What the Voice Page removes the need for:
- Navigating to Inbox just to see if anything needs action
- Navigating to Proposals just to approve
- Opening the 3D view just to check if agents are working

The principle: **status information no longer requires navigation.** Action information comes to the CEO. Navigation is only for depth.

---

## System-Lead Coordination Notes

*(Spec written 2026-04-05 — awaiting system-lead response on audit findings)*

**Assumption 1:** `agent.currentTask` is reliably populated for active/working agents. If it's frequently null, the Context strip shows "working" without task detail — still useful as a status indicator.

**Assumption 2:** Blocked/waiting-for-input messages are reliably tagged with the correct `type` field. The `needsInput()` function in `messageTypes.ts` is the routing logic. If agents are sending blocked states as generic `message` type, Act Now cards will not surface them. Agent discipline on type tagging is a prerequisite.

**Assumption 3:** Voice-bridge transcription completes in under 3s for typical CEO messages (10–30 words). If latency is higher, the preview step should show a "Transcribing…" spinner to prevent CEO thinking the tap didn't register.

**Open question for system-lead:** Are there information categories flowing through the system (from their audit) that the current store doesn't expose? If yes, those categories may need new store slices to appear on the Voice Page.

---

# Part 2 — Notification & Messaging UX (Original Spec)

*The notification system described below is the messaging subsystem of the command center above. The Attention Bar and Message Tray are used when CEO is in other tabs — the Voice Page's Act Now zone serves the same purpose when CEO is on the Voice Page.*

---

## The Problem With What Exists Today

Command describes the current system as "full-height Z-axis notification cards that slide in." This pattern has three fundamental problems:

**1. Full-height cards are intrusive by definition.**  
They consume the entire screen to deliver what is often a one-sentence update. An agent saying "Done — 3 files written" does not deserve the same visual weight as a full-page takeover. The interruption cost is disproportionate to the information value.

**2. Long-press to switch target is a broken interaction.**  
Long-press is a hold gesture. When the finger lifts, the card dismisses. These two actions — hold to trigger, release to confirm — directly conflict. CEO tries to switch agents and accidentally clears the card. This is a finger-trap, not a feature.

**3. Inline response is an afterthought.**  
When a blocked agent needs a decision and CEO wants to say "go with option A" — that should take four seconds: swipe, speak, done. Instead it requires navigating, finding the right reply surface, typing or recording, and sending. By the time that's complete, the mental context is gone.

---

## Design Principles for the Redesign

**Principle 1: The CEO decides when to engage, not the message.**  
Messages do not demand full-screen attention. They signal their presence and wait. CEO opens when ready.

**Principle 2: Voice is the primary reply medium.**  
Typing on mobile is slow and error-prone. Every message card makes voice reply the easiest path — one gesture away, not buried in a compose screen.

**Principle 3: Urgency is visible without reading.**  
A glance at the screen should tell the CEO whether anything needs action. Color and position carry this, not just text.

**Principle 4: One gesture per intention.**  
Swipe right = reply. Swipe left = dismiss. Tap = expand. No long-press anywhere. Gestures are unambiguous and non-conflicting.

---

## The Interaction Model: Attention Bar + Message Tray

The redesign replaces full-height takeover cards with a **two-layer system**:

### Layer 1: The Attention Bar (persistent, non-intrusive)

A compact strip that anchors above the tab bar whenever messages are waiting. Never taller than 52px. Never modal. Never blocks anything.

```
╔═════════════════════════════════════════════════════════╗
║  ● command  ● productivitesse  +1          3 · 1 urgent ║
║  ▬▬▬  (swipe up to open)                               ║
╚═════════════════════════════════════════════════════════╝
[ Voice ]  [ Dashboard ]  [ Agents ]  [ Inbox ]  [ Requests ]
```

- **Left side:** Colored dots for each sending agent, name truncated. Max 3 shown, then "+N more."
- **Right side:** Total count + urgency count. If any Zone 1 messages (escalate/blocked), count is shown in gold on a dark gold background. If Zone 2 only, count shown in grey.
- **Color of the bar itself:** Tinted by urgency. Escalate → faint red wash. Waiting-for-input → faint gold wash. Zone 2 only → no tint, neutral grey.
- **Swipe up** anywhere on the bar → opens the Message Tray.
- **Tap** the bar → same as swipe up.
- When no messages: bar is hidden. No empty space.

The bar has a drag handle pill (same as existing `mobile__drag-pill` in `mobile.css`). This makes the "swipe up" affordance immediately legible — it's the same visual language as iOS bottom sheets.

### Layer 2: The Message Tray (on-demand, bottom sheet)

A bottom sheet containing all pending messages, organized by urgency. Opens on swipe-up from the Attention Bar.

**Height:** 72% of viewport (leaves 28% of the scene visible — CEO retains spatial context).  
**Corners:** 16px top border-radius. iOS sheet language.  
**Background:** `rgba(8, 10, 22, 0.97)` with `backdropFilter: blur(20px)` — matches the notification card aesthetic from the current desktop system but anchored to the bottom.  
**Drag handle:** Always visible at top of sheet. Drag down to collapse.  
**Dismiss:** Drag down past 40% of sheet height, or tap the dimmed backdrop above.

---

## Information Hierarchy: The Message Card

Each agent message is one card inside the tray. Default height: 72px. Expanded height: variable.

### Compact State (default)

```
┌────────────────────────────────────────────────────────┐
│ ●  command                                      2m ago │
│    [BLOCKED] Can't proceed — need approval on the      │
│    auth migration, option A or B?              [Reply] │
└────────────────────────────────────────────────────────┘
```

**Row 1 (top):** Agent color dot (8px) + agent name (13px bold, agent color) + timestamp (10px dim, right-aligned).  
**Row 2:** Type badge (`[BLOCKED]`, `[DONE]`, `[ESCALATE]` etc. in type color, 9px) + message preview (12px, two lines max, truncated with ellipsis).  
**Row 3 (Zone 1 only):** `[Reply]` button, right-aligned. Not shown for Zone 2 (updates) — those are read-only unless CEO expands.

Zone 1 cards have a **4px left border** in the type color (gold for waiting-for-input, red for escalate). Zone 2 cards have no border, 70% opacity text, and no Reply button by default.

### Swipe Gesture Affordances

**Swipe right (→ to reply):**  
As finger moves right, a green reply affordance slides in from the left edge:
```
 ▸ Reply                  [card content shifts right]
```
At ~60px swipe distance: card locks open in "reply mode" (see Voice Reply State below).  
Release before 60px: snaps back to center.

**Swipe left (← to dismiss):**  
As finger moves left, a red dismiss affordance slides in from the right edge:
```
                  [card content shifts left]  ✕ Dismiss
```
At ~70px swipe distance: card locks. For Zone 2: instantly dismissed. For Zone 1: brief haptic pulse + the dismiss affordance label changes to "Needs attention — dismiss?" with a confirm tap required. CEO sees the nudge, taps confirm if they mean it.  
Release before 70px: snaps back.

This is the **WhatsApp reply gesture** + **iOS Mail dismiss gesture** — two of the most practiced swipe interactions in mobile. No learning required.

### Expanded State

Tap anywhere on a card → expands to show full message body:

```
┌────────────────────────────────────────────────────────┐
│ ●  command                                      2m ago │
│ ──────────────────────────────────────────────────────│
│ [BLOCKED]                                              │
│                                                        │
│ I've completed the database schema update but can't    │
│ proceed without a decision on authentication.          │
│                                                        │
│ Option A: Keep the existing session token structure    │
│   (faster, but doesn't meet the new compliance req)    │
│                                                        │
│ Option B: Migrate to short-lived JWTs                  │
│   (2-3h more work, but fully compliant)                │
│                                                        │
│                    [↩ Voice Reply]  [✎ Type Reply]    │
└────────────────────────────────────────────────────────┘
```

Expanded cards show the full message body (markdown rendered, same as desktop InboxPanel). Two explicit reply buttons appear: **Voice Reply** (primary, left) and **Type Reply** (secondary, right).

Tap the card again → collapses back to compact state.

### Voice Reply State

Triggered by: swipe-right gesture, or tapping "↩ Voice Reply" in expanded view.

The card transforms in-place — it doesn't navigate away, doesn't open a new screen:

```
┌────────────────────────────────────────────────────────┐
│ ●  command  →  replying                         2m ago │
│ ──────────────────────────────────────────────────────│
│ "…need approval on the auth migration, option A or B?" │
│                                                        │
│   ╭────────────────────────────────────────────╮       │
│   │  ● ● ●  Recording...           0:03        │       │
│   ╰────────────────────────────────────────────╯       │
│                                                        │
│   [✕ Cancel]                                           │
└────────────────────────────────────────────────────────┘
```

Key design choices:
- The **original message body is quoted above the recorder** (last 120 chars). CEO never loses context of what they're responding to. This is the iMessage/WhatsApp reply-quote pattern.
- The recording pill shows an animated waveform (three pulsing dots minimum, or live amplitude visualization if available from the existing `AudioContext` code in VoicePage).
- Recording is **tap-to-stop**, not hold-to-record. CEO can speak for as long as needed without holding a button.
- **Cancel** at bottom — one tap, no confirm. Goes back to compact state, recording discarded.

### Voice Reply Preview State

After CEO taps "stop" (or recording detects silence threshold):

```
┌────────────────────────────────────────────────────────┐
│ ●  command  →  review before sending            2m ago │
│ ──────────────────────────────────────────────────────│
│ You said:                                              │
│ "Go with option B, the JWT migration. I'll approve     │
│  the extra time, just keep me posted on progress."     │
│                                                        │
│   [⟳ Re-record]                          [↑ Send →]   │
└────────────────────────────────────────────────────────┘
```

Transcript shown in full. Two actions:
- **Re-record**: clears transcript, returns to recording state
- **Send →**: sends the message (appends `[RE: original preview]\n\n${transcript}` for agent context), card fades and dismisses from the tray

Send sends immediately — no second confirm. The transcript preview IS the confirm. CEO read it; that's enough.

If transcription fails (voice-bridge unreachable):
```
│   ✗ Transcription failed — relay may be down           │
│   [⟳ Retry]    [✎ Type instead]         [✕ Cancel]    │
```

Three graceful paths. No dead end.

---

## Tray Layout: Zone Organization

Inside the open tray, messages are arranged in two sections:

```
┌────────────────────────────────────────────────────────┐
│  ▬▬▬                                                   │  ← drag handle
├────────────────────────────────────────────────────────┤
│  NEEDS YOUR INPUT  [2]                                 │  ← zone 1 header (gold)
├────────────────────────────────────────────────────────┤
│  [command card — BLOCKED]                              │
│  [voice-bridge card — ESCALATE]                        │
├────────────────────────────────────────────────────────┤
│  UPDATES  [3]  ▾                                       │  ← zone 2 header (grey, collapsible)
├────────────────────────────────────────────────────────┤
│  [productivitesse card — DONE]                         │
│  [knowledge-base card — STATUS]                        │
│  [agency-biz card — DONE]                              │
└────────────────────────────────────────────────────────┘
```

Zone 1 is always visible and always above Zone 2. Zone 2 is collapsible (tap header to collapse/expand). If Zone 1 is empty, the "Updates" zone still shows but without the section header distinction — just a plain list.

Within each zone, **sort order is by urgency then recency**:
- Escalate first (red)
- Waiting-for-input / blocked second (gold)
- Within each type: newest first

This ensures the most urgent item is always the first card CEO sees after opening the tray.

---

## Scenario Walkthroughs

### Scenario 1: Three Agents Message at Once

**What CEO sees:**
1. Attention bar appears above tab bar. Glow: gold (one is waiting-for-input). Text: "● command  ● productivitesse  ● knowledge-base — 3 · 1 needs input"
2. CEO is mid-conversation elsewhere. Ignores it for 2 minutes.
3. CEO swipes up on the attention bar.
4. Tray slides up. command is at the top (BLOCKED). productivitesse and knowledge-base are in Updates below.
5. CEO taps command card to read full message.
6. Swipes right on command card → voice reply opens.
7. Speaks: "Go with option B." Taps stop.
8. Reads transcript, taps Send.
9. command card fades and disappears. Tray now shows only Updates zone with 2 items.
10. CEO glances at Updates, swipes left on both (zone 2 = instant dismiss, no confirm).
11. Tray is empty. CEO swipes down. Attention bar disappears.

**Total taps/gestures:** 1 swipe up, 1 tap (expand), 1 swipe right, 1 tap (stop), 1 tap (send), 2 swipe lefts, 1 swipe down. **8 gestures to process 3 agent messages.** All voice, no typing.

---

### Scenario 2: I Want to Respond to Agent B, Not Agent A

**Setup:** command (Zone 1 — BLOCKED) and productivitesse (Zone 2 — DONE, but CEO has a follow-up question).

**What CEO does:**
1. Opens tray. command is at top.
2. Scrolls past command to productivitesse in Updates.
3. Swipes right on productivitesse → voice reply.
4. Speaks: "Good work — can you also check the mobile layout?"
5. Send.
6. productivitesse card dismisses. command card remains at top, untouched.
7. CEO can address command now, or swipe down to close — command stays pending.

**Key:** command is never dismissed, never lost. It stays at the top of Zone 1 until CEO explicitly replies or dismisses it. Productivitesse was simply scrolled past and replied to independently. No "target switching" required — all agents are visible simultaneously.

---

### Scenario 3: I Want to Ignore This Message

**Setup:** Three Zone 2 done messages accumulated overnight.

**What CEO does:**
1. Opens tray. Zone 1 is empty. Zone 2 has 3 items.
2. Reads the zone 2 header: "UPDATES [3]". 
3. Taps the zone 2 header → collapses all 3 at once into a single collapsed row.
4. Swipes down to close tray.
5. Attention bar now shows "3 · 0 urgent" in neutral grey (no gold/red).
6. CEO finishes what they're doing. Returns later.
7. Taps attention bar, opens tray, swipes left on each done message individually (instant dismiss, no confirm for Zone 2).

**Or faster:** Long-press on the Zone 2 section header → "Dismiss all updates" option appears. One tap clears all Zone 2. Zone 1 items are never bulk-dismissed.

---

### Scenario 4: Escalation Arrives While CEO Is Reading Something Else

**Setup:** CEO has the tray open reading a done message. An escalate message arrives mid-reading.

**What happens:**
1. A haptic pulse fires on the device (iOS: `Haptics.impact({ style: ImpactStyle.Heavy })`).
2. The tray automatically scrolls to the top and a new card slides in above the existing Zone 1 items, with a brief red flash on the card border.
3. CEO sees the escalation card immediately without having to scroll.

**Why not a second modal or push notification?** CEO is already in the tray. A modal on top of a sheet would be two layers of interruption. The in-place animation is sufficient — and the haptic ensures they notice without requiring visual attention.

---

### Scenario 5: Single Message, Simple Acknowledgment

**Setup:** productivitesse sends a done message ("Completed the auth task").

**What CEO does:**
1. Attention bar appears. Neutral grey. "● productivitesse — 1 update."
2. CEO glances. Not urgent. Swipes up on bar.
3. Tray opens. One card. Compact view reads: "Done — Completed the auth task."
4. Swipe left. Gone. Bar disappears.

**Two gestures total.** This is the "quick scan" path for routine updates.

---

## Borrowed Patterns and Why They Work Here

| Pattern | Source | Why it applies |
|---------|--------|---------------|
| Swipe right to reply with quote context | WhatsApp | Most practiced reply gesture on mobile; reveals context above reply box |
| Bottom sheet with drag handle | iOS native sheets | Users understand sheet = temporary, drag down = close. Zero learning curve. |
| Pull-down notification center | iOS notification center | "Pull when ready" respects CEO's attention. Non-modal. |
| Section collapse (tap header) | Slack channel sections | Lets CEO hide entire categories of information without losing them |
| Transcript preview before send | iOS Siri, Voice Memos | Voice is lossy — CEO needs to confirm before committing |
| Waveform animation during recording | Voice Memos, Telegram voice | Visual feedback that mic is actually capturing; reduces "did it hear me?" anxiety |
| Colored agent indicators | Telegram | Each contact has a color; builds spatial memory — "gold dot = command, blue dot = productivitesse" |
| Haptic on escalation | iOS Messages urgent notification | Physical signal for eyes-busy situations (CEO driving, walking) |

---

## States: Complete State Machine

```
                     ┌──────────────────┐
                     │   NO MESSAGES    │
                     │  (attention bar  │
                     │    hidden)       │
                     └────────┬─────────┘
                              │ message arrives
                              ▼
                     ┌──────────────────┐
                     │  ATTENTION BAR   │◄──── new messages arrive (bar updates)
                     │   visible        │
                     └────────┬─────────┘
                              │ swipe up / tap bar
                              ▼
                     ┌──────────────────┐
                     │   TRAY OPEN      │◄──── new messages arrive (tray updates in-place)
                     │  (all messages)  │
                     └──┬──────────┬────┘
              tap card  │          │ swipe down / tap backdrop
                        ▼          └───────────────────────────────────►
                 ┌──────────────────┐                            ATTENTION BAR
                 │  CARD EXPANDED   │
                 └──┬───────────────┘
      swipe right / │ "Voice Reply"  │ swipe left /
      tap button    │                │ "Dismiss"
                    ▼                ▼
           ┌─────────────┐    ┌──────────────┐
           │  RECORDING  │    │  DISMISSED   │─► removed from tray
           └──────┬──────┘    └──────────────┘
                  │ tap stop
                  ▼
           ┌──────────────┐
           │   PREVIEW    │
           └──┬───────────┘
   "Send →"   │         │ "Re-record"
              ▼         └──────────────► RECORDING
           ┌──────────────┐
           │    SENT      │─► card fades, removed from tray
           └──────────────┘
```

One exit from every state. No dead ends. No state where CEO is stuck.

---

## Information That Never Appears on a Card

Mobile cards show: agent name, type badge, message preview (2 lines), timestamp.  
Mobile cards do NOT show: raw relay IDs (`plugin:relay-channel:relay-channel`), internal routing metadata, full markdown tables, code blocks.

The `agentDisplayName()` function already strips internal names. Markdown in preview is stripped to plain text — full markdown renders only in the expanded state. This keeps compact cards readable at a glance.

---

## What Changes vs What Stays

| Current | New |
|---------|-----|
| Full-height modal card takeover | Compact attention bar + tray |
| Long-press to switch target | Scroll to target in tray |
| Swipe/X to dismiss (ambiguous on press-and-hold) | Swipe-left (explicit, 70px threshold) |
| No inline voice reply | Swipe-right opens voice recording in-place |
| No transcript preview | Transcript shows before send |
| No urgency differentiation on arrival | Bar color + haptic signal urgency |
| No batch dismiss | Zone 2 header long-press → "Dismiss all updates" |

Components that build on existing code:
- `sendMessage()` from `actions.ts` — unchanged, voice reply calls this
- `getRecorder()` from `recorder.ts` — unchanged, recording logic reused
- Voice-bridge `/transcribe` — unchanged
- `needsInput()` from `messageTypes.ts` — determines Zone 1 vs Zone 2
- `agentDisplayName()` — used for card headers

New components to build:
- `AttentionBar` — the persistent strip
- `MessageTray` — the bottom sheet container
- `MessageCard` — card with swipe gesture handlers, compact/expanded/recording/preview states
- `VoiceReplyInline` — the recording + preview UI that appears inside a card

---

## What This Feels Like

CEO pulls out their phone. There's a gold-tinted strip above the tab bar with two colored dots and "2 · 1 needs input." One swipe up. The tray opens. command is at the top — blocked on something. One swipe right. The card expands. A quote shows what command needs. CEO speaks. Taps stop. Reads back their own words. Taps Send. Card gone.

Total time: 15 seconds. No navigation. No typing. No modals fighting each other. No long-press traps.

That is the target feeling.
