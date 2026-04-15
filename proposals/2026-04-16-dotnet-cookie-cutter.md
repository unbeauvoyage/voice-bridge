---
title: .NET as the Single Cookie-Cutter — Cross-Surface Stack for Games, Web, Mobile, Desktop
author: chief-of-staff
created: 2026-04-16T06:11:34
status: draft-for-discussion
audience: ceo
summary: Recommend .NET (C#) as the one scalable cookie-cutter spanning Unity games, ASP.NET backends, MAUI mobile+desktop, and Blazor/React web. Framework-fatigue killer. Existing TypeScript projects stay. This draft is for CEO discussion — key decisions and open questions listed at the end.
---

# .NET as the Single Cookie-Cutter

## Why this proposal exists

CEO constraints (stated 2026-04-16):

1. **Games in ~1 month**, ongoing. Unity is the default game engine → C#.
2. **Commercial web + mobile + desktop apps**, ongoing alongside games.
3. **No framework decision fatigue.** One cookie-cutter that scales both directions (tiny tool → commercial product). Never "use X for light, Y for heavy."
4. **AI silent-failure aversion.** Python/Django ruled out: dynamic typing lets AI write plausible-looking code that fails at runtime. Want strict static typing across the stack.

Current state: TypeScript across productivitesse, knowledge-base, voice-bridge, message-relay. TS-strict is working but it is a web-first stack. Unity work is imminent. Commercial mobile/desktop is on the roadmap. A single unified stack would collapse four framework choices into one.

This document is a **starting point for discussion, not a final ruling.** CEO explicitly wants to discuss this more. Decisions are called out at the bottom.

---

## Recommendation

**Adopt .NET as the cookie-cutter for all new greenfield projects.** Existing TypeScript projects stay TypeScript — no rewrites.

### What "the cookie-cutter" means concretely

A single template directory at `~/environment/templates/dotnet-cookie-cutter/` containing:

```
dotnet-cookie-cutter/
├── src/
│   ├── App.Api/                 # ASP.NET Core minimal API (backend)
│   ├── App.Core/                # domain logic, pure C#, no framework deps
│   ├── App.Infrastructure/      # EF Core, external services
│   ├── App.Shared/              # DTOs shared with UI
│   ├── App.Web/                 # Blazor WASM (web UI, optional)
│   ├── App.Mobile/              # MAUI (iOS + Android + macOS + Windows)
│   └── App.AppHost/             # .NET Aspire orchestration
├── tests/
│   ├── App.Core.Tests/          # xUnit unit tests
│   ├── App.Api.Tests/           # WebApplicationFactory integration tests
│   └── App.E2E/                 # Playwright.NET end-to-end
├── .editorconfig                # strict formatting + analyzer severity
├── Directory.Build.props        # TreatWarningsAsErrors, Nullable enabled, AnalysisLevel latest
├── .claude/
│   ├── settings.json            # PostToolUse hook: dotnet build + dotnet test on edit
│   └── HOOK-PATTERN.md
├── global.json                  # pinned .NET SDK version
└── README.md
```

One `dotnet new` away from a working scaffold with all surfaces wired.

### Scaling both directions

**Scaling down** (tiny tool): delete `App.Web/`, `App.Mobile/`, `App.AppHost/`. Keep `App.Api` + `App.Core` + tests. Single-project solution.

**Scaling up** (commercial product): everything is already there. Add services under Aspire, scale horizontally, swap SQLite→PostgreSQL via EF Core provider change (same pattern as our current Drizzle rule).

The same project can grow from "weekend tool" to "commercial SaaS" without a framework migration. This is the scalability property CEO asked for.

---

## Why .NET hits all 4 constraints

### 1. Games alignment (Unity = C#)

Unity's scripting language is C#. Unity 2022+ supports .NET Standard 2.1 — you can share pure-C# domain libraries between `App.Core` and Unity game projects. No serialization gymnastics between "game brain" and "app brain." One language, one type system, one debugger across games and apps.

Longer term: Unity is migrating toward CoreCLR (announced roadmap) — further closing the gap. Betting on C# is betting with the Unity direction, not against it.

### 2. Single stack across web + mobile + desktop

| Surface | .NET answer | Notes |
|---|---|---|
| Backend API | ASP.NET Core Minimal API | Production-grade, first-party, same patterns as Node.js Express but typed. |
| Web UI | Blazor WASM (first choice) OR React/Vite + ASP.NET Core backend | Blazor keeps us in C#; React fallback acceptable if a specific project needs the JS ecosystem. |
| Mobile (iOS + Android) | .NET MAUI | Native UI, shared C# logic. Replaces Capacitor. |
| Desktop (macOS + Windows + Linux) | .NET MAUI (mac/win) OR Avalonia (Linux) | Same codebase as mobile. Replaces Electron. |
| Orchestration | .NET Aspire | One-command "run the whole stack" — API + DB + cache + frontend. Replaces docker-compose + custom shell scripts. |
| AI integration | Semantic Kernel | First-party Microsoft library. Plugin-style. Replaces our ad-hoc LLM wrappers. |
| ORM | EF Core | Same schema-then-migrate story as Drizzle. Works with SQLite and PostgreSQL, one driver swap. |
| Logging | Serilog + OpenTelemetry | Structured logs, distributed tracing, first-party OTel support. |
| Testing | xUnit + FluentAssertions + Playwright.NET | xUnit for unit/integration, Playwright.NET for E2E (same tool as today, .NET bindings). |

One answer per surface. Zero deliberation.

### 3. Zero framework fatigue

Today, a new project spawns questions: Next.js or Vite? Vitest or Playwright? Drizzle or Prisma? React Query or SWR? Electron or Tauri? Capacitor or native?

Under .NET: `dotnet new app-cookie-cutter -n MyProject`. Done. The answers are pre-baked. Agents stop deliberating and start building.

### 4. AI silent-failure resistance

Python's dynamic typing is exactly the failure mode CEO is worried about: AI writes `obj.some_field` where `some_field` does not exist, the code runs, and the error surfaces three layers deep at runtime. TypeScript catches most of this but has escape hatches (`any`, `as`, `// @ts-ignore`).

C# with:
- **Nullable reference types enabled** (`<Nullable>enable</Nullable>`)
- **TreatWarningsAsErrors**
- **AnalysisLevel: latest-Recommended**
- **EditorConfig with strict analyzer severity**
- **Directory.Build.props enforcing all of the above across every project**

...gives the strictest compiler in common use. Null-misses are compile errors. Unused variables are errors. Missing await is an error. There is no `as any` equivalent that is idiomatic. Code that compiles is much more likely to be correct than code that compiles in TS.

This is the single strongest argument for .NET in an AI-heavy workflow. **AI silent failures are our #1 code-quality risk.** C# closes the gap TypeScript strict-mode leaves open.

---

## Tradeoffs

### Pros
- One language (C#) across games, backend, web, mobile, desktop. No mental context switch.
- Strictest static typing in common use → fewer AI silent failures.
- First-party Microsoft ecosystem: Aspire, Semantic Kernel, EF Core, MAUI — all under one maintainer, high quality, consistent idioms.
- MAUI replaces both Electron (desktop) and Capacitor (mobile). One framework.
- Real AOT compilation option (Native AOT) for performance when needed — no second language required.
- Roslyn analyzers are extensible — we can enforce custom project rules at compile time (same idea as our current ESLint boundary rules, but in the compiler).
- Hot reload is first-party and better than Vite HMR for most scenarios.

### Cons
- **Learning curve for our current TS-heavy agent pool.** Agents have been coding TS for weeks. C# patterns are different (async/await more formal, LINQ idioms, project-oriented rather than file-oriented).
- **iOS MAUI tooling is less polished than Capacitor.** MAUI iOS builds require Xcode + .NET workloads, slower build times than Vite→Capacitor. Real cost: ~2–4x longer iOS build cycles in early phases.
- **Blazor WASM has larger initial payload** than a Vite/React SPA (download size ~1.5–2 MB gzipped first load). Mitigated by AOT + trimming but still real on first visit.
- **React ecosystem breadth** — npm has more random libraries than NuGet. For 95% of use cases NuGet has what we need; for edge cases (e.g., a specific niche chart library) we may have fewer options.
- **Team lead and coder agent definitions** need updating. Test commands, build commands, hook scripts, code-review rubrics all assume TS today.
- **Mac-first workflow** — .NET on macOS is fully supported and production-grade, but Windows/Linux remain "first-class citizens" of the platform. No real problem since CEO's fleet is Mac + iPhone, but flagged for completeness.

### Risks
- **MAUI on iOS is the weakest link.** If CEO's mobile needs are heavy and iOS-first, MAUI may frustrate. Capacitor+React is more polished today.
- **Blazor vs React** — Blazor is still less mature than React. For public-facing commercial products where hiring/freelancers matter, React has a bigger talent pool.
- **Lock-in to Microsoft roadmap.** .NET is open-source, but Microsoft drives direction. If they pivot (unlikely but possible) we are more exposed than with a loose-coalition stack like Node.
- **Migrating existing TS projects later** would be expensive. This proposal explicitly says "don't migrate," but that means long-term maintaining two parallel stacks (TS for existing, .NET for new) until the TS projects retire naturally.

---

## Migration plan

### Phase 0 — This proposal + discussion (now → CEO decision)
No code. Just align on direction. Open questions below.

### Phase 1 — Template scaffolding (3–5 days after approval)
- Create `~/environment/templates/dotnet-cookie-cutter/` with the structure above
- Pin .NET SDK version in `global.json`
- Wire `Directory.Build.props` with nullable + warnings-as-errors + AnalysisLevel
- Write `.claude/settings.json` PostToolUse hook: `dotnet build` + `dotnet test` on edit
- Write `HOOK-PATTERN.md` mirroring productivitesse's Q5 pattern
- Playwright.NET E2E harness scaffolded
- Example `dotnet new` custom template registration so `dotnet new cookie-cutter -n X` works

### Phase 2 — Agent definitions (1–2 days, parallel with Phase 1)
- Update `.claude/agents/coder.md` with a C#/.NET profile
- Update `.claude/agents/tester.md` with xUnit + Playwright.NET patterns
- Update `.claude/agents/team-lead.md` coding rules (still "never code" — same rule)
- Add `.NET` section to `~/environment/CLAUDE.md` (code standards parity with the TS module)

### Phase 3 — First pilot project
Pick ONE greenfield project as the pilot. CEO to nominate. Candidates we know of:
- A Unity game prototype with ASP.NET backend for leaderboards/saves
- A commercial desktop app idea that has been in the backlog
- A new tool that doesn't fit any existing project

Run it through the template. Measure: time to "first working feature," iOS build time, developer velocity vs the TS baseline. Honest comparison.

### Phase 4 — Decide based on pilot evidence
If pilot goes well → .NET becomes default. If it hits real walls (MAUI iOS frustration, Blazor payload complaints, agent velocity drop) → revisit with data, not speculation.

### What does NOT happen
- **No migration of existing TS projects.** Productivitesse, KB, voice-bridge, message-relay stay TS. They work, they are shipping, no reason to touch them.
- **No "hybrid" guidance.** Each new project picks one stack. No "use C# for backend, React for frontend" split unless there is a compelling reason. Default is all-.NET.

---

## Open questions for CEO discussion

These are the decisions I want to talk through before finalizing the proposal. Listed in rough priority order.

### Q1. Blazor WASM vs React+ASP.NET for web UI — which is the default?
Blazor keeps us in one language but has ecosystem/payload tradeoffs. React has more libraries and hireable talent but reintroduces JS/TS. My lean: **Blazor for internal tools and admin UIs, React for public-facing commercial products.** But this is exactly the kind of "depends" answer CEO rejects. Do we pick one and stick with it?

### Q2. MAUI vs Capacitor+React for mobile — is iOS build time a dealbreaker?
MAUI iOS builds are slower than Capacitor iOS builds. For CEO's productivitesse-style "iterate 10x per day" workflow, this could be painful. Worth measuring on the pilot. If it's a real problem, the fallback is Capacitor+React even on .NET projects (which does break the "one stack" rule).

### Q3. Electron vs MAUI vs Tauri for desktop — replace Electron entirely?
MAUI can do desktop on macOS and Windows. Avalonia is the third option for Linux. Current voice-bridge and productivitesse electron stays. But for new desktop tools: MAUI or keep Electron? My lean: MAUI.

### Q4. Pilot project — what should it be?
Running the first project on the template is how we find out if the idea works. CEO to nominate a greenfield project — ideally one that touches at least two surfaces (e.g., backend + web, or backend + mobile, or desktop + game) so we stress the "one stack everywhere" claim.

### Q5. Does this apply to agents/tooling itself?
The environment-level tooling (message-relay, scripts, hooks) is TS today. Should future meta-tooling also be .NET, or keep the "production = .NET, meta-tooling = TS" split? My lean: **keep meta-tooling in TS.** Nobody wants to boot a CLR for a hook script. But worth discussing.

### Q6. Semantic Kernel vs raw HTTP calls for LLM work?
Semantic Kernel is Microsoft's "opinionated" LLM framework — plugins, planners, memory. We have raw HTTP + our own glue today. Adopting Semantic Kernel ties us to Microsoft's LLM abstractions. My lean: **use SK for new work, evaluate honestly after the pilot.** If it feels overstructured, we fall back to raw HTTP.

### Q7. Deployment target — Aspire in dev, but what in prod?
Aspire is great for "run locally with one command." For production deployments, we have options: Azure App Service (obvious but MS lock-in), AWS (via standard ASP.NET hosting), self-hosted (Kestrel directly), container (Docker + any orchestrator). Should we pick one now or defer until we have a production-bound project?

### Q8. Timeline pressure — is this urgent or slow-burn?
"Games in 1 month" is a real deadline. If the first game project needs to ship in 1 month, do we start with .NET (risk: learning curve eats the deadline) or ship game #1 in Unity-only + existing TS backend, then migrate the backend to .NET after? My lean: **ship game #1 pragmatically, don't let the framework decision block the deadline.** But CEO's call.

### Q9. Who writes the first line of .NET code?
Once approved, someone has to build the template. Options: (a) I spawn a .NET-fluent coder agent to build the scaffold, (b) the CEO builds the scaffold since they know .NET from prior experience, (c) hire a real human .NET developer for one week to build it right. My lean: **(a) with (b) as sanity-check reviewer.** Agent builds, CEO reviews, iterate.

### Q10. The "no decision fatigue" rule — does picking .NET itself qualify as a decision we are making right now?
Slight meta-question. The whole point of the cookie-cutter is "stop deliberating." But we are currently deliberating on which cookie-cutter to pick. Once picked, the decision is permanent (within reason). Worth naming that this is the *last* framework decision we make for this tier of work — after this, the answer to "what do I use" is always ".NET."

---

## What I need from CEO

1. Read this. Push back on anything that feels wrong.
2. Schedule a real discussion session (voice or back-and-forth on this document) covering Q1–Q10.
3. Once Q1–Q10 are resolved, the proposal gets a `status: approved` update and Phase 1 kicks off.
4. Until then: nothing changes. Existing TS projects continue. No premature commitment.

## Parking lot

Items flagged during drafting but not critical to the decision:

- **Rust** — ruled out as a second language earlier. Revisit only if a .NET service hits a performance wall we cannot address with Native AOT.
- **Python/Django** — ruled out per CEO (AI silent failure risk). Revisit only if we adopt a framework that makes silent failure impossible (e.g., `mypy --strict` with runtime enforcement), which is not a native Python story.
- **Go** — not discussed but worth naming as an alternative. Pro: simpler than C#, ships static binaries. Con: more verbose, weaker type system than C#, no Unity alignment, no mobile story. Rejected for fit.
- **JVM (Kotlin)** — similar reasoning. Kotlin has Android but no iOS story without Kotlin Multiplatform (experimental). No Unity alignment. Rejected for fit.

---

## Appendix: reference reading

- [.NET Aspire overview](https://learn.microsoft.com/en-us/dotnet/aspire/)
- [MAUI platform support](https://learn.microsoft.com/en-us/dotnet/maui/supported-platforms)
- [Semantic Kernel](https://learn.microsoft.com/en-us/semantic-kernel/)
- [Unity + .NET CoreCLR roadmap](https://unity.com/roadmap)
- [Blazor WASM performance](https://learn.microsoft.com/en-us/aspnet/core/blazor/performance)
