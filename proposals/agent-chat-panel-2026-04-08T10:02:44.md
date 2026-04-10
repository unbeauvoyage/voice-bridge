---
title: "Agent Chat Panel: Per-Agent Chat History in Right Panel"
proposedBy: prism
agent: productivitesse
status: pending
ts: 2026-04-08T10:02:44
updated: 2026-04-08T10:02:44
summary: "Replace the AgentDetailPanel (last 3 messages) with a full chat interface when the CEO clicks a planet. CEO messages right-aligned in gold, agent messages left-aligned with type color accents. Compose bar locked to selected agent. Limited message window to start, infinite scroll later."
---

# Agent Chat Panel: Per-Agent Chat History in Right Panel

**Submitted:** 2026-04-08T10:02:44  
**Author:** prism (ux-expert)  
**Surface:** Desktop dashboard — `HoloPanelRight` (agent selected state)  
**Scope:** New component + chat bubble component + minor store/actions wiring

---

## What Changes

When the CEO clicks a planet, `HoloPanelRight` currently shows `AgentDetailPanel` — agent name, status, last 3 messages, "Open in feed" link. This gets replaced with a full chat interface: all messages between CEO and that agent, newest at bottom, compose bar locked to that agent.

The 3D scene, planet selection, camera lerp, and everything else stays the same. Only the right panel content changes.

---

## Chat Interface Design

### Layout

```
┌─────────────────────────────────┐
│  ● matrix                  ✕   │  ← header: agent name + status + close
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐   │  ← agent message (left)
│  │ [done] relay refactor   │   │
│  │ complete. WS reconnect  │   │
│  │ confirmed.              │   │
│  └─────────────────────────┘   │
│                        09:41   │
│                                 │
│          ┌─────────────────┐   │  ← CEO message (right)
│          │ good — can you  │   │
│          │ check the spawn │   │
│          │ script too?     │   │
│          └─────────────────┘   │
│                        09:43   │
│                                 │
├─────────────────────────────────┤
│  [message ▾]  Reply...    ↑   │  ← compose bar, locked to agent
└─────────────────────────────────┘
```

### Message Bubbles

**CEO messages (right-aligned)**
- Background: `rgba(255, 215, 0, 0.08)` — subtle gold tint
- Border: `1px solid rgba(255, 215, 0, 0.2)` — gold accent
- Text: `#e8e8f0` (standard body)
- Alignment: `margin-left: auto`, `max-width: 75%`
- No type badge — CEO messages are always context/commands

**Agent messages (left-aligned)**
- Background: `rgba(255, 255, 255, 0.04)` — standard card bg
- Left border: `3px solid {MSG_TYPE_COLOR[type]}` — type accent (done=green, waiting=yellow, escalate=red, etc.)
- Type badge: small uppercase label using type color, top-left of bubble
- Text: monospace — terminal aesthetic, consistent with design system
- Alignment: `margin-right: auto`, `max-width: 75%`

**Timestamps**
- Displayed below bubble, muted (`rgba(255,255,255,0.3)`), `10px`, relative format ("09:41", "Mon 14:30")
- Grouped: consecutive messages from same sender suppress repeated timestamps — only show on last in group

**Consecutive grouping**
- Messages from the same sender within 5 minutes: no repeated name, tighter vertical spacing (4px gap vs 16px between sender changes)

### Scrolling
- Overflow-y scroll, newest message at bottom on load
- `scroll-behavior: smooth`
- Auto-scroll to bottom on new incoming message (if already near bottom — within 100px)
- Start: limited window — last 50 messages from store (filtered to `m.from === agentId || m.to === agentId`)
- Optimize later: `GET /history/{agentId}` fetch + infinite scroll upward

### Compose Bar
- Reuse existing `ComposeBar` with `lockedTo={selectedAgentId}` prop (already supported)
- Type selector defaults to `message`, CEO can change
- Send on Enter, Shift+Enter for newline
- Placeholder: `"Reply to {agentDisplayName(agentId)}…"`

---

## Implementation Plan

### New files

**`AgentChatPanel.tsx`** — replaces `AgentDetailPanel` in `HoloPanelRight`
```
- Props: { agentId: string, onClose: () => void }
- State: messages (filtered from store + optional history fetch), scrollRef
- Render: header + scrollable bubble list + ComposeBar
- Effect: filter store.messages on agentId change; scroll to bottom
```

**`ChatBubble.tsx`** — single reusable bubble
```
- Props: { message: AgentMessage, isOwn: boolean, showTimestamp: boolean }
- Renders left or right variant based on isOwn
- Type badge on agent messages only
- Timestamp conditional on showTimestamp prop (grouping logic in parent)
```

### Modified files

**`HoloPanelRight.tsx`** (or equivalent)
- When `selectedAgentId` is non-null: render `<AgentChatPanel agentId={selectedAgentId} onClose={() => store.selectAgent(null)} />` instead of `<AgentDetailPanel />`

**`AgentDetailPanel.tsx`**
- Can be deprecated or retained as a compact widget if needed elsewhere. Not deleted immediately.

### No store changes needed
- Messages already in `store.messages` (last 100 total)
- Filtering by agentId is a view concern, not a store concern
- `sendMessage` action already handles send — ComposeBar uses it directly

---

## Data: Limited Window (v1)

Filter `store.messages` for `m.from === agentId || m.to === agentId`. Store holds last 100 messages across all agents — this may give 10-30 messages per agent in practice, which is sufficient for a limited window.

No history API fetch in v1. When the store rolls over old messages, they are gone from the chat view. This is the known limitation — infinite scroll + history API is the v2 optimization.

**Important:** The relay exposes `GET /history/{agentName}` but it is only confirmed working for `ceo`. Before relying on it for arbitrary agent names, productivitesse should verify the endpoint with a test fetch. If it works, history fetch can be added to v1 at low cost.

---

## Visual Consistency

All styling uses existing design system tokens:
- `MSG_TYPE_COLOR` for type accent borders and badges
- CEO gold `#ffd700` for own-message bubbles
- Standard card bg `rgba(255,255,255,0.025)` for agent bubbles
- Monospace for agent message text, sans for CEO input
- `10px`/`11px`/`12px` type scale from design system
- `8px` border radius on bubbles

No new design tokens introduced.

---

## Tradeoffs

| Option | Pros | Cons |
|--------|------|------|
| **This proposal** — replace AgentDetailPanel with chat | Clean, CEO-familiar pattern, uses existing send path | AgentDetailPanel (info card) goes away from this surface |
| Expand AgentDetailPanel to show more messages | Preserves agent info | Not a chat — still a list, not conversational |
| Modal/overlay chat | Doesn't disrupt 3D view | Adds navigation layer, more complex |

**Recommendation:** Replace AgentDetailPanel. Agent info (status, task) can move into the chat header as a subtitle line — keeps the useful data without occupying the full panel.

---

## CEO Experience Outcome

Before: Click a planet → see agent name + 3 message snippets + "open in feed."  
After: Click a planet → see full conversation with that agent, send a reply directly, close to return to overview.

The mental model shifts from "agent monitor" to "conversation." Every planet is a chat thread.
