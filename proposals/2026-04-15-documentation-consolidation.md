---
title: System Documentation Consolidation — CEO Direction #1
timestamp: 2026-04-15T16:25:00
status: proposal
summary: Audit found duplication across CLAUDE.md files. Consolidate to parent-child structure with project-specific rules only.
---

# Documentation Consolidation Proposal

**Aligns with:** CEO Direction #1 (System Documentation — Lean and Honest)

## Problem

Current documentation structure has duplication and unclear relationships:

1. **TDD rules duplicated** — knowledge-base/CLAUDE.md and productivitesse/CLAUDE.md both copy the TDD section from environment/CLAUDE.md instead of referencing it
2. **Parent-child relationship unclear** — productivitesse documents that it extends environment CLAUDE.md; knowledge-base does not
3. **File bloat** — Both project files have expanded beyond project-specific rules into system-wide guidance
4. **Inconsistency** — Different projects structure the same rules differently
5. **Agent onboarding confusion** — New agents don't know whether to read environment first or project first

## Audit Findings

### knowledge-base/CLAUDE.md (150+ lines)
- Focuses on Bun-specific rules (correct)
- **Problem:** Duplicates TDD section, doesn't reference environment
- **Missing:** Parent relationship documentation

### productivitesse/CLAUDE.md (150+ lines)
- Explicitly acknowledges it extends environment (good pattern)
- **Problem:** Still duplicates TDD section instead of referencing
- **Duplicates:** Team Lead directive, branch policy, parallel worktrees
- **Bloat:** Some system-wide guidance mixed in

## Solution: Consolidated Structure

### 1. **Environment CLAUDE.md** (System-wide, authoritative)
- TDD discipline (absolute rule)
- Agent types and roles
- Session management
- Communication protocols
- Team management rules
- Module standards

### 2. **Project CLAUDE.md** (Project-specific, 40-50 lines max)
- **Pattern:** Start with "Extends ~/environment/CLAUDE.md"
- **Include only:**
  - Tech stack specifics (Bun vs Node, React Router, Electron, etc.)
  - Branch policy (main/dev naming, merge strategy)
  - Team structure (roles, reporting)
  - Build/deployment specifics
  - Platform-specific considerations

### 3. **Agent Definitions** (.claude/agents/{role}.md)
- Read on startup (identity + tools)
- One file per role (coder, team-lead, researcher, etc.)
- Consistent frontmatter (name, description, model)

### Example Project CLAUDE.md (consolidated)

```markdown
# Productivitesse

Extends `~/environment/CLAUDE.md` for system-wide rules. See there for: TDD, agents, sessions, communication.

## Tech Stack
- React Router v7 (Vite-based)
- Electron + Capacitor
- TypeScript strict mode
- Framework-portable architecture

## Branch & Deployment
- `main`: production fallback (only CEO-approved builds)
- `dev`: development baseline
- All merges via rebase + fast-forward (linear history)

## Team Structure
- Team lead: coordination only, no coding
- Coders: implement in parallel worktrees (.claude/worktrees/)
- Tester: runs Playwright E2E suite
- Designer: UI components

## Platform-Specific
- Electron panel: alwaysOnTop + visibleOnAllWorkspaces
- Capacitor: live reload over Tailscale (HTTPS required)
- macOS window enumeration: native APIs via child_process
```

## Implementation

### Phase 1: Update Environment CLAUDE.md
- Keep as-is (already comprehensive)
- Minor cleanup: remove superseded rules, consolidate modules

### Phase 2: Consolidate Project Files
1. **knowledge-base/CLAUDE.md** (→ 40 lines)
   - Keep: Bun stack rules, extension-first principle, test layers
   - Remove: TDD duplication, server restart (can live in team lead notes)
   - Add: Parent relationship header

2. **productivitesse/CLAUDE.md** (→ 50 lines)
   - Keep: Branch policy, team structure, worktree guidance
   - Remove: TDD duplication, Team Lead directive (link to environment)
   - Shorten: Tech stack to bullet points

3. **Other projects** (future)
   - Create CLAUDE.md following consolidated pattern
   - Start with "Extends ~/environment/CLAUDE.md"

### Phase 3: Document Agent Onboarding
- Add to environment CLAUDE.md:
  ```
  ## Agent Startup (Read in Order)
  1. .claude/agents/{your-role}.md — your identity and tools
  2. {project}/CLAUDE.md — project specializations
  3. ~/environment/CLAUDE.md — system rules
  ```

## Benefits

1. **Clarity:** Agents know exactly where to find rules
2. **Maintenance:** Fix TDD rule once, it applies everywhere
3. **Scalability:** New projects follow the pattern immediately
4. **Consistency:** Same structure across all projects
5. **Leanness:** CEO's goals (shorter, clearer, emphatic)

## Timeline

- Phase 1 (environment): 30 min
- Phase 2 (projects): 1 hour
- Phase 3 (onboarding docs): 20 min
- **Total:** ~2 hours

Can assign to coder for mechanical consolidation + Chief of Staff review.

## Approval Required

CEO review + approval before Phase 2 execution.

---

**Chief of Staff**  
2026-04-15T16:25:00
