# Team Structure & Parallelization Rules

## The Rule

**Team leads NEVER code.** They coordinate, delegate, review merges, and stay available.

## Team Lead Responsibilities
- Receive tasks from Command
- Break tasks into features
- Spawn micro-teams per feature (TeamCreate)
- Monitor progress (zero-token: git log, worklogs)
- Review and merge completed features to main
- Report completion to Command
- Stay responsive to Command/Jarvis at all times

## What Team Leads NEVER Do
- Write code
- Run builds
- Fix bugs directly
- Block on any single task

## Micro-Team Structure (per feature)

For each feature, the team lead spawns a **visually named** sub-team:

**Naming convention:** `Feature-[Name]-Team` — e.g., `Feature-Dashboard-Input-Team`, `Feature-Notifications-Team`. Names must be visually prominent so it's clear who works together.

```
Feature-[Name]-Team (isolated worktree + separate port)
  ├── Writer — implements the feature
  ├── Reviewer — reviews the code (never the writer)
  └── Tester — writes + runs Playwright/UI tests
```

**Isolation:**
- Each feature sub-team gets its own **git worktree** (separate branch, separate directory)
- Each sub-team runs on a **different port** (5173, 5174, 5175, etc.)
- Multiple features can build and test in parallel without blocking each other
- Result: 4+ worktrees testing simultaneously = 4x parallelism = no bottleneck

**Flow:**
1. Team lead creates worktree: `git worktree add ../feature-[name] -b feature/[name]`
2. Assigns port: dev server on unique port (5174, 5175, etc.)
3. Spawns writer with clear spec + worktree path + port
4. Writer implements → signals done
5. Reviewer reviews diff → approves or requests changes
6. Tester writes tests against assigned port, runs full suite → reports pass/fail
7. All pass → team lead merges to main with VIP commit
8. Clean up worktree: `git worktree remove ../feature-[name]`

## Parallelization

Multiple features run simultaneously:
```
Team Lead (productivitesse)
  ├── Feature Team A (branch: feature/issues-panel)
  │     ├── Writer A
  │     ├── Reviewer A
  │     └── Tester A
  ├── Feature Team B (branch: feature/notifications)
  │     ├── Writer B
  │     ├── Reviewer B
  │     └── Tester B
  └── Feature Team C (branch: feature/questions-panel)
        ├── Writer C
        ├── Reviewer C
        └── Tester C
```

Each team works in full isolation — separate worktree, separate branch, separate dev port. No merge conflicts. Team lead merges sequentially when features complete.

## Spawn Commands

Team leads use TeamCreate (not Agent) so agents persist for follow-ups:
- Writer: "Implement [feature]. Work on branch feature/[name]. Signal DONE when complete."
- Reviewer: "Review the diff on branch feature/[name]. Check TS errors, security, breaking changes. Approve or request changes."
- Tester: "Write Playwright tests for [feature] on branch feature/[name]. Run full suite. Report results."

## Branch Naming
- `feature/[short-name]` for new features
- `fix/[short-name]` for bug fixes
- `main` is always stable — only merged after review + test

## Why This Matters
- Team leads stay available (never blocked coding)
- 10 features can run in parallel
- Each feature is tested before merge
- CEO/Command can always reach team leads
- No single point of failure
