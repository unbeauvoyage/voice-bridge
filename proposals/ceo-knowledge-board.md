---
title: CEO Knowledge Board
date: 2026-04-04
status: approved
---
# Feature Design Spec — CEO Knowledge Board

**Status:** Draft  
**Priority:** High  
**Author:** ux-lead  
**Date:** 2026-04-04  
**Requested by:** CEO (via Jarvis + Command)

---

## Problem / Why

CEO questions and agent explanations are scattered across four places that don't talk to each other:

| Surface | What it does | Why it fails |
|---|---|---|
| `questions/` + `answers/` | File-based Q&A | Manual filing — nobody uses it |
| `[EXPLAIN]` prefix | Routes explanations to `waiting-for-input` + PROBLEM-LOG | One-time attention event; answer is lost after CEO reads inbox |
| PROBLEM-LOG.md | Incident root causes | Not CEO questions — system events. Mixed with learning. |
| My Requests board | Task directives | Task lifecycle, not knowledge. Wrong bucket. |

CEO has no single place to see "things I asked, things I learned." Knowledge evaporates from the inbox. Files are never read again. The system has no memory of its own explanations.

**Goal:** One dashboard panel that auto-captures every CEO question + every agent explanation — without CEO filing anything manually.

---

## What Already Exists and How It Maps

| Existing thing | Status in new design |
|---|---|
| `questions/` + `answers/` directories | **Retained as file backend** — Knowledge Board reads these; relay syncs them. CEO never writes to them manually. |
| `[EXPLAIN]` prefix | **Rewired** — still triggers PROBLEM-LOG.md for incidents, but also creates a Knowledge Board entry with the question + answer paired. |
| PROBLEM-LOG.md | **Kept separate** — incident-specific (crashes, root causes, failures). Knowledge Board links to relevant entries. Not merged. |
| My Requests board | **Kept separate** — task directives only. Knowledge Board is for questions only. Cross-linked when a question spawns a task. |

---

## The Core Distinction (Do Not Blur This)

| Panel | Type of CEO message | Lifecycle |
|---|---|---|
| My Requests | "Build X", "Fix Y", "Research Z" — *directives* | not-picked-up → in-progress → completed |
| Knowledge Board | "How does X work?", "Why did Y fail?", "What is Z?" — *questions* | pending → answered → archived |

Jarvis decides which bucket at routing time. CEO never has to specify.

---

## Auto-Capture Flow

```
CEO sends message
       │
       ▼
  Jarvis classifies
       │
  ┌────┴────────────────────────┐
  │ task directive               │ question / explanation request
  ▼                              ▼
POST /requests               POST /knowledge
(My Requests board)          status: approved
                                  │
                             agent assigned to answer
                                  │
                             agent responds:
                             - [EXPLAIN] prefix, OR
                             - type="done" for question task
                                  │
                             relay pairs response to entry
                             status: "answered"
                             answer text stored
                                  │
                             WebSocket push → Knowledge Board updates
                             File written to ~/environment/answers/
```

**Classification rules for Jarvis (simple heuristics):**
- Starts with "how", "why", "what is", "explain", "what does", "can you tell me" → question
- Starts with "build", "fix", "add", "remove", "research", "implement", "create", "check on" → directive
- Ambiguous → directive by default (My Requests + optional Knowledge entry if answer given)
- `[EXPLAIN]` in agent response → always creates/updates a Knowledge entry

CEO never files manually. The auto-capture is invisible infrastructure.

---

## Panel Structure

**Tab:** "Knowledge" in the dashboard tab bar. Badge shows count of `pending` (unanswered) entries.

### Desktop 3D View

**Layout:** Two-column card grid, newest at top-left. Pending cards have a subtle pulse border. Answered cards are solid.

**Above the grid:**
```
[Search bar — full text search] [Category: All | Technical | Operational | Conceptual | Incident] [Status: All | Pending | Answered]
```

Unlike My Requests (filter-only), Knowledge Board has **full-text search** — knowledge is worth finding again.

**Knowledge Card anatomy:**
```
┌─────────────────────────────────────────────────────────┐
│ [category badge]  [timestamp]              [● pending]  │
│                                                         │
│  CEO's question text — 2 lines, click to expand        │
│  ─────────────────────────────────────────────────────  │
│  ┌ Answered by: jarvis · 14m later                      │
│  │ Answer preview — 3 lines of markdown text…          │
│  │ [Read more]                                         │
│  └                                                      │
│  [→ Problem Log entry]  [→ My Requests #4]  [Archive]  │
└─────────────────────────────────────────────────────────┘
```

**Card states:**
- `pending` — orange border, "Agent working…" placeholder in answer area
- `answered` — no border color (clean), answer inline
- `archived` — greyed out, collapsed to one line, shown at bottom of list

**Expand behavior:** clicking a card expands it inline to show full question + full answer (rendered markdown). No modal — stays in the list context.

**Cross-links (conditional, shown only when relevant):**
- `→ Problem Log entry` — shown if the question originated from a `[EXPLAIN]` / incident
- `→ My Requests #N` — shown if answering the question spawned a task
- `→ Proposal` — shown if the question led to a proposal being filed

**Archive:** available on all answered entries. Soft-delete — archived entries are searchable but not shown by default. There is no "dismiss pending" — you cannot dismiss an unanswered question (it needs an answer).

---

### Mobile HTML View (390px)

**Tab:** "Knowledge" in bottom tab bar, between "Requests" and "Proposals". Badge count of pending.

**Layout:** Full-width scrollable card list. Each card:
```
[category badge]  [● pending | answered]           [timestamp]
CEO question text — 2 lines
──────────────────────────────────────────────────────────────
Answered by: [agent] · Answer preview — 1 line…   [expand ↓]
```

**Search:** sticky search bar at top (collapses on scroll, tap to restore).

**Gestures:**
- Tap card → expands inline (same card, no modal)
- Swipe left on answered → "Archive" action revealed
- Swipe left on pending → no action (cannot dismiss pending)

**Category filter:** horizontal scrollable chip row below search bar. `All · Technical · Operational · Conceptual · Incident`

**Status:** pending cards sorted to top automatically.

---

## Data Contract

**Endpoints:**

- `GET /knowledge` — returns Knowledge entries, newest first. Query: `?status=pending|answered|archived`, `?category=...`, `?q=search+term`, `?limit=N`
- `POST /knowledge` — create new entry (called by Jarvis at routing). Body: `{ question, category, source_message_id }`
- `POST /knowledge/:id/answer` — agent files answer. Body: `{ answer_text, answered_by, linked_problem_log_entry?, linked_request_id? }`
- `POST /knowledge/:id/archive` — CEO archives an answered entry
- `GET /knowledge/:id` — full detail for single entry

**Knowledge entry schema:**
```json
{
  "id": "uuid",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "question": "CEO's original message text",
  "category": "technical | operational | conceptual | incident",
  "status": "pending | answered | archived",
  "answered_by": "agent-name | null",
  "answer": "markdown string | null",
  "answered_at": "ISO8601 | null",
  "source": "relay-auto | manual",
  "linked_request_id": "uuid | null",
  "linked_problem_log_entry": "string | null",
  "linked_proposal_id": "uuid | null",
  "file_path": "~/environment/answers/YYYY-MM-DD-slug.md | null"
}
```

**WebSocket event:** `type: "knowledge_update"` — relay → dashboard when any entry changes. Payload: full entry object. Dashboard merges by id.

**File sync:** when relay writes `answered`, it also writes to `~/environment/answers/YYYY-MM-DD-[slug].md`. The corresponding question is in `~/environment/questions/`. These files remain the durable archive. The relay is source of truth for live status.

---

## How [EXPLAIN] Gets Rewired

Currently: agent sends `[EXPLAIN]` prefix → goes to `waiting-for-input` inbox + PROBLEM-LOG.md

**New behavior:** agent sends `[EXPLAIN]` prefix →
1. PROBLEM-LOG.md still written (unchanged — incident record)
2. Knowledge Board entry created or updated with the answer paired to the CEO's original question
3. Inbox `waiting-for-input` message still sent (unchanged — CEO still gets notified)
4. Knowledge Board badge increments for the new answered entry

The inbox message is the notification. The Knowledge Board is where the answer lives permanently.

---

## Feature Parity Checklist

| Capability | Desktop 3D | Mobile HTML |
|---|---|---|
| View all questions + answers | ✓ | ✓ |
| Full-text search | ✓ | ✓ |
| Filter by category | ✓ | ✓ |
| Filter by status | ✓ | ✓ |
| Pending entries sorted to top | ✓ | ✓ |
| Inline expand full Q+A | ✓ | ✓ |
| Archive answered entries | ✓ (button) | ✓ (swipe left) |
| Cross-links to Problem Log / My Requests / Proposals | ✓ | ✓ |
| Live WebSocket updates | ✓ | ✓ |
| Badge count of pending | ✓ | ✓ |
| Auto-capture from relay (no manual filing) | ✓ | ✓ |

---

## How My Requests and Knowledge Board Work Together

These are **two separate tabs with a clean boundary** — but they are aware of each other:

1. **Jarvis decides at routing time** which bucket a CEO message belongs to. Task directive → Requests. Question → Knowledge. This keeps the buckets clean.

2. **Cross-links, not merging.** If answering a question leads to a task (e.g., "how long would implementing X take?" → CEO decides to do it → task created), the Knowledge entry links to the My Requests entry. CEO can trace the chain: question → answer → decision → task → done.

3. **Shared tab bar, separate panels.** The two tabs sit next to each other. Badge on Requests = open tasks. Badge on Knowledge = unanswered questions. CEO sees both counts at a glance without conflating them.

4. **Different dismissal semantics.** Requests can be cancelled (CEO decides not to do the task). Knowledge entries can be archived (CEO has absorbed the knowledge). You can't cancel a question — only archive an answered one.

---

## Out of Scope

- CEO-to-CEO knowledge (no other CEO exists)
- Agent-to-agent Q&A (agents use the relay directly — this board is CEO-facing only)
- Version history of answers (one answer per question in v1)
- Knowledge graph / topic clustering (search handles discovery in v1)
- Upvoting or rating answers (no social mechanics in v1)
- Exporting the knowledge base (file sync to answers/ is the export)
- Proactive surfacing ("you asked this before") — future feature

---

## Acceptance Criteria

- [ ] Jarvis classifies CEO messages and calls POST /knowledge for questions
- [ ] Agent [EXPLAIN] responses auto-pair to pending Knowledge entry and set status answered
- [ ] Dashboard Knowledge tab renders with badge count of pending entries
- [ ] Pending cards show "Agent working..." placeholder until answered
- [ ] Answered cards show full Q+A inline on expand
- [ ] Full-text search works across question and answer text
- [ ] Category and status filters narrow the list correctly
- [ ] Archive action soft-deletes on desktop (button) and mobile (swipe left)
- [ ] Cannot swipe-archive a pending entry
- [ ] Cross-links to Problem Log, My Requests, and Proposals render when linked_* fields are populated
- [ ] WebSocket update transitions pending → answered without page reload
- [ ] File written to ~/environment/answers/ when answer is stored
- [ ] Playwright test: Jarvis routes question → pending appears → agent answers → card transitions to answered → archive works
