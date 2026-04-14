---
type: proposal
title: Rearch — testing architecture and stack direction
summary: Stay on TS (hardened), enforce schema-at-boundary with Zod, replace unit tests with property + Playwright-against-real-fixtures, ship HTML ListGraph renderer first before any canvas library.
status: proposed
author: proposal-writer
created: 2026-04-09T21:45:03
priority: high
project: productivitesse
---

# Rearch — testing architecture and stack direction

This proposal synthesizes four parallel research streams (stack, schema/testing, agent-graph rendering, code audit) into one coherent direction for the rearchitecture in flight. The goal is to commit, with evidence, to the technical foundation we will live on for the next year of LLM-assisted development.

## Problem statement

Productivitesse is mid-rearchitecture (Phases 1–4 already landed: dirs, deps, ESLint boundaries, view models, proposals data pipeline, 13-type horizontal sweep, HTML ListGraph). Three open questions need a CEO decision before we keep building:

1. **Is the stack right long-term?** TS + React + Vite + Electron + Capacitor + Zod + a Rust addon — ignoring sunk cost, is this the best foundation for LLM-driven development, or should we switch?
2. **What is the testing strategy?** The current codebase has almost no tests, and the recent shipped bugs (m.text crash, network badge regression, overlay-in-chat-mode) all bypassed the type system. What replaces "write more unit tests"?
3. **What renders the agent graph?** ReactFlow, R3F, custom canvas, or plain DOM? The choice locks in dependencies and mobile performance.

The audit also surfaced a fourth problem worth flagging: the existing codebase has a 572-LOC god-store, a 1332-LOC `VoicePage.tsx`, hand-rolled types used as wire casts, and `mobile/` and `dashboard/` features that import each other. The rearchitecture is already addressing this — Phases 1–4 — and this proposal validates that direction with evidence.

## Proposed solution (one sentence)

**Stay on TS hardened, make schema-at-the-boundary the only validation discipline that exists, default unit-level tests to properties not examples, run Playwright against frozen production fixtures, and ship the HTML ListGraph renderer before any canvas library.**

The rest of this document defends each part with the specific evidence the research surfaced.

---

## 1. Stack — TS hardened wins by 5 points, and the strongest argument is the iteration loop

### The decision matrix

Five axes scored 0–5: type-system strength, architectural explicitness, boundary cost, ecosystem corpus in LLM training data, self-correction loop latency.

| Stack | Type | Arch | Boundary | Corpus | Self-correct | **Total** |
|---|---|---|---|---|---|---|
| Current TS strict (no changes) | 3 | 2 | 2 | 5 | 4 | **16** |
| **Current TS hardened** | **4** | **4** | **5** | **5** | **5** | **23** |
| TS everywhere + Rust island | 4 | 4 | 4 | 5 | 5 | **22** |
| Rust everywhere | 5 | 4 | 4 | 2 | 3 | **18** |
| Rust backend + TS frontend | 5 | 4 | 2 | 4 | 3 | **18** |
| C# / .NET 9 + React | 4 | 4 | 2 | 3 | 4 | **17** |
| Go backend + TS frontend | 2 | 3 | 2 | 4 | 5 | **16** |

"TS hardened" beats the next-best alternative (TS + Rust island) by one point and beats every full-stack rewrite candidate by 5+. Rust-everywhere scores higher on type strength but is dragged down by corpus weakness and self-correction latency.

### The load-bearing evidence

- **Type-constrained decoding cuts compile errors by 74.8%** vs 9.0% for syntax-only constraints (arXiv 2504.09246, April 2025). Type errors are 33.6% of all LLM code failures.
- **SWE-Sharp-Bench (Microsoft, AIware 2025):** frontier models solve 70% Python vs 40% C# on identical configs. C# is empirically harder for LLMs *despite* having a stronger nominal type system than TS — the corpus advantage matters more than raw type system power below a threshold.
- **DDD bounded contexts study:** monolithic LLM code is ~55% production-ready; same problem in bounded contexts is ~88% (+60% relative). 35% of monolithic LLM code crosses architecture boundaries; 28% of imports are hallucinated. Architecture *as enforced ceremony* helps LLMs.
- **Anthropic agentic-PBT red team:** 56% valid bug rate on real Python packages with property-based testing, ~$5.56 per bug report. Properties are uniquely good for LLMs because they can be inferred from docstrings, not memorized.
- **Self-Spec result (HumanEval):** prompting an LLM to author a schema *first* lifts pass rates measurably (GPT-4o 87→92%, Claude 3.7 92→94%) — schema-first beats test-first even within a single generation.

### The strongest single argument: the Vite + Playwright iteration loop

Edit-to-feedback latency, by stack:

- **TS + Vite HMR:** <1s for UI changes, 2–5s for type errors. **Best in class.**
- TS + tsc full: 5–30s. Still good.
- C# .NET incremental: 5–30s.
- Rust + cargo incremental: 10–60s small, much slower for refactors.
- Rust full rebuild: 2–10 minutes. **Past the 2-minute threshold.**
- Go: <1s, but weakest type system.

Combined with Playwright running against a live Vite page, the TS loop is:

1. LLM edits a `.tsx` file
2. HMR pushes change in <500ms
3. Playwright re-runs a smoke against the live page in 2–5s
4. LLM gets a real failure signal in **<10 seconds total**

**No other stack has this loop.** Rust+Leptos has compile times in the way. C#+Blazor has slower hot-reload. Native iOS has no fast loop at all. This is the strongest argument for staying on TS that does *not* reduce to "sunk cost." It is a structural property of the toolchain.

### A finding that strengthens "keep TS" beyond v1

Schema-as-the-entire-spec is *feasible everywhere but ergonomic only in TS+Zod (and Effect Schema)*. The pattern productivitesse already has — `proposal.ts` is 60 self-documenting lines that an LLM reads in 30 seconds and understands the entire domain — is genuinely TS-idiomatic. Rust splits the same content across struct + derive macros + traits. Go has no schema abstraction. C# has FluentValidation but separate from the DTO. The 60-line schema with doc comments aimed at LLMs is the productivity asset, and only TS+Zod gives you it cheaply.

### What "hardened" means concretely

- Tighten TS: enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- Enable `eslint-plugin-boundaries` (already a devDep — currently unconfigured) at error level
- Schema-derive `message-relay/src/types.ts` from Zod (zod is already a relay dep)
- Finish the 13 remaining schema migrations (Phase 3 horizontal sweep, in progress)
- Write `GLOSSARY.md` as the canonical concept map
- **Optional, deferred:** Rust island for the relay hot path (routing/persistence/attachments) via napi-rs, if and only if a measured bottleneck appears. Not speculative.

### What we explicitly rejected and why

- **C#/.NET wholesale:** worse on benchmarks (40% vs 70%), loses corpus advantage, loses full-stack unification.
- **Rust everywhere:** would force Leptos/Dioxus, which have <5% of React's training corpus. Compile latency past the 2-minute threshold for large refactors.
- **Go:** weakest type system of the contenders; cannot encode the schemas we want to encode.
- **Switching from React:** corpus dominance is a moat. React has the largest training-data footprint of any UI framework.

---

## 2. Testing — six rules, replacing "write more unit tests"

The current codebase has a Playwright suite at `tests/ui/` (dashboard, satellites, mobile) and a `playwright.config.ts`. It also has zero contract tests, almost no unit tests, and recent crashes the test suite did not catch. The fix is not "more tests" — it is the right tests at the right boundaries.

### The case study: the m.text crash (commit 9674157)

`src/features/mobile/VoicePage.tsx` shipped a crash fixed by `m.text ?? ''`. The bug is the perfect forcing function for the whole testing position because **every layer that should have caught it failed for an instructive reason**:

| Mechanism | Caught? | Why |
|---|---|---|
| TypeScript strict mode | No | The wire data was `as HubMessage[]`-cast at the boundary. The compiler trusted the cast. |
| LLM-written unit test on `VoicePage` | No | The LLM writing the test would mock `HubMessage[]` with `text` populated, mirroring the broken interface. **Locks in the bug.** |
| Existing Playwright `'mobile layout loads without JS errors'` test | No | Runs against a relay where fetch errors are filtered out (`e.includes('fetch')`). No real messages render → the crash path is never exercised. |
| Zod parse at the wire boundary | **Yes** | Would have thrown loud at the first bad payload, with the exact field name. |
| Property-based test | **Yes** | "For any HubMessage from the wire, rendering does not throw" would fail. |
| Playwright + recorded production fixture | **Yes** | Real wire shapes carry the field-name drift. The crash would surface on first run. |

**Three out of three recent shipped bugs (m.text, network badge, overlay-in-chat-mode) would have been caught by either schema-at-boundary or Playwright-on-real-DOM. None would have been caught by a function-level unit test.** The layer where humans (and LLMs) pour the most testing effort is the layer least likely to catch the bugs that ship.

### The deeper lesson: defensive coercion ≠ schema at the boundary

`src/features/mobile/api.ts` already does manual normalization in `fetchMessages()` — the author tried four field names and used `String(... ?? "")` to coerce undefined to empty. **The crash still shipped**, because `VoicePage.tsx` reads from a *different* code path that bypasses the normalization. Defensive coercion at one consumer is not the same as schema at the boundary. There are N consumers; there is one boundary.

The LLM-era twist: with humans, the convention "always normalize at the consumer" can hold across a small team. With LLM agents, every new feature is written by an agent that has not read every previous consumer, so any rule that requires uniform discipline at every call site fails. **The only rules that survive are the ones enforced at the type system** — the consumer literally cannot get an unvalidated `HubMessage` because the only way to get one is through `Message.parse(...)` at the boundary.

This is the core principle: **LLM-era code requires rules enforced by the compiler/parser, not by convention, because LLMs do not maintain conventions across agent boundaries.**

### The six rules (in priority order)

1. **Boundary validation is the only validation that scales across LLM agents.** Every `unknown → T` transition goes through a Zod schema. No `as Foo` casts on wire data. Lint-enforced: a rule that flags hand-rolled interfaces used to type the result of `await res.json()` or WebSocket frame data. Failure mode it prevents: the m.text crash.

2. **Property tests are the default unit-level test format.** Example tests written by LLMs lock in LLM mental models. Properties grounded in schemas (which the LLM can re-derive from doc comments) catch bugs both LLMs and humans miss. Validation: Anthropic red-team 56% bug rate at $5.56/bug; agentic-PBT paper. Tooling: `fast-check`.

3. **Playwright is the integration test format, run against frozen production fixtures.** Real DOM, real IPC, real wire shapes. The current Playwright suite exists but runs against an empty/mocked relay, so it misses every crash that depends on the *shape* of real data. **Concrete fix:** record a snapshot of real relay responses (anonymized via a single transformer), commit them as fixtures, feed them into the existing Playwright tests on every PR. The infrastructure is already there — only the fixtures are missing. This is the highest-leverage testing improvement available.

4. **One schema per concept, in one well-known place.** No parallel `Message` and `HubMessage` interfaces. The current `src/data/schemas/` directory is the right shape; the rule is that *every* wire-crossing concept has exactly one schema there, and producers and consumers both import from it. Lint-enforced.

5. **Schema doc comments are aimed at LLMs.** The current `src/data/schemas/proposal.ts` is the canonical example: every field has a *why*, not just a *what*. New agents read the schema and have the entire domain in 30 seconds. Self-Spec evidence shows this lifts code generation quality even within a single prompt.

6. **Manual unit tests only when a property cannot be formulated.** This is a small minority of cases. If you find yourself writing an example-based unit test and the property version is harder to write, you are probably testing implementation, not behavior — stop and reconsider.

### What this looks like in practice

- The 13 schema files in `src/data/schemas/` get doc comments matching `proposal.ts`'s style.
- Every new feature ships with: (a) a schema (or extends one), (b) a property test for the schema's invariants, (c) a Playwright smoke that exercises the rendering path against a fixture.
- The existing `tests/ui/` Playwright suite gets a new `fixtures/` directory with frozen relay snapshots.
- No new "unit test culture" investment — that budget goes to schemas, properties, and fixtures instead.

---

## 3. Renderer — HTML ListGraph first, canvas deferred until CEO approves

The CEO has explicitly directed (and Phase 4 has already shipped) that the agent-graph renderer phase begins with **plain DOM/React HTML — `ListGraph.tsx` in `src/renderers/graph/`, divs + flex, zero canvas libraries**. This proposal endorses that decision and explains why it is correct on the merits.

### The constraint

- v1 renderer scope is one renderer (`ListGraph`), not four.
- ReactFlow, R3F, dagre, d3-force are all deferred until the CEO sees ListGraph working and approves the next step.
- The current R3F `Scene.tsx` keeps running on the existing code path until HTML ListGraph is validated.
- The `AgentGraphViewModel` contract — including the `subscribeFrame` callback — is unchanged. ListGraph simply never subscribes to per-frame updates.

### Why this is the right call

The agent-graph rendering research surfaced a strong recommendation for `@xyflow/react` (ReactFlow v12), with concrete performance evidence: it handles ~1000 nodes smoothly on desktop, hundreds on mid-range mobile, and 15–30 nodes (productivitesse's actual scale) is roughly 1–2% of its comfortable limit. None of the canvas-2D arguments (200+ nodes, particle effects, bloom, 60Hz physics) apply to productivitesse.

But the ReactFlow recommendation is also a *commitment*: a new dependency, custom node memoization, dagre layout, touch-event configuration, safe-area handling, animation budget. **All of that is wasted work if the underlying view model contract is wrong.** A trivial DOM ListGraph that consumes `AgentGraphViewModel` proves the contract with the smallest possible blast radius. If the contract is right, ReactFlow drops in later as a different consumer of the same VM. If the contract is wrong, we find out without having paid the ReactFlow integration cost.

This is also consistent with the testing position: ship the simplest thing that exercises the integration end-to-end, see real data flow through it, then decide what to add. ListGraph is the renderer-phase equivalent of "Playwright against real fixtures."

### What ships in renderer phase v1

- `src/renderers/graph/ListGraph.tsx` — divs + flex, consumes `AgentGraphViewModel`
- `src/domain/layout/orbitLayout.ts` (already in plan) and a trivial `gridLayout.ts` or `stackLayout.ts` — pure TS layout algorithms, prove the VM contract is layout-agnostic
- Zero new dependencies in stage 1: only `zod`, `gray-matter`, `eslint-plugin-boundaries`
- Deferred to stage 2 (after CEO approval): `@xyflow/react`, `@dagrejs/dagre`, d3-force, R3F refactor

### What we are NOT committing to

- ReactFlow as the eventual canvas-graph renderer is the *current best candidate* but not yet a decision. ListGraph being live first gives us the option to validate ReactFlow against real data shapes before committing.
- Canvas 2D drawing modules from `patoles/agent-flow` were initially a candidate; the consultant retracted that recommendation after a deeper read showed the canvas modules transitively depend on most of the monorepo. That fork is off the table.

---

## 4. Code audit — the rearchitecture is addressing the right things

The frontend audit found a codebase shape that is exactly what the rearchitecture phases are designed to fix. Logging it here so the CEO sees the audit findings and the in-flight phases line up.

### Audit findings

- `dashboard/store.ts` — **572 LOC god-store** holding agents, messages, notifications, recording, hierarchy, docDrawer, tabs, buildStatus, etc.
- `dashboard/types.ts` — 236 LOC, every domain type in one file.
- `dashboard/hooks/useWebSocket.ts` — ~520 LOC, WS client + event routing + derivation + legacy shims + initial fetches all in one effect.
- `mobile/VoicePage.tsx` — **1332 LOC**, the largest single component.
- `mobile/api.ts` — 584 LOC, mobile-specific API client, but **also imported by `dashboard/store.ts`**. `mobile/` and `dashboard/` are not siblings — they are entangled.
- Large UI files: `KnowledgePanel.tsx` 730, `ProposalsPanel.tsx` 534, `Scene.tsx` 490 (R3F).
- **No data layer.** Components read raw relay JSON via fetch/WS and dump it into Zustand. No schema validation. Hand-written interfaces used as wire casts (`as never`, `as unknown as ...`).
- **No abstraction between "what to show" and "how to show it."** `Scene.tsx` uses R3F directly; panels use HTML/CSS; nothing in between.
- The one clean abstraction in the codebase is `src/platform/{web,electron,capacitor}-adapter.ts` — the platform layer.

### How the rearchitecture phases address each finding

| Finding | Addressed by |
|---|---|
| god-store, no data layer | Phase 1b scaffolding (dirs, deps, ESLint boundaries, view models) → Phase 2 (proposals data pipeline: schema → repo → store → selector → binder) |
| hand-written interfaces as wire casts | Phase 2 + Phase 3 horizontal sweep (13 remaining domain types migrated to schema → repo → binder) |
| no "what vs how" abstraction | Phase 1b view models + Phase 4 ListGraph (the first renderer that consumes a view model instead of raw store state) |
| mobile/dashboard entangled imports | Phase 3 horizontal sweep — concept-first folders, not feature-first |
| god-files >400 LOC | Implicit in the schema-per-concept and view-model-per-concept structure; no explicit cap yet — recommend adding one (median 100–150, hard cap 400) |

The audit's conclusion: **the rearchitecture is addressing the right things in the right order.** This proposal does not change the phase plan. It validates it with evidence and adds the testing/stack/renderer commitments around it.

### Recommended file-size cap (new)

- **Median: 100–150 LOC per file.**
- **Hard cap: 400 LOC.** Anything larger must be split unless it is a single stateful unit that genuinely cannot be decomposed.
- One React component per file. Type-only files separated from logic files. Pure function modules per concern (drawing, formatting, status derivation each in their own file).
- Rationale: Read tool default truncation at 2000 lines is a soft signal; Aider's published benchmarks show edit success rates drop sharply on files >500 LOC; small files enable parallel-agent editing without merge conflicts. This is a discoverable LLM ergonomics property, not a style preference.

---

## Tradeoffs and what could go wrong

- **Boundary-validation enforcement is a discipline tax.** Lint rules catch the obvious cases; the subtle cases (e.g., a type assertion buried in a helper) still get through. Mitigation: review-time spot checks, plus the m.text class of bugs becomes the canonical example in onboarding docs.
- **Property tests have a learning curve.** `fast-check` is less familiar than Jest/Vitest example tests. Mitigation: the schemas already encode invariants, so most properties write themselves; one well-documented example in the codebase becomes the template for the rest.
- **Playwright fixtures rot.** Frozen production data drifts from real production over time. Mitigation: schedule a quarterly fixture refresh via a scripted recorder; gate fixture updates on CEO review of the diff.
- **Staying on TS forecloses Rust as a future option.** It does not — the "Rust island for the relay hot path" door remains open via napi-rs. The proposal explicitly defers that decision until a measured bottleneck appears.
- **HTML ListGraph may not be visually compelling.** That is the point. The CEO sees the data flow correctly, then decides how much visual investment is justified. The contract is the deliverable, not the polish.

---

## Next steps (if approved)

1. **Stack hardening (Phase 3 follow-on):**
   - Enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` in `tsconfig.json`
   - Configure `eslint-plugin-boundaries` at error level
   - Schema-derive `message-relay/src/types.ts` from Zod
   - Write `GLOSSARY.md`

2. **Testing rollout:**
   - Add a lint rule (or codified review checklist) flagging hand-rolled interfaces typed against `await res.json()` / WS frame data
   - Add `fast-check` as a dev dependency; write one canonical property test per existing schema as a template
   - Build the relay-snapshot recorder and commit a first set of anonymized fixtures under `tests/ui/fixtures/`
   - Wire the existing Playwright tests to consume those fixtures so the m.text class of bugs surfaces

3. **Renderer phase:**
   - Continue the already-shipped HTML `ListGraph` work
   - Do not add ReactFlow, R3F, dagre, or d3-force until the CEO has seen ListGraph working against real data and approved the next step

4. **Open questions for the CEO:**
   - Approve the file-size cap (median 100–150, hard cap 400)?
   - Approve adding `fast-check` as a dev dependency now (low cost, used immediately)?
   - Approve the relay fixture recorder as a small dedicated piece of work before Phase 3 closes?
   - Is the Rust island worth even *planning* now, or stay theoretical until measured?

---

## Sources

- arXiv 2504.09246 (April 2025) — type-constrained decoding cuts compile errors 74.8% vs 9.0%
- Microsoft RustAssistant — 74% accuracy fixing real Rust compile errors via compiler+LLM iteration
- Microsoft SWE-Sharp-Bench (AIware 2025) — 70% Python vs 40% C# on identical configs
- Anthropic red-team agentic property-based testing — 56% valid bug rate, $5.56/bug
- arXiv 2510.09907 — agentic-PBT six-step workflow, 933 modules across 100 packages
- "Self-Spec" HumanEval results — schema-first prompting lifts pass rates
- DDD bounded contexts study — 55% → 88% production-ready code across architecture boundaries
- xyflow / ReactFlow v12 stress-test demos — 400 nodes + 800 edges at 60fps on iPhone 12
- Aider (Paul Gauthier) — published benchmarks on edit success rates by file size
- Internal: commit `9674157` (m.text crash), `a23b038` (network badge), `44c7802` (overlay-in-chat-mode)
- Internal: `src/data/schemas/proposal.ts`, `src/data/repos/relayRepo.ts`, `src/domain/eventBinders/bindProposals.ts`, `src/features/mobile/api.ts`, `tests/ui/mobile.spec.ts`
