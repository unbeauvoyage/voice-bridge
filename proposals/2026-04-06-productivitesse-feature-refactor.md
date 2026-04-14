---
type: proposal
title: Productivitesse — Feature-Based Refactor for AI Efficiency
summary: Decompose the monolithic dashboard folder and Zustand store into isolated feature modules so AI agents can navigate the codebase with fewer tokens per session.
status: proposed
author: command
created: 2026-04-06T16:35:04
priority: medium
project: productivitesse
---

# Productivitesse — Feature-Based Refactor for AI Efficiency

## Problem

The productivitesse frontend is organized around a single `features/dashboard/` folder containing 44 files and a single 309-line Zustand store covering 40+ unrelated state slices. This structure means:

- An AI agent working on **voice recording** must navigate 10 files scattered across `dashboard/`, `mobile/`, `runner/`, and `platform/`
- An agent working on **proposals** touches `actions.ts`, `store.ts`, and `ProposalsPanel.tsx` — all embedded in one giant dashboard folder
- Every session, the agent re-reads irrelevant files just to find what it needs

Cost compounds: every extra tool call = tokens burned = real money, every session, forever.

## Current State

```
features/
  dashboard/        ← 44 files, all mixed together
    store.ts        ← 309 lines, 40+ state slices
    actions.ts      ← all API calls for all features
    components/     ← 33 components for all features
  mobile/           ← some feature logic lives here
  runner/           ← some feature logic lives here
platform/           ← adapters partly feature-specific
```

**Voice recording example:** logic is split across 10 files in 4 different folders.

## Proposed Structure

```
features/
  voice-recording/
    recorder.ts           (consolidated recorder impl)
    useVoiceRecorder.ts   (single hook)
    store.ts              (recording state slice only)
    components/
      RecordButton.tsx
      RecordingIndicator.tsx
      VoicePage.tsx       (mobile-compatible)
    types.ts

  notifications/
    store.ts
    components/           (consolidate 4 notification UIs)
    types.ts

  proposals/
    api.ts                (proposal mutations)
    store.ts              (proposal slice)
    components/
      ProposalsPanel.tsx
      ProposalCard.tsx
    types.ts

  requests/
    api.ts
    store.ts
    components/

  issues/ questions/ knowledge/ backlog/ reports/ messages/
    (same pattern — each gets api.ts, store.ts, components/)

  dashboard/              (core layout only)
    App.tsx               (routing + layout skeleton)
    store.ts              (only: activeTab, UI state)
    components/           (layout primitives: NavBar, HoloPanel, Scene)
    control.ts            (programmatic API — unchanged)

store/
  index.ts               (thin combiner — imports all feature slices)
```

## Tradeoffs

**Benefits:**
- Agent working on voice = reads `voice-recording/` only. ~5 files vs ~10 scattered.
- Agent working on proposals = reads `proposals/` only. ~4 files vs searching 3 folders.
- Feature isolation enables independent testing and ownership.
- Recorder duplication fixed: `recorder.ts` + `useVoiceRecorder.ts` consolidated.

**Costs:**
- Large scope: 7-10 feature extractions + store decomposition + ~300 import rewires
- Risk of regressions if rushed — needs full E2E test pass after each feature extraction
- Estimated effort: 40-60 hours for a complete clean refactor

**Neutral:**
- File naming is already good — minimal renaming needed
- `platform/` adapters stay mostly as-is unless features absorb them

## Recommended Approach

1. **Freeze new features** on dashboard during refactor
2. **Extract one feature at a time** — voice first (highest scatter), then notifications, then proposals
3. **Run E2E after each extraction** before moving to next
4. **Store decomposition last** — most risky, do after all features are isolated

## Next Steps (if approved)

- CEO approves scope
- Team lead creates dev branch, assigns one coder per feature extraction
- Start with voice-recording (proves the pattern)
- Merge feature-by-feature, not all at once
