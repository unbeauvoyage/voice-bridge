---
title: Information Taxonomy
date: 2026-04-03
status: pending
---

# Proposal: Information Taxonomy

**Date:** 2026-04-03  
**Status:** Pending CEO approval

---

## Problem

The system produces and consumes many types of information — reports, proposals, questions, answers, issues, backlog items, directives — but there is no shared mental model for what each type means, where it lives, or how it behaves. This causes meta-confusion: CEO has to think about the container before engaging with the content.

---

## Taxonomy

Eight types. Each has a distinct lifecycle and interaction model.

---

### 1. Report
**What it is:** Factual summary of completed work or research findings. Read-only.  
**Interaction:** No decision required. CEO reads if interested.  
**Lives in:** `.worklog/` directories within each project.  
**Signal phrase:** "Here's what we found / what was done."  
**Example:** Research agent completes market analysis — logs findings to `.worklog/market-analysis.md`.

---

### 2. Proposal
**What it is:** Suggested action needing CEO approval. Interactive — CEO responds yes/no/modify.  
**Interaction:** Requires explicit CEO decision before action is taken.  
**Lives in:** `~/environment/proposals/`  
**Signal phrase:** "Should we do X? Here's the plan."  
**Example:** This document.

---

### 3. Question
**What it is:** CEO's learning inquiry — something CEO wants to understand.  
**Interaction:** Triggers research or explanation. Pending until answered.  
**Lives in:** Verbal/in-conversation until answered; no persistent storage needed unless deferred.  
**Signal phrase:** "How does X work? Why does Y happen?"  
**Example:** "How does edge-tts handle SSML?"

---

### 4. Answer
**What it is:** Response to a Question. Delivers knowledge — not a decision, not a task.  
**Interaction:** Read-only. CEO absorbs it.  
**Lives in:** `~/environment/answers/`  
**Signal phrase:** "X works like this because..."  
**Example:** Researched explanation of a technology or system behavior.

---

### 5. Issue
**What it is:** A bug, breakage, or small discrete task. Actionable, bounded in scope.  
**Interaction:** Gets assigned and closed. Short lifecycle.  
**Lives in:** `ISSUES.md`  
**Signal phrase:** "This is broken / this specific thing needs fixing."  
**Example:** "Voice bridge crashes on empty input — fix the null check."

---

### 6. Backlog Item
**What it is:** A larger initiative that isn't active yet. Strategic in nature.  
**Interaction:** CEO moves to Active when ready. Until then, it waits.  
**Lives in:** `BACKLOG.md`  
**Signal phrase:** "We should build / do X someday."  
**Example:** "Build a Windows-compatible session manager."

---

### 7. Dream
**What it is:** CEO's vision or aspiration. Not yet shaped into a plan.  
**Interaction:** Discussed, not acted on. May eventually become a Backlog item.  
**Lives in:** Conversation only — not stored unless CEO asks to capture it.  
**Signal phrase:** "Imagine if we could... / What if the system..."  
**Example:** "Imagine if agents could self-spawn based on workload."

---

### 8. Directive
**What it is:** CEO's direct order. Immediately actionable. No ambiguity.  
**Interaction:** Execute now. No approval loop needed.  
**Lives in:** Nowhere — execute and done.  
**Signal phrase:** "Do X." / "Stop Y." / "Fix Z now."  
**Example:** "Shut down the research team for today."

---

## Should These Stay Separated?

Yes. Each type has a different lifecycle:

| Type | Lifecycle | CEO action |
|---|---|---|
| Report | Created → read (or not) | None required |
| Proposal | Created → approved/rejected | Decide |
| Question | Asked → answered | Read answer |
| Answer | Created → read | None required |
| Issue | Created → assigned → closed | Assign (or auto-assign) |
| Backlog Item | Created → prioritized → activated | Activate when ready |
| Dream | Spoken → discussed → (maybe) backlog | Revisit later |
| Directive | Spoken → executed | None |

Merging types collapses these lifecycles and forces CEO to figure out what kind of thing they're looking at before engaging with it. Separation means the container signals the required action.

---

## Should We Add More Categories?

No. Eight is the right number. The temptation to add more (e.g., "Memo", "Update", "Observation") creates confusion by adding overlap without adding clarity. If something doesn't fit one of these eight, it should be reframed until it does.

---

## Recommendation

Adopt this taxonomy as the official information model for the system. Update team leads and meta-manager instructions to reference these definitions when routing information.

---

## Next Steps

1. CEO approves taxonomy (or adjusts any definitions)
2. Add taxonomy reference to CLAUDE.md or a dedicated `~/environment/TAXONOMY.md`
3. Relay to all agents: standard definitions for how to label and route information
4. Create `~/environment/answers/` directory if it doesn't exist yet
