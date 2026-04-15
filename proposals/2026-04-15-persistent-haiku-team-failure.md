---
title: Persistent Haiku Team Architecture — Failure Analysis & Alternatives
created: 2026-04-15T07:55:00
status: proposed
author: productivitesse-team-lead
summary: Persistent Haiku coder agents spawn but don't execute tasks. Investigate root cause and propose alternatives.
---

# Problem

Persistent Haiku coder team (dev-coder, feature-coder) spawned per chief-of-staff's pattern instruction, but agents are non-functional:
- Spawn successfully
- Do not read TaskList
- Do not process assigned tasks
- Do not respond to SendMessage
- Go idle immediately after spawn
- No error messages or logs

Same failure pattern observed with earlier one-off agents (playwright-fix, inbox-animation, inbox-longpress, task5-jsonl-store).

## System Context

- Token budget: Haiku (constrained)
- Pattern attempted: TaskCreate small chunks → TeamCreate persistent team → coders self-manage via TaskList
- Expected: Coders read TaskList, claim unblocked tasks, work TDD, report completion
- Actual: Coders spawn, idle, no engagement

## Root Cause Hypotheses

1. **Agent definition issue** — `.claude/agents/coder.md` may not work correctly in team context
2. **Prompt issue** — Coder prompts don't trigger TaskList reading or task ownership behavior
3. **Team infrastructure issue** — TeamCreate/TaskList integration broken or misconfigured
4. **Haiku model limitation** — Model too constrained to handle multi-step work without explicit direction
5. **Isolation/worktree issue** — `isolation: "worktree"` may prevent agents from accessing shared task list
6. **Race condition** — Agents spawn, go idle before TaskList is available

## Evidence

- One-off agents (no team): same failure
- Persistent team agents: same failure
- Both Haiku and implied earlier use of Sonnet: not tested on Haiku with current prompts
- Manual verification: tasks exist in TaskList, can be read via TaskGet, agents just don't interact with them

## Proposed Alternatives

### Option A: Sonnet Coders (Proven to Work)
- Spawn persistent team with Sonnet model instead of Haiku
- Breaks token budget but work completes
- Trade-off: Cost vs productivity
- Timeline: immediate
- Risk: low (Sonnet has worked before)

### Option B: Explicit Task Assignment (No Self-Management)
- Keep Haiku coders
- Team lead assigns tasks directly via TaskUpdate (owner field) + SendMessage (task details)
- Coders don't self-claim; team lead pushes work
- Timeline: immediate
- Risk: team lead bottleneck on assignments, less autonomous

### Option C: Synchronous Task Dispatch
- Rewrite coder prompts to enter tight loop: `while(true) { TaskGet(taskId); work(); TaskUpdate(status:completed); next_task = TaskList(); }`
- Force deterministic task progression
- Timeline: 30min for prompt rewrite
- Risk: may expose other infrastructure issues (TaskList access, task ownership)

### Option D: Abandon Persistent Team, Use Codex
- Use Codex for actual work (`/codex:rescue`)
- Team lead coordinates Codex calls
- Keep Claude Code for planning/testing only
- Timeline: immediate pivot
- Risk: loses persistent context across tasks, requires Codex availability

### Option E: Debug & Fix (Deep Dive)
- Spawn single coder with verbose logging
- Capture what actually happens after spawn
- Check: TaskList access, Team config, Agent message delivery
- Fix infrastructure
- Timeline: 1-2 hours, unknown success rate
- Risk: time-heavy, may not find root cause

## Recommendation

**Option B + C Hybrid:** Keep Haiku (token budget), add explicit task assignment from team lead + rewrite coder prompts to be more aggressive about TaskList polling. Lower cost than Sonnet, higher autonomy than pure assignment.

**Fallback: Option A** if Option B+C doesn't work within 30min. Switch to Sonnet, accept token cost.

---

**Decision needed:** CEO/chief-of-staff approval on which path to pursue. Productivitesse work is fully stalled until this is resolved.
