---
title: Emoji Taxonomy for Visual Scanning
date: 2026-04-03
status: proposed
---

# Proposal: Emoji Taxonomy for Visual Scanning

**Date:** 2026-04-03
**Status:** Pending CEO approval
**Proposed by:** designer (design consultant)

---

## Problem

Proposals, messages, and reports in the dashboard currently rely on text badges (`DONE`, `PENDING`, `HIGH`) and color coding for visual differentiation. At a glance -- especially on mobile at 390px -- the CEO must read small uppercase text to categorize items. A consistent emoji system would allow instant pattern recognition before reading any text.

---

## Recommendation: Two-Axis System (Type + Topic)

Use a **primary axis** (content type) that is always present, plus an **optional secondary axis** (topic) that can be added when useful. Do not map emojis to teams/projects -- team names change frequently, and agents already have color dots.

### Why not team-based?

- Teams/projects are fluid -- new ones appear weekly, old ones merge or die.
- Maintaining a team-emoji registry creates overhead with no scanning benefit (you still need to read the name to know which team).
- Agent color dots already serve this role in the 3D view and agent chips.

### Why type + topic?

- **Type** is stable: the set of content types (proposal, done, question, issue, report) changes rarely and maps 1:1 to dashboard views.
- **Topic** is useful but optional: a security proposal and a UI proposal feel different, but both are proposals. Adding topic emoji gives a second scanning dimension when relevant, without requiring it.

---

## Emoji Map

### Primary: Content Type (always shown)

| Type | Emoji | Rationale |
|---|---|---|
| Proposal (pending) | `📋` | Clipboard = "needs review" |
| Proposal (approved) | `✅` | Universal "done/accepted" |
| Proposal (rejected) | `❌` | Universal "no" |
| Done message | `✅` | Completion signal |
| Waiting-for-input | `⏳` | Blocked, time passing |
| Escalate | `🔺` | Alert triangle -- urgent |
| Message (general) | `💬` | Chat bubble |
| Status update | `📡` | Broadcast/telemetry |
| Report (worklog) | `📄` | Document |
| Question (open) | `❓` | Needs answer |
| Question (answered) | `💡` | Resolved insight |
| Issue (high priority) | `🚨` | Alarm -- demands attention |
| Issue (normal) | `📌` | Pinned, tracked |
| Voice message | `🎙️` | Mic -- matches existing voice UI |
| Backlog item | `📥` | Inbox/queued |

### Secondary: Topic Tags (optional, agent-assigned)

| Topic | Emoji | When to use |
|---|---|---|
| Security | `🔒` | Auth, permissions, encryption, vulnerabilities |
| UI/Design | `🎨` | Layout, styling, components, UX |
| Infrastructure | `🏗️` | Servers, deployment, relay, CI/CD |
| Performance | `⚡` | Speed, optimization, caching |
| Data/Research | `🔬` | Analysis, findings, market research |
| Testing | `🧪` | Tests, QA, validation |
| Mobile | `📱` | iOS, Capacitor, responsive |
| Voice | `🎙️` | Voice bridge, transcription, audio |
| Finance | `💰` | Costs, budgets, pricing |
| Legal/Compliance | `⚖️` | Regulations, contracts, terms |

---

## Assignment Rules

**Type emoji: auto-assigned by relay/dashboard.**
- The relay already knows the `type` field (`done`, `waiting-for-input`, `escalate`, `message`).
- Proposals have a `status` field (`pending`, `approved`, `rejected`).
- Reports have a `source` field (`worklog`, `done-message`).
- Questions have a `status` field (`open`, `researching`, `answered`).
- No agent input needed. The dashboard maps type/status to emoji deterministically.

**Topic emoji: agent-assigned from the defined list.**
- Agents may include a `topic` field when sending messages or proposals (e.g., `topic: "security"`).
- The relay validates against the allowed list. Unknown topics are silently dropped (no emoji shown, no error).
- Topics are optional. Most routine messages will not need one. Agents should add topics when the content crosses domain boundaries (e.g., an infra agent sending a security-related proposal).

This keeps the system low-friction: type emojis just appear automatically, topic emojis are opt-in.

---

## Placement

**Inline, left of title/sender -- not a large standalone icon.**

Rationale:
- Large icons at the top of cards waste vertical space. On mobile at 390px, every pixel of vertical space is premium.
- The existing badge pattern (`DONE`, `PENDING`, `HIGH`) sits inline in the meta row. Replacing or prefixing with an emoji maintains the scanning line.
- Example rendering in a proposal card meta row:

```
📋 command → productivitesse  PENDING  2:34 PM
   Add emoji taxonomy for visual scanning
```

- Example rendering in inbox message row:

```
⏳💬 Command → ceo  WAITING  3:12 PM
   Need approval on the deploy schedule
```

When both type and topic are present, show type first, then topic, no separator: `🔺🔒` (escalation about security).

---

## Mobile Legibility (390px viewport)

- Emoji render at native OS size, which is legible at 390px without scaling adjustments.
- Placement inline means emojis flow with the existing flex layout -- no special mobile override needed.
- The current badge font size is 8-9px, which is already at the legibility floor. An emoji at that same row height (roughly 14-16px native) will actually be *more* legible than the text badge it supplements.
- Do not remove text badges entirely -- keep them as a fallback for accessibility (screen readers, emoji rendering failures). Show emoji + text badge on desktop; on mobile, show emoji only and hide the text badge to save horizontal space.

---

## Implementation Scope

1. **Relay change**: Accept optional `topic` field on messages and proposals. Validate against allowed list.
2. **Dashboard change**: Add an `emojiForType()` utility that maps type/status to emoji. Call it in the meta row of ProposalCard, InboxPanel rows, MessageFeed rows, ReportsView cards, QuestionsPanel cards. Roughly 5-6 components, one shared utility.
3. **No data migration**: Existing messages/proposals render with type emoji immediately (auto-assigned). Topic emoji only appears on new messages that include it.
4. **Estimated touch points**: ~120 lines of code across 6 files + 1 new utility.

---

## Open Questions for CEO

1. Should the topic list be extensible by agents (they propose new topics, CEO approves), or is the fixed list above sufficient?
2. Preference on emoji style: native OS emoji (renders differently on macOS vs iOS vs Windows) or a fixed emoji font/sprite set for consistency?
3. Should notifications (NotificationStack toast cards) also get emoji, or keep those text-only to avoid visual noise in the overlay?
