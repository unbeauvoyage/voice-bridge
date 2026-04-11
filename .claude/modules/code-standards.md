# AI-Optimized Code Standards

Every project team lead and coder MUST follow these standards. They exist because AI agents re-read the codebase from scratch each session — poor structure compounds into wasted tokens every time.

---

## Rule 1: Feature-Based Folder Structure

Organize by **what the code does**, not what pattern it implements.

**Do:**
```
features/
  voice-recording/
    components/
    hooks/
    store.ts      ← feature-specific Zustand slice
    api.ts        ← relay/network calls for this feature
    types.ts
  notifications/
    ...
```

**Don't:**
```
components/   ← all components regardless of domain
hooks/        ← all hooks regardless of domain
stores/       ← all stores regardless of domain
```

**Why:** Grep/Glob returns exactly one folder for a feature. Agent reads only what it needs.

---

## Rule 2: State Management — Slices in Features, Root Combines

- Each feature owns its Zustand slice: `feature/store.ts`
- Root `store/index.ts` composes slices — kept thin, rarely edited
- No monolithic god-store mixing unrelated concerns

**Why:** Agent working on voice recording reads `voice-recording/store.ts`. It doesn't need to parse 300 lines of unrelated state.

---

## Rule 3: File Naming — Behavior First

Name files after **what they do**, not what pattern they are.

| Bad | Good |
|-----|------|
| `service3.ts` | `sendRelayMessage.ts` |
| `hook.ts` | `useVoiceRecorder.ts` |
| `util.ts` | `markdownUtil.ts` |
| `index.ts` (re-export barrel) | avoid unless at feature root |

- Components: noun (`MessageCard.tsx`, `ProposalPanel.tsx`)
- Hooks: `use` + behavior (`useAgentStatus.ts`)
- API/actions: verb + noun (`sendMessage.ts`, `fetchProposals.ts`)
- Stores: feature + `Store` (`voiceStore.ts`, `notificationStore.ts`)

**Why:** The agent's first Glob/Grep hits the right file. No excavation needed.

---

## Rule 4: Avoid Barrel Index Files

Re-export index files (`index.ts` that just re-exports) force the agent to read the index AND follow every export. Skip them unless at a feature root to expose a public API.

**Exception:** `features/shared/index.ts` to expose cross-feature utilities is fine.

---

## Rule 5: Co-locate What Changes Together

If feature A's bug requires editing 5 different folders, the structure is wrong. Ask: "If I need to change X, how many top-level folders do I touch?" The answer should be 1-2.

- API call + its types + its store slice + its UI → all in the same feature folder
- Platform adapters that belong to a feature → `feature/platform/`

---

## Rule 6: Keep Files Focused

Files over ~300 lines in a component or ~500 lines in a page are a signal to split. Large files burn tokens even when the agent only needed 10 lines.

- Monolithic pages → extract sub-components by responsibility
- Monolithic stores → decompose into feature slices
- Monolithic utility files → split by behavior domain

---

---

## Rule 7: Tests Are Specs — Not Coverage Theater

**Every feature ships with tests that describe what the feature does. Tests are the living spec — coders and testers read them to understand intent.**

### Integration and E2E first — unit tests are a distant second

In an LLM-assisted codebase, failures are integration failures — wrong shape sent to the relay, wrong adapter loaded silently, network error crashing instead of degrading. Unit tests on individual functions don't catch these. Integration and E2E tests do.

**Priority order:**
1. **E2E tests (Playwright)** — simulate real user actions against the running app. Catch wiring failures that no unit test can see.
2. **Integration tests (Vitest + fetch)** — verify contracts between components: relay endpoint shapes, permission lifecycle, store transitions under real inputs.
3. **Silent-failure guards (Vitest)** — the only unit tests worth writing: things that degrade invisibly without a test.

### What to test

| Category | Priority | Examples |
|---|---|---|
| **E2E user flows** | High | User taps send → message arrives; permission approved → agent unblocks |
| **Integration contracts** | High | `/status` shape guard, permission lifecycle end-to-end, fetch error → `[]` |
| **Silent-failure guards** | Medium | Platform adapter unavailable → doesn't crash; MIME fallback → never `undefined` |

### What NOT to test

- Pure functions with no branching logic (trivially verifiable by reading)
- UI rendering, CSS, label text
- Third-party library internals (Zustand, React Router, Capacitor)
- Getters and derived state with no transformation logic

### Test file rules

1. **Comment block at the top** — what this file guards and what silent failure it prevents
2. **Descriptions read as specs** — `it('returns [] when agents field is missing in /status response')` — no one-word test names like `it('works')`
3. **Mock at boundaries** — mock `fetch()` and `window` globals; never mock internal module functions
4. **One test file per feature domain** — co-located at `feature/__tests__/name.test.ts`
5. **Playwright for user flows** — `tests/ui/*.spec.ts` for anything that simulates a user action

### Mandatory: spec directs the coder — not the other way around

**Spec-writer runs first. Coder and tester both work from the spec. Team lead never writes either.**

The workflow:
1. Requirement arrives → team lead assigns coder + tester
2. **Coder writes `specs/feature-name.md` first** — as a planning document for itself before writing any code
3. Coder implements against its own spec
4. Tester reads same spec → writes and runs tests against it
5. Both aligned to one document, working independently. No verbal handoff needed.

**Why the coder writes the spec:** The coder uses it to plan what they're about to build — thinking through inputs, outputs, and edge cases before touching any code. It's self-direction, not documentation. The tester then picks up the same file as their input.

**When to use a dedicated spec-writer:** Complex or ambiguous features where design needs dedicated thought before a coder starts. For standard features, coder owns both.

**Testers must refuse verbal-only test requests.** If told "test X" without a spec file, ask for the spec first. The spec is the input artifact — not a message.

### Mandatory: every new feature ships with a spec and tests

**Reviewers enforce this.** No PR merges to `dev` without:
- A spec file in `specs/` describing the feature behavior
- At least one test that exercises the described behavior

If either is missing, the reviewer blocks the merge.

### Mandatory: Codex review on every feature before merge

**Every implementation must pass both a standard review AND an adversarial review before merging to `dev`.**

This is non-negotiable. The adversarial reviewer's job is to challenge decisions, surface failure modes, and question tradeoffs the coder didn't consider. It catches what a friendly reviewer misses.

**Standard review flow (after coder reports done):**

1. **`code-reviewer` agent** — reads implementation against spec, checks for bugs, security issues, missing tests
2. **Codex adversarial review** — challenges the design, surfaces failure modes, questions assumptions

**How to run Codex reviews:**

In interactive sessions (team leads with a terminal):
```
/codex:review          — standard review pass
/codex:adversarial-review   — challenge mode: questions decisions, tradeoffs, failure modes
```

In non-interactive sessions (coders, `claude -p`, worktrees):
```bash
codex exec --full-auto -o /tmp/codex-{agent}-review.txt "Review this implementation against the spec at specs/{name}.md. Focus on: correctness, error handling, silent failures, missing edge cases. Files changed: {list}" 2>/dev/null &
codex exec --full-auto -o /tmp/codex-{agent}-adversarial.txt "Adversarial review of specs/{name}.md implementation. Challenge every design decision. What assumptions are wrong? What fails under load or bad input? What would you do differently?" 2>/dev/null &
```

**Who runs the reviews:**
- Team lead spawns a `code-reviewer` teammate for the standard pass
- Team lead runs Codex adversarial review directly (or assigns to reviewer)
- Both results go to coder for fixes before merge

**No merge without both reviews passing.** If adversarial review surfaces a HIGH severity issue, coder fixes before merge. LOW severity issues may be filed as follow-up backlog items.

### Project testing policy

Each project must have a `TESTING-POLICY.md` at root. It defines:
- The mandatory test categories for that project
- How to run all tests (exact commands)
- What the CI gate checks

Reference implementations:
- `~/environment/projects/knowledge-base/TESTING-POLICY.md`
- `~/environment/projects/productivitesse/TESTING-POLICY.md`

---

## Applying to New Projects

Team leads must set up feature-based structure before writing any code. First commit = folder scaffold + `TESTING-POLICY.md`. Coders fill it in.

## Applying to Existing Projects

Refactors are **CEO-approved** (scope is large). Team leads propose, CEO decides.
See: `~/environment/proposals/` for the productivitesse refactor proposal.

---

## Rule 8: Platform Adapters — Named by Target, Not Framework

Adapter files are named after the **target platform**, never the framework implementing it.

| Target | File | Current framework | Could become |
|---|---|---|---|
| Browser | `web-adapter.ts` | Browser APIs | — |
| Mobile native | `mobile-adapter.ts` | Capacitor | Tauri Mobile / MAUI |
| Desktop native | `desktop-adapter.ts` | Electron | Tauri / MAUI |

**Why:** Framework names in filenames create coupling to implementation details. When Electron is replaced by Tauri, `desktop-adapter.ts` is rewritten internally — nothing outside changes. If it were named `electron-adapter.ts`, every import and every test would reference a framework that no longer exists.

### Native code layering

When writing Swift / Kotlin / Rust, it goes below the adapter:

```
PlatformAPI (types.ts)          — the contract features depend on
    ↓
mobile-adapter.ts               — framework-agnostic JS (currently Capacitor)
desktop-adapter.ts              — framework-agnostic JS (currently Electron)
    ↓
Native bridge                   — Capacitor plugin / Tauri command / MAUI binding
    ↓
Swift / Kotlin / Rust           — per-OS native implementation
```

The adapter never imports native code directly — it calls through the bridge. Swapping the bridge (Capacitor → Tauri) only rewrites the adapter internals. The PlatformAPI contract and all feature code remain untouched.

### OS detection inside adapters

Adapters that need OS-specific behavior use `getPlatform()`:
- `mobile-adapter`: `Capacitor.getPlatform()` → `'ios' | 'android'`
- `desktop-adapter`: `process.platform` → `'macos' | 'windows' | 'linux'`
- `web-adapter`: always `'web'`

Never use framework-specific OS detection outside the adapter layer.

---

## Rule 10: Structured Logging — Context, Action, Reason

**Every project that runs as a service ships a tiny structured logger. No bare `console.log` for anything that could matter at runtime.**

Reference implementation: `~/environment/projects/knowledge-base/src/logger.ts` — 22 lines, JSON-line output, four levels (`info` / `warn` / `error` / `debug`).

```ts
logger.info('process', 'item queued', { id });
logger.warn('process', 'item error (extraction)', { id, error: msg });
logger.error('embed', 'embedding failed', { id, error: String(e) });
```

The contract is always: **(context, message, optional data)**. Context is the module/subsystem (`process`, `embed`, `startup`, `retry`). Message is what happened. Data is the structured payload.

**Why:** Greppable by context, parsable by tools, every error carries enough state to debug from one log line. Compare to `console.error('failed', err)` — useless after the fact.

### Required for

- Backend services (anything running outside the browser)
- Long-running queues, workers, schedulers
- Any catch block on the server side that decides to swallow an error

### Not required for

- Pure UI components — `console.error` in a React error boundary is fine
- One-off scripts under 50 lines

---

## Rule 11: No Silent Catches

**Catch blocks that swallow errors without logging are forbidden. If the recovery is "do nothing", that decision must be visible.**

A catch with `/* ignore */` is a debugging black hole. Six months later, when the feature mysteriously stops working, the only evidence is silence.

**Bad:**
```ts
try { await fetch(url); } catch { /* ignore */ }
try { await fetch(url); } catch { /* relay may be down */ }
```

**Good:**
```ts
try {
  await fetch(url);
} catch (err) {
  logger.warn('relay', 'best-effort post failed', { url, error: String(err) });
  // Intentional: best-effort signal, no user impact
}
```

```ts
// UI component without a logger module — minimum bar:
try {
  await api.archive(id);
} catch (err) {
  console.warn('[KnowledgePanel] archive failed', { id, err });
}
```

**The rule:** every catch block does at least ONE of:
1. Log with context (logger or console with `[module]` prefix)
2. Surface to user (toast, error boundary, status field)
3. Re-throw a typed error
4. Have a one-line comment explaining *why* silence is correct AND a logger.debug call so the silence is auditable in debug mode

A bare `catch { /* ignore */ }` fails review.

---

## Rule 12: Typed Network Errors at the Boundary

**Network calls go through one wrapper per remote system, and that wrapper throws a typed error class — never a bare `Error`.**

Reference: `~/environment/projects/productivitesse/src/transport/relay/http.ts` — `RelayHttpError` and `RelayNotConfiguredError`. Callers branch on `err instanceof RelayHttpError` and access `.status`, `.path`, `.body` for context.

**Why:** Catch sites can decide intelligently — retry on 5xx, surface 4xx, ignore "not configured". A bare `Error` forces every catch to either swallow or string-match the message.

**Required for:** any module that fetches from a relay, API, websocket, or external service. Forbidden: scattering raw `fetch()` calls across feature components — they bypass the wrapper and lose typing.

**Productivitesse caveat:** UI components in `features/*/components/` that call `fetch()` directly bypass `relayGet`/`relayPost`. They must either route through the wrapper or be flagged as a follow-up backlog item.

---

## Rule 13: Spec-Per-Feature in `specs/`

**Every shipped feature has a spec file in `<project>/specs/`. The spec is the source of truth for behavior — tests assert against it, reviewers compare implementation against it, future agents read it before touching the code.**

Reference: `~/environment/projects/knowledge-base/specs/` — 14 spec files, one per feature, each with frontmatter (`type`, `feature`, `status`, `created`, `updated`, `summary`).

### Spec frontmatter template

```markdown
---
type: spec
feature: <feature-name>
status: implemented | in-progress | proposed
created: <ISO timestamp>
updated: <ISO timestamp>
summary: <one-sentence behavior description>
---
```

### Spec body must contain

- **Overview** — what the feature does in 2-3 sentences
- **Acceptance criteria** — bullet list of testable behaviors
- **Edge cases** — what happens at the boundaries (empty input, network failure, duplicate, etc.)
- **Out of scope** — explicit non-goals so the spec doesn't drift
- **How to test** — manual verification steps (even if automated tests exist)

### Enforcement

- Reviewers block PRs that add features without a spec
- The spec file lives next to the test that exercises it
- When implementation drifts from the spec, the spec is updated in the same PR — the spec is not stale documentation

---

## Rule 14: TESTING-POLICY.md Is Mandatory

**Every project at root must have `TESTING-POLICY.md` — what gets tested, why, and how to run tests. Reviewed and updated as the project evolves.**

Reference: `~/environment/projects/knowledge-base/TESTING-POLICY.md` — defines mandatory test categories (migrations, queue logic, E2E smoke), what is explicitly NOT tested, and the philosophy (tests guard against silent failure, not for coverage theater).

The policy must answer:
1. What categories of code MUST have tests (with reasoning per category)
2. What does NOT get tested and why
3. When in the lifecycle tests are written (with the feature, not after)
4. Exact commands to run all test suites
5. CI gate behavior

If a project ships features without a TESTING-POLICY.md at the root, the team lead has not finished setting up the project.

---

## Rule 9: Browser Testability — All Features Must Work in Web

**Every feature in every app (Capacitor mobile, Electron desktop) must be testable in a plain browser.**

This is a hard rule. The web adapter is not a stub layer — it is a real implementation using browser APIs.

**Why:** Rebuilding and installing a native binary takes minutes. Testing in a phone browser (pointed at the Vite dev server via LAN or Tailscale) takes zero seconds. Fast iteration requires browser parity.

### What this means per feature

| Feature | Web implementation |
|---|---|
| Voice recording | `MediaRecorder` + Web Audio API |
| Relay connection | WebSocket via LAN/Tailscale URL |
| Sessions / agent grid | JSONL events via WebSocket |
| Navigation | React Router in-browser |
| Notifications | `Notification` Web API |
| Storage | `localStorage` / `IndexedDB` |
| Deep links / URL open | Window `location` |

### Allowed exceptions — truly native-only

Only the following are permitted to lack a web fallback, because they have **no browser equivalent**:

| Feature | Why web fallback is impossible |
|---|---|
| Global keyboard listener (RShift, Rust addon) | Requires OS-level hook; browser JS cannot intercept global key events |
| Window enumeration (list all OS windows) | Requires OS process introspection; no browser API |
| Window activation / focus other apps | Requires OS permission not available to web |
| Camera / mic hardware access (native plugin) | Use Web `MediaDevices` API instead — this one IS achievable in web |

### Rule for coders

When implementing any feature:
1. **Web adapter gets a real implementation first**, not a stub
2. If a feature truly requires native hardware, document the exception explicitly in a comment: `// WEB_STUB: no browser equivalent — OS window enumeration requires native`
3. Never add `if (isMobile() || isDesktop()) { ... }` guards that silently skip features on web

### Testing policy implication

E2E tests and manual QA run in the browser first. If it works in browser, the Capacitor and Electron wrappers are low-risk. A browser-only test suite catches 80% of bugs before any native build is needed.
