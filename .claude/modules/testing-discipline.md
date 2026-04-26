# Testing Discipline & Error Handling Coverage

> **Priority #1 after relay communication: Error handling coverage.**
> **Priority #2: E2E/Integration test coverage.**
> **Priority #3: Unit tests — strict criteria only (see below).**
> Every agent reads this before touching code.
>
> **Critical emphasis:** Error handling is MORE important than test count. A feature with 100 tests but generic error messages is worse than a feature with 20 tests and beautiful error handling.

## 🚨 UNIT TEST POLICY — LAW (2026-04-18, CEO directive)

**Do NOT write new unit tests. Existing unit tests may be kept but should not be expanded.**

### Why

LLM-written code changes the equation. Traditional TDD's red/green loop forced humans to design better interfaces; agents reason about interfaces without needing the failing test as a design tool. Meanwhile, unit tests:
- Consume agent context window (fewer tokens for real architecture work)
- Cause compaction earlier (cutting work mid-stream)
- Give false confidence — hundreds of passing unit tests did not catch the 2026-04-18 voice transcription outage, which was an integration failure, not a logic failure

### The three tiers

| Tier | What | Action |
|------|------|--------|
| **Delete** | Tests for internal implementation details — store internals, private functions, mocked integration points that test nothing real | Delete. They add false confidence. |
| **Convert** | Tests for user-visible behavior currently covered by unit tests | Rewrite as E2E/integration test, then delete the unit version |
| **Keep (strict criteria)** | Pure isolated logic with no I/O: parsers, data transforms, math, type guards | Keep only these. They run fast, catch real regressions, require no environment. |

### New test rule

**Write E2E or integration tests first. Unit tests only if E2E/integration genuinely cannot cover the scenario** — and that exception must be rare. When in doubt, write an E2E test.

E2E tests catch composition failures (the class of bug that caused our worst incidents). Unit tests do not.

---

## Why E2E Tests Are Primary

**The 2026-04-18 lesson:** Three correct individual components (voice recorder, HTTP client, relay delivery) combined into a broken user experience. Each component passed its unit tests. The integration failed because:
- localStorage had a stale value unit tests never touch
- URL was read at module init, not call time — unit tests mock this away
- MIME type was wrong from the browser — unit tests don't run browsers

None of these are catchable by unit tests. All three were caught by a 30-second Playwright run.

**Test at the highest level you can.** If a Playwright test can cover it, use Playwright. If an HTTP integration test can cover it, use that. Unit tests are the last resort, not the first tool.

---

---

## ERROR HANDLING COVERAGE — PRIORITY OVER TEST COUNT

**Every significant error path in your code must be:**
1. **Explicit** — not hidden in a generic try-catch
2. **Logged structurally** — with context (what failed, why, what was attempted)
3. **Testable** — you have a test that verifies what happens when this error occurs
4. **User-visible or developer-visible** — never silent failures

**Bad error handling (❌):**
```ts
try {
  await fetch(url).then(r => r.json());
} catch (e) {
  console.error('Something went wrong');  // ❌ Generic, no context
}
```

**Good error handling (✓):**
```ts
try {
  const res = await fetch(url);
  if (!res.ok) {
    const errorBody = await res.text();
    logger.error('voice_bridge_fetch_failed', {
      url, status: res.status, body: errorBody.slice(0, 200)
    });
    throw new VoiceBridgeError(`HTTP ${res.status}: ${errorBody}`);
  }
  return await res.json();
} catch (e) {
  if (e instanceof VoiceBridgeError) throw e;
  logger.error('voice_bridge_parse_failed', { url, error: e.message });
  throw new VoiceBridgeError(`Failed to reach voice bridge: ${e.message}`);
}
```

**Structured logging rule:** Every error MUST log structured context: what operation, what failed, why, what was attempted. This context flows to observability systems (Datadog, AWS CloudWatch).

**Error handling test requirement:** If an error path exists, there is a test for it. "What happens when the relay is offline?" → test. "What happens on 502?" → test. "What happens on MIME rejection?" → test.

---

## STRUCTURED LOGGING FOR OBSERVABILITY

**All applications use unified logging framework** (to be specified by team — candidates: pino, winston, or custom).

**Log entry structure (standardized across all projects):**
```json
{
  "timestamp": "2026-04-18T09:30:00Z",
  "level": "error|warn|info|debug",
  "component": "voice-bridge:transcribe|productivitesse:relay|knowledge-base:scraper",
  "event": "transcription_failed|relay_offline|scrape_timeout",
  "context": {
    "url": "...",
    "status": 502,
    "attempt": 2,
    "duration_ms": 1500
  },
  "error": {
    "message": "HTTP 502",
    "stack": "... (optional, for errors only)"
  },
  "user_visible_message": "Voice transcription failed — voice bridge unreachable"
}
```

**Every error must include:**
- **component** — which service/module (voice-bridge:transcribe, productivitesse:relay, etc.)
- **event** — human-readable error type (transcription_failed, relay_offline, scrape_timeout, auth_failed)
- **context** — relevant operational data (URL, HTTP status, attempt number, durations)
- **user_visible_message** — what the user sees (if applicable)

This structure enables:
- Datadog/AWS parsing and alerting on specific error types
- Correlation of errors across services
- Root cause analysis (error patterns over time)
- SLA monitoring (how many transcription_failed per hour?)

---

## ABSOLUTE RULE: ACCEPTANCE TESTS FIRST FOR ALL UI, HTTP, AND USER-VISIBLE BEHAVIOR

**Write a behavior test BEFORE writing any implementation code for any feature that touches UI, HTTP endpoints, or user-visible behavior. This is not optional. If you are implementing without a failing test already written, you are violating this rule.**

No acceptance test = no done. Team lead will not accept the work. PR will not be reviewed.

This is not a suggestion. This is not a preference. This is the strongest enforcement rule in this document. Behavior tests are the spec. You do not know what to build until the test tells you what to build. Writing implementation first means you are guessing — and guessing is not engineering.

**For JS/TS projects, the acceptance test framework is Playwright.** For other projects (.NET, Kotlin, etc.), use that project's primary end-to-end or integration test framework — the principle is the same regardless of the tool.

**The only exception:** pure logic with no I/O (data transforms, math, parsers with no network or DOM dependency). Everything else — every URL, every UI state, every agent interaction, every HTTP response — gets a behavior test written first.

If you find yourself thinking "I'll add the test after" — stop. That is the violation. Write the test. Run it. Watch it fail. Then implement.

---

## THE NON-NEGOTIABLE RULE

**A feature, fix, or change is NOT done until you have run a real test that proves it works — and you have shown the command output to prove it.**

"I believe it works." ❌
"The code looks right." ❌
"TypeScript compiled." ❌
"Unit tests pass." ❌ (necessary but not sufficient)
"I ran a curl/Playwright/CLI test and here is the actual output:" ✅

**Why this rule exists:** The CEO keeps catching bugs that would have been found by a 30-second curl test or a 2-minute Playwright run. Every such catch is a failure of this rule. The CEO's time is not a substitute for automated verification. **If a bug is catchable by automation and the CEO catches it, the pipeline failed.**

---

## TEST COMMENTS ARE THE SPEC (CEO Rule — April 2026)

**Primary purpose of tests:** Executable, permanent specifications — not just regression detection. Agents must read tests before changing behavior to understand existing intent.

**When to add a comment above a test:**
Comment ONLY when the behavior could look wrong or surprising to someone who didn't make the decision.

**The filter:** *"Would a competent developer reading this test think it might be a bug?"*
- Yes → comment is mandatory.
- No → skip it. The test name carries it.

**What gets commented:**
- Behavior that intentionally breaks an obvious pattern (acronym casing loss, ordering dependencies)
- Upsert/idempotency semantics that are non-obvious
- Design decisions that look like bugs

**What does NOT get commented:**
- Anything the test name already fully explains
- Obvious correct behavior

**Example (comment required — acronym casing looks like a bug):**
```typescript
// Tag slugs are URL-friendly versions of the canonical Title Case form.
// Acronyms intentionally lose casing — AI becomes ai — because
// the canonical Title Case form is source of truth, not the slug.
test('converts Title Case to lowercase hyphenated slug', () => {
  expect(toTagSlug('Unreal Engine')).toBe('unreal-engine');
});
```

**Intra-team design decisions belong in test files**, not relay messages or separate docs.

**Checklist for every new test:**
- [ ] Name describes capability/intent (not implementation)
- [ ] If behavior could look like a bug → comment above explaining WHY
- [ ] No separate spec files — tests are the spec

---

## Visual Verification (UI Work)

After implementing any UI feature or fix, the coder MUST:
1. Run the relevant Playwright test with `--reporter=html` or ensure screenshots are captured
2. Read at least one screenshot with the Read tool to visually confirm the feature renders correctly
3. If no Playwright test covers this feature — write one first (TDD), then run it
4. Only report DONE after: (a) passing tests AND (b) visual confirmation via screenshot

If the screenshot shows the feature is broken — fix it. Do not report done with a broken screenshot.

**This applies to ALL UI work.** Non-UI work (server, relay, background tasks) still requires passing tests but not screenshots.

The canonical failure mode this prevents: reporting a fix as done without checking that it actually renders. Tests can pass while the UI is visually wrong (wrong position, invisible, covered by another element).

---

## Manual Browser Testing

**Before handing off any UI feature**, the coder must run Playwright in real mode (headless or headed) and look at the results:

1. Run the Playwright test suite: `npx playwright test --reporter=html` (or the project equivalent)
2. If the test opens a browser — observe it. If headless — capture screenshots.
3. Read at least one screenshot with the Read tool. Look at it with your own eyes (vision).
4. If what you see does not match the expected behavior — fix it before reporting done.

**On second pass (CEO reported a bug):** Manual browser testing is REQUIRED, no exceptions. If the CEO said something is broken and you are fixing it:
- Run Playwright
- Take screenshots
- Read the screenshots
- Confirm visually that the fix works
- Include the screenshot confirmation in your report

Reporting "fixed" without running the browser after a CEO-reported bug is a policy violation.

---

## Playwright Safety Rule: No Unintercepted Mutations Against Live Applications

**Critical rule discovered via production incident (2026-04-18):**

Playwright tests running against a live application MUST intercept all mutating API calls via `page.route()` or target an isolated server on a separate port. **Never make unintercepted real-server POST/PATCH/DELETE calls from a Playwright test suite when the live application is also running against that server.**

**Why:** Unintercepted mutations from tests mutate shared production state (files, relay targets, relay delivery, database records) while the CEO or users are interacting with the app. This causes unexpected side effects, cross-contamination, and is nearly impossible to debug.

**Examples of violations:**
- ❌ Test POSTing audio to `localhost:3030/transcribe` while the Electron app is running and also using `localhost:3030`
- ❌ Test updating relay targets in shared state while CEO is testing voice
- ❌ Test writing files that the app depends on without isolation

**How to fix:**
1. **Option A (preferred):** Run your test suite against an isolated server on a different port (e.g., integration tests on port 13031 while live app uses 3030)
2. **Option B:** Intercept all mutations via `page.route()` and return mock responses
3. **Option C:** Run tests only when the live app is NOT running (e.g., during build-time gates, not during local development)

**This rule applies to all Playwright test suites.** If you are uncertain whether your test might mutate shared state, err on the side of isolation or interception.

---

## WHAT "DONE" MEANS

Done means **all six** of these are true:

1. **Code written** — the implementation exists
2. **Static checks pass** — typecheck clean, lint clean, build succeeds
3. **Unit tests pass** — if the changed code has unit tests, they run green
4. **Real-world verification** — at least one of the following, with command output captured:
   - **HTTP endpoint** → `curl` against the running service, showing actual status code and body
   - **UI component** → Playwright test that clicks through the user flow, or a build-and-launch on a real device with a screenshot
   - **CLI tool** → invoke the tool with realistic input, show the output
   - **Background daemon** → start it, hit it, show the response
5. **Manual browser test passed (UI work)** — Playwright run with screenshot, screenshot read with the Read tool, visual confirmation that the feature renders correctly. Non-UI work is exempt from this step.
6. **Report includes evidence** — the completion message cites the actual command run and the actual output

**Only step 1 + 2 + 3 = half done.** Those prove the code compiles and unit logic is correct. They do not prove the system works end-to-end. They do not catch integration regressions, config drift, wrong port, wrong Content-Type, stale cached build, silent swallowing of errors, or "works on dev but not in production mode."

---

## WHO DOES WHAT (Roles)

### Team Leads
- **Write specs BEFORE spawning coders.** `specs/{feature}.spec.md` with requirements, acceptance criteria, and a **test plan** (explicit list of what will be verified and how).
- **Spawn a `test-writer` for non-trivial features** — tests should exist before the coder reports done, not after.
- **Spawn a `tester` to run the test suite** after the coder commits. You do not ask coders "did you test it?" and trust the answer. You verify.
- **Refuse completion reports that don't include test output.** If a coder reports done without showing verification, send them back.
- **Write this rule into every coder spawn prompt.** The coder must be told explicitly in their prompt: "Verify with real commands. Show the output in your report."

### Coders
- **Run the tests yourself before reporting done.** Do not ask someone else to check your work.
- **Include actual command output in your completion report.** Not "tests pass" — paste the last line of the test output, the HTTP status code, the Playwright result.
- **If you can't verify because the environment isn't set up, STOP and say so.** Do not report done with "I believe it works."
- **If the task is a bug fix, reproduce the bug first.** Write a failing test, then make it pass. A fix with no regression test is not a fix — the bug will come back.

### Test Writers
- **Write the test from the spec, not from the implementation.** Tests derived from implementation only test that the code does what the code does — which is useless. Tests from the spec verify the requirement.
- **Every bug fix gets a regression test.** No exceptions. If a bug was caught in production, it means no test covered that path. The fix includes the missing test.
- **Prefer integration/E2E tests over pure unit tests for user-facing features.** Unit tests are great for pure functions. They are not great for "does the UI actually show the message." Playwright is mandatory for any interactive flow.

### Testers
- **Run the suite. Report actual output.** You are not there to judge whether the tests are good — you run them and tell the team the result.
- **Flag tests that pass trivially** — a test that imports nothing real, mocks everything, and asserts `true === true` should be called out.
- **Flag tests that the CI/local environment cannot run** — if a test requires a running server, a real device, or a missing env var, it is not actually running in the pipeline.

### Spec Writers
- **Every spec includes a Test Plan section.** Not optional.
- **The test plan enumerates which test types cover which acceptance criteria.** Example: "AC-3 (upload accepts PNG) — covered by `attachments.e2e.ts::uploadPNG`."
- **If the spec says "user can X" and there is no Playwright or curl test verifying "user can X", the spec is incomplete.**

---

## TEST TYPES AND MINIMUM BAR

| Layer | Tool | When Required | Owner |
|---|---|---|---|
| Typecheck | `tsc --noEmit` | Every commit | Coder |
| Lint | ESLint / project linter | Every commit | Coder |
| Unit | `bun test` / `vitest` / `jest` | Pure functions, business logic, data transforms | Coder + test-writer |
| Integration | Real HTTP via `curl` / Bun `fetch` | Every HTTP endpoint, every relay path, every protocol handler | Coder + test-writer |
| E2E (UI) | Playwright | Every user-interactive screen, every critical flow | test-writer + tester |
| Smoke (CLI) | Shell script, real invocation | Every CLI tool | Coder |
| Manual (CEO) | CEO taps around on the device | ONLY for pure aesthetic/UX judgment calls that automation cannot evaluate | CEO |

**Minimum bar for declaring done:**
- **HTTP endpoint changed** → at least one `curl` command with captured output
- **UI component changed** → at least one Playwright test, OR a device screenshot if Playwright isn't set up yet (and you must note the gap)
- **Relay protocol changed** → an integration test that round-trips a real message through the real relay
- **Data pipeline changed** → input data in, transformed data out, compared against expected

---

## WHAT CEO SHOULD NEVER HAVE TO CATCH

CEO should not be the test suite. The following classes of bugs must be caught by automation BEFORE a report reaches the CEO:

- ❌ HTTP endpoint returns wrong status code (catchable by `curl`)
- ❌ Endpoint returns wrong Content-Type (catchable by `curl -I`)
- ❌ Request body not parsed (catchable by `curl` with a real body)
- ❌ Case sensitivity mismatch in a filter (catchable by a unit test on the filter)
- ❌ Component doesn't update when data changes (catchable by Playwright)
- ❌ Message not shown when received (catchable by Playwright with a WS mock)
- ❌ File upload silently fails (catchable by `curl -F`)
- ❌ Config hardcoded to the wrong port (catchable by integration test)
- ❌ Button does nothing when clicked (catchable by Playwright)
- ❌ Dead code path nobody calls (catchable by code-reviewer + grep)

**CEO testing is appropriate ONLY for:**
- ✅ "Does this UI feel right?" — aesthetic, pacing, information density
- ✅ "Is this the right UX?" — subjective workflow judgment
- ✅ "Is this actually the priority?" — product direction
- ✅ Final pre-ship smoke test on real hardware

If a bug the CEO caught is in the ❌ list above, the team that shipped it **must** write a postmortem entry in `PROBLEM-LOG.md` AND write the missing test before any other work continues.

---

## SPECIFIC RULES FOR COMMON BUG CLASSES

### HTTP / Relay bugs
- **Minimum test:** `curl -sS -w "\n%{http_code}\n" <endpoint>` — captures body + status code
- **Every endpoint** must have at least one success-case and one error-case integration test
- **Every Content-Type branch** must be tested — you do not trust "it should accept image/*" without proving it
- **Every port** must be configurable in tests — hardcoded port = test drift the moment config changes

### UI / mobile bugs
- **Minimum test:** Playwright spec that mounts the component and verifies the user-visible behavior
- **Every piece of state that drives rendering** must have a test that changes the state and asserts the render updates
- **Every derived value** (selectors, `useMemo`, hooks) must have a test with a stable reference test — show that the hook returns equal output for equal input
- **Case normalization, date formatting, locale, timezone** — always tested explicitly, never "it seems to work"

### Domain/store refactors
- **Before merging a refactor, prove the new layer is wired.** Grep for callsites. Show that the new hook/store is subscribed to by at least one rendering component. Untested orphan architecture is worse than no architecture.
- **Dual-write period** — if migrating from old to new, keep old running until new is verified, then delete old in a follow-up commit. Do not delete old and hope the new one works.

### Protocol bugs (message-passing, serialization)
- **Round-trip test is mandatory.** Write the message, send it, receive it, compare. This catches ID drift, case mismatch, field renames, encoding issues.
- **Cross-runtime test** if the protocol crosses runtime boundaries (Bun ↔ Node, TS ↔ Swift). One bug class we've seen: `ECONNREFUSED` vs `ConnectionRefused` naming mismatch.

---

## COMPLETION REPORT TEMPLATE

Every coder completion report must use this structure:

```
DONE — {one sentence: what was done}

Files touched:
- path/to/file1.ts
- path/to/file2.ts

Verification:
- Typecheck: {actual command} → {result, e.g. "clean"}
- Unit tests: {actual command} → {result, e.g. "12/12 pass"}
- Integration: {actual command} → {result, e.g. "curl ... → 201"}
- E2E: {actual command or "N/A — gap noted: no Playwright coverage"}

Gaps / follow-ups (if any):
- {anything that isn't covered and should be}
```

**If any line under "Verification" says "I believe" or "should work" or "looks correct" — the report is REJECTED. Send it back.**

---

## WARNINGS TO TEAM LEADS (you, specifically)

- **You are the firewall between coders and the CEO.** If a coder reports done and you relay that to the CEO without verifying, **you** are the bug. Verify first.
- **"The coder said it's done" is not evidence.** Demand the command output.
- **You do not code, but you do run tests.** `bun test`, `npx tsc --noEmit`, `curl`, `pnpm playwright test` — these are TEAM LEAD commands. Run them yourself before reporting to CEO if you have to.
- **You are judged by how few bugs reach the CEO.** Every bug the CEO catches that automation could have caught is a black mark on your pipeline. Fix the pipeline, not just the bug.
- **The urge to skip testing happens when you're tired or pressured.** That's exactly when you must not skip. The cost of shipping a bug is always higher than the cost of running the test.

---

## WARNINGS TO CODERS

- **"Tests pass" without showing output is a lie by omission.** Paste the output. If you didn't run them, say you didn't run them.
- **If the test environment isn't set up, STOP and say so.** Do not report done with "I couldn't run the integration test because the relay wasn't running." That means the work is not done — either set up the environment or escalate.
- **Every bug fix writes a regression test FIRST.** Red → green → refactor. Not "I fixed it, now I'm done."
- **A one-line fix is not exempt.** Every fix has a test. Especially one-liners, which are exactly the class of fix that comes back.
- **If you notice something in an adjacent area that's also broken, FLAG IT.** Don't fix silently, don't ignore it. A relay message to your team lead saying "I noticed X is also broken" is how quality compounds.

---

## ESCALATION

If any of the following is true, escalate to your team lead or the CEO:

- You cannot write a test for this change. (Why not? Usually means the code isn't testable — that's a refactor need.)
- The test environment is broken. (Don't work around it — fix it or flag it.)
- Existing tests are trivially-passing fakes and you can see they don't actually verify anything. (Write real ones.)
- A refactor left orphan code. (Wire it up or delete it.)

---

## THIS RULE IS ENFORCED

**Repeat violations will result in the offending agent or team being retired.** The CEO has been clear: the system must not waste the CEO's attention on bugs that automation could catch. Every team lead and coder is expected to internalize this rule and enforce it up and down their team.

**The single most important sentence in this document:**

> **Never report done to the CEO without having run a real test and shown the output.**

---

## Known Playwright Traps

### 1. `overflow:hidden` + transparent background → `toBeVisible()` false negative

**Problem:** If a container element (e.g. overlay `body`) uses `overflow: hidden` and a transparent background, Playwright's `toBeVisible()` check returns false even when the element is logically present and its children are rendering correctly.

**Fix:** Assert a child element's visibility or use count-based checks:
```ts
// Wrong — fails on overflow:hidden + transparent bg
await expect(page.locator('body')).toBeVisible()

// Correct — assert the root mount point exists
await expect(page.locator('#overlay-root')).toHaveCount(1)
// Or assert a visible child
await expect(page.locator('text=expected content')).toBeVisible()
```

**Origin:** `src/renderer/tests/tts-playback.pw.ts` — overlay body has `overflow:hidden` + transparent bg by design (click-through window). `toBeVisible()` was replaced with `#overlay-root` count assertion.

---

### 2. Headless Chrome rejects mock streams on native `MediaRecorder`

**Problem:** When `navigator.mediaDevices.getUserMedia` is mocked to return a fake stream object, native `MediaRecorder` construction throws in headless Chrome because the stream lacks proper audio track internals. This means any code path gated on `new MediaRecorder(stream)` never runs, and UI state changes (like disabling the record button) never fire.

**Fix:** Inject a full fake `MediaRecorder` class via `page.addInitScript` using `Reflect.set`:
```ts
await page.addInitScript(() => {
  const fakeTrack = { stop(): void {} }
  const fakeStream = {
    getTracks(): typeof[] { return [fakeTrack] },
    getAudioTracks(): typeof[] { return [fakeTrack] },
  }
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: async (): Promise<typeof fakeStream> => fakeStream },
    writable: true,
    configurable: true,
  })

  class FakeMediaRecorder extends EventTarget {
    static isTypeSupported(_mime: string): boolean { return true }
    mimeType = 'audio/webm'
    state: 'inactive' | 'recording' | 'paused' = 'inactive'
    start(): void { this.state = 'recording' }
    stop(): void {
      this.state = 'inactive'
      this.dispatchEvent(new Event('stop'))
    }
    addEventListener(type: string, cb: EventListenerOrEventListenerObject): void {
      super.addEventListener(type, cb)
    }
  }
  Reflect.set(window, 'MediaRecorder', FakeMediaRecorder)
})
```

**Reference implementation:** `tests/ui/voice-session-flow.pw.ts` — "record button is disabled while recording is in progress" test.

**Why `Reflect.set` not `window.MediaRecorder =`?** The `consistent-type-assertions` ESLint rule (`@typescript-eslint/consistent-type-assertions`) forbids `(window as any).MediaRecorder = ...`. `Reflect.set` achieves the same result without a type assertion bypass.
