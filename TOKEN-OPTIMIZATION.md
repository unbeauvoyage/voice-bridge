---
title: Token Optimization — Living Playbook
owner: chief-of-staff
created: 2026-04-16T06:38:03
status: living-document
summary: Why we hit rate limits despite effort, what the evidence says, and the prioritized fix list. Synthesized from 5 parallel research streams (internal audit, external web research, CLAUDE.md leanness, agent harnessing, team structure). Updated weekly.
---

# Token Optimization Playbook

## TL;DR

We hit rate limits because of **3 compounding structural leaks**, not because of one profligate agent:

1. **Cache TTL dropped to 5 minutes (March 2026 regression).** Every idle gap >5 min on a persistent agent pays ~12.5× rate to re-upload context. Our team-leads idle for hours. [source: GH #46829]
2. **Session-start overhead is enormous.** CLAUDE.md (673 lines on productivitesse) + MEMORY.md + agent definition + MCP tool schemas + modules = up to 173k of 200k *before real work*. Every subagent spawn pays this tax too. [source: Anthropic costs doc + Medium]
3. **No proactive /compact.** We compact reactively at 200k when sessions grind. Research + Anthropic guidance: compact after each task cycle at 100-120k. Saves the whole "compaction death spiral" class. [source: GH #24677]

**Combined effect:** a persistent team-lead idle for an hour, woken with a 6k prompt, costs as if we sent 75k fresh tokens. Do that 10× across the fleet = 750k tokens of pure re-upload tax per work cycle.

## The rule

> **Write the minimum number of words that change behavior. Load the minimum context that makes the current task possible. Reset context as soon as the task is done.**

## Evidence-based principles

Citations in appendix.

| Principle | Evidence |
|---|---|
| Lean prompt + rich tool harness > heavy prompt | Manus (5 refactors/6mo), Vercel (80% tool cut, better results), LangChain (3 rewrites) |
| Linear instruction-compliance decay past ~150 rules | Jaroslawicz et al. 2025 (arXiv:2507.11538) |
| Multi-turn performance drops 39% vs single-turn | Same paper |
| Reflection/adversarial review: 67→88% HumanEval | Datalearningscience 2024 |
| Context reset (handoff) > summarization | Anthropic official — Managed Agents |
| Hierarchical topology: 5.5% drop under faulty agents vs 23.7% flat | MAS resilience study 2025 |
| MCP tool reduction: 46.9% context savings (ToolSearch) | Medium 2026-04 |
| Cache TTL permanently 5 min since March 2026 | GH #46829 |

## Top 12 leaks (measured, ranked by impact)

From the internal audit (`.worklog/token-audit-internal-2026-04-16T00-00-00.md`):

| # | Leak | Size | Frequency | Weekly impact |
|---|---|---|---|---|
| 1 | productivitesse/CLAUDE.md | 6.7k | every session | 33-67k/week |
| 2 | knowledge-base-refactor inbox (team-lead.json, 1521 lines) | 15k | each wake | 15k/wake |
| 3 | proposals/ kb-item-*.md misfiled artifacts (~80 files) | 22k | each scan | 22k/scan |
| 4 | All 148 proposals/ files | 101k | full scan | 101k/scan |
| 5 | Environment .worklog/ cumulative | 70k | full scan | 70k/scan |
| 6 | Productivitesse .worklog/ cumulative | 54k | full scan | 54k/scan |
| 7 | PROBLEM-LOG.md | 4.8k | every session (agents told to read on wake) | high freq |
| 8 | team-lead.md agent definition | 1.5k | every team-lead spawn | per spawn |
| 9 | coder.md agent definition | 1k | every coder spawn (frequent) | per spawn |
| 10 | productivitesse inbox (11 stale unread) | 1k | each wake | per wake |
| 11 | Duplicate TDD rules (environment + productivitesse + others) | ~2k × N | every session | compounded |
| 12 | Agent Teams Reference inside productivitesse/CLAUDE.md (subset of #1) | 5.5k | every session | 27-55k/week |

## Prioritized actions

### Tier 1 — mechanical, reversible, do now

A1. **Strip Agent Teams Reference from productivitesse/CLAUDE.md** → `.claude/modules/agent-teams.md`, loaded on-demand. Saves 5.5k/session. Zero behavior risk. (~5 min)

A2. **Move kb-item-*.md and kb-raise-*.md out of proposals/** → `knowledge-base-exports/`. Saves 22k/scan. (~2 min)

A3. **Clean knowledge-base-refactor team directory** (team was ordered TeamDelete'd; inbox still 1521 lines). Either delete team dir or truncate inbox to last 10. Saves 15k/wake. (~5 min)

A4. **Archive stale proposals (2026-04-03 through 2026-04-06, no action 13+ days)** → `proposals/archive/`. Add `status: archived` frontmatter. (~10 min)

A5. **Archive PROBLEM-LOG entries older than 30 days** → `PROBLEM-LOG-2026-Q1.md`. Keep PROBLEM-LOG.md under 200 lines. (~10 min)

**Total estimated Tier 1 impact: ~45-80k tokens saved per session cycle. Execution time: ~30 min.**

### Tier 2 — structural, this week

B1. **62-line rewrite of productivitesse/CLAUDE.md** (demonstrated in claude-md research). Apply same leanness pass to every project CLAUDE.md. Target: max 120 lines per project CLAUDE.md.

B2. **Deduplicate TDD rules.** Keep canonical version in `~/environment/CLAUDE.md`. Replace duplicates with single-line pointer: `"TDD rules: see ~/environment/CLAUDE.md § TDD."`

B3. **Convert behavioral rules to hooks** where mechanizable. Principle: "hooks are laws, rules are requests" (Anthropic). Current examples that should be hooks:
   - "Always use scoped `git add`" → pre-commit hook reject `-A`
   - "Run tests after every feature touch" → PostToolUse hook runs relevant `.spec` file
   - "No skip() in tests" → lint rule + pre-commit hook

B4. **Migrate deep reference content to Skills.** TeamCreate tutorial, MAUI build commands, OTA install steps → Skills, load-on-demand. Drops 50+% of current CLAUDE.md mass.

B5. **Introduce HANDOFF.md context-reset protocol.** When session approaches 120k, team-lead writes HANDOFF.md (goal, state, next step, load-bearing decisions), spawns fresh session reading HANDOFF, terminates old session. Replaces reactive /compact.

B6. **Per-phase tool scoping.** Coder agents don't need relay access during implementation (distraction surface). Reviewers don't need Edit/Bash (avoids reviewer-writes-fix pattern). Tool lists change per task type.

B7. **Adversarial framing for reviewers and testers.** Prompt edit only. Evidence: Du et al. multiagent debate, ChatDev Reviewer pattern.

### Tier 3 — architectural, next 2 weeks

C1. **Domain experts as knowledge files + spawnable sessions.** Drop always-on footprint. Knowledge at `.claude/expert-knowledge/{name}.md`, spawn session on-demand reading the knowledge file. Correction of my earlier "keep them always-on" stance — research showed they cost on wake.

C2. **Persistent per-project coders instead of fresh spawns.** Amortizes context across tasks in same project. Measure: task-to-completion tokens on persistent vs spawned coder.

C3. **Compact-on-completion discipline.** After every completed task cycle (not every message), proactive /compact. Never cross 150k. Team-leads get reminded in their definition.

C4. **Cap inbox growth.** Auto-truncate inboxes at 50 messages or 14 days, whichever first. Write a `~/.claude/tools/inbox-gc.sh`. Run daily.

C5. **Cap relay message body size.** Soft warn >1500 chars, hard reject >3000 chars. Force worklog-pointer pattern: `"See .worklog/{agent}.md § 2026-04-16 for details."`

C6. **Weekly audit.** This file gets re-run every Monday. Measure compliance. Track top 12 leak table movement.

### Tier 4 — deferred, needs discussion

D1. **Team structure alternatives A + B** from team-structure research. Major changes to always-on count + roles. Discuss before committing.

D2. **.NET cookie-cutter proposal** (separate file: `proposals/2026-04-16-dotnet-cookie-cutter.md`). Independent track, but shares the "lean defaults" philosophy.

D3. **Replace Sonnet with Haiku for routine proposal-writer / researcher spawns.** Measure quality delta. Backstop: escalate to Sonnet if Haiku fails.

## Non-fixes (tempting but wrong)

- **"Turn off persistent agents"** — idle sessions cost nothing if nothing wakes them. The cost is on wake, not idle. Correcting my earlier sloppy framing.
- **"Use Haiku for everything"** — Haiku failed at architectural work in two documented pilots (see WORKFLOW-REVIEW.md). Role-appropriate model selection, not blanket downgrade.
- **"Stop using codex:review"** — codex quota is separate. Our side cost is the prompt+response Sonnet tokens (~2-5k/review). Worth keeping for architectural/logic commits; skip for pure-mechanical ones.

## Monitoring

Track weekly:
- Number of rate-limit hits (should trend down)
- Average session context at /compact (should trend down — goal: <150k)
- productivitesse/CLAUDE.md line count (target: <120)
- proposals/ file count (target: <80 after archival)
- PROBLEM-LOG.md line count (target: <200)
- Number of always-on sessions (current: ~10, alt-A proposes 5)

## Appendix — sources

### Internal audits (same directory, `.worklog/`)
- `token-audit-internal-2026-04-16T00-00-00.md` — internal file-size measurements
- `research-claude-md-lean-2026-04-16T14-30-00.md` — CLAUDE.md leanness + 1/10 rewrite
- `research-agent-harnessing-2026-04-16T14-30-00.md` — harness engineering + 8-layer surface
- `research-team-structures-2026-04-16T14-30-00.md` — topology evidence + alternatives
- `token-research-external-2026-04-16T12-00-00.md` — cache TTL regression + 3 structural leaks

### External
- [Anthropic: Manage costs effectively](https://code.claude.com/docs/en/costs)
- [Anthropic: Harness Design for Long-Running Apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Anthropic: Managed Agents](https://www.anthropic.com/engineering/managed-agents)
- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [Cache TTL regression #46829](https://github.com/anthropics/claude-code/issues/46829)
- [Compaction death spiral #24677](https://github.com/anthropics/claude-code/issues/24677)
- [MCP ToolSearch 46.9% reduction](https://medium.com/@joe.njenga/claude-code-just-cut-mcp-context-bloat-by-46-9-51k-tokens-down-to-8-5k-with-new-tool-search-ddf9e905f734)
- [Jaroslawicz 2025 — Instruction compliance decay](https://arxiv.org/abs/2507.11538)
- [Lost in the Middle — Liu 2024](https://arxiv.org/abs/2307.03172)
- [HumanLayer: Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Skill Issue: Harness Engineering](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents)
- [Phil Schmid: Agent Harness 2026](https://www.philschmid.de/agent-harness-2026)
- [Parreao Garcia: How Claude Code Rules Actually Work](https://joseparreogarcia.substack.com/p/how-claude-code-rules-actually-work)
- [DEV.to: Subagent token burn](https://dev.to/onlineeric/claude-code-sub-agents-burn-out-your-tokens-4cd8)
- [32blog: 50% reduction techniques](https://32blog.com/en/claude-code/claude-code-token-cost-reduction-50-percent)
- [MindStudio: 18 token management hacks](https://www.mindstudio.ai/blog/claude-code-token-management-hacks-3)
- [The Register: Rate limit drain](https://www.theregister.com/2026/03/31/anthropic_claude_code_limits/)

## Tier 1 execution report (2026-04-16)

Executed by coder agent (chief-of-staff-coders team). All tasks completed 2026-04-16T~05:00.

### A1 — Split productivitesse/CLAUDE.md

| | Before | After |
|---|---|---|
| CLAUDE.md | 894 lines | 304 lines (-590) |
| agent-teams.md (new) | — | 143 lines |

**Tokens saved per session:** ~5.5k (590 lines × ~10 tokens/line)
**Tokens saved per scan:** same (every session loads CLAUDE.md)
**Estimated weekly:** 27-55k tokens
**Reversibility:** Fully reversible — copy agent-teams.md back into CLAUDE.md
**Commit:** productivitesse dev branch `06dd200`

### A2 — Move kb-item/kb-raise out of proposals/

| | Before | After |
|---|---|---|
| proposals/ file count | ~148 | ~72 |
| Files moved | — | 76 moved to knowledge-base-exports/ |

**Tokens saved per scan:** ~22k (76 files × avg 290 lines × ~10 tokens/line)
**Reversibility:** Fully reversible — mv files back
**Commit:** environment main `d4e426b`

### A3 — Archive zombie team dirs

| | Before | After |
|---|---|---|
| knowledge-base-refactor inbox | 1521 lines (team-lead.json) + 280 + 13 + 30 = 1844 lines total | Archived to ~/.claude/teams/archive/ |
| UUID teams (25c2a24d, f6c28738) | Active — mtime 2026-04-15 | Left in place (active within 7 days) |

**Tokens saved per wake (knowledge-base-refactor):** ~15k
**Reversibility:** Fully reversible — mv back from archive
**Note:** No git commit (outside repo). Filesystem operation only.

### A4 — Archive stale proposals

| | Before | After |
|---|---|---|
| proposals/2026-04-03 to 04-06 | 31 files | 12 kept (approved/done), 19 moved to archive/ |

**Tokens saved per scan:** ~3-5k (19 files × avg 50 lines × ~10 tokens/line per file)
**Files touched:** 19 archived, 12 kept
**Commit:** environment main `39599fa`

### A5 — PROBLEM-LOG archival

| | Before | After |
|---|---|---|
| PROBLEM-LOG.md | 685 lines | 687 lines (+archive pointer, +1 blank) |
| Entries moved | 0 | 0 (no entries older than 2026-03-17) |

**Note:** All 685 lines of content are from April 2026 — within the 30-day window. Zero entries met the archival criteria. PROBLEM-LOG-2026-Q1.md created as structural placeholder. Target of <200 lines cannot be met by date-based archival until entries from April 2026 age past 30 days (~2026-05-17).
**Commit:** environment main `89c1ec5`

### Totals

**Per-session savings:** ~5.5k (A1) + partial scan savings (A2, A4) ≈ **~5.5k tokens per session** (CLAUDE.md is the primary per-session cost)

**Per-scan savings:** ~22k (A2, proposals scan) + ~3-5k (A4) + ~15k (A3, per kb-refactor wake) ≈ **~40-42k tokens per scan cycle**

**Note on A5:** PROBLEM-LOG.md reduction to <200 lines is deferred — no eligible entries exist yet. Will be achievable ~2026-05-17 when April entries age out.
