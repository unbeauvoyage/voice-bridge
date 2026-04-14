---
title: System Architecture Review — Docs, Capabilities, and Org Chart
author: team-lead (arch audit, Opus)
created: 2026-04-14T00:22:34
updated: 2026-04-14T00:22:34
type: proposal
status: pending
summary: Three-stream audit of CLAUDE.md hierarchy, Claude Code extension mechanisms, and agent org chart — concrete recommendations to reduce contradictions, enable deterministic enforcement via hooks, and make reporting lines explicit
---

# System Architecture Review

Foundational review covering three streams. Detailed findings in:
- `~/.worklog/arch-audit/docs-audit.md` — Stream 1
- `~/.worklog/arch-audit/capability-map.md` — Stream 2
- `~/.worklog/arch-audit/org-chart.md` — Stream 3

## Problem Statement

The system has grown organically. Three related issues are compounding:

1. **Docs contradict themselves.** Rules about specs, tests, model choice, and session spawning exist in 3–5 files each. The spec-first workflow and the tests-as-spec workflow are both declared mandatory in different files. Agents pick whichever they read first.

2. **Enforcement is purely prose.** Every rule is "you must" or "you never" — we rely on agents reading 300-line files and complying. Claude Code offers deterministic enforcement via hooks, and we use almost none of it. `testing-discipline.md` is 311 lines of repeated instruction because we have no mechanism to block non-compliant work.

3. **The org chart is implicit.** Agents don't know who their manager is. `quality-auditor`, `agentflow-expert`, and `agency-lead` are orphans. Chief-of-staff, command, and team leads have overlapping authority over code. Scaling the team (new projects, new agencies) requires CEO to re-explain the hierarchy every time.

## Top Findings

### Stream 1 — Docs Audit
- **Three files claim "source of truth"** (CLAUDE.md, CLAUDE-common-to-all-projects.md, testing-discipline.md). They should collapse to one root + focused modules.
- **Spec-first vs tests-as-spec** is a live contradiction. The CEO policy is tests-as-spec. Delete `spec-writer`, delete Rule 13 in code-standards.md, fix team-lead.md and coder.md to match.
- **Rule numbering is broken** in code-standards.md (two Rule 10s, Rule 9 appears out of sequence).
- **Model policy drifts** — CLAUDE.md says atlas/sentinel are Sonnet but project-manager.md frontmatter says Haiku.
- **Testing discipline duplicated 4x** across team-lead.md, coder.md, code-standards.md, and testing-discipline.md. Collapse to one canonical source with one-line links.
- **Target line counts:** testing-discipline.md 311→150, team-lead.md 221→90, coder.md 153→60, code-standards.md 513→200.

### Stream 2 — Claude Code Capabilities
- **~25 hook events available**, we use maybe 2. Huge lever we're not pulling.
- **Determinism is free.** A `SubagentStop` hook that blocks completion reports missing test output replaces 80 lines of testing-discipline.md with 10 lines of shell.
- **Skills are zero-used.** Every CEO command (`/status`, `/proposals`) could be a named skill.
- **The biggest wins:**
  1. `PermissionRequest` hook → relay HTTP endpoint → zero-token auto-approval (Tier 3 already planned)
  2. `SubagentStop` hook → enforce verification sections in completion reports
  3. `SessionStart` hook → inject agent identity and org position from frontmatter
  4. `TaskCreated` hook → enforce "task-first" discipline
  5. `Stop` hook → keep team leads from idling while teammates have work in flight

### Stream 3 — Org Chart
- **Three C-suite roles:** command (COO), chief-of-staff (CTO), PMs (VP Ops). Currently all three touch coding — need clear separation.
- **Four departments:** Executive, Environment (staff experts), Engineering (team leads + crew), Agency.
- **Every agent file needs three new frontmatter fields:** `department`, `reports_to`, `escalates_to`.
- **Orphans to adopt:** quality-auditor → chief-of-staff; agentflow-expert → chief-of-staff (or delete); agency-lead → command.
- **Missing roles:** relay-engineer (owner of message-relay/), product-owner (BACKLOG + proposals curator), incident-commander (auto-spawned on escalate).

## Concrete Recommendations

### Recommendation A — Collapse the doc hierarchy (Stream 1)
**Scope:** docs only, no behavioral changes.

1. Make `~/environment/CLAUDE.md` the only root. Target ~150 lines — a map, not a manual.
2. Delete `~/.claude/CLAUDE-common-to-all-projects.md`. Move its team-management content to new `.claude/modules/team-management.md`.
3. Delete testing content from `CLAUDE-common-to-all-projects.md` and all restatements in team-lead.md, coder.md, code-standards.md. Canonical source: `testing-discipline.md`.
4. Kill spec-first contradictions: delete `code-standards.md` Rule 13, `CLAUDE-common-to-all-projects.md` spec-first sections, and spec-first paragraphs in team-lead.md + coder.md. The policy is tests-as-spec — declare it once at the top of CLAUDE.md.
5. Fix rule numbering in code-standards.md.
6. Split productivitesse-specific rules out of code-standards.md into `projects/productivitesse/CODE-STANDARDS.md`.
7. Align model policy: single table in CLAUDE.md, agent frontmatter must match.

**Owner:** system-expert (matrix) — this is directly in his domain.
**Risk:** low. Pure doc refactor. Verification: every CLAUDE.md link still resolves, no agent hits a 404.

### Recommendation B — Adopt hooks for deterministic enforcement (Stream 2)
**Scope:** infrastructure. Medium lift. Requires relay server coordination.

Phase 1 (quick wins):
1. `SubagentStop` hook — validate coder completion reports have "Verification:" section with real output. Block otherwise.
2. `SessionStart` hook — load agent frontmatter, inject `additionalContext` with identity + reporting line + peers.
3. `InstructionsLoaded` hook — log which CLAUDE.md files loaded to which session (debug drift).

Phase 2 (Tier 3 permissions — already planned):
4. `PermissionRequest` hook → POST to `relay :8767/hook/permission/...` → auto-approve known-safe, escalate unknowns. Eliminates cmux polling Tier 1.

Phase 3 (behavioral enforcement):
5. `Stop` hook on team leads — prevent idle when teammates are active.
6. `TaskCreated` hook — enforce naming conventions and required fields.
7. Skills — convert repeat CEO commands into named `/skills`.

**Owner:** chief-of-staff + communications-expert (relay endpoints).
**Risk:** medium. Hooks can hang sessions if misconfigured. Test in one agent (a coder) first, then roll out.

### Recommendation C — Make the org chart explicit (Stream 3)
**Scope:** frontmatter migration + chain-of-command section in CLAUDE.md.

1. Add `department`, `reports_to`, `escalates_to` fields to all 19 agent files. Mechanical — `system-expert` can do in one session.
2. Add a "Chains of Command" section to CLAUDE.md covering: coding request, research request, security incident, architecture question, UX concern.
3. Adopt or delete orphans: quality-auditor, agentflow-expert, agency-lead.
4. Clarify command vs chief-of-staff vs team-lead boundary in CLAUDE.md "Two Scopes" section.
5. (Phase 2) The `SessionStart` hook from Recommendation B reads this frontmatter so every session starts knowing its position.

**Owner:** system-expert (matrix).
**Risk:** low. Frontmatter is additive. Existing prompts unchanged.

## Prioritization

| Priority | Recommendation | Effort | Impact | Owner |
|---|---|---|---|---|
| P0 | Kill spec vs tests-as-spec contradiction | S | H | matrix |
| P0 | Fix code-standards.md rule numbering | S | M | matrix |
| P0 | Fix model policy drift (PM Haiku vs Sonnet) | S | M | matrix |
| P1 | Add frontmatter fields to all agents | S | H | matrix |
| P1 | Collapse testing-discipline duplicates | M | H | matrix |
| P1 | Adopt SubagentStop hook for test verification | M | H | chief-of-staff |
| P1 | Adopt PermissionRequest hook (Tier 3) | M | H | signal + chief-of-staff |
| P2 | Split productivitesse rules out of code-standards.md | M | M | matrix |
| P2 | SessionStart hook for org-position injection | M | M | chief-of-staff |
| P2 | Resolve orphan agents | S | M | matrix |
| P3 | Skills for CEO commands | M | L | chief-of-staff |
| P3 | Add missing roles (relay-engineer, etc.) | L | M | CEO decision |

## What CEO Decides

This proposal asks CEO to approve (or modify) the direction:

1. **Tests-as-spec wins** — delete spec-first, delete `spec-writer` role. Yes/no?
2. **Hooks for enforcement** — begin migrating rules from prose to hooks, starting with test verification. Yes/no?
3. **Frontmatter org chart** — add reports_to / department / escalates_to to all agents. Yes/no?
4. **Command vs chief-of-staff split** — command = strategic routing + CEO-facing; chief-of-staff = code quality + architecture only. Yes/no?
5. **Orphan adoption** — quality-auditor → chief-of-staff, agentflow-expert → delete or adopt, agency-lead → command. Yes/no?

On approval, system-expert owns Recommendations A and C. Chief-of-staff and communications-expert co-own Recommendation B. Total scope: a few focused work sessions, not a multi-week project.

## Non-Goals

This proposal does NOT:
- Rewrite the relay server or change communication transport
- Change how TeamCreate works
- Replace Claude Code with a different tool
- Add new models or change which agents use which model
- Propose new products or features for productivitesse
