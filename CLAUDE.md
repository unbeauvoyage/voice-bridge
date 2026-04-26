# Meta-Manager System

## Sub-agent fast-path
If your role is one of: **coder, code-reviewer, tester, test-writer, spec-writer, designer, researcher, proposal-writer, security-expert** — your instructions are fully in your agent def file. Stop reading here.

## Startup
1. `echo $RELAY_AGENT_NAME` → read `.claude/agents/$RELAY_AGENT_NAME.md`
2. Skim `learnings/token-optimization/PRINCIPLES.md` (P2,P3,P4,P7,P8) + `ANTI-PATTERNS.md`
3. Read `CONCEPTS.md`, `SESSIONS.md`, `BACKLOG.md`, then `.claude/modules/CLAUDE-full.md`
4. **Read your handoff pointer** (see "Handoff convention" below).

## Handoff convention
- **Per-project session** (productivitesse, relay, knowledge-base, ...): read
  `<project-root>/handoffs/LATEST.md`.
- **Cross-project session** (chief-of-staff, agency-lead): read
  `~/environment/handoffs/LATEST-for-{your-role}.md`.
- **Decisions and conventions** (timeless): `~/environment/decisions/`.
- **`.worklog/`** is a per-agent rolling diary, not a handoff — different
  artifact. Keep using it.
- **Legacy: `~/.claude/plans/`** is read-only archive. Do not write there.
- Full convention: `~/environment/decisions/handoff-convention.md`.
- The CEO says "write a handoff" → write the handoff in the right scope folder
  and update the relevant LATEST pointer. CEO says "continue" / "resume" →
  read your role's LATEST pointer first.

## CEO communication
- Flag/ask CEO via `relay_reply to: "ceo"`. CLI alone = invisible.
- Message `type` mandatory: `done`/`status`/`waiting-for-input`/`escalate`/`message`

## TDD — ABSOLUTE
- Failing test first. Report test name before implementing.
- No `skip()`. Show real pass/fail count or task is not done.

## Verification — ABSOLUTE
Every code change must be **exercised as a user before reporting done**. This is separate from a permanent test suite — it's the human verification step automated.

- **UI changes (React/TS apps):** drive Playwright programmatically (not a saved spec). Open the page, perform the user action, screenshot the result, and read the screenshot back to confirm it looks right. Paste the page URL + screenshot path in the completion report.
- **Backend / data changes:** curl the endpoint, parse the response, show the actual JSON (not "it works").
- **CLI / script changes:** run the script with a representative input, show stdout/stderr.

A coder may spawn a **Sonnet** (not Haiku) verifier sub-agent for UI verification they can't do inline. Haiku cannot reliably drive Playwright. The verifier returns PASS/FAIL with evidence. The coder is still responsible for the result.

"Tests pass" without artifact is rejected. "I believe it works" is rejected. "TypeScript clean" is necessary but not sufficient — type-correct code can be visually broken or behaviorally wrong.

### Mandatory artifact shape

Every verification claim must reference a literal value copied from the task. The phrase pattern is:

> "I verified the user can see `<literal>` at `<URL>` after `<action>`."

If `<literal>` is a placeholder, the verification is invalid. If `<URL>` is "the app loads," it is invalid unless the bug was about the landing page. If `<action>` is "navigate to home," it is invalid unless the bug was about navigation.

### Synthetic-data ban (relay-backed projects)

For projects that consume data from the relay (productivitesse, knowledge-base, voice-bridge2): you may not pass UI verification by injecting data into the client-side store, MSW, or localStorage. Data must originate from the actual relay process at the participant/key named in the task. Empty backend = stop and report `BLOCKED — preconditions absent`, never seed-and-self-verify.

### Negative control rule

Any UI assertion that gates "done" must be paired with one negative-control run that proves the assertion can fail. If you cannot make it fail by changing the expected string, your selector is wrong and the green run is meaningless.

## Real-time visibility (NEW — CEO directive 2026-04-26)

Every progress message you send (mid-work, end-of-task, escalation) MUST include:

- **Files I'm currently editing**: absolute paths, one per line. The CEO opens these in VSCode to follow along live.
- **Worktree path**: absolute path to the git worktree. (If editing the live tree directly because no worktree, say so explicitly.)
- **Merge status**: one of `worktree-only` | `committed-not-pushed` | `pushed-not-merged` | `merged-to-dev` | `merged-to-main`.
- **Branch name**: explicitly named.
- **What I'm doing right now**: one sentence in present-continuous tense ("Editing useMessages.ts to delete the cast at line 56", not "I'll fix the cast").

Pattern at the top of every message:

> WORKING ON
>   Files:    /absolute/path/file1.ts, /absolute/path/file2.ts
>   Worktree: /absolute/path/to/worktree (or "live tree, no worktree")
>   Branch:   feature-branch-name
>   Status:   worktree-only | committed-not-pushed | merged-to-dev | ...
>   Now:     <one sentence in present continuous>

Coders + team-leads + reviewers all use this. CEO's VSCode is open watching these files; if you don't disclose them, the CEO is flying blind.

## Platform priority (NEW — CEO directive 2026-04-26)

**Web is the canonical platform.** Every feature is implemented and verified on web FIRST. Capacitor (iOS) and Electron (desktop) variants strive for 100% feature parity with the web version. Web is the source of truth — never the other way around.

If you are tempted to implement a feature directly on iOS or Electron because "the API is easier there," stop. Implement on web first via the PlatformAPI abstraction, then provide platform-specific adapters.

## Testing model + scope (NEW — CEO directive 2026-04-26)

- **Tester agents are always Sonnet, never Haiku.** Haiku has demonstrated test-result fabrication. When spawning a tester, the spawn call MUST set `model: "sonnet"` explicitly.
- **User story tests are committed alongside the features they cover** at `<project>/tests/stories/<page-or-feature>/`. Never write tests to `/tmp` or other temporary locations — they must be reusable and version-controlled. (See "User story tests" section below for full format.)
- **Tests are written in sync with implementation**, not retrofitted. The coder writes a failing test before the implementation, the tester runs it as soon as the coder's worktree is ready.

## User story tests (the only kind of test we write) (NEW — CEO directive 2026-04-26)

We test USER STORIES, not functions. A user story test simulates one specific thing a real user does end-to-end and verifies the user-visible outcome. We do NOT write unit tests, we do NOT mock the system under test, we do NOT test internal functions in isolation.

**The bar (CEO directive 2026-04-26):** A passing user-story test must be PROOF that the user story works in production. Not "high confidence" — proof. If a test is green and the user story is broken, the test is insufficient and that is a defect in the test.

**Count rule:** The number of tests equals the number of user stories. One test per story, no more. We do NOT write contract tests, smoke tests, key-shape assertions, type-narrowness checks, or coverage-gap patches. If a code path needs coverage, write the user story for it — never patch it with a side-channel test.

**Mechanical gating:** No commit lands without its user-story test proven passing. The pre-commit hook runs the relevant story-test suite against real services; failing tests block the commit. Chief-of-staff owns enforcement.

The reasoning: error handling, edge cases, internal function correctness are all exercised AUTOMATICALLY when the user-story-level assertion runs. If an internal function breaks, the story test fails because the user-visible behavior breaks. Internal-function tests are dead weight that ossify implementation choices and don't catch what matters.

Industry-standard term for this is **acceptance tests** (XP / BDD / ATDD). We use the more direct name **user story tests** in this codebase.

**On adoption of this rule**: every project (ceo-app, relay, knowledge-base, voice-bridge2, productivitesse — all of them) must do a one-time **user-story-test cleanup sweep** of its existing test files and delete any test that does not match the user-story-test definition above. This is a permanent commitment — we never write or keep non-story tests again. Phase definitions for the agency-wide strict-contracts initiative live in `~/environment/decisions/strict-contracts.md` (the cleanup sweep is one of the phases there).

### Format

Path: `<project>/tests/stories/<page-or-feature>/<scenario>.story.ts`

Each `.story.ts` file documents a single user story, written so a non-technical reader can understand what it proves:

```ts
test('CEO sends a text message to chief-of-staff from the voice page', async ({ page }) => {
  // Given the real relay is up and chief-of-staff is a real connected agent
  // And I am on the voice page in a real browser
  // When I type "hello chief" and press Enter
  // Then the message appears in the thread within 5 seconds
  // And GET /api/messages?participant=chief-of-staff returns the literal "hello chief"
})
```

The test NAME states the user story. The comments inside frame it as Given/When/Then for clarity. The test BODY uses real services with real assertions on real outputs.

### Real services only — no fakes

User story tests spin up:
- Real backend (project-specific entry — `bun run src/index.ts` for relay, others vary; check package.json `scripts`)
- Real frontend (`npm run dev` is typical; confirm per project)
- Real database (separate dev instance — never production)
- Real browser via Playwright (note: each project's `playwright.config.ts` must include `**/*.story.ts` in `testMatch` — the default Playwright config does not match `.story.ts`)

**The principle: no mocks of the System Under Test (SUT).** Whatever the test is verifying must actually run. A test that mocks the SUT only proves the mock works.

User story tests therefore do NOT use:
- Test-double libraries (MSW, vi.mock, sinon, etc.) when the doubled component IS the SUT
- Seeded data in Zustand stores, React Query cache, or localStorage to fake what the SUT should produce
- Stubs of any system the test is actually verifying

The SUT depends on what's being tested. Concretely:
- Test that the relay routes a message → relay is the SUT (real backend, real WS, real DB; do NOT mock those)
- Test that an LLM-summary feature shows a useful summary → LLM is the SUT (real LLM call required, no mock)
- Test prompt-construction logic in isolation → LLM is a DEPENDENCY, not the SUT — but you should not write this test in this codebase at all (it's an internal-function test). Instead, write a user story test like "user requests summary, observes correctness" where the LLM is the SUT.

If a test's natural framing requires mocking what it's supposed to verify, the test is wrong-shape. Re-frame it as a user story.

If preconditions are missing (relay down, no agents) → report `BLOCKED — preconditions absent` and stop. NEVER seed-and-self-verify.

### Organization

Tests are organized to match how a real user (or QA tester) walks through the app:

- **Page-based by default**: one folder per page, multiple stories per folder covering every user-reachable interaction on that page (every button, every input, every flow).
- **Feature-based for cross-cutting stories** that span multiple pages (notifications fire from any page, connection status visible across pages).

Examples:
```
tests/stories/voice-page/send-text.story.ts        ← interaction available on /voice
tests/stories/voice-page/send-voice.story.ts
tests/stories/voice-page/attach-image.story.ts
tests/stories/inbox-page/triage-needs-input.story.ts
tests/stories/chat-page/raw-jsonl-toggle.story.ts
tests/stories/notifications/fires-on-incoming-message.story.ts
tests/stories/connection-mode/switch-tailscale-to-lan.story.ts
```

### What this replaces (no spec files needed)

We do NOT maintain separate SPEC.md files for features. The user story tests ARE the spec. Reading the test file tells you (a) what the feature does, (b) what the acceptance criteria are, (c) whether it works.

### Negative control still applies

Per the verification rules above: every story test must be paired with at least one assertion you've proven CAN fail (assert wrong literal first, confirm RED, then revert). A test that has only ever been seen GREEN is not a verified test.

### What we explicitly do NOT write

- Unit tests of internal functions or hooks (dead weight, ossifies implementation)
- Mocked tests (proves only that the mock works)
- Snapshot tests (false sense of coverage)
- Tests that import from internal modules to test them in isolation

### Existing non-user-story tests must be deleted

Any test in this repo that does NOT exercise a real user story is dead weight and gets deleted. Specifically delete:

- Any `*.test.ts` / `*.spec.ts` that imports an internal module to call its functions directly (unit-style)
- Any test that uses mocks, MSW, vi.mock, or any test-double library
- Any test that asserts "given input X, function Y returns Z" (input/output assertions on internal functions)
- Any test in a worktree-only `/tmp/` location that wasn't promoted to `tests/stories/`
- Any snapshot test
- Any "smoke test" that doesn't simulate a real user action

Verbatim CEO framing: "we are just automating what a developer would manually test with his eyes." If a test doesn't simulate something a developer would actually click/type/observe in a browser (or curl, for backends), it goes.

**Backend equivalent**: For backend services (relay, knowledge-base server), the "user" is an API client. A user story test for a backend looks like: "When an API client POSTs `{from:'ceo', to:'X', body:'Y'}` to `/api/messages`, the relay returns 200 and the message is delivered to X's WebSocket subscriber." Real curl, real handler, real WS subscriber. NOT "calling deliverTo() with mock arguments and asserting the return value."

This section is the positive-rule restatement of the Synthetic-data ban — they are the same rule from two angles.

## Git
No `Co-Authored-By` or AI attribution. Subject + body only.

## Branch policy (NEW — CEO directive 2026-04-26)
- **`dev` is the canonical CEO development branch** in every project. CEO uses `dev`; agents work in feature/fix/infra branches.
- **Team-leads (and chief-of-staff) merge verified work into `dev`**, never directly into `main`. "Verified" means: passing user-story tests via the mechanical gate AND adversarial code review by a separate Opus reviewer.
- **Agents do not merge to `dev` themselves.** They commit to feature branches; team-leads decide when to promote.
- Every project must have a `dev` branch. If a project lacks one, create it from the canonical local main and document the convention.
- **Promotion `dev` → `main`** is a separate decision the CEO owns; agents don't initiate it.

## Sub-agent spawn policy
- **Prefer `TeamCreate` + named teammates over raw `Agent` spawns.** TeamCreate gives you persistent named teammates (addressable via `SendMessage to: <name>`) with a shared task list and peer visibility. Raw `Agent` spawns are fire-and-forget — once they exit you cannot resume them mid-session, only re-spawn fresh. Use `TeamCreate` for any workstream involving (a) multiple coders touching related work, (b) longer than a single round-trip, or (c) work where you might want to interrupt or course-correct. Reserve raw `Agent` spawns for one-shot independent reads (e.g., a single research pass) where mid-session interaction is not needed.
- **Always pass `run_in_background: true` to the Agent tool.** Never block on a spawned subagent — you'll be notified when it finishes.
- **Never spawn `team-lead` or `agency-lead`.** Those are session-start roles. The harness enforces this via a PreToolUse hook (`~/environment/.claude/hooks/agent-spawn-guard.sh`), but you should not attempt it in the first place.
- If you ARE the team-lead/agency-lead, spawn coders / designers / test-writers / etc. directly into your team. No middleman.

## Hooks wiring (NEW — CEO directive 2026-04-26)

The testing-gate hooks (`testing-gate/on-code-edit.sh`, `on-bash.sh`, `stop-gate.sh`) only fire if the `hooks` block is present in the active settings file.

`~/environment/.claude/settings.json` (committed) wires the hooks correctly. **BUT** if a user/agent has their own `~/environment/.claude/settings.local.json` with ANY `hooks` block, that block REPLACES the global one (Claude Code does NOT deep-merge; it object-replaces at top level).

If you create or edit `settings.local.json` for any reason, you MUST include the full `hooks` block from `settings.json` (or omit `hooks` entirely from your local file to inherit the global). Otherwise the testing-gate stops firing for your session and "tests pass" claims become unverifiable theater.

If hooks aren't firing in your session, run `cat ~/environment/.claude/settings.local.json | jq .hooks` — if it's null or absent, you're inheriting global. If it's defined but missing the `PreToolUse|PostToolUse|Stop` testing-gate keys, that's the bug.

## settings.local.json gotcha — READ THIS BEFORE TOUCHING settings (NEW — CEO directive 2026-04-26)

Claude Code does NOT deep-merge `settings.json` and `settings.local.json`. The local file REPLACES the global file's `hooks` key entirely (top-level object replacement, not key-by-key merge). Concrete failure mode: a user with their own `~/environment/.claude/settings.local.json` from before the testing-gate wiring landed will have NO hooks fire — the gate is silently bypassed for that user.

**If you have a `~/environment/.claude/settings.local.json`, you MUST include the same `hooks` block from `settings.json` in it (or remove the `hooks` key from your local entirely so it falls through to global). Otherwise the testing gate doesn't fire for you.** The committed `settings.json` is the single source of truth for the hooks block. Copy it verbatim into your local override if you keep one.

A future task (filed as a follow-up phase in `~/environment/decisions/strict-contracts.md`) will move the hook enforcement to a wrapper script that fires regardless of settings.local.json — until then, every user is responsible for keeping their local file in sync.

## Model policy
- Persistent agents + managers: Sonnet. Spawned teammates: Sonnet default; Opus when stuck.
- Disposable one-shots: Haiku. Haiku HARD LIMIT: single-file mechanical only.
- **Tester agents: always Sonnet, NEVER Haiku — see Testing section above.**
