---
title: Three-app convergence — make productivitesse + voice-bridge2 + knowledge-base mergeable by copy-paste
author: chief-of-staff
created: 2026-04-15T23:55:00
status: open-for-implementation
summary: CEO directive — the three apps will merge into one. Lead all teams to identical foundations now so the future merge is "copy files, change configs". This document defines the convergence contract.
audience: ceo + all team leads
---

# Three-App Convergence

## Goal
After the current refactor lands, productivitesse, voice-bridge2, and knowledge-base must be **mergeable by copy-paste**: same folder shape, same build tooling, same TS/ESLint config, same domain types, same relay client. Differences should live in `src/features/*` only — never in tooling, never in shared types, never in configs.

## Why
Three apps today = three sets of bugs to fix three times, three eslint configs that drift, three Zustand patterns that conflict, three relay clients that hold subtly different shapes. The CEO wants one app. Convergence is the path.

## Convergence contract

Each row is a hard requirement. Teams MUST converge on the listed value before merge. Drift is a failure mode, not a style preference.

### 1. Folder shape (identical across all three apps)
```
src/
  components/        — reusable UI primitives, no business logic
  pages/             — route-level composition, owns layout
  features/          — business logic, public API via index.ts (rename to services/ pending CEO decision)
  shared/            — cross-feature utilities (relay client, design tokens, hooks)
  data/
    apiClient/       — OpenAPI codegen output (when introduced)
```

### 2. Build tooling (identical)
- **Vite** (no Webpack, no esbuild standalone, no Parcel)
- **React Router v7** SPA mode for productivitesse + KB; voice-bridge2 keeps Electron BrowserWindow but uses the same Vite renderer config
- **Bun** for test runners (`bun:test` for unit, Playwright for E2E)
- **Drizzle ORM** for any DB (`drizzle-orm/bun-sqlite` default, `drizzle-orm/node-postgres` for prod)

### 3. TypeScript config (identical strict baseline)
```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 4. ESLint config (identical — copy from voice-bridge2/eslint.config.mjs)
```ts
'@typescript-eslint/no-explicit-any': 'error',
'@typescript-eslint/no-non-null-assertion': 'error',
'@typescript-eslint/explicit-function-return-type': 'error',
'@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
'@typescript-eslint/ban-ts-comment': 'error',
// Plus eslint-plugin-boundaries with F1-F7 feature boundary rules
```

### 5. Realtime feedback (identical)
- PostToolUse hook fires `tsc --noEmit` AND `eslint --max-warnings 0` on every Edit/Write
- Husky pre-commit hook fires both
- Coders see errors mid-edit, not at end of task

### 6. Domain types (one source of truth)
All three apps consume canonical types from `~/environment/DOMAIN.md` — extracted into a shared `@productivitesse/domain` package once we have a monorepo. Until then: copy-paste the canonical Type shapes verbatim from DOMAIN.md. Drift forbidden.

Enforced by chief-of-staff: PRs introducing a new domain noun outside DOMAIN.md will be rejected.

### 7. State management (identical)
- Server state → React Query (@tanstack/react-query v5)
- Client state → Zustand v5 with immer + persist where appropriate
- NEVER mirror server state into Zustand. Reference: `~/environment/.claude/modules/data-architecture.md`

### 8. Relay client (identical)
A single `shared/relay-client.ts` module. Same shape in all three apps. No per-app variants. When the relay protocol changes, change one file in one app and copy to the other two as part of the same PR.

### 9. Test discipline (identical)
- Playwright E2E with capability-named files (no page-named files)
- `bun:test` unit tests
- ZERO `.skip()` calls across all three apps. Existing skips: enumerate, fix-or-delete, never bypass.
- `webServer` wired in `playwright.config.ts` so tests start the server automatically

### 10. Package.json scripts (identical names)
```json
"scripts": {
  "dev": "...",          // each app's dev mode
  "build": "...",
  "lint": "eslint . --max-warnings 0",
  "typecheck": "tsc --noEmit",
  "test": "bun test",
  "test:e2e": "playwright test",
  "test:all": "npm run typecheck && npm run lint && npm test && npm run test:e2e"
}
```

## Per-app convergence status (as of 2026-04-15)

| Requirement | productivitesse | voice-bridge2 | knowledge-base |
|---|---|---|---|
| Folder shape (features/pages/components) | features ✓, pages ✗, components ✓ | features ✓, pages ✓, components ✓ | features ✓ (refactor branch only), pages ✗, components partial |
| Vite + React Router v7 | ✓ | ✓ (renderer) | **✗ — Bun.serve() + HTML imports** (must migrate to Vite for merge) |
| TS strict baseline | partial (missing noPropertyAccessFromIndexSignature) | partial (exactOptionalPropertyTypes:false on web) | partial (noUnused* disabled with TODO) |
| ESLint config | partial (boundaries not wired, 234 warnings, assertionStyle still allows `as`) | ✓ (reference) | MISSING — no config at all |
| Realtime feedback | tsc ✓, eslint ✗ | unknown | ✗ |
| DOMAIN.md compliance | not yet checked | not yet checked | acknowledged, will enforce |
| React Query + Zustand | partial (zustand server-state violations) | partial (wakeStore needs immer+persist) | refactor branch ✓, main ✗ |
| Relay client | ad-hoc per file | shared/relay-client.ts ✓ | ad-hoc per file |
| Zero `.skip()` | **46 violations** | ✓ (zero skips) | ✓ (1 skip in worktree) |
| Standard scripts | partial | ✓ | partial |

## Convergence sequence

**Phase 1 — config alignment (THIS WEEK)**
1. Copy voice-bridge2/eslint.config.mjs → productivitesse + KB. Wire boundaries.
2. Add noPropertyAccessFromIndexSignature + flip exactOptionalPropertyTypes:true everywhere.
3. Add eslint to PostToolUse hook everywhere.
4. Kill all 46 productivitesse skips. Verify KB still has zero/one.
5. Add React Query to KB main branch deps.

**Phase 2 — folder shape (NEXT WEEK)**
1. Productivitesse: extract src/pages/ from dashboard shell.
2. KB: split web/app.tsx 4800-line god-component into pages + features.
3. All three: ensure features/*/index.ts is the only public API entry.

**Phase 3 — shared kernel (AFTER PHASE 2)**
1. Extract shared/relay-client.ts to a single source. Vendor or symlink across all three.
2. Extract DOMAIN.md types into a `domain/` package consumed by all three.
3. Extract shared design tokens (if any).

**Phase 4 — merge (CEO TIMING)**
1. Move all three into a monorepo (Bun workspaces or pnpm workspaces).
2. Replace vendored shared/ with workspace package.
3. Each app stays its own entry (productivitesse desktop+mobile, voice-bridge2 menubar, knowledge-base server). They share everything below the entry.

## Open questions
1. Monorepo tool: Bun workspaces (lighter) or pnpm workspaces (more mature)?
2. After merge, do the three apps become three Vite entry points in one repo, or do we go further and unify the UI shell too (one app, multiple modes)?
3. Voice-bridge will be deleted soon — daemon/+certs/ migration to voice-bridge2 must complete before that, listed in voice-bridge-deprecation-audit.md.
4. **KB build tooling divergence:** KB main uses Bun.serve() + HTML imports, not Vite. For copy-paste merge to work, KB must migrate the web/ portion to Vite. Suggested timing: after Phase 3 lands (Phase 3 already does the heavy split; Vite migration is a smaller follow-on).
5. **Productivitesse missing convergence rows:** noUnusedLocals/Parameters not in tsconfig yet; standard scripts (test:e2e, test:all) partial. Add to next chunk batch.

## Enforcement
Chief-of-staff owns this convergence contract. Team leads:
- Read this proposal.
- Check your project against the per-app convergence status table.
- Add chunks for any ✗ or partial in your queue.
- Report convergence-relevant changes to chief-of-staff so the table stays current.
- New domain nouns → DOMAIN.md first, then code.
