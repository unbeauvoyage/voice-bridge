# Unified Folder Structure Standard

All frontend projects must mirror this structure exactly. Same folder names, same purpose everywhere.
If you replace `productivitesse` with `myenglishbook` in any path, the corresponding file must exist.

## Canonical Structure

```
src/
  app/              ← route definitions ONLY (React Router, Next.js pages, etc.)
                      No business logic. No state. No data fetching. Pure routing glue.

  features/         ← one folder per domain feature
    {feature}/
      components/   ← React components — dumb, presentational only
                      No direct API calls. No Zustand. Props in, events out.
      hooks/        ← ALL hooks for this feature (React Query + custom)
                      useXxxQuery.ts, useXxxMutation.ts, useXxxState.ts
      store/        ← Zustand slices for this feature ONLY
                      One file per slice: {feature}-store.ts
      domain/       ← Types, interfaces, pure functions (no React, no side effects)
                      types.ts, {concept}.ts
      __tests__/    ← Unit + integration tests co-located with the feature
      index.ts      ← Public API — only export what consumers need

  shared/           ← Code used by 3+ features (NOT a dumping ground)
    components/     ← UI primitives (Button, Modal, etc.) used by 3+ features
    hooks/          ← Hooks used by 3+ features
    types/          ← Global types used everywhere

  pages/            ← Page-level components (thin wrappers — routing only)
                      Imports from features, owns no logic

  platform/         ← Platform adapters (web vs native vs electron vs extension)
                      One subfolder per platform: web/, mobile/, desktop/, extension/

  test/             ← E2E tests, test utilities, factories, fixtures
                      NOT unit tests (those live in features/__tests__/)
```

## Rules

1. **Components are dumb** — A component that fetches data or reads a Zustand store directly is wrong. It should receive props from a hook.
2. **Hooks own everything** — Data fetching (React Query), local state, derived state all live in `hooks/`.
3. **feature/index.ts is the boundary** — Consumers import from `features/inbox`, never from `features/inbox/components/InboxList`. If it's not in index.ts, it's private.
4. **No global `stores/` folder** — Zustand stores belong to the feature that owns that state. If state is needed by 3+ features, it goes in `shared/`.
5. **React Query hooks stay in features** — Not in a global `data/` or `apiClient/` folder. The feature that needs the data owns the query.
6. **Tests co-locate** — `features/{feature}/__tests__/`, not a separate top-level `tests/` folder. E2E tests only go in `test/`.

## Per-Project Migration

### productivitesse — mostly aligned, minor moves
Current state: mostly follows the standard. React Query hooks are in `features/{feature}/data/` not `hooks/`.
Moves needed:
- [ ] Rename `features/{feature}/data/` → `features/{feature}/hooks/` (move query files there)
- [ ] Ensure `features/{feature}/store/` exists and Zustand slices are there (not scattered)
- [ ] Delete empty `src/data/` and `src/domain/` root-level folders (content moved to features)

### knowledge-base (web/) — significant restructure needed
Current state: React Query hooks centralized in `data/apiClient/` (wrong), app state in `data/` (wrong).
Moves needed:
- [ ] Move `data/apiClient/useXxxQuery.ts` files into the owning feature's `hooks/` folder
- [ ] Move `data/useAppShell.ts` → `features/app-shell/hooks/useAppShell.ts` (create feature)
- [ ] Move `data/useFilterState.ts`, `data/useSearchState.ts`, `data/useUiState.ts` into owning features
- [ ] Remove dangling `src/components/` at root — move contents to `shared/components/`
- [ ] Create `features/{feature}/domain/` for types currently inline in components

### myenglishbook (next/src/) — most work needed
Current state: Feature folders are flat (no subfolders), nanostores instead of Zustand, types inline.
Moves needed:
- [ ] Add `components/`, `hooks/`, `domain/`, `__tests__/` subfolders to every feature
- [ ] Move flat component files into `components/`, hook files into `hooks/`
- [ ] Migrate nanostores to Zustand feature stores (`features/{feature}/store/`)
- [ ] Move inline types to `features/{feature}/domain/types.ts`
- [ ] Delete stale `src/services/` workspace file, move `src/images/` to `public/`

## Tech Stack Constraints

| Concern | Standard | Notes |
|---|---|---|
| Global state | Zustand (feature-level stores) | No nanostores, no Redux |
| Server state / data fetching | TanStack Query (React Query) | In feature hooks/ |
| Routing | React Router v7 (or Next.js app router) | Route files in app/ only |
| Testing | Vitest + React Testing Library + Playwright E2E | Co-located unit, E2E in test/ |

## What This Enables

- Any agent (or developer) looking for "how X works in productivitesse" can find it in `features/X/`
- Switching between projects: muscle memory transfers — same paths, same purpose
- New features follow the same pattern regardless of who builds them
- Code review has a clear standard: "is this component dumb? is this hook in the right folder?"
