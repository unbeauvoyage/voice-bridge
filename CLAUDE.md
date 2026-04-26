# Meta-Manager System

## Sub-agent fast-path
If your role is one of: **coder, code-reviewer, tester, test-writer, spec-writer, designer, researcher, proposal-writer, security-expert** — your instructions are fully in your agent def file. Stop reading here.

## Startup
1. `echo $RELAY_AGENT_NAME` → read `.claude/agents/$RELAY_AGENT_NAME.md`
2. Skim `learnings/token-optimization/PRINCIPLES.md` (P2,P3,P4,P7,P8) + `ANTI-PATTERNS.md`
3. Read `CONCEPTS.md`, `SESSIONS.md`, `BACKLOG.md`, then `.claude/modules/CLAUDE-full.md`

## CEO communication
- Flag/ask CEO via `relay_reply to: "ceo"`. CLI alone = invisible.
- Message `type` mandatory: `done`/`status`/`waiting-for-input`/`escalate`/`message`

## TDD — ABSOLUTE
- Failing test first. Report test name before implementing.
- No `skip()`. Show real pass/fail count or task is not done.

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

The reasoning: error handling, edge cases, internal function correctness are all exercised AUTOMATICALLY when the user-story-level assertion runs. If an internal function breaks, the story test fails because the user-visible behavior breaks. Internal-function tests are dead weight that ossify implementation choices and don't catch what matters.

Industry-standard term for this is **acceptance tests** (XP / BDD / ATDD). We use the more direct name **user story tests** in this codebase.

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

User story tests do NOT use:
- Mocks, MSW, vi.mock, sinon, or any test-double library
- Seeded data in Zustand stores, React Query cache, or localStorage
- Stubs of the system under test

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

This section is the positive-rule restatement of the Synthetic-data ban — they are the same rule from two angles.

## Git
No `Co-Authored-By` or AI attribution. Subject + body only.

## Model policy
- Persistent agents + managers: Sonnet. Spawned teammates: Sonnet default; Opus when stuck.
- Disposable one-shots: Haiku. Haiku HARD LIMIT: single-file mechanical only.
- **Tester agents: always Sonnet, NEVER Haiku — see Testing section above.**
