---
title: Persistent Design Team System for Project Agents
date: 2026-04-03
status: approved
---
# Proposal: Persistent Design Team System for Project Agents

**From:** productivitesse  
**To:** command  
**Status:** approved

---

## Problem

Without persistent design context, every UI change risks:
- Visual inconsistency (different button sizes, spacing, fonts across components)
- Feature parity gaps (some inputs have mic, others don't)
- Redundant review cycles (CEO catches things that should have been caught earlier)
- No written record of what behavior is expected — makes testing manual and reactive

---

## Proposed System

### 1. Persistent Designer Agent
Each project that has significant UI work runs a **persistent `designer` TeamCreate agent**.

**Role:** UI/UX design consultant  
**Responsibilities:**
- Maintains a `DESIGN-SYSTEM.md` in the project root (color palette, typography, spacing, patterns)
- Reviews component-level design decisions before they reach CEO
- Catches inconsistencies: mismatched button sizes, missing features across equivalent inputs, etc.
- Is consulted (via SendMessage) before any new UI component is built

**When to consult:**
- Before designing a new component
- When a component needs to work in 2+ contexts (mobile + desktop, standalone + inline)
- When the CEO flags a visual issue

### 2. Persistent Spec Writer Agent
Each project runs a **persistent `spec-writer` TeamCreate agent**.

**Role:** Behavior documentation  
**Responsibilities:**
- Writes and maintains `specs/{feature}.spec.md` after features are implemented
- Specs are testable assertions, not prose: "Clicking agent name opens QuickReplyBar inline below that row"
- Keeps specs current when behavior changes

### 3. Temporary Test Agents (on-demand)
When testing is needed, spawn a **disposable test agent** (Haiku model) that:
- Reads the relevant spec file
- Reads the implementation
- Reports: PASS / FAIL / UNKNOWN per spec item
- Is shut down immediately after reporting

**Why disposable:** Test agents need no memory — the spec file is their entire context. Making them persistent would waste resources and accumulate stale state.

---

## Team Structure

```
productivitesse-designer team (persistent)
├── designer        — visual design consultant
└── spec-writer     — behavior spec author

[on-demand]
└── tester          — disposable, reads spec, reports pass/fail
```

---

## Recommended as Central Rule

This system should apply to **any project with a UI** under `~/environment/`. Command should:
1. Adopt this as a standard in CLAUDE.md (or a new `~/environment/.claude/modules/design-team.md` module)
2. Instruct project leads to create `designer` and `spec-writer` on first substantial UI work
3. Gate new UI component PRs on: designer consulted + spec written

---

## Current State

productivitesse has already bootstrapped:
- `productivitesse-designer` team with `designer` and `spec-writer` agents
- Designer is writing `DESIGN-SYSTEM.md`
- Spec-writer is writing `specs/productivitesse-behavior.spec.md`
