---
title: KnowledgePanel — test-first before KB frontend merge
date: 2026-04-15T15:34:18
author: productivitesse (team-lead)
status: draft
type: proposal
tags: [refactor, testing, knowledge-base, productivitesse, ceo-direction-4]
summary: Before merging the knowledge-base frontend into productivitesse, write a Playwright spec that fully exercises the current KnowledgePanel behavior. It is the only critical-path P0 component in the upcoming refactor with zero existing test coverage — losing it silently is the single highest regression risk.
---

# KnowledgePanel — Test-First Before KB Frontend Merge

## Context

CEO Direction #4 calls for exhaustive test coverage of every behavior in productivitesse and knowledge-base before they are merged. The pre-refactor gap analysis (`productivitesse/.worklog/test-coverage-gap-2026-04-15.md`) identifies **5 P0 gaps** — behaviors with zero test coverage. Of those, **KnowledgePanel is the only one that is itself ground zero of the refactor**: its component tree, its data shape, and its endpoints will all change when the KB frontend lands.

If we ship the merge without a test for the current behavior, we lose the ability to detect "did we keep what users had before?" — only "does the new thing happen to work?".

## Problem

`src/features/mobile/KnowledgePanel.tsx` and `src/features/dashboard/components/KnowledgePanel.tsx` (two separate components) currently render KB entries fetched from `/kb` (or whatever the current endpoint is — exact wiring not yet audited). There is **zero Playwright coverage** and no unit tests. The behavior we will preserve in the merge is therefore undefined except by manual CEO observation.

## Proposal

**Step 1 (1 hr):** A test-writer agent writes `tests/ui/knowledge-panel.spec.ts` covering at minimum:
- Panel renders with N entries from a mocked KB endpoint
- Each entry shows title + summary + timestamp
- Click on an entry opens detail view
- Empty state renders when KB returns `[]`
- Error state renders when KB returns 500
- Both web and mobile breakpoints (use `goMobile()` helper)

**Step 2 (15 min):** Run the spec against current dev — capture pass count as the "behavior baseline".

**Step 3 (during merge):** The KB-merge coder runs the same spec after every commit. Spec failures = behavior regression. Spec must remain green at merge completion, or the merge is incomplete.

**Step 4 (post-merge):** Extend the spec for new KB capabilities introduced by the merge (sync to backend, item editing, etc.).

## Why this proposal vs just doing it

This is small enough to "just do" — but the question of *who* does it matters:
- The team lead (me) is prohibited from writing src/test code by the standing rule
- The current usage limit (resets Apr 18 05:00 JST) blocks subagent spawning
- A direct CEO override would unblock either path

This proposal asks for one of: (a) approval to write it directly under temporary override, (b) confirmation it can wait until Apr 18 when test-writers spawn cleanly, or (c) reassignment to chief-of-staff if the cross-project KB context matters more than the productivitesse-side context.

## Out of Scope

- The other 4 P0 gaps (voice-cancel, voice-error-recovery, mobile-agent-sheet, command-center) — those are NOT touched by the KB merge so can wait for normal sprint cycles
- Knowledge-base server side tests — separate concern, owned by the KB project
- The KB merge architecture itself — covered by the existing `2026-04-06-productivitesse-feature-refactor.md` proposal

## Acceptance

Approval is just a CEO yes/no on the timing question (Apr 18 vs sooner). The actual test-writing is mechanical once approved.
