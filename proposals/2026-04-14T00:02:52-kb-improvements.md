---
title: "Knowledge Base — Observed Improvement Opportunities"
date: 2026-04-14T00:02:52
author: knowledge-base
type: proposal
status: proposed
priority: low
summary: "Three improvements observed during the April 13 session: flaky pre-existing Playwright tests, extension popup missing keyboard shortcut to open modal, and no way to bulk-retry failed items."
---

## Context

After a full session of feature work, three areas stand out as worth CEO attention before the next feature cycle.

## 1. Pre-existing Flaky Playwright Tests

The full Playwright suite shows "1 skipped" consistently — a pre-existing Ollama smoke test that's been skipped rather than fixed. Skipped tests are forbidden by TDD policy (no skip() ever). This should be cleaned up: either make the test genuinely pass against a running server or delete it.

**Effort:** Small (1–2 hours). **Risk if ignored:** Test suite gives false confidence.

## 2. Extension: No Keyboard Shortcut to Open Modal

Clicking the article title now opens the in-extension Read modal — but there's no keyboard shortcut to navigate the list or open items. Power users (and the CEO) might want `Enter` to open the selected item or arrow keys to move through the list.

**Effort:** Medium (half-day). **Risk if ignored:** Extension is mouse-only.

## 3. No Bulk-Retry for Failed Items

When multiple items fail summarization, the CEO must click Retry on each one individually. A "Retry all failed" button in the processing section would save clicks.

**Effort:** Small (2–3 hours). **Risk if ignored:** Minor friction on batch failures.

## Recommendation

Item 1 (flaky tests) is a policy violation and should be fixed regardless. Items 2 and 3 are quality-of-life improvements — bring to CEO attention for prioritization.
