---
title: Phase 4 Rebase Strategy — Cherry-Pick Instead of Full Rebase
date: 2026-04-16T04:09:45
status: pending
summary: Phase 4 rebase onto main will explode — P4a-P4e all modify the old monolithic app.tsx which Pass 1-8 completely rewrote. Phase 4's migration goals were already achieved by the refactor. Recommend cherry-picking the 5 unique non-overlapping commits instead.
---

# Phase 4 Rebase Strategy

**Filed:** 2026-04-16T04:09:45  
**Author:** knowledge-base team lead  
**For:** chief-of-staff + CEO  
**Trigger:** Per chief-of-staff directive — "if it explodes, STOP and file a proposal"

---

## Conflict Surface Assessment

### What Phase 4 is

15 commits on top of merge-base `a2aa638` (a pre-refactor commit from ~2026-04-15 19:21).

The core Phase 4 commits (P4a–P4e) are:

| Commit | Description | Primary file touched |
|--------|-------------|----------------------|
| `e9e827c` | P4a: migrate tagStatusMap from useState to React Query | `web/app.tsx` |
| `ebbde9f` | P4b: migrate itemsInCollections from useState to React Query | `web/app.tsx` |
| `99c4dd2` | P4c: migrate semanticResults and ftsResults to React Query | `web/app.tsx` |
| `c8edeea` | P4d: migrate item detail cache to React Query | `web/app.tsx` |
| `865b8af` | P4e: move semanticMode + activeCollectionId to Zustand | `web/app.tsx` |

All 5 of these commits make surgical incisions into the old 1053-line monolithic `web/app.tsx`.

### Why it explodes

Main's Pass 1-8 refactor **completely rewrote** `web/app.tsx` — from 1053 lines to 64 lines. The file is structurally unrecognizable. P4a's first commit would land on a file that no longer has `loadTags()`, `setTagStatusMap`, or `tagStatusMap` state. Git cannot apply a surgical diff to a file that has been gutted and replaced.

First conflict surface (on the very first P4a commit, `e9e827c`):
- `web/app.tsx` — CONFLICT (content)
- `web/src/features/collections/index.ts` — CONFLICT (content)

This would cascade through all 5 P4a-P4e commits.

---

## Critical Finding: Phase 4 Goals Are Already Achieved

The Pass 1-8 refactor accomplished the **exact same migration goals** as Phase 4, but via component extraction rather than in-place mutation:

| Phase 4 Goal | Phase 4 Approach | Pass 1-8 Achievement |
|---|---|---|
| tagStatusMap → React Query | `useTagStatusMapQuery` hook | Derived via `React.useMemo` from `useTagsQuery` in KnowledgeBody |
| itemsInCollections → React Query | `useItemsInCollectionsQuery` | `useItemsInCollectionQuery` (fixed union-set bug too) |
| semanticResults/ftsResults → React Query | `useSemanticSearchQuery` / `useFtsSearchQuery` | Both exist in main at same paths |
| item detail → React Query | `useItemDetailQuery` | `useItemDetailQuery` exists in main |
| semanticMode → Zustand | moved to uiStore | `searchStore.ts` has `semanticMode` |
| activeCollectionId → Zustand | moved to uiStore | `filterStore.ts` has `activeCollectionId` |

**Conclusion: Phase 4's core work is already done. The branch is obsolete as a migration unit.**

---

## What Phase 4 Has That Main Does Not

Non-overlapping unique commits (cherry-pickable):

| Commit | Value | Status |
|--------|-------|--------|
| `87ef027` | Article chat E2E test coverage (20 tests) | UNIQUE — main has no article-chat tests |
| `7f5f966` | Article chat E2E refactor (core flows) | UNIQUE — depends on 87ef027 |
| `1e48f3c` | `test-results/` added to .gitignore | UNIQUE — minor housekeeping |
| `4377351` | ESLint config fix + parserOptions | Potentially unique — need to check main's eslint config |
| `947310a` | Remove unused imports from types.ts | May already be on main |

The 4 reverted commits (`5d54c7e` reverts P4e, `8dc9f68` reverts an extraction fix) add noise; they net to zero.

---

## Recommended Strategy: Cherry-Pick the Unique 5

Instead of rebasing the full 15-commit branch (which will require resolving 5+ app.tsx explosion conflicts), cherry-pick only the unique non-overlapping commits onto main:

```bash
git checkout main
git cherry-pick 87ef027  # article-chat E2E (20 tests)
git cherry-pick 7f5f966  # article-chat E2E refactor
git cherry-pick 1e48f3c  # test-results gitignore
git cherry-pick 4377351  # ESLint config (check for conflict with convergence-B ESLint commit)
# 947310a (types.ts unused imports) — verify not already on main first
```

Then:
1. Delete or archive `phase-4/server-state-migration` branch
2. Declare Phase 4 migration COMPLETE — goals achieved via Pass 1-8

---

## Risk Assessment

| Option | Effort | Risk | Outcome |
|--------|--------|------|---------|
| Full rebase (original plan) | 4-6h | HIGH — 5+ explosion conflicts on dead app.tsx code | Conflict noise with no new functionality |
| Cherry-pick unique commits | 30min | LOW — 2-3 commits with no file overlap | Article-chat tests + housekeeping land cleanly |
| Abandon phase-4 branch entirely | 0min | NONE | Lose article-chat tests (only real value) |

**Recommendation:** Cherry-pick. The article-chat E2E coverage is real value. The P4a-P4e migration work is already done.

---

## Decision Needed

1. Approve cherry-pick approach (recommended)
2. Require full rebase anyway (will produce conflicts on dead code, no new functionality)
3. Abandon phase-4 branch entirely (lose article-chat tests)
