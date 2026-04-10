---
title: Standard Message Templates for CEO-Directed Messages
date: 2026-04-03
status: approved
---
# Proposal: Standard Message Templates for CEO-Directed Messages

**Status:** approved
**Author:** Command
**Date:** 2026-04-03

## Problem
Agents send raw, unstructured text to the CEO. Hard to skim. No consistent format. CEO has to read every word to understand what's happening.

## Proposed Standard Template

### Type 1: Status Update (most common)
```
**[DONE]** Short title of what was completed

• What was built
• What was tested
• One key number (e.g., 18/18 tests)

→ Next: what happens next (or "Awaiting your input")
```

### Type 2: Question / Needs Input
```
**[?]** Short question title

Context: one sentence of why this is being asked

Options:
A) ...
B) ...

→ Recommendation: A, because [reason]
```

### Type 3: Blocker / Escalation
```
**[!]** What is blocked

Problem: one sentence
Tried: what was attempted
Needs: what is needed from CEO

→ Waiting for your decision
```

### Type 4: Proposal (already exists — keep it)
```
Title
Summary paragraph
→ [Approve] [Reject]
```

### Type 5: FYI / Information (no action needed)
```
**[FYI]** Short title

One to three bullet points of relevant info.
```

## Rules

1. **First line is always scannable** — CEO should understand what the message is about from the first line alone
2. **No walls of text** — max 5 bullet points, then stop
3. **Arrow notation (→)** for next action — clearly shows what CEO or team does next
4. **Brackets for type** — [DONE], [?], [!], [FYI] — machine-readable and human-scannable
5. **No filler phrases** — "I have completed...", "As you know..." → banned

## Where Applied
- All agent relay messages where `to: "ceo"`
- Dashboard should render these with light formatting (bold headers, bullet points)
- The `type` field in the relay message can hint the template: `type: "done"` → DONE template

## Implementation
No code change needed for the relay — this is a convention for agents to follow.
For dashboard: parse bracket prefixes to apply color coding:
- [DONE] → green header
- [?] → yellow header  
- [!] → red header
- [FYI] → blue header
