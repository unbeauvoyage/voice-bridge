---
id: llm-era-tech-stack
type: proposal
version: 1.0
status: proposed
created: 2026-04-09T21:32:12
updated: 2026-04-09T21:32:12
title: LLM-era tech stack — keep TypeScript, harden the boundaries
summary: Sunk-cost-free re-evaluation of the productivitesse stack. Conclusion: keep TypeScript end-to-end, but invest in stronger boundary types (Effect Schema or tRPC), explicit bounded contexts, and a Rust island for the relay's hot path. Switching wholesale to C# or Rust would lose more in ecosystem corpus and full-stack unification than it gains in compiler strictness.
author: stack-researcher
---

# LLM-era tech stack — keep TypeScript, harden the boundaries

## Mandate

CEO is mid-rearchitecture (TypeScript + React + Fastify relay) and wants an objective, sunk-cost-free answer: is this the right foundation long-term for an LLM-era codebase, or would a different stack produce fundamentally better LLM outputs? Frame the question from the LLM's perspective, not human DX.

## TL;DR

**Keep TypeScript. Harden the boundaries.** Specifically:

1. **Stay on TypeScript end-to-end** — strict mode, no `any`, no `// @ts-ignore`. The training-data corpus for TS is enormous and the full-stack unification value (one type travels client→wire→server) is unmatched.
2. **Replace hand-typed wire protocols with schema-derived types** — adopt Effect Schema (or tRPC for procedure-style endpoints) so the relay's `Message` type is generated from a schema rather than maintained by hand. This collapses 33% of LLM compile-time failures (the "wrong field name / wrong arg type at the boundary" class).
3. **Adopt explicit bounded contexts in `src/`** — the rearchitecture already moves toward this with `features/`, `data/schemas/`, `transport/`. Push it further: each bounded context exports an SDK-style facade, internals are private. Independent published research shows this raises LLM production-ready output from ~55% to ~88% on monolithic vs bounded codebases.
4. **Create a Rust island for the relay's hot path only** — message routing, persistence, attachments. Keep Fastify routes in TS as the "outer shell" so LLMs can iterate fast on the public-facing API. The Rust core becomes a stable, compiler-enforced contract that almost never changes.
5. **Do NOT switch to C#/.NET, Rust-everywhere, or Go.** The rationale below.

## The framing — what we're optimizing for

This is the heart of the question. Traditional stack debates optimize for **human developer experience**. In the LLM era, the dominant cost is the **iteration loop**: prompt → generate → compile → fix → repeat. Stack choice should minimize the number of iterations needed to produce correct code.

That decomposes into five measurable axes:

| Axis | What it measures | Why it matters for LLMs |
|---|---|---|
| **Type-system constraint strength** | How much wrong code the compiler refuses | Forces self-correction at compile time, before tests |
| **Architecture explicitness** | How much intent is encoded in file structure / interfaces | More ceremony = more context the LLM can read instead of guess |
| **Boundary cost** | What the LLM must hold in head when crossing client/server | Lower = fewer "phantom field" hallucinations |
| **Training-data corpus size and uniformity** | How much high-quality code the model has seen | Affects baseline output quality before any project context |
| **Self-correction loop quality** | How fast / how clearly the compiler tells the LLM it's wrong | Determines iteration count |

Crucially, **human concerns invert here**. "DDD is heavy", "TypeScript decorators are noise", "Java is verbose" — these are anti-features for humans but pro-features for LLMs because they encode intent the LLM would otherwise have to invent.

## The evidence

### 1. Type-constrained generation reduces compile errors by 8x

Recent paper (April 2025, arXiv 2504.09246, "Type-Constrained Code Generation with Language Models") found that **type-constrained decoding reduces compilation errors by 74.8% versus 9.0% for syntax-only constraints**. Type errors account for **33.6% of all failures in LLM-generated code** — and these are not typos. They are: wrong argument types, incompatible return values, accessing nonexistent fields. Exactly the class of error that a strong type system catches and a permissive one defers to runtime.

**Implication:** The strength of the type system is a primary determinant of LLM iteration count. This favors Rust > C# > TypeScript-strict > Go > Python.

### 2. Rust's compiler feedback loop is the gold standard

Microsoft Research's RustAssistant paper (arXiv 2308.05177) demonstrates **74% accuracy in fixing real-world Rust compilation errors** purely from compiler output + LLM iteration. The Rust ecosystem advantage is twofold:
- **Strict, structured compiler errors** — the borrow checker output is dense but unambiguous; LLMs converge fast.
- **Uniform corpus** — `cargo` layout, `rustfmt`, Clippy, and a culture of CI mean the training distribution has less stylistic noise. Models output more idiomatic code on the first try.

**Implication:** Rust is genuinely the strongest single-language target for LLM code generation. We must explain why we are NOT recommending Rust-everywhere.

### 3. C#/.NET is empirically harder for current LLMs

SWE-Sharp-Bench (Microsoft Research, AIware 2025, arXiv 2511.02352) is the first reproducible C# software-engineering benchmark with 150 instances from 17 repos. Headline: **frontier models solve 70% of Python tasks but only 40% of C# tasks** under identical agent configurations. The gap is attributed to higher inherent change complexity in C# projects (mean 4.88 files modified per patch, mean 131 lines added/removed) AND smaller training corpus.

**Implication:** Despite C#'s nominal type system advantage, the ecosystem cost (smaller corpus, more verbose change patterns) currently dominates. C# is *worse* than TypeScript for LLMs in practice today, even though it would be better in theory.

### 4. DDD bounded contexts dramatically improve LLM output

Independent analysis (understandingdata.com, 2026): in monolithic codebases, LLMs produce ~55% production-ready code; with explicit bounded contexts, ~88%. Mechanism:
- **Cognitive load reduction**: LLM loads 15-25% of codebase per task instead of 100%
- **Explicit interfaces**: SDK-style factory functions act as reading-time documentation
- **Ubiquitous language**: domain terms (`confirmOrder`, `cancelOrder`) become semantic anchors

The same article reports that **35% of LLM-generated code in monolithic codebases crosses architectural boundaries** and **28% of imports reference nonexistent or wrong modules**. Both classes of error are eliminated by explicit, narrow public APIs at context boundaries.

**Implication:** Architecture explicitness is as load-bearing as type-system strength. This is independent of language.

### 5. Schema-first wire types collapse a third of all LLM mistakes

The 33% boundary-error finding above is exactly the surface that tools like tRPC, Effect Schema, ts-rest, and OpenAPI codegen address. tRPC's "code-as-contract" pattern (server router → inferred client types, zero codegen) gives the LLM a single source of truth: change a field name on the server and the client immediately fails to compile. No guesswork, no drift.

The current relay (`message-relay/src/types.ts`) defines `Message`, `MessageType`, `StatusResponse` by hand. Every time an LLM touches the relay protocol, it must independently re-derive the contract from reading the file — and there is nothing forcing the dashboard's TypeScript code to stay in sync. This is the single highest-leverage change available to us.

**Implication:** The most actionable improvement is not language change — it is replacing hand-typed wire protocols with schema-derived types within the existing TypeScript stack.

### 6. Full-stack unification value is enormous

When client and server speak the same language, a single type literally travels across the wire. The LLM holds **one** mental model. When client is TS and server is C# or Rust, the LLM holds **two** models plus the serialization rules between them. Empirically, this is where most "phantom field" errors come from in heterogeneous stacks.

The current stack already pays the unification dividend. Switching the relay to Rust or C# would forfeit it.

## Stack scoring matrix

Scoring 1-5 (5 = best) on each axis. "Current TS strict" reflects what we have today; "Current TS hardened" reflects this proposal's recommendation.

| | Type strength | Arch. explicit | Boundary cost | Corpus | Self-correct | **Total** |
|---|---|---|---|---|---|---|
| **Current TS strict** | 3 | 2 | 2 | 5 | 3 | **15** |
| **Current TS hardened (proposal)** | 4 | 4 | 5 | 5 | 4 | **22** |
| C# / .NET 9 + React | 4 | 4 | 2 | 3 | 4 | **17** |
| Rust everywhere (incl. UI via Leptos/Dioxus) | 5 | 4 | 5 | 2 | 5 | **21** |
| Rust backend + TS frontend | 5 | 4 | 2 | 4 | 5 | **20** |
| Go backend + TS frontend | 2 | 3 | 2 | 4 | 3 | **14** |
| TS everywhere + Rust island for hot path | 4 | 4 | 4 | 5 | 4 | **21** |

**Reading the table:**
- The current stack as-is (15) significantly underperforms.
- Pure Rust (21) is technically excellent but loses the corpus war and forces Leptos/Dioxus, which have tiny LLM training data.
- C# (17) is a wash — its theoretical advantages don't materialize in current model performance (SWE-Sharp-Bench data).
- **Hardened TS (22)** wins because it's the only option that scores 4+ on every axis. It's also the lowest-cost path from where we are.
- "TS + Rust island" (21) is a credible second place and is partially achievable as a follow-on (the relay hot path).

## Why not C# / .NET

C# is the most defensible "bigger than TS" alternative. We rejected it because:

1. **Empirical underperformance**: 40% vs 70% solve rate on SWE-Sharp-Bench vs SWE-Bench Verified. LLMs are demonstrably worse at C# today than at Python or TS.
2. **Ecosystem fragmentation**: ASP.NET Core, MAUI, WPF, WinForms, Unity, Blazor — the C# corpus is split across many UI frameworks. None are dominant in modern LLM training data the way React is for TS.
3. **Lost full-stack unification**: would force a wire boundary between TS frontend and C# backend. Adds the 33% boundary-error class right back.
4. **Switching cost**: complete rewrite of `src/`, `electron/`, `message-relay/`, and `native/`. Multi-month project for an unproven net win.

C# would be the right answer if we were starting from zero AND the team was already C#-native AND we accepted Blazor or MAUI for UI. None of those hold.

## Why not Rust everywhere

Rust is the strongest language for LLM code generation in isolation. We rejected Rust-everywhere because:

1. **UI ecosystem is too small**: Leptos, Dioxus, Yew, Tauri all exist but their combined LLM training corpus is < 5% of React's. LLMs hallucinate APIs constantly in these frameworks today.
2. **No path for Capacitor / Electron parity**: replacing Capacitor and Electron with Tauri is plausible long-term but the iOS native bridging story is much less mature.
3. **Compile times**: Rust's incremental compile cycle is slower than TS's. The LLM iteration loop for tight UI iteration would be painful.
4. **Impossible migration**: this would be a complete rewrite of every line of code, plus retraining all team agents.

**However**, Rust has a clear role: **a Rust island for the relay's hot path** (message routing, persistence, attachments). This is where:
- The contract is stable (it almost never changes once correct)
- The performance matters
- Memory safety bugs would be catastrophic
- The interface is narrow (a few functions)

This is a follow-on, not a v1.

## Why not Go

Go scores worst on type-system strength of the serious contenders. Its simplicity is a human advantage but actively unhelpful for LLMs — the looser type system catches fewer mistakes, and the lack of generics until recently means the corpus is full of hand-rolled type-unsafe patterns. Go is a fine choice for humans on small-team backend services. It is the wrong choice when LLMs are the primary author.

## What to actually do — concrete recommendations

### Phase A — Immediate, low-risk (this week)

1. **Schema-derive the relay protocol**. Replace `message-relay/src/types.ts` hand-written types with Zod (already in the project) or Effect Schema definitions. Generate the TS types from those schemas. The dashboard imports the same schemas. Result: LLMs can no longer drift the wire protocol on either side.
2. **Enforce bounded-context boundaries with ESLint**. The project already has `eslint-plugin-boundaries` in devDependencies — actually enable it and define the boundaries. Each `src/features/*` becomes a context with an explicit public API.
3. **Document the ubiquitous language**. A short `GLOSSARY.md` with the canonical terms (`relay`, `agent`, `message`, `worktree`, `proposal`, `team-lead`, `bounded-context`). LLMs read this as an anchor.

### Phase B — Medium term (this month)

4. **Adopt Effect Schema or tRPC for all client↔server APIs**. Pick one and standardize. Effect Schema is a better fit if we want runtime validation everywhere; tRPC is better if we want zero-codegen procedure-style APIs.
5. **Tighten TS strict-mode further**: enable `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Each one closes a class of errors LLMs make.
6. **Migrate the remaining 13 hand-written schemas in `src/data/schemas/`** from `_meta.ts` (TS-only) to `_base.ts` (Zod-validated). Work already in progress per task #6.

### Phase C — Long term (next quarter, optional)

7. **Carve out a Rust island for the relay's hot path**. Routing, persistence, attachment storage. Expose via a stable napi-rs interface. Keep all Fastify HTTP/WS routes in TS as the outer shell. This buys us Rust's compiler guarantees on the part of the system that's most cost-of-failure.
8. **Re-evaluate Tauri vs Electron**. Capacitor stays for mobile (no real alternative). Tauri becomes interesting if/when its iOS story matures. Not urgent.

### What NOT to do

- Do not rewrite to C#, .NET, or Rust wholesale.
- Do not abandon TypeScript end-to-end unification.
- Do not adopt heavyweight DI frameworks (NestJS, Inversify) — they add ceremony LLMs don't yet handle well.
- Do not switch from React to a less popular framework. React's training-data dominance is an enormous LLM advantage.

## Risks and unknowns

- **Schema-derived types add a small upfront cost**. We need to decide between Zod (simpler, already in the codebase) and Effect Schema (more powerful, larger learning curve). Recommend Zod for v1.
- **Bounded-context enforcement may break existing imports**. Allow a grace period; ratchet `eslint-plugin-boundaries` from "warn" to "error".
- **The Rust island is genuinely complex**. Defer until Phase A and B prove the underlying thesis.
- **Model capabilities change quickly**. If LLMs get dramatically better at C# or Rust UI frameworks, the matrix shifts. Re-evaluate annually.

## Open questions for CEO

1. Is the "Rust island for relay hot path" interesting enough to plan for, or should it stay theoretical?
2. Effect Schema vs Zod — willing to accept Effect's larger surface area for its stronger guarantees?
3. Are we willing to enforce bounded-context ESLint rules even if it temporarily breaks builds in worktrees?

## Coordination

This proposal intersects with schema-tester's research on schema-driven development and testing. The recommendation here (schema-derive the relay protocol, tighten boundaries) is the "compile-time" face of what schema-tester is doing for the "runtime validation" face. Both should ship together for maximum effect.

## Sources

- [Type-Constrained Code Generation with Language Models (arXiv 2504.09246)](https://arxiv.org/pdf/2504.09246)
- [RustAssistant: Using LLMs to Fix Compilation Errors in Rust Code (Microsoft Research)](https://www.microsoft.com/en-us/research/publication/rustassistant-using-llms-to-fix-compilation-errors-in-rust-code/)
- [Fixing Rust Compilation Errors using LLMs (arXiv 2308.05177)](https://arxiv.org/abs/2308.05177)
- [SWE-Sharp-Bench: A Reproducible Benchmark for C# Software Engineering Tasks (arXiv 2511.02352)](https://arxiv.org/abs/2511.02352)
- [DDD Bounded Contexts: Clear Domain Boundaries for LLM Code Generation](https://understandingdata.com/posts/ddd-bounded-contexts-for-llms/)
- [Choosing Rust for LLM-Generated Code (RunMat)](https://runmat.com/blog/rust-llm-training-distribution)
- [tRPC: End-to-End Type Safety Without Code Generation](https://www.gocodeo.com/post/trpc-achieving-end-to-end-type-safety-without-code-generation)
- [Effect Schema documentation](https://effect.website/docs/schema/introduction/)
- [MultiPL-E benchmark](https://github.com/nuprl/MultiPL-E)
