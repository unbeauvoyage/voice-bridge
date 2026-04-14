---
id: unified-ceo-app-migration-plan
title: Unified CEO App — Migration Plan (productivitesse + knowledge-base + voice-bridge)
date: 2026-04-15T02-05-33
status: proposed
priority: high
summary: Converge productivitesse, knowledge-base, and voice-bridge frontends into a single CEO personal app organized by features and pages per the data-architecture cookie cutter. Phased plan — each project first conforms to the cookie cutter in place, then combine into one app, then cross-pollinate. `shared/` disappears once unified because there is only one root.
---

## Goal

Three projects currently coexist as separate frontends (productivitesse, knowledge-base, voice-bridge) that each serve the same person (CEO). The long-term target is a single unified personal app where:

- **Features are capabilities** — "knowledge search," "voice chat," "window switcher," "notes," "sessions monitor," "agent messaging." Each lives once, used everywhere.
- **Pages compose features** — "dashboard page" shows knowledge + sessions + voice in one view; "chat page" has messaging + voice + video; "knowledge page" is focused on search + reading.
- **One frontend, one platform adapter layer** — Electron for desktop, Capacitor for mobile, web for browser.
- **No `shared/` folder** — once unified, every capability belongs to a feature. The `shared/` concept only exists when multiple separate projects need a common library.

## Migration Order Analysis

Three possible orders:

### Option A — Each conforms first, then combine
1. Each team refactors its own frontend to the feature/page/data-architecture cookie cutter.
2. Once all three are structurally identical, combine them into one repo.
3. Deduplicate and cross-pollinate.

### Option B — Combine first, then restructure
1. Merge three repos into one (mechanical).
2. Restructure the combined codebase once.

### Option C — Combine and restructure in one go
1. Single mega-refactor that merges and restructures atomically.

### Recommendation: **Option A — conform first, then combine**

Rationale:
- **Smaller atomic migrations.** Each project is already a working app. Refactoring a working app is straightforward; merging three at once is risky.
- **Parallel teams.** Three team leads can execute Phase 1 in parallel — no cross-project coordination required until Phase 2.
- **Identical structure = trivial combine.** If all three converge on the same cookie cutter first, Phase 2 becomes a mechanical file move with predictable conflicts only in top-level infrastructure (package.json, tsconfig, router).
- **Lower blast radius.** If one project hits trouble in Phase 1, the other two continue. In Option B or C, any problem blocks everything.
- **Testable increments.** Phase 1's output is verified independently — each project's tests pass in isolation before combine. In Option B, you have no intermediate green state.

Option B is rejected because the "messy combined state" would block development for days. Option C is rejected because mega-refactors have historically produced the bugs we are trying to eliminate.

---

## Phase 1 — Conform Each Project to the Cookie Cutter (parallel)

Each project goes through the same internal refactor. Estimated 1 week per project, runnable in parallel.

### 1.0 Shared preconditions (all three projects)

Before any file moves:
1. **Install ESLint boundary enforcement**: `eslint-plugin-boundaries`, `no-restricted-imports` configured per the data-architecture module
2. **Add Playwright + vitest** where missing
3. **Write behavior tests for everything that must survive the refactor** — the same test fortification discipline as myenglishbook's Phase 1
4. **Confirm tsc strict flags** match the code-standards module
5. **Install PostToolUse hook** (already deployed — no action needed)

No refactor proceeds without Phase 1.0 being green.

### 1.1 productivitesse

**Current state:** Already uses some feature folders (`src/features/dashboard/`, `src/features/mobile/`, `src/features/runner/`, etc.), plus flat `src/domain/`, `src/platform/`, `src/data/`.

**Target:** Every capability moves into `src/features/<name>/` with the mandatory subdirectory shape. Pages move to `src/pages/`. Shared platform adapters stay in `src/platform/` (they are genuine infrastructure, not a feature).

**Concrete steps:**
1. Audit `src/features/*` directories — confirm each is a real capability (not a page).
2. Move route components (`app/*/route.tsx`) into `src/pages/<X>Page.tsx`. Update React Router config to import from `@/pages/`.
3. Move `src/domain/` contents into the feature that owns them (`src/features/<X>/domain/`).
4. Move `src/data/` flat files into features. If a data hook is used by multiple features, move it to the feature with the strongest ownership and expose via `index.ts`.
5. Create/tighten `src/features/<X>/index.ts` as the public API for each feature.
6. Enable the ESLint boundary rules (F1–F6 from the cookie cutter).
7. Fix all lint errors — this will surface any improper cross-feature imports.
8. Audit `src/stores/` — move client state into features that own it. Only genuinely global UI state (theme, layout preferences) stays at root.
9. Confirm every page in `src/pages/` is pure composition — no `useQuery`, no store-writes, only imports from feature APIs.
10. All tests pass at the end.

### 1.2 knowledge-base

**Current state:** 🚨 4,906-line `web/app.tsx` monolith. No feature structure. Bun server + React UI in one project.

**Target:** Two-step refactor — first break `app.tsx` into features, then apply the cookie cutter layers.

**Concrete steps:**
1. Identify the natural features inside `app.tsx` — likely candidates: `knowledge-list`, `knowledge-reader`, `knowledge-search`, `knowledge-ingest`, `tags`, `ratings`, `browser-extension-ui`.
2. Create `web/src/features/<X>/` for each candidate and extract the corresponding code from `app.tsx` in staged commits.
3. Extract routing from `app.tsx` into `web/src/pages/` with each page composing the relevant features.
4. Convert the Bun server API surface to OpenAPI if not already — this is the backend side and can happen in parallel.
5. Install `@hey-api/openapi-ts`, generate Layer 1 hooks from the Bun server's OpenAPI spec.
6. For each feature, migrate to the three-layer data hook architecture: generated Layer 1, thin Layer 2 wrappers, Layer 3 composition.
7. Migrate any state from `app.tsx`'s inline state to a Zustand store in the owning feature — client state only.
8. Enable ESLint boundary rules.
9. The browser extension UI (`extension/`) is a separate concern — keep as its own frontend or extract into `web/src/features/browser-extension/` if it shares code.
10. All tests pass.

This is the biggest of the three Phase 1 efforts. It may take two weeks rather than one.

### 1.3 voice-bridge

**Current state:** Bun daemon + Electron tray app. Minimal UI. Some overlap with voice-bridge2.

**Target:** Frontend (if any) conforms to the cookie cutter. The daemon side stays as a separate process.

**Concrete steps:**
1. Decide: keep voice-bridge and voice-bridge2 as separate projects, or merge voice-bridge2 into voice-bridge. (This is a blocking CEO question before Phase 1.3 begins.)
2. Identify voice-bridge's frontend surface — overlay panel, settings UI, status indicators. Move these into `src/features/voice/` and `src/features/voice-settings/` within voice-bridge's electron side.
3. Create `src/pages/` for any panel pages (e.g., `OverlayPage.tsx`, `SettingsPage.tsx`).
4. The Bun daemon stays as a separate process — it's a server, not a frontend. It has its own tsconfig and is not subject to the feature/page rules. It uses `shared/domain/` for wire types.
5. Enable ESLint boundary rules for the frontend side only.
6. All tests pass.

This is the smallest Phase 1 effort.

### Phase 1 Definition of Done (per project)

For each project individually:

- [ ] `src/pages/` contains every route destination
- [ ] `src/features/<X>/` contains every capability
- [ ] No page file exists inside a feature directory (F1 enforced)
- [ ] Every feature has `index.ts` as its public API (F2 enforced)
- [ ] Cross-feature imports go only through `index.ts` (F4 enforced)
- [ ] Layers within features respect the boundary rules (F5 enforced)
- [ ] Pages import only from feature public APIs and `shared/` (F6 enforced)
- [ ] All ESLint boundary rules pass with zero warnings
- [ ] `tsc --noEmit` passes under strict flags
- [ ] All tests pass — Playwright E2E + vitest units
- [ ] `shared/` contains only items that pass the 3-feature rule

---

## Phase 2 — Combine Into Unified CEO App

Only starts when all three projects have completed Phase 1 and all three test suites are green.

### 2.1 Create the unified repo

```
~/environment/projects/ceo-app/
  src/
    pages/                    ← merged from all three
    features/                 ← merged from all three
    data/
      apiClient/
        generated/            ← single OpenAPI spec (or composed if still multi-backend)
    app/
      router.tsx              ← unified router composing routes from all features
      providers.tsx           ← unified React Query + theme + Zustand providers
      shell.tsx               ← unified app shell
  electron/                   ← Electron main process (from productivitesse + voice-bridge merged)
  capacitor/                  ← mobile shell (from productivitesse)
  tests/
  package.json
  tsconfig.json
  eslint.config.mjs
```

### 2.2 Move features

For each of the three projects:
1. Copy `src/features/*/` from the source project into `ceo-app/src/features/`
2. Copy `src/pages/*.tsx` into `ceo-app/src/pages/`
3. Resolve name collisions — if two projects have a feature with the same name, either merge them (if they represent the same capability) or rename one.
4. Update imports — `@/features/X` paths should resolve identically in the new project.

### 2.3 Unify infrastructure

1. Merge `package.json` files — dedupe dependencies, choose versions (prefer newer)
2. Merge `tsconfig.json` — use the strictest of the three as the unified baseline
3. Merge ESLint configs — boundary rules apply to the unified `features/` and `pages/`
4. Unify router — the unified router imports from every feature's `index.ts` and aggregates routes
5. Unify providers — one React Query client, one theme provider, one Zustand store per feature

### 2.4 Drop `shared/`

Once unified, `shared/` has no reason to exist. Every item in each project's former `shared/` directory:

1. Is it used by at least 3 features in the new unified app? → Keep at top level in `src/shared/ui/`, `src/shared/hooks/`, etc.
2. Is it used by one or two features only? → Move into the primary owning feature, expose via `index.ts`.
3. Is it framework or generic (Button, Modal, useDebounce)? → `src/shared/ui/` or `src/shared/hooks/` — these are not anyone's feature, they are generic.

The rule "`shared/` goes" is slightly overstated — **generic UI primitives still belong in `shared/ui/`** because they have no feature ownership. What DOES go is any `shared/` entry that was there because two projects needed the same domain-aware code. Those move into feature ownership.

### 2.5 Phase 2 Definition of Done

- [ ] All features from all three projects live in `ceo-app/src/features/`
- [ ] All pages from all three projects live in `ceo-app/src/pages/`
- [ ] Unified package.json, tsconfig, eslint.config
- [ ] Unified router imports from every feature
- [ ] Every test from every original project passes in the unified repo
- [ ] `pnpm lint` (or equivalent) passes with zero boundary violations
- [ ] `tsc --noEmit` passes
- [ ] Electron app launches and shows a dashboard with all three original apps' capabilities
- [ ] Mobile (Capacitor) build produces an installable iOS app
- [ ] The CEO can use the unified app to do everything the three separate apps did

---

## Phase 3 — Cross-Pollinate and Deduplicate

With everything in one codebase:

1. **Identify duplicated capabilities** — e.g., both productivitesse and voice-bridge had relay message panels. Merge into one `features/messaging/` used by both (whichever) pages.
2. **Cross-pollinate** — the voice chat feature now appears on the dashboard page (previously productivitesse's) AND on the knowledge reader page if voice-read-aloud is added.
3. **Unify the backend story** — if the CEO wants a single unified backend, merge the relay + knowledge-base server into one service over time. This is a separate discussion.
4. **Polish pages** — rewrite pages to take best advantage of having all features available. Build genuinely multi-feature pages (chat page with voice + video, dashboard with everything, knowledge page with TTS).

Phase 3 has no fixed end — it is ongoing product work once the architecture is unified.

---

## Open Questions for CEO

1. **voice-bridge vs voice-bridge2** — which survives? This must be answered before Phase 1.3 starts.
2. **Target repo location** — new `projects/ceo-app/`, or merge into the largest of the three (productivitesse)?
3. **Backend unification timeline** — is merging the knowledge-base Bun server with the relay in scope for Phase 3, or parked indefinitely?
4. **Electron vs Tauri** — productivitesse uses Electron, voice-bridge uses Electron. Long term, does the unified app stay on Electron or eventually move to Tauri? (Not blocking — can stay on Electron for now.)
5. **Mobile — which features are mobile-first?** productivitesse's mobile feature already exists. Does voice-chat go on mobile too? Knowledge-base reader on mobile? Decisions affect how features are implemented.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Phase 1 takes longer than expected on knowledge-base | Acceptable — run the other two in parallel and merge when kb is ready |
| Feature name collisions during Phase 2 | Phase 1 audit must flag collisions early; rename during Phase 1 if caught |
| Unified router complexity (too many routes) | Split into route groups by feature cluster; React Router v7 supports nested route configs |
| Test infrastructure conflicts (Playwright configs, etc.) | Choose one Playwright config during Phase 2; migrate tests one feature at a time |
| Electron main process conflicts | Phase 2.3 must carefully merge electron/main.ts from both productivitesse and voice-bridge |
| Bundle size explodes | After Phase 2, run bundle analyzer; lazy-load features that aren't on critical path |
| Team lead disagreements on feature boundaries | Chief of Staff arbitrates; the cookie cutter is authoritative |

---

## Ownership

- **Chief of Staff** — owns this plan, arbitrates cross-project architectural questions, owns the cookie cutter module updates
- **productivitesse team lead** — owns Phase 1.1
- **knowledge-base team lead** — owns Phase 1.2
- **voice-bridge team lead** — owns Phase 1.3
- **Chief of Staff + rotating coder** — owns Phase 2 execution (mostly mechanical)
- **Chief of Staff + feature owners** — owns Phase 3 polish

---

## Timeline (rough)

- Phase 1 parallel execution: 2 weeks (knowledge-base is the long pole)
- Phase 2 combine: 1 week
- Phase 3 polish: ongoing

Total to unified working app: ~3 weeks of engineering with three parallel teams.
