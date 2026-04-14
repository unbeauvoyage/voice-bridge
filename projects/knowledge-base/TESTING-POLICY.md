---
type: knowledge
title: Testing Policy
summary: What gets tested, why, and when — scoped to high-stakes paths only; no rote coverage.
codebase: knowledge-base
created: 2026-04-11T00:00:00
updated: 2026-04-11T00:00:00
---

# Testing Policy

## Core Philosophy

Tests in this project are a protection layer, not a development tool. The question is never "what percentage of code is covered?" — it is "what failure mode would be invisible until it had already caused damage?" Write tests for high-stakes paths that could silently corrupt data or break the core user loop. Everything else is noise.

This is not anti-testing. It is a deliberate trade-off: in the LLM era, reading code is fast. An LLM can verify a pure utility function in seconds by inspection. Running a test suite for that same function costs CI time, maintenance burden, and attention every time the signature changes. The cost is not worth it. Reserve tests for the cases where reading the code is not enough — where the failure would be silent, cumulative, or only detectable at runtime with real state.

The rule of thumb: if a bug in this code path could corrupt stored data or break the feature permanently for a user without any visible error, it gets a test. If it would surface immediately as a visible error or is trivially verifiable by reading the logic, it does not.

Implementation comes first. Tests are written at the same time as the feature — same coder, same PR — not in a separate pass and not after the fact.

---

## What Gets Tested (Mandatory)

### 1. Database Migrations

Every migration step must have a corresponding test using an in-memory SQLite database (`new Database(":memory:")`). A broken migration is the highest-severity failure in this system: it can silently corrupt or lose all stored URLs, metadata, and processing state for every user. Unlike most bugs, a bad migration cannot be "fixed forward" without data recovery work.

Migration tests are write-once. Once a migration is committed and tested, its test does not change. If the migration is wrong, it gets a new migration to correct it — the test for the original migration stays as a record of what that step was supposed to do.

Each test should:
- Apply all prior migrations to reach the schema state the new migration acts on
- Run the migration under test
- Assert the resulting schema shape (columns present, types correct, constraints applied)
- Assert that existing rows survive the migration without data loss

### 2. Queue and Retry Logic

The processing queue is the backbone of the system. Silent failures here mean URLs appear to be saved but are never processed, or processing is attempted so aggressively it causes cascading failures. Three behaviors must be tested:

**Retry budget persistence across restarts.** If a job has used 2 of 3 allowed retries and the process restarts, it must resume with 1 retry remaining — not reset to 3. Test this by running a job to partial retry state, simulating a restart (reinitializing the queue from the persisted DB state), and confirming the retry count is preserved.

**Semaphore concurrency limiting.** If the semaphore allows a maximum of N concurrent jobs, submitting N+1 jobs simultaneously must result in exactly N running at once, with the (N+1)th waiting. Test with a controlled async setup where job duration is deterministic.

**Backoff calculation correctness.** Given a retry number and a backoff strategy (e.g., exponential), the calculated delay must match the expected value. Test the boundary cases: retry 0, retry 1, retry at the max budget.

### 3. Core E2E Smoke Test

One Playwright test covers the complete user loop from end to end:

1. Save a URL via the UI
2. Wait for the background processing pipeline to complete
3. Verify the URL appears in the saved items list with a non-empty title and summary

This test exists because each stage of the pipeline (fetch, parse, summarize, persist, display) can silently succeed while the next stage fails. Unit tests on each stage do not catch integration gaps. This single test validates the entire chain is wired together correctly.

The test should use a stable, predictable URL (or a local mock server) so it does not flake on network conditions. It is the canary for the whole system.

---

## What Does Not Get Tested

**Getters and pure utility functions.** A function that formats a date string or extracts a domain from a URL is trivially verifiable by reading it. If it breaks, the breakage is visible immediately. No test needed.

**UI component rendering.** Whether a card renders with the correct CSS class or a button shows the right label is not a silent failure. Visual regression is caught by looking at the page.

**Anything an LLM can verify faster by reading than by running.** If the logic fits in a mental model in under 30 seconds of reading, a test adds no protective value. The maintenance cost of keeping that test current exceeds the protective value.

**Coverage for coverage's sake.** A line coverage percentage is not a goal. Adding tests to reach a number without a specific failure mode in mind is prohibited. Every test in this repo must have a sentence-long justification for why the failure it guards against would otherwise be silent.

---

## When Coders Write Tests

Tests are written by the same coder who wrote the feature, in the same PR, at the same time. Testing is not a separate phase, a QA handoff, or a follow-up task.

Tests are required when touching:
- Database schema (any migration file)
- Queue processing logic
- Retry or backoff behavior
- API contracts that other systems depend on (request shape, response shape, error codes)

Tests are not required for:
- UI changes (layout, labels, styles, copy)
- New settings keys or configuration additions
- Feature flags
- Logging additions

If a PR touches both a migration and a UI change, the migration needs a test. The UI change does not. Apply the rules per path, not per PR.

---

## TDD Exception

Test-first development is not the default. The one situation where writing the test before the implementation is correct: debugging a specific regression. When a bug is reported and you need to know the exact moment it is fixed, write a failing test that reproduces the bug first, then fix the code until the test passes. This gives a precise signal and prevents the same regression from re-entering.

A second valid case: when an interface contract matters more than the implementation details. If you are designing an API that multiple callers will depend on and the shape of that API is the hard part, writing the test (which doubles as a usage spec) before the implementation can clarify the design. This is rare in this codebase.

In all other cases, implement first.

---

## Running Tests

Unit and integration tests:

```sh
bun test
```

End-to-end tests:

```sh
bunx playwright test
```

CI runs both on every merge to main. A PR that breaks either suite does not merge. There is no separate "test later" track.
