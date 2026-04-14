# AI-Optimized Code Standards

Every project team lead and coder MUST follow these standards. They exist because AI agents re-read the codebase from scratch each session — poor structure compounds into wasted tokens every time.

---

## 🚨 COMPILER FEEDBACK LAW — LAW (2026-04-14, CEO directive)

**Non-negotiable. System-wide. Effective immediately.**

Agents editing TypeScript without live compiler feedback are blind — equivalent to an IDE with all errors suppressed. The tooling enforces this automatically; agents must not disable or skip it.

1. **PostToolUse hook fires on every `.ts`/`.tsx` edit** — runs `tsc --noEmit` for that project automatically. No agent action required.
2. **Output is filtered to the edited file only** — cross-file errors during multi-file refactors are expected and suppressed until you edit those files. This is intentional.
3. **Pre-commit hook is the final gate** — tsc must pass before any commit. This catches anything PostToolUse missed.
4. **Every source file must be in a tsconfig `include` glob** — a file outside `include` is invisible to the compiler. If you add a new directory (e.g., `server/`), add it to the tsconfig immediately.
5. **`tsc --noEmit` clean is a hard requirement before reporting done** — if the compiler has errors in your file, your task is not done.

### Why

Agents discovered a production bug (`data.response` ReferenceError) that TypeScript would have caught instantly — but the file lived in `server/` which was excluded from the tsconfig `include`. The compiler never saw it. This law prevents that class of failure.

---

## 🚨 TYPE HARDENING DIRECTIVE — LAW (2026-04-14, CEO directive)

**Non-negotiable. System-wide. Effective immediately.**

1. **No `as Type` casts** — ever. If you need a cast, the type is wrong upstream. Fix the source.
2. **No `!` non-null assertions** — ever. Use `if (x)` guards, optional chaining `x?.y`, or nullish coalescing `x ?? fallback`. A `!` is a lie to the compiler.
3. **No temporary inline TypeScript avoidance** — no `@ts-ignore`, no `@ts-expect-error` to silence a real error, no `any` as a shortcut.
4. **Leave nothing untyped** — every function parameter, return type, and variable that the compiler cannot infer must be explicitly typed.
5. **All teams audit now** — every project runs a type-hardening sweep. Find violations, file them, fix them. Report to chief-of-staff.

### What this means in practice

```ts
// ❌ ILLEGAL
const data = await res.json() as { agents: string[] }
const el = document.getElementById('root')!
let value: any = getConfig()
// @ts-ignore
doThing()

// ✅ REQUIRED
const raw = await res.json()
if (!isAgentsResponse(raw)) throw new Error('unexpected /agents shape')
const agents: Agent[] = raw.agents.map(toAgent)

const el = document.getElementById('root')
if (!el) throw new Error('#root not found')

// Use a type guard or zod to narrow unknown:
function isAgentsResponse(x: unknown): x is { agents: RawAgentInfo[] } {
  return typeof x === 'object' && x !== null && Array.isArray((x as any).agents)
}
```

### Type guards replace casts

When receiving `unknown` from the network, use a type guard. A type guard is honest — it checks at runtime. A cast is a lie — it only satisfies the compiler.

**Do not use Zod at internal API boundaries.** See API Boundary Standard below.

### `null` and `undefined` are handled explicitly

```ts
// ❌ ILLEGAL — lying to the compiler
const name = agent.name!

// ✅ REQUIRED — honest handling
const name = agent?.name ?? 'unknown'
// OR
if (!agent.name) throw new Error(`agent ${agent.id} has no name`)
const name = agent.name  // TypeScript now knows it's defined
```

### Enforcement

- Reviewers block any PR containing `as`, `!`, `any`, or `@ts-ignore` without a documented exception
- Documented exception: `x as unknown as Y` double-cast with a comment explaining WHY the types are provably compatible (very rare — think carefully before using)
- Team leads run `grep -rn " as \| !\.\|: any\|@ts-ignore" src/` on every project weekly and file hardening tasks for anything found

---

## Architecture Standard: React-Native DDD

This is the mandated architecture for all projects. It combines React best practices (hooks, co-location, context) with DDD principles (named domain types, shared language, boundary isolation). **It does not import Spring/Clean Architecture patterns that fight React's grain** — no DI containers, no explicit ports/adapters ceremony, no interface-per-use-case.

The key insight: React already gives you a clean architecture if you use hooks correctly. Hooks ARE the use case layer. Context IS the dependency injection. Co-located feature folders ARE vertical slices. The missing piece is only domain type discipline and a shared vocabulary.

### The three layers (React-native)

```
shared/domain/   ← System-wide named types. One truth for Agent, Message, Intent.
src/
  domain/        ← Service-specific types extending shared. Pure TS, no React.
  features/      ← Vertical slices. Hooks co-located with components.
  platform/      ← Thin adapter layer (Electron IPC / Capacitor / Web APIs).
```

**Single rule: `domain/` imports nothing outside itself. Everything imports from `domain/`.**

---

### Layer 1: Shared + local domain (pure TypeScript)

```
shared/domain/         ← System-wide truth (Agent, Message, Intent, AgentName...)
  types.ts
  brands.ts            ← Branded primitives

src/domain/            ← Service-local extensions only
  types.ts             ← e.g. DaemonState, WakeState (voice-bridge specific)
  logic.ts             ← Pure functions — business rules, no side effects
```

**Named types and branded primitives:**
```ts
// shared/domain/types.ts
export type AgentName = string & { readonly __brand: 'AgentName' };
export type AgentStatus = 'idle' | 'working' | 'waiting' | 'offline';

export interface Agent {
  name: AgentName;
  status: AgentStatus;
  hasChannel: boolean;
}
```

---

### Layer 2: Features — hooks + components co-located (React-native vertical slices)

This is the heart of the architecture. **Hooks ARE the use-case layer.** They contain all business logic, data fetching, and state management. Components are dumb renderers that accept domain types from hooks.

```
features/
  agent-grid/
    AgentGrid.tsx       ← dumb component — domain types in, JSX out
    AgentCard.tsx
    useAgents.ts        ← ALL logic here: fetch, transform, state
    store.ts            ← Zustand slice (domain types only, no wire formats)
    index.ts            ← public API: only what other features may import
```

**Hook pattern — fetch, transform, return domain type:**
```ts
// features/agent-grid/useAgents.ts
export function useAgents(): Agent[] {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetchAgents()                         // ← calls platform adapter
      .then(raw => raw.map(toAgent))      // ← transforms wire → domain
      .then(setAgents);
  }, []);

  return agents.sort(byStatus);          // ← domain logic inline, no ceremony
}
```

**Component pattern — receives domain types, never fetches:**
```ts
// AgentGrid.tsx — no useState, no useEffect, no fetch
function AgentGrid() {
  const agents = useAgents();            // ← one hook call
  return <>{agents.map(a => <AgentCard agent={a} key={a.name} />)}</>;
}
```

**Why hooks, not classes/services:**
- Hooks co-locate with the component they serve — no excavation needed
- React's `useEffect` + `useState` IS the observable use-case pattern — no RxJS needed
- Hooks compose naturally — `useAgentStatus` calls `useAgents` internally
- Hooks are trivially testable by mocking `fetch` at the boundary

---

### Layer 3: Platform adapter — thin, named by target

One file per platform. Converts platform API calls to domain types. This is the **only** place wire formats from relay/IPC/Capacitor are touched.

```
platform/
  web-adapter.ts        ← fetch + WebSocket
  desktop-adapter.ts    ← Electron IPC (window.__voiceBridge)
  mobile-adapter.ts     ← Capacitor plugins
  index.ts              ← exports getPlatformAPI() — auto-selects by env
```

```ts
// platform/desktop-adapter.ts
export async function fetchAgents(): Promise<Agent[]> {
  // Call Electron IPC, convert to domain type here
  const raw = await window.__voiceBridge?.getAgents() ?? [];
  return raw.map(name => ({ name: name as AgentName, status: 'idle', hasChannel: false }));
}
```

Features import `getPlatformAPI().fetchAgents()` — never `window.__voiceBridge` directly.

---

### What NOT to do (Spring/Clean patterns that fight React)

| Pattern | Why it doesn't fit React |
|---|---|
| `IAgentPort` interface + separate adapter class | Over-engineering. Hook + platform adapter gives the same swap-ability with less code |
| Explicit DI container / `app/providers.tsx` wiring | React Context is fine for config/platform; feature data belongs in hooks or Zustand |
| `class RelayService implements IRelayPort` | React doesn't benefit from class hierarchies — functions compose better |
| Separate `ports/` directory | Adds indirection with no gain — the platform adapter IS the port |
| `use case` files (one class per action) | A hook IS a use case — `useSendMessage()` is the use case handler |

**The test:** if a junior React dev reads the code and can navigate to any feature in 2 Glob/Grep calls, the architecture is right. If they need to follow `interface → class → factory → context → hook`, it's too complex.

---

### Migration path for existing code

**Don't rewrite.** Apply on contact:
1. Adding a feature → co-locate hook + component, import domain types from shared
2. Editing an existing file → extract the inline shape to a named type in domain
3. Adding a network call → route through platform adapter, never raw fetch in components
4. Full restructure → CEO-approved proposal only

productivitesse's `domain/types/` and `platform/` are already close to this shape. The missing pieces: hooks with domain return types, and feature `index.ts` public APIs. Add incrementally.

---

### DOMAIN.md + Rule 16 applies here

Before writing any code in a new feature, team lead updates `DOMAIN.md` with new concepts. The type in `domain/types.ts` must match the term in `DOMAIN.md` exactly.

---

## API Boundary Standard (2026-04-14, CEO directive)

All 4 apps (message-relay, productivitesse, knowledge-base, voice-bridge2) are **one system** sharing one TypeScript codebase. API contracts between them are enforced by **shared types**, not code generation or runtime schema validation.

### Shared types — the only API contract tool

```
~/environment/shared/types/
  relay.ts        ← SendRequest, SendResponse, AgentsResponse, ChannelsResponse, etc.
  knowledge.ts    ← KnowledgeItem, SearchResponse, TagsResponse, etc.
  domain.ts       ← Agent, Message, AgentName, AgentStatus (cross-cutting)
  index.ts        ← re-exports
```

- **Backend** imports shared types and is forced by the compiler to return them
- **Frontend** imports the same types — same truth, zero drift, zero runtime cost
- **If backend changes a type** → compiler errors on both sides simultaneously

```ts
// message-relay — compiler enforces SendResponse return shape
app.post<{ Body: SendRequest; Reply: SendResponse }>('/send', handler)

// productivitesse — same type imported directly, no cast needed
import type { AgentsResponse } from '@env/shared/types/relay'
const data: AgentsResponse = await res.json()
```

### When to use Zod

Zod validates **shape at runtime** — it is an automated type guard generator. Use it only where the data source is outside our control:

| Use Zod | Don't use Zod |
|---|---|
| External scraping (YouTube, web content) | Internal API calls between our services |
| Environment variable parsing | Database reads via Drizzle (already typed) |
| LLM/OpenAI response parsing | Any fetch between relay ↔ productivitesse ↔ voice-bridge2 |
| User file imports / CSV / YAML | knowledge-base API calls from productivitesse |

**Why Zod doesn't help at internal boundaries:** Zod validates shape but not trustworthiness. Malicious data matching the schema still passes. Version drift between services is a deployment problem, not a type problem — and shared types catch it at compile time, which is earlier and cheaper than runtime. Zod at internal boundaries is performance overhead with no real safety gain.

### What Zod actually is

A type guard generator. The snippet:
```ts
const item = schemas.KnowledgeItem.parse(raw) // Zod
```
is equivalent to:
```ts
if (!isKnowledgeItem(raw)) throw new Error('unexpected shape')
const item = raw // TypeScript narrows here
```

For complex external schemas, Zod saves writing type guards by hand. That's its value. Don't use it beyond that.

### No OpenAPI, no code generation pipeline

Cross-language / cross-team boundaries → OpenAPI is the right tool.
Same language, same team, same repo → shared TypeScript types are the right tool.
We are one system. No generation pipeline needed.

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

---

## Rule 10: Two Boundary Rules — Transform at the Edge, Pass Domain Inward

**Raw infrastructure formats must never leak into UI components or business logic. Two hard boundaries apply to all projects.**

Extra boilerplate is explicitly accepted in exchange for data-source independence and testability.

---

### Boundary 1: DATA BOUNDARY — Raw formats die at the edge

Raw formats (JSONL lines, relay WebSocket payloads, future DB rows, API responses) must be **converted to domain types at the first file that touches them**. Nothing past that boundary knows the raw format exists.

```ts
// ❌ WRONG — JSONL type leaking into a hook
import type { JsonlSession } from '../features/jsonl-sessions/store';
function useAgentStatus(name: string): JsonlSession { ... }

// ❌ WRONG — relay wire shape leaking into a component
const msg = useRelayStore(s => s.messages[0]); // msg is RelayMessage, not Agent
<MessageCard from={msg.from} body={msg.body} />

// ✅ CORRECT — convert at the adapter, pass domain inward
// adapter/jsonlAdapter.ts — only file that knows about JsonlSession
function toAgent(raw: JsonlSession): Agent { ... }

// hooks/useAgentStatus.ts — uses domain type only
function useAgentStatus(name: string): AgentStatus { ... } // AgentStatus is a domain type
```

**What "domain type" means:** Types defined in `src/domain/` or `src/types/` that describe the business concept (Agent, Message, Session, AgentStatus) — not the storage format. JSONL-specific fields, relay wire shapes, and WebSocket protocol details are NOT domain types.

**The rule in one sentence:** If a type name contains "Jsonl", "Relay", "WS", "Raw", "Wire", or references a storage mechanism, it must not appear in UI components or hooks.

---

### Boundary 2: PLATFORM BOUNDARY — UI knows nothing about Capacitor/Electron/Web APIs

The React app (components, hooks, business logic) must not import from `@capacitor/*`, `electron`, or call `window.webkit`, `window.__electronAPI`, etc. directly. All platform access goes through `getPlatformAPI()` or equivalent adapter.

This boundary is already implemented in productivitesse via `getPlatformAPI()`. **Do not break it.**

---

### Domain hooks as the access pattern

UI components access data only through domain hooks:

```ts
// ❌ WRONG
import { useJsonlStore } from '../features/jsonl-sessions/store';
const sessions = useJsonlStore(s => s.sessions);

// ✅ CORRECT
import { useAgents } from '../hooks/useAgents';
const agents = useAgents();
```

Domain hooks are thin facades: they read from stores/adapters, convert to domain types, and expose a clean interface. The UI calls hooks that call adapters — never adapters directly.

**Minimum required hooks per UI project:**

| Concept | Hook | Returns |
|---|---|---|
| Agent list | `useAgents()` | `Agent[]` |
| Agent status | `useAgentStatus(name)` | `AgentStatus` |
| Agent messages | `useAgentMessages(name)` | `Message[]` |
| Relay connection | `useRelayConnection()` | `{ connected: boolean, url: string }` |

---

### Why these rules exist

- **Data source changes cause production bugs.** When JSONL schema changes or we swap to a DB, every component that leaked the raw type breaks. With the boundary, only the adapter changes.
- **Testability.** Components using domain hooks can be tested by mocking hooks. No stores, no WebSockets, no file watchers needed in tests.
- **Readability.** `useAgentStatus(name)` is self-documenting. `useJsonlStore(s => s.sessions.get(id)?.agentName)` is archaeology.
- **Swap cost.** If JSONL is replaced by a database tomorrow, zero domain or UI code changes — only the adapter.

### Enforcement

- Team leads reject PRs where raw infrastructure types appear in UI components or hooks
- Coders finding a violation during a feature: fix it in the same PR (boy-scout rule)
- New pages and hooks: domain types only, no raw format imports

---

## Rule 15: API Boundary Types Are MANDATORY — No Inline Casts

**Every HTTP endpoint must have its request and response shapes defined as exported TypeScript types. Consumers import and use those types — never guess, never cast inline.**

This is the single most common source of silent production bugs in this codebase. A wrong `as { agents: string[] }` cast compiles, ships, and crashes at runtime with zero compiler warning.

### The rule

**Server side (relay, any service):**
```ts
// message-relay/src/types/api.ts — the contract
export interface AgentInfo {
  name: string;
  state: string;
  hasChannel: boolean;
}

export interface GetAgentsResponse {
  agents: AgentInfo[];
}

export interface SendMessageBody {
  from: string;
  to: string;
  type: MessageType;
  body: string;
}
```

Every endpoint handler uses and returns these types. No anonymous inline shapes.

**Client side (voice-bridge, productivitesse, any consumer):**
```ts
// ❌ WRONG — inline cast is a lie the compiler accepts
const data = await res.json() as { agents: string[] }

// ❌ WRONG — type guard without the real type
const data = await res.json() as { agents: Array<{ name: string } | string> }

// ✅ CORRECT — import the exported type from the source
import type { GetAgentsResponse } from '@relay/types/api'
const data = await res.json() as GetAgentsResponse
```

### For relay specifically

All relay API types live in `message-relay/src/types/api.ts`. Consumers import from there. If the relay type doesn't exist yet, the coder writing the consumer also adds it to the relay types file — the consumer never owns the server's types.

### No exceptions for "simple" endpoints

There is no such thing as a too-simple endpoint to type. The bug that crashed voice-bridge2's settings panel was a cast of `string[]` on a response that actually returned `AgentInfo[]`. One correct type export would have prevented hours of debugging.

### Enforcement

- **Coders**: before writing `res.json() as`, ask — does the server export this type? If not, add the export first.
- **Reviewers**: any `as { ... }` on a network response is an automatic review block.
- **Team leads**: API boundary types are part of the definition of done. No feature ships with untyped network calls.

### Migration (existing code)

Every time a coder touches a file with an untyped network call, they add the type as part of the same PR (boy-scout rule). Full audit is a separate BACKLOG item — don't wait for it, fix on contact.

---

## Rule 16: Domain-Driven Design — Every Project Has a Domain Language

**This system follows DDD. Domain terminology is defined explicitly and shared across all services.**

### What this means in practice

**Every project has a `DOMAIN.md` at its root.** This file defines:
- The service domain and purpose
- The ubiquitous language: all domain terms used in code, types, and communication
- Key domain entities and value objects (what they are, not how they're implemented)
- Domain events the context produces and consumes

```markdown
# Domain: Voice Bridge

## Domain
Voice input processing — captures spoken intent, routes it to the correct agent.

## Ubiquitous Language
| Term | Meaning |
|---|---|
| Wake Word | The spoken trigger phrase that starts recording |
| Intent | A parsed command with a target agent and body |
| Target | The named agent an intent is addressed to |
| Transcript | Raw text output from speech-to-text |
| Daemon | The background process listening for the wake word |

## Domain Events
- `wake_word_detected` — daemon heard the trigger phrase
- `recording_started` / `recording_stopped` — mic state changed
- `transcript_ready` — Whisper returned text
- `intent_dispatched` — message routed to relay

## Entities
- **VoiceSession**: a single wake-word → record → transcribe → dispatch cycle
- **DaemonState**: current state of the background process (idle/listening/recording/processing)
```

### Domain types live in `src/domain/`

All entities, value objects, and domain events are TypeScript types in `src/domain/types.ts` (or sub-files by aggregate). Nothing outside `src/domain/` defines what a domain concept IS — they may implement or adapt it, but the definition lives here.

```
src/
  domain/
    types.ts        ← Agent, Message, Intent, DaemonState — the concepts
    events.ts       ← domain event types (what the context emits)
  adapters/
    relay.ts        ← maps RelayMessage → domain Message (anti-corruption layer)
    daemon.ts       ← maps daemon stdout → DaemonState
  features/
    voice-panel/    ← uses domain types only, never adapter types
```

### Cross-service communication = relay messages

The relay IS the integration layer between services. When voice-bridge dispatches an intent to command, that is a domain event crossing a service boundary. The relay message schema is the **shared contract** — the minimal agreed interface between services.

**Shared contract types live in `message-relay/src/types/api.ts`.** All services import from there when they need to speak to each other. Neither service owns the other's internal domain model.

### Team coordination via domain language

When teams collaborate (productivitesse + relay, voice-bridge + command), they communicate using domain terms, not implementation terms.

- ❌ "The agents array in the JSON response" 
- ✅ "The AgentInfo list from the relay registry"

Team leads are responsible for establishing and maintaining the ubiquitous language in DOMAIN.md. When a term is used inconsistently across teams, the team lead resolves it in the file and broadcasts the change.

### One system — one ubiquitous language

**relay, productivitesse, voice-bridge, and knowledge-base are services of a single application, not separate bounded contexts.** They share one domain vocabulary. An `Agent` means the same thing everywhere. A `Message` is the same concept across all services.

This is intentionally counter to DDD purist separation. The system is small, the team is unified, and divergent vocabularies between services create exactly the confusion we're solving. One language wins.

**The shared domain lives at `~/environment/shared/domain/`:**
```
shared/
  domain/
    types.ts     ← Agent, Message, Intent, Session — system-wide entities
    events.ts    ← Domain events that cross service boundaries
    brands.ts    ← Branded primitives: AgentName, MessageBody, SessionId
```

All services import their domain types from here. The relay is not the owner of domain types — it's a service that consumes them like everyone else.

```ts
// In productivitesse, voice-bridge, relay, knowledge-base:
import type { Agent, AgentName, Message } from '~/shared/domain/types';
```

Service-specific types (relay's routing metadata, voice-bridge's daemon state, knowledge-base's embeddings) live in each service's own `src/domain/` and extend shared types when needed — never redefine base concepts.

### Type placement rules

Where a type lives determines who owns it and who can use it.

| Type category | Location | Examples |
|---|---|---|
| Cross-service wire contract | `shared/domain/` | Agent, Message, AgentName, MessageId |
| Service-internal domain types | `src/domain/types/` | DaemonState, EmbeddingMetadata |
| View models (UI rendering) | `src/domain/viewModels/` | AgentCardViewModel, MessagePreviewVM |
| UI state | `src/features/*/types.ts` | DrawerState, SelectedTab, FilterConfig |
| External data parsers | `src/data/schemas/` | Zod schemas for third-party APIs, LLM output |

**The test for shared/domain/:** Does this type cross an HTTP boundary between our own services? If no, it does not belong in shared/. View models, UI state, and service-internal types live in their project.

**If the backend moves to Rust or .NET:** shared/domain/ becomes the TypeScript-side generated output from an OpenAPI spec. The types don't move — only their source changes (hand-written → generated). Plan for OpenAPI if a non-TypeScript backend is on the roadmap within 1 year.

### In-app types are equally mandatory

API boundaries are the most visible failure point, but **in-app type discipline is the deeper issue**. Every concept inside a project must have a named type — not just the ones crossing HTTP boundaries.

**No anonymous inline shapes anywhere:**
```ts
// ❌ WRONG — inline shape leaking through function boundaries
function renderAgent(a: { name: string; state: string; active: boolean }) { ... }
const agents: Array<{ name: string; micState: 'on' | 'off' }> = []

// ✅ CORRECT — named domain type
import type { Agent, AgentStatus } from '../domain/types'
function renderAgent(agent: Agent) { ... }
const agents: Agent[] = []
```

**Value objects get their own types:**
```ts
// ❌ WRONG — raw primitives with implicit meaning
function setTarget(target: string) { ... }
const threshold: number = 0.3

// ✅ CORRECT — named value objects
type AgentName = string & { __brand: 'AgentName' }
type WakeThreshold = number & { __brand: 'WakeThreshold' }
function setTarget(target: AgentName) { ... }
```

Branded types (`string & { __brand: 'X' }`) are the correct tool for value objects that are primitives under the hood. They prevent passing the wrong `string` into the wrong slot — a bug class that TypeScript's structural typing normally allows.

**State machines are explicit:**
```ts
// ❌ WRONG — state as a raw string
let state: string = 'idle'

// ✅ CORRECT — exhaustive union
type WakeState = 'idle' | 'listening' | 'recording' | 'processing'
let state: WakeState = 'idle'
```

**The test:** if you delete a type and the compiler doesn't complain anywhere, the type wasn't being used — something is untyped downstream. Every type should be load-bearing.

### Enforcement

- New projects start with `DOMAIN.md` before any code — team lead writes it
- PRs that introduce new domain concepts without updating `DOMAIN.md` are blocked
- Terminology drift (same concept with two names in code) is treated as a bug, not style
- Cross-context PRs must be reviewed by both context owners
- **Any `string` or `number` parameter that has domain meaning gets a named type or brand** — reviewed on sight
