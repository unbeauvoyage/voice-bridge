---
title: Modern Testing Strategy for AI-Driven Development
date: 2026-04-03
status: approved
---
# Proposal: Modern Testing Strategy for AI-Driven Development

**Status:** approved
**Author:** Command
**Date:** 2026-04-03

## The Question
When AI writes most of the code, do we still need unit tests? Or can we rely on UI tests + specification files + AI testers?

## Short Answer
**Drop most unit tests. Keep UI tests + spec files + build verification.** Here's why and how.

## The Problem with Unit Tests in AI Development

Unit tests made sense when humans wrote code slowly and needed regression safety nets. In an AI-driven workflow:

1. **Code is cheap, specs are expensive.** AI rewrites entire components in minutes. Unit tests that assert implementation details break constantly and slow iteration.
2. **Mocking is lying.** Unit tests with mocks verify your assumptions about dependencies, not actual behavior. The Playwright-vs-real-relay bug we already hit proves this.
3. **AI writes tests that pass by construction.** When the same AI writes both code and unit tests, the tests tend to verify what was written, not what was intended. They catch typos, not design flaws.

## What Actually Catches Bugs

In our system, bugs have come from:
- **Integration mismatches** (relay running old build, endpoints missing) — caught by UI tests hitting real services
- **Visual/UX issues** (panels off-screen, z-index, truncation) — caught by Playwright or human eyes
- **Build failures** (TypeScript errors, missing imports) — caught by `tsc --noEmit`
- **Stale test data** (the "[TASK APPROVED]" loop) — caught by observation, not unit tests

None of these would have been caught by unit tests.

## The New Strategy: Spec-Driven Testing

### Layer 1: QA Specification Files (the source of truth)

Every feature gets a `.spec.md` file before implementation begins:

```markdown
# Feature: Questions/Answers Panel

## Expected Behavior
- NavBar shows "Q&A" tab
- Clicking Q&A tab opens panel with cards
- Each card shows: question title, answer preview, date
- Cards load from ~/environment/answers/ directory via relay /answers endpoint
- Empty state shows "No questions yet" message
- Cards are sorted newest-first

## Edge Cases
- answers/ directory doesn't exist → show empty state, no error
- Answer file has no frontmatter → skip it gracefully
- 100+ answers → paginate or virtual scroll

## NOT in scope
- Editing answers from dashboard
- Submitting new questions from dashboard
```

**Who writes specs:** The team lead writes the spec BEFORE spawning a writer. The writer implements to spec. The tester tests against spec. The reviewer checks spec compliance.

**Where specs live:** `specs/[feature-name].spec.md` in the project root.

### Layer 2: Build Verification (automated, mandatory)

```bash
npx tsc --noEmit        # Type safety — catches 60% of AI coding errors
npm run build            # Bundler catches import/export issues
```

This is non-negotiable. Runs before every commit. Catches the majority of mechanical errors.

### Layer 3: UI/Integration Tests (Playwright)

One Playwright test per spec behavior:

```typescript
// Generated from spec, not from implementation
test('Q&A tab shows answer cards from relay', async ({ page }) => {
  await page.getByRole('button', { name: 'Q&A' }).click();
  await expect(page.getByText(/questions/i)).toBeVisible();
  // Verify real data loads (not mocked)
  const cards = page.locator('[data-testid="answer-card"]');
  await expect(cards.first()).toBeVisible({ timeout: 5000 });
});
```

Key rules:
- **Test against real services** (relay, filesystem) — no mocks
- **Test user-visible behavior** — not implementation details
- **Test from the spec** — tester reads `.spec.md`, writes tests, never reads implementation code
- **Clean up test data** — no seeding that leaks into production (learned from the TASK APPROVED bug)

### Layer 4: AI Tester Review (the human-QA replacement)

The tester agent doesn't just run Playwright — it also:
1. Opens the feature in a browser (Playwright screenshot or manual navigation)
2. Checks visual appearance against spec expectations
3. Tries edge cases from the spec
4. Reports: "Spec says X, I see Y" with screenshots

This replaces traditional human QA for most cases.

### When to Still Write Unit Tests

Unit tests are justified only for:
- **Pure logic with complex edge cases** (date parsing, sorting algorithms, data transformations)
- **Shared utilities used by many components** (if it breaks, 10 things break)
- **Security-critical code** (auth, input sanitization)

If the function is only used in one component and Playwright can verify the behavior end-to-end, skip the unit test.

## The Workflow

```
1. Team lead writes spec (.spec.md)
2. Writer implements to spec
3. Build verification (tsc + build)
4. Reviewer checks: does code match spec?
5. Tester writes Playwright tests FROM SPEC (not from code)
6. Tester runs tests against real services
7. All pass → VIP commit
```

## Scaling with AI

This scales because:
- **Specs are small** (~30 lines) and reusable — CEO or team lead writes once
- **AI testers can generate Playwright tests from specs** — give spec to tester agent, it writes tests
- **No mock maintenance** — mocks are the #1 scaling bottleneck in traditional testing
- **Parallel testing** — each feature team runs on its own port, tests don't collide
- **Spec drift detection** — if behavior changes, update spec first, then code, then tests. Spec is always the authority.

## Summary

| Old Way | New Way |
|---------|---------|
| Unit tests for everything | Unit tests only for pure logic |
| Mocked dependencies | Real services (Playwright) |
| Tests written after code | Spec written before code, tests from spec |
| Human QA | AI tester agent + Playwright |
| Tests verify implementation | Tests verify behavior |
| Test maintenance burden | Spec maintenance (much smaller) |

## Migration
No migration needed — we're already mostly doing this with Playwright. Formalize it:
1. Create `specs/` directory in productivitesse
2. Write specs for the 7 features currently in development
3. Instruct testers to test from spec, not from code
