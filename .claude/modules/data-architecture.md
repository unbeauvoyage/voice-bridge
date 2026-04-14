# Data Architecture Cookie Cutter

**Status:** Active, mandatory for all new code
**Scope:** All TypeScript projects in `~/environment/projects/` and any new project
**Authority:** Chief of Staff owns this module. Project team leads adapt — never override the core rules.

This module defines the single data architecture every TypeScript project in the system must converge on. It is derived from an LLM-era-optimized analysis of stored-vs-derived state, enforceability, and boilerplate cost per session. See also: `code-standards.md` (TypeScript strictness, compiler feedback) and `testing-discipline.md` (TDD).

---

## The Guiding Principle

**Strictness the machine enforces is free value for LLMs. Strictness humans maintain by convention decays.** Every rule in this module must be enforceable by compiler, linter, codegen, or test — never by doc comment or convention.

The second principle: **Server state is mirrored, not stored. Client state is stored, not derived.** The moment you invert this rule, you have the dual-state bug class that consumes weeks of debugging.

---

## The Stack (mandatory)

```
Language                TypeScript, every strict flag enabled
API contract            openapi.json — source of truth for HTTP wire envelopes
                        Polyglot-safe: survives backend language changes
                        Branded types + WS event shapes live in the relay package
                        (message-relay/src/types/api.ts) — import from there, not a shared/ folder
Type + hook codegen     @hey-api/openapi-ts (or orval for legacy)
                        Generates: types, fetch client, React Query hooks, Zod schemas
HTTP client             fetch (via hey-api's @hey-api/client-fetch)
Server state            @tanstack/react-query v5
                        One cache entry per endpoint — 1:1 with server
Client state            zustand + immer + persist middleware
                        Holds client-owned state only (selections, UI flags, drafts)
Validation              Zod at every network boundary (in queryFn, before return)
Router                  React Router v7 (SPA mode) or Next.js App Router
                        Both work — data layer is router-independent
Tests                   Playwright (E2E) + vitest / bun test (units)
Linter                  ESLint + eslint-plugin-boundaries + no-restricted-imports
Edit hook               PostToolUse tsc+test hook on every file edit
Commit gate             Husky pre-commit: tsc + lint + all unit tests
```

No alternatives. No "when the project is big" clauses. This stack.

---

## Folder Organization — Feature-First with Orthogonal Pages

### The orthogonality principle

**Pages and features are orthogonal axes, not a hierarchy.**

- A **feature** is a capability the app provides — "messaging," "voice call," "video call," "user management," "notes," "editor."
- A **page** is a URL destination — "chat page," "user list page," "dashboard page."
- A single page composes many features (a chat page uses messaging + voice + video).
- A single feature appears in many pages (video call appears in the chat page AND the user list page).
- A feature may also be used in widgets or panels that are not pages at all.

Pages never own features. Features never contain pages. Each lives in its own top-level directory.

### The structure (mandatory for every TypeScript project)

```
src/
  pages/                        ← EVERY page lives here, always
    ChatPage.tsx
    UserListPage.tsx
    DashboardPage.tsx
    LandingPage.tsx
    NotFoundPage.tsx

  features/                     ← EVERY capability lives here, always
    messaging/
      components/
        MessageList.tsx
        MessageComposer.tsx
        QuickSendWidget.tsx
      hooks/                    ← Layer 3 composition hooks
      data/                     ← Layer 2 thin wrappers
      domain/                   ← Pure functions + feature-local types
      store/                    ← Zustand (client state only)
      tests/
      index.ts                  ← PUBLIC API — only thing other features/pages import
    voice/
      components/
        VoiceRecordButton.tsx
        VoiceCallControls.tsx
      ...
    video/
      components/
        VideoCallPanel.tsx
        QuickVideoButton.tsx
      ...
    user/
      ...

  shared/                       ← Genuinely cross-feature, no owner
    ui/                         ← Generic components (Button, Modal, Toast)
    hooks/                      ← Generic hooks (useDebounce)
    utils/

  data/
    apiClient/
      generated/                ← @hey-api/openapi-ts output (one generator, one dir)

  app/                          ← Root shell: router, providers, entrypoint
```

### The two binary rules for folders

1. **Every page lives in `src/pages/`. No exceptions. Pages never live inside features.**
2. **Features never contain pages. Features contain capabilities: components, hooks, data, domain, store, tests. Features export building blocks; pages assemble them.**

### Page shape (composition only)

```ts
// src/pages/ChatPage.tsx
import { MessageList, MessageComposer } from '@/features/messaging'
import { VoiceCallControls } from '@/features/voice'
import { VideoCallPanel, QuickVideoButton } from '@/features/video'

export const ChatPage = () => (
  <div>
    <header><QuickVideoButton /></header>
    <MessageList />
    <VoiceCallControls />
    <VideoCallPanel />
    <MessageComposer />
  </div>
)
```

Pages are pure composition. They do not fetch, do not transform, do not own state beyond wiring. They import from `@/features/<X>` public APIs only.

### Feature shape (capability only)

Every feature has exactly this directory structure — missing subdirectories are allowed only when genuinely empty:

```
features/<name>/
  components/    ← UI building blocks (has domain knowledge of this feature)
  hooks/         ← Layer 3 composition hooks
  data/          ← Layer 2 thin wrappers over generated Layer 1 hooks
  domain/        ← Pure functions + feature-local types
  store/         ← Zustand store (client state only)
  tests/         ← Unit + integration + E2E
  index.ts       ← Public API — the ONLY file other code may import
```

### Router glue (per framework, minimal)

Pages live in `src/pages/` regardless of framework. The router for each framework gets one-line re-export glue only when the framework requires file-based routing:

| Framework | Glue file | Content |
|---|---|---|
| Next.js App Router | `app/chat/page.tsx` | `export { ChatPage as default } from '@/pages/ChatPage'` |
| Astro | `src/pages/chat.astro` | one-line import from `@/pages/ChatPage` |
| React Router v7 programmatic | `src/router.ts` | `import { ChatPage } from '@/pages/ChatPage'` — no glue file |
| React Router v7 file routes | `app/routes/chat.tsx` | one-line re-export |

Glue files are birth-only maintenance. Daily work happens entirely in `src/pages/` and `src/features/`. Framework migration swaps only the glue layer.

### Lint rules that enforce feature-based organization

Every rule below is mechanically checked by `eslint-plugin-boundaries` or `no-restricted-imports`. Nothing is convention.

**Rule F1 — Pages never live in features**
```
no-restricted-syntax: ban files matching /features/.*\/.*Page\.tsx$/
// or
boundaries/element-types: forbid element type "page" inside "feature"
```

**Rule F2 — Features expose only via `index.ts`**
```jsonc
{
  "no-restricted-imports": ["error", {
    "patterns": [{
      "group": ["**/features/*/*", "!**/features/*/index", "!**/features/*/index.ts"],
      "message": "Features expose their public API via index.ts. Import from @/features/X, never from internals."
    }]
  }]
}
```

**Rule F3 — Features never import pages**
```jsonc
{
  "no-restricted-imports": ["error", {
    "patterns": [{
      "group": ["**/pages/**"],
      "message": "Features cannot import pages. Pages compose features, not the other way around."
    }]
  }]
}
```
Applied inside `src/features/**`.

**Rule F4 — Cross-feature imports must go through index.ts**
```jsonc
{
  "no-restricted-imports": ["error", {
    "patterns": [{
      "group": ["**/features/*/!(index)**"],
      "message": "Cross-feature imports must go through the feature's public API (features/X/index.ts)."
    }]
  }]
}
```
Applied everywhere except the feature's own internals.

**Rule F5 — Layers within a feature (via eslint-plugin-boundaries)**
```jsonc
{
  "boundaries/elements": [
    { "type": "feature-components", "pattern": "features/*/components/**" },
    { "type": "feature-hooks",      "pattern": "features/*/hooks/**" },
    { "type": "feature-data",       "pattern": "features/*/data/**" },
    { "type": "feature-domain",     "pattern": "features/*/domain/**" },
    { "type": "feature-store",      "pattern": "features/*/store/**" }
  ],
  "boundaries/element-types": [
    { "from": "feature-components", "allow": ["feature-hooks", "feature-store", "feature-domain", "shared/**"] },
    { "from": "feature-hooks",      "allow": ["feature-data", "feature-domain", "feature-store"] },
    { "from": "feature-data",       "allow": ["feature-domain", "data/apiClient/generated/**"] },
    { "from": "feature-domain",     "allow": [] },
    { "from": "feature-store",      "allow": ["feature-domain"] }
  ]
}
```

Layers within a feature:
- **Components** may import hooks, store, domain, and shared. Never data.
- **Hooks** may import data, domain, and store.
- **Data** may import domain and generated code. Never components, hooks, store.
- **Domain** imports nothing app-specific (pure functions + types only).
- **Store** may import domain only (for types). Never data, never hooks.

**Rule F6 — Pages only import from feature public APIs and shared**
```jsonc
{
  "boundaries/element-types": [
    { "from": "page", "allow": ["features/*/index.ts", "shared/**"] }
  ]
}
```

Pages cannot reach into feature internals, cannot import from `data/apiClient/`, cannot import stores directly.

**Rule F7 — The 3-feature rule for `shared/`**
This is a review-time rule, not a lint rule: **a file moves to `shared/` only when at least 3 features use it AND no single feature can be called its owner.** Otherwise it stays in its owning feature and is exposed via `index.ts`.

---

## The Data Hook Architecture — One Layer by Default

**Components always import from the feature's `index.ts` — never from generated hooks directly.** The feature index re-exports either the generated hook or a wrapper. The component import never changes when the implementation evolves.

**Decision rule — apply this checklist per endpoint, in order. Stop as soon as a condition is false.**

1. **Always export the hook from the feature's `index.ts`.** This is the stable import boundary for components. Non-negotiable.
2. **Does the DTO type match what the component renders?** If yes — re-export the generated hook directly from `index.ts` under a clean name. Done.
3. **If no** (dates need parsing, shape differs, fields missing/renamed) — add a Layer 2 `select` wrapper (~10 lines) and export that from `index.ts` instead. Done.
4. **Does this hook need to combine data from two or more endpoints?** If yes — add a Layer 3 composition hook, export that from `index.ts`. If no — done.

When the DTO shape later diverges from what the component needs, only the feature internals change — the component import stays identical. This is the blast-radius limiter.

Do not add a wrapper unless step 3 or 4 requires it. An empty passthrough wrapper with no transformation is a bug, not architecture.

### Layer 1 — Server Mirror (generated)

**Location:** `src/data/apiClient/generated/`
**Produced by:** `@hey-api/openapi-ts` from the OpenAPI spec
**Purpose:** One React Query hook per endpoint — 1:1 with the server.
**Properties:**
- One cache entry per endpoint (shared across all consumers via the query key)
- Zod schemas generated alongside types
- Consistent query key shape
- Pure plumbing — no app knowledge, no transformation
- **Regenerated whenever the OpenAPI spec changes** — never hand-edited

**ESLint rule:** `src/data/apiClient/generated/**` can only be imported from `src/data/apiClient/*.ts`. Components, features, and stores cannot import it directly.

### Layer 2 — Per-Endpoint Domain Wrappers (thin, hand-written when needed)

**Location:** `src/data/apiClient/*.ts`
**Purpose:** Add domain transformation or field projection to a single endpoint.
**Shape:** ~10 lines, fixed template.

```ts
// src/data/apiClient/useHtmlContent.ts
import { useGetHtmlContentByIdQuery } from './generated/htmlContent'
import { toSelectedHtmlContent } from '@/domain/HtmlContent'

export const useHtmlContent = (id?: number) =>
  useGetHtmlContentByIdQuery(
    { id: id ?? 0 },
    { query: { enabled: !!id, select: toSelectedHtmlContent } }
  )
```

**Rules:**
- Must use React Query's `select` for transformation (never `useEffect`)
- Transformation function comes from `src/domain/` and is pure
- May pass an options bag through for component-local overrides (polling, placeholder, etc.)
- No `useState`, no `useEffect`, no `useContext`, no store imports

**Exists only when needed** — but the binary question is "does this endpoint need transformation?", not "should I bother wrapping?" If yes, wrapper exists. If no, components import the generated hook via a re-export file. Either way, Layer 2 is the consumer-facing directory.

### Layer 3 — Composition Hooks (plain React)

**Location:** `src/features/<feature>/hooks/` or `src/domain/<entity>/`
**Purpose:** Combine multiple Layer 1/2 hooks into a domain shape that doesn't exist in the API.
**Example:** `useUser` that merges `useProfile()` + `useUserDetails()` into a `User` object.

```ts
// src/features/user/hooks/useUser.ts
import { useMemo } from 'react'
import { useProfile } from '@/data/apiClient/useProfile'
import { useUserDetails } from '@/data/apiClient/useUserDetails'
import { toUser, type User } from '@/domain/User'

export const useUser = () => {
  const profile = useProfile()
  const details = useUserDetails()

  const data = useMemo<User | undefined>(
    () => (profile.data && details.data ? toUser(profile.data, details.data) : undefined),
    [profile.data, details.data],
  )

  return {
    data,
    isLoading: profile.isLoading || details.isLoading,
    error: profile.error ?? details.error,
  }
}
```

**Rules:**
- No `useQuery`, no `useMutation`, no direct fetch — only composes Layer 1/2 hooks
- Uses `useMemo` to stabilize derived references
- Transformation functions are pure, live in `src/domain/`, testable in isolation
- No `useState`, no `useEffect`
- No Zustand store imports (composition is pure read-then-derive)

### Field-Level Projections — via React Query `select`

Components that need only one field of an entity get a named hook that uses `select` on the Layer 1 hook:

```ts
export const useSelectedHtmlContentTitle = () => {
  const id = useSelectedId() // from Zustand
  return useGetHtmlContentByIdQuery(
    { id: id ?? 0 },
    { query: { enabled: !!id, select: (d) => d.title } }
  ).data
}
```

Each field subscribes only to that field's changes. Re-renders are precise.

---

## Zustand Store Rules

### What Zustand holds

**Client-owned state only.** Nothing that the server knows about or can return.

Examples of what goes in Zustand:
- `selectedId` (which item the user selected in a list)
- `isEditModeActive` (UI toggle)
- `draftTitle` (user input before save)
- `filterText` (user's search input)
- `theme` (user's UI preference)
- `sidebarCollapsed` (user's UI state)

Examples of what does NOT go in Zustand:
- User profile fetched from `/api/user/:id`
- A list of notes fetched from `/api/notes`
- Anything returned by a `queryFn`
- Anything computed from something in the React Query cache

### Store structure

```ts
// src/stores/htmlContentStore.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

interface HtmlContentUiState {
  selectedId: number | null
  filterText: string
  setSelectedId: (id: number | null) => void
  setFilterText: (text: string) => void
}

export const useHtmlContentStore = create<HtmlContentUiState>()(
  persist(
    immer((set) => ({
      selectedId: null,
      filterText: '',
      setSelectedId: (id) => set((s) => { s.selectedId = id }),
      setFilterText: (text) => set((s) => { s.filterText = text }),
    })),
    { name: 'htmlContent-ui' }
  )
)

// Field-level selector hooks — one per primitive
export const useSelectedId  = () => useHtmlContentStore((s) => s.selectedId)
export const useFilterText  = () => useHtmlContentStore((s) => s.filterText)
```

### Store rules (binary)

1. **One store per feature folder.** Cross-feature state goes in `src/stores/globalXxx.ts`.
2. **Always use `immer` middleware.** Never hand-write immutable updates.
3. **Always use `persist` middleware.** Pass an empty `partialize` if you don't want persistence.
4. **One hook per primitive field.** Consumers must not destructure — use `useShallow` if grouped read is unavoidable, but always prefer per-field hooks.
5. **No server-derived fields.** If it came from an API, it doesn't live here.
6. **No cross-store imports.** A store cannot read another store — that coupling belongs in a feature-level composition hook.
7. **Actions are declared in the store.** Components call `setX(y)`, never mutate directly.

---

## Binary Rules (complete enforcement set)

Every rule below is a tool check, not a convention.

### Type system rules (TypeScript strict)
1. Every strict flag enabled: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `allowUnusedLabels: false`, `allowUnreachableCode: false`
2. No `any`
3. No `!` non-null assertions
4. No `as Type` casts on external data (use Zod parse instead)
5. No `@ts-ignore` or `@ts-expect-error` for real errors

### Data layer rules (ESLint)
6. `@tanstack/react-query` can only be imported from `src/data/apiClient/**`
7. `src/data/apiClient/generated/**` can only be imported from `src/data/apiClient/*.ts`
8. Inside `src/data/apiClient/**`, no React hooks except `useQuery`, `useMutation`, `useQueryClient`, `useInfiniteQuery`
9. Inside `src/data/apiClient/**`, no imports from `src/stores/**`
10. Inside `src/domain/**`, no React hook imports except `useMemo`
11. Inside `src/domain/**`, no imports from `src/stores/**` or `src/data/apiClient/**` — domain is pure
12. Inside composition hooks (`src/features/*/hooks/`), no direct `fetch` calls, no direct API client imports

### Store layer rules (ESLint)
13. Inside `src/stores/**`, no imports from `src/data/apiClient/**`
14. Inside `src/stores/**`, no imports from other store files (one store per file, no cross-coupling)
15. Inside `src/stores/**`, no server-type imports from `@env/domain` that represent API responses (only UI shapes)

### Validation rules
16. Every `queryFn` ends with `Schema.parse(raw)` or delegates to a Zod-validated generated hook
17. Every `mutationFn` validates input with Zod before sending
18. Every external data source (fetch, file I/O, LLM output, env vars, URL params, subprocess stdout) uses Zod

### Test rules (TDD)
19. TDD — failing test before implementation
20. No `test.skip()`, no `describe.skip()`, no `.only()` checked in
21. Test names describe capability, not implementation
22. Playwright for E2E. vitest or bun test for pure functions.
23. All unit tests run on every pre-commit
24. E2E tests run in CI

### Build and edit rules
25. PostToolUse hook runs tsc on every `.ts`/`.tsx` edit — no timeout escape
26. Pre-commit runs `tsc --noEmit`, `eslint`, and all unit tests — any failure blocks the commit
27. Generated files (`src/data/apiClient/generated/**`) cannot be hand-edited — CI verifies they match regenerated output

---

## Applying the Cookie Cutter to Existing Projects

Projects in `~/environment/projects/` are at different stages. The cookie cutter is the destination; each project has a different starting point.

### productivitesse (already close)
- ✅ Strict TypeScript, TDD, ESLint boundaries
- ⚠️ No OpenAPI codegen yet — add `@hey-api/openapi-ts` when a backend is consumed
- ✅ Zustand already in use
- ⚠️ Verify no server data is stored in Zustand (audit `stores/`)

### knowledge-base
- ✅ Strict TypeScript, ESLint boundaries, TDD
- 🚨 4,906-line `web/app.tsx` must be broken into features — separate refactor, not data-layer-specific
- ⚠️ No OpenAPI yet — knowledge-base server needs an OpenAPI spec so @hey-api/openapi-ts can generate Layer 1 hooks
- ⚠️ Currently hand-writes React Query hooks — migrate to the three-layer pattern

### voice-bridge2
- ⚠️ New project, strict TS partial
- Add `@hey-api/openapi-ts` for relay API consumption — import types from `message-relay/src/types/api.ts`
- Zustand + immer + persist per the rules

### myenglishbook (revival)
- 🚨 Major refactor required — see `projects/myenglishbook/REFACTOR-GUIDE.md`
- Redux → Zustand migration
- Dual-state bug class elimination
- @hey-api/openapi-ts introduction
- Four-phase refactor plan documented in the guide

### New projects (greenfield)
- Use this module from day zero
- Start from the cookie cutter template (future work: create a scaffold)
- Every binary rule enabled on the first commit

---

## Forbidden Patterns (never add these)

These were invented to solve human team coordination problems. LLMs gain nothing from them and the context cost is continuous:

| Pattern | Why skip |
|---|---|
| Repository pattern wrapping typed clients | Generated API client IS a repository |
| Clean Architecture with 5+ layers | Layers by convention decay |
| Interfaces for single-implementation classes | Ceremony without safety |
| DI containers | Constructor parameters are enough |
| Factory pattern without real variation | Unused abstraction |
| Mapper classes | Pure transform functions suffice |
| Event bus for synchronous code | Only justified for genuinely async decoupling |
| Two state libraries in one project | Pick one, enforce with lint |
| Storing server data in a client store | Dual-state bug class — forbidden |
| `useEffect + dispatch` to sync React Query into a store | Replaced by composition hooks with `useMemo` |
| Fat hooks with fetch + state + side effects | Replaced by layered architecture |
| Redux DevTools as a reason to choose Redux | LLMs don't use time-travel debugging |
| Hand-written wrappers over generated hooks when no transformation is needed | Re-export via a single file instead |

---

## The One-Sentence Standard

**One stack, three layers, two states (server in React Query, client in Zustand), zero hand-written plumbing, every rule enforced by tooling, and server-derived data is never stored.**

That is the data architecture cookie cutter for every TypeScript project in the system. Deviate only with Chief of Staff approval and a written rationale.
