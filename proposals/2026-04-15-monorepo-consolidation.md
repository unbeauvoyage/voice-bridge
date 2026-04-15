---
title: 4-App Monorepo Consolidation — System Architecture
timestamp: 2026-04-15T16:35:00
status: proposal
summary: Consolidate message-relay, productivitesse, knowledge-base, voice-bridge2 into ~/environment/system/ with Bun workspaces.
---

# 4-App Monorepo Consolidation Proposal

**Related to:** BACKLOG item "Monorepo consolidation — 4-app system"

**Aligns with:** Chief of Staff cross-project standards ownership

## Current State

Four critical apps are scattered across the environment:
- `~/environment/message-relay/` (git submodule)
- `~/environment/projects/productivitesse/`
- `~/environment/projects/knowledge-base/`
- `~/environment/projects/voice-bridge2/`

**Problem:**
1. No shared workspace definition → cross-app dependencies require manual path setup
2. `shared/domain/` implies global scope, actually only serves these 4 apps
3. message-relay is a git submodule (adds complexity, harder to iterate)
4. Each app manages its own dependencies separately → duplication, version drift
5. No clear ownership boundary — teams don't know which apps belong to the "system"

## Solution: Single Bun Monorepo

**New structure:**
```
~/environment/system/
  ├── packages/
  │   ├── relay/                    (message-relay)
  │   ├── productivitesse/          (mobile + desktop app)
  │   ├── knowledge-base/           (knowledge capture + retrieval)
  │   ├── voice-bridge2/            (voice input layer)
  │   └── shared/                   (domain types, only for these 4)
  ├── package.json                  (workspace root)
  ├── bunfig.toml                   (shared Bun config)
  └── scripts/
      ├── install-all.sh
      ├── test-all.sh
      └── build-all.sh
```

## Benefits

### 1. **Dependency Management**
- Single `bun install` at root installs all apps + shared dependencies
- Version conflicts surfaced immediately
- Shared deps (React, TypeScript, Zod, etc.) deduplicated

### 2. **Path Aliases**
- Workspace imports: `import type { AgentName } from "@system/domain"`
- Replace relative imports: `import { AgentName } from "@system/domain"` instead of `../../../../shared/domain`
- TypeScript `paths` config in root `tsconfig.json`

### 3. **Cross-App Testing**
- Run all tests: `bun run test:all`
- Run relay tests only: `bun run -w relay test`
- Single CI pipeline

### 4. **Clear Ownership Boundary**
- "System" = these 4 apps + their shared types
- Future projects start outside system/ (e.g., `~/environment/projects/`) — they import from system if needed
- No ambiguity about what's global vs system-scoped

### 5. **Simplified message-relay Integration**
- Flatten submodule → regular package
- Easier to iterate on relay changes (no submodule update dance)
- Relay remains deployable as standalone service if needed

## Implementation Plan

### Phase 1: Prepare (2 hours)
1. Create `~/environment/system/` directory
2. Create workspace `package.json` with Bun workspace definition
3. Create root `bunfig.toml` (extends Bun defaults)
4. Copy each app into `packages/{name}/` preserving git history

### Phase 2: Update Config (3 hours)
1. Update `tsconfig.json` in each app to use workspace paths
2. Update `eslint.config.mjs` in each app (import shared rules from @system if applicable)
3. Update `playwright.config.ts` to reference correct server ports
4. Add root `tsconfig.json` with paths:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@system/domain": ["./packages/shared/domain"],
         "@system/relay": ["./packages/relay"],
         "@system/productivitesse": ["./packages/productivitesse"],
         "@system/knowledge-base": ["./packages/knowledge-base"],
         "@system/voice-bridge2": ["./packages/voice-bridge2"]
       }
     }
   }
   ```

### Phase 3: Update Imports (2 hours)
1. Search-replace relative imports to workspace imports
2. Test each app builds + tests pass
3. Update CI/CD pipeline to run at workspace root

### Phase 4: Deploy & Migrate (1 hour)
1. Move old directories to backup
2. Update git `.gitignore` (include `packages/*/node_modules/`)
3. Test `bun install` + `bun run test:all`
4. Update all agent CLAUDE.md files to reference new structure

## Migration Path

**Minimal disruption:**
- Backup old directories before moving
- Run full test suite after each phase
- Keep old git history intact (git filter-repo to preserve commits)
- Teams can continue working in feature branches during migration

**Timeline:** ~2 days for full migration + validation

## Decision Points

1. **Keep message-relay as submodule or flatten?**
   - **Recommend:** Flatten. Submodules add complexity, relay is tightly coupled to system.
   - **If keep:** That's fine too — workspace can include submodule path

2. **Shared types location?**
   - **Current:** `~/environment/shared/domain/` (implies global)
   - **New:** `~/environment/system/packages/shared/` (system-scoped)
   - **Future projects** importing from shared should import from system package, not copy

3. **CI/CD at root or per-package?**
   - **Recommend:** Root pipeline runs `bun run test:all` + `bun run build:all`
   - **Fallback:** Per-package workflows if builds are independent

## Long-term Benefits

- **Onboarding:** New engineers clone one repo, `bun install`, all 4 apps ready
- **Dependency audits:** Single audit covers all system apps
- **Shared infrastructure:** Logging, error handling, types — define once, import everywhere
- **Scaling:** Easy to add 5th/6th app to system without restructuring

## What This Does NOT Change

- Each app has its own branch/deployment strategy
- Each team lead manages their own app's codebase
- Relay remains separately deployable
- CI/CD can still be per-service if needed

## Owner

**Chief of Staff** plans migration. **Coder** executes under Chief guidance (worktree per phase).

---

**Chief of Staff**  
2026-04-15T16:35:00
