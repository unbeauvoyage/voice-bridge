---
id: llm-era-frontend-stack
title: LLM-Era Frontend Architecture Standard
date: 2026-04-14T22:03:56
status: done
implemented: 2026-04-15
becomes: .claude/modules/data-architecture.md
priority: high
summary: The objectively best frontend stack for 100% LLM-written, ex-engineer-managed TypeScript projects — distilled from a live architecture review of myenglishbook, productivitesse, and knowledge-base. Maximum strictness enforced by tooling, zero redundant layers, code generation over hand-writing.
---

## Core Principle

**Strictness the machine enforces is free value for LLMs. Strictness humans maintain by convention decays exactly as fast as it did for humans.** Every architectural rule must be enforceable by the compiler, linter, test runner, or pre-commit hook. Rules that rely on discipline die.

This inverts the old trade-off. Humans said "we can't afford full strictness, we need to ship." For LLM-written projects that is dead: strictness is now *cheaper* than looseness because a strict codebase makes every subsequent LLM session faster and more correct, while a loose codebase pays the re-learning tax per session.

---

## The Stack (final)

```
Language               TypeScript, every strict flag
Domain vocabulary      shared/domain/ — HAND-WRITTEN: Agent, Message, User, etc.
                       (small, stable, imported across all services)
API contract           openapi.json — source of truth for HTTP envelopes
                       (polyglot-safe — survives backend language changes)
Codegen                orval → generates API types + React Query hooks + Zod schemas
                       from the OpenAPI spec
State (UI)             Zustand + immer + persist middleware
State (API)            TanStack Query v5 (via the generated hooks)
Domain wrappers        Hand-written ONLY when transformation is needed
                       (10-15 line thin wrappers using React Query's `select`)
Boundary validation    Zod at every external edge (orval generates the schemas)
Router                 React Router v7
Styling                Tailwind (or CSS Modules)
Testing                Playwright (E2E) + vitest/bun test (units)
Enforcement            ESLint + eslint-plugin-boundaries + no-restricted-imports
Hooks                  PostToolUse tsc+test hook on every file edit
Commit gate            Husky pre-commit: tsc + lint + affected tests
```

## The Two Type Layers

A critical distinction that eliminates the "hand-written vs generated" argument:

| Layer | What it represents | Source | Example |
|---|---|---|---|
| **Domain vocabulary** | What things ARE — the ubiquitous language | Hand-written in `shared/domain/` | `Agent`, `Message`, `User`, `KnowledgeItem` |
| **API envelopes** | How things MOVE over HTTP | Generated from OpenAPI via orval | `GetAgentsResponse`, `CreateMessageRequest` |

Both exist. Domain types are a vocabulary; API types wrap that vocabulary in HTTP-specific shapes. Hand-craft the vocabulary, generate the envelopes, wire them together with thin hand-written domain wrappers where transformation is needed.

---

## Why this stack

### Zustand over Redux Toolkit (for LLM projects)

The old reasons for Redux (DevTools time-travel, enforced immutability, opinionated structure) no longer apply:

| Old Redux advantage | Why it's dead for LLMs |
|---|---|
| DevTools time-travel | LLMs debug with logs and tests, not DevTools |
| Enforced immutability via Immer | Zustand has `immer` middleware — identical guarantees |
| Opinionated structure | ESLint rules enforce structure, not the framework |
| Team coordination | No human team exists in a 100% LLM project |
| Cross-tab state | Zustand `persist` middleware with storage events |

What Zustand gives you that Redux Toolkit does not:

1. **~70% less boilerplate.** One `create()` call replaces slice + store config + provider + typed hooks + selectors file.
2. **Less context cost per LLM session.** Fewer files to read per feature.
3. **Named single-field hook pattern is identical.** The Redux strength of per-field selectors works exactly the same way:
   ```ts
   export const useSelectedHtmlContentTitle = () =>
     useHtmlContentStore(s => s.selectedHtmlContent?.title)
   ```
4. **Combines cleanly with React Query.** Server state goes in React Query, client state goes in Zustand. No conflict, no redundant layer.

**Zustand is NOT right when:** you need complex state machines with many transitions, heavy middleware for cross-cutting concerns (logging/analytics across many slices), or deep derived selector trees with `createSelector` memoization. For those cases, use XState (state machines) or Redux Toolkit as escape hatches. For everything else, Zustand.

### React Query for server state

TanStack Query is best-in-class for server state: pagination, infinite queries, optimistic updates, prefetching, cache normalization, `select` transformation. RTK Query is one generation behind. Do not combine them (the myenglishbook bug — using both is redundant).

### OpenAPI → generated hooks, not hand-written wrappers

Hand-written wrappers like `useQueryHtmlContent` add value only when they do one of three things:
1. Wire-to-domain transformation
2. Query-key centralization
3. Default-configuration enforcement

All three can be solved automatically by a code generator:
- **orval**, **@hey-api/openapi-ts**, or **openapi-react-query-codegen** produce typed React Query hooks directly from the OpenAPI spec
- Query keys are auto-generated and consistent
- Default config is encoded in the generator template

**Hand-write a wrapper ONLY when domain transformation is needed** (e.g., parsing Lexical state, rehydrating Excalidraw elements). In that case the wrapper is ~10 lines and uses `select: domainTransform`.

```ts
// Auto-generated from OpenAPI — never touched by hand
export const useHtmlContentGetById = (id: number, options?) =>
  useQuery({
    queryKey: ['htmlContent', 'getById', id],
    queryFn: () => htmlContentApi.getHtmlContentById({ id }),
    ...options,
  })

// Hand-written ONLY because transformation is non-trivial (10 lines)
export const useHtmlContent = (id?: number) =>
  useHtmlContentGetById(id!, {
    enabled: !!id,
    select: toSelectedHtmlContent,  // pure function, memoized by React Query
  })
```

### The Store ↔ Application Layer Discipline

This pattern survives across libraries — it's not Redux-specific. It works identically in Zustand.

1. **Store holds ONLY serializable state.** No `LexicalEditor` instances, no DOM nodes, no class instances with methods. Only JSON.
2. **Domain shape ≠ store shape.** Two TypeScript interfaces: `SerializedSelectedHtmlContent` (in store) and `SelectedHtmlContent` (in app). The type system enforces which is which.
3. **Reducer serializes on write.** When data enters the store, the reducer converts live objects to serializable form.
4. **Pure hydrator on read.** A pure function `toSelectedHtmlContent(serialized) → live` converts back. No React dependencies, no side effects, testable in isolation.
5. **Named single-field hooks.** Components never subscribe to the whole slice — they import named hooks like `useSelectedHtmlContentTitle()`. Each hook reads one primitive, so React-Redux/Zustand only re-renders when that field changes.
6. **Components never import the store directly.** They import named hooks. The store layer is invisible to the UI.

ESLint rule to enforce:
```
no-restricted-imports: useHtmlContentStore → only from ./data/store/hooks/**
```

Components that need to read the store must import one of the named hooks. Nothing else.

---

## Strict TypeScript Flags (required, no exceptions)

Copy this into every `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
    "forceConsistentCasingInFileNames": true
  }
}
```

Combined with the TYPE HARDENING DIRECTIVE (no `as` casts, no `!`, no `any`, no `@ts-ignore`), this catches the entire class of production bugs LLMs are most likely to generate.

---

## Architectural Boundary Enforcement (ESLint)

Use `eslint-plugin-boundaries` or `no-restricted-imports` to make the following RULES UNBREAKABLE BY LLMs:

1. **`@tanstack/react-query` can only be imported from `src/data/apiClient/**`.**
   Forces all data fetching through named hooks.

2. **Components cannot import Zustand stores directly.**
   They can only import named selector hooks from `src/data/store/hooks/**`.

3. **Features cannot import from other features.**
   Cross-feature code goes through `shared/` or the domain layer.

4. **Platform adapters (Electron/Capacitor/web) cannot import features.**
   Adapters are pure infrastructure. Features use the abstract platform interface.

5. **Generated code (`src/data/apiClient/generated/**`) cannot be hand-edited.**
   Enforced by a CI check: if the file differs from what the generator produces, the build fails.

---

## Test Discipline

- **Playwright for E2E.** Full coverage of user-visible flows.
- **Vitest or bun test for unit tests.** Pure functions only — transformers, domain logic, selectors.
- **No `skip()` ever.** A skipped test is a lie.
- **TDD is mandatory.** Failing test first, then implementation.
- **Test names describe capability, not implementation.** `conversation-history.spec.ts` not `inbox-page.spec.ts`.

---

## PostToolUse Feedback Loop (already implemented 2026-04-14)

On every `.ts`/`.tsx` edit:
1. Run `tsc --noEmit` for the project
2. Filter output to errors in the edited file only (IDE-like behavior)
3. If a matching `{basename}.test.ts` exists, run it
4. Output surfaces to the agent immediately

This closes the blind-spot gap where `server/` directories were outside `tsconfig include` and silently drifted.

---

## Forbidden Patterns (do NOT add to the stack)

These were invented to solve human-team coordination problems and add no value for LLMs:

| Pattern | Why skip |
|---|---|
| Repository pattern wrapping typed clients | API client is already a repository |
| Clean Architecture with 5+ layers | Layers maintained by convention decay |
| Interfaces for single-implementation classes | Ceremony without safety |
| DI containers | Constructor parameters are enough |
| Factory patterns without real variation | Unused abstraction |
| Mapper classes | Transform functions suffice |
| Event bus for synchronous code | Only justified for genuinely async decoupling |
| Two state libraries in one project | Pick one, enforce with lint |
| Hand-written wrappers over generated hooks | Use the generator template |

---

## Migration Plan for Existing Projects

### productivitesse
- ✅ Already uses Zustand + strict TS
- Adopt orval for OpenAPI → React Query hook generation when a backend is added
- Add ESLint boundary rules for `platform/` isolation (already started)

### knowledge-base
- 🚨 **Urgent refactor:** 4,906-line `app.tsx` monolith must be broken into features + hooks + components
- Adopt Zustand + React Query
- Generate hooks from OpenAPI spec (knowledge-base has one)

### myenglishbook (if revived)
- Consolidate to Zustand + React Query (drop Redux Toolkit, Jotai, nanostores)
- Keep the store ↔ app hydrator discipline (it's correct, just port to Zustand)
- Generate hooks from OpenAPI (backend already has a spec)
- Remove all commented-out code
- Split fat hooks into [raw fetch] + [pure transform] + [UI composition]

### voice-bridge2 and immini
- Add CLAUDE.md, tests, ESLint boundary rules
- Add orval for any API consumption
- Use Zustand for client state if needed

---

## Success Criteria

A project built on this stack should have:

1. `tsc --noEmit` clean with every strict flag enabled
2. ESLint clean with architectural boundary rules
3. Playwright tests covering every user-visible flow
4. Zero hand-written React Query wrappers unless they contain domain transformation
5. One state library (Zustand) for client state, no alternatives present
6. OpenAPI as the single source of truth for API contracts
7. A new LLM session can read `src/data/apiClient/` and know every data access in the app
8. No `any`, no `!`, no `as Type` casts, no `@ts-ignore`
9. PostToolUse hook running on every edit
10. Pre-commit hook blocking unverified code

If all ten are true, the project is LLM-ready.

---

## The One-Sentence Summary

**For 100% LLM-written TypeScript projects managed by a former engineer, the objectively best stack is Zustand + React Query + OpenAPI codegen + max-strict TypeScript + ESLint boundary rules + TDD — maximizing every form of strictness the machine can enforce while eliminating every abstraction whose value depends on human discipline.**
