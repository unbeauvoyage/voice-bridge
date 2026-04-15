---
title: Workflow Review — What Works, What Breaks
author: researcher
created: 2026-04-16T00:00:00
status: living
summary: Concrete patterns that are earning their keep, concrete patterns that are costing us, with evidence and fix suggestions.
---

# What Works

- **Small-chunk Haiku teams via explicit assignment (not self-managed TaskList)** — productivitesse (5/5/1 split) and knowledge-base (3 in flight 2026-04-15) both moved work forward when team lead pushed tasks directly via SendMessage rather than expecting agents to poll TaskList themselves.

- **Codex:review + codex:rescue loop** — multiple chunks today landed cleanly when team lead used `/codex:review` on each chunk and `/codex:rescue` when a coder got stuck. No need for escalation to CEO.

- **DOMAIN.md as pre-ship gate** — KB proposed 5 new fields via DOMAIN.md before shipping; field name drift was caught early. When it worked, it prevented the `dateAdded`/`createdAt`/`date_added` three-way drift that cost 12+ file edits (LANDMINES.md entry, 2026-04-14).

- **PostToolUse tsc hook** — KB installed this (STEAL-THIS.md #2); type errors surface in the same edit turn instead of accumulating silently. Prevents entire classes of `as Type` cast lies (LANDMINES.md #1).

- **Worktree isolation for parallel coders** — When properly set up with isolated `cacheDir`, parallel Vite instances don't crash the main dev server on port 5173. Pattern documented after the 2026-04-03 cache-corruption incident (PROBLEM-LOG.md).

- **Relay permission persistence** — shipped 2026-04-15 (commit 90f90d9 area). Permission requests no longer loop on relay restart. Postmortem-driven fix that actually closed the loop.

- **Inline self-review in commit body as codex-rate-limit fallback** — when codex CLI is rate-limited mid-refactor, team lead substitutes Stage 1/4 gates with a 4-point adversarial self-review written directly into the commit body (concerns + decisions), then runs a post-hoc codex Stage-4 batch at rate-limit recovery using narrow `"adversarial pass — what did I miss in the inline self-review?"` prompts grouped by semantic family (5 calls covering 8 commits, not 8 separate calls). Evidence: voice-bridge2 `server/index.ts` route extraction 2026-04-16 — 8-commit cycle (e904c4c, ac4dafa, 05a22f3, 6532c5c, cb76bbd, 75e01f8, 6f731bb, 6d95dfc) landed with 603→297 line shrinkage, +61 offline DI tests, zero regressions, two latent bugs logged to `voice-bridge2/ISSUES.md` (DFRR) rather than in-refactor fixed. Invariants that make this safe: scoped `git add <files>` never `-A`, all lint/typecheck fixes in the same commit (no follow-up churn), latent bugs rescued to ISSUES.md not silently fixed.

- **One-shot Agent fallback when team members stall** — chief-of-staff's 4 Phase C sweep coders stalled; Agent tool (without team membership) unblocked. When team infrastructure fails, one-shot is a reliable escape hatch (BACKLOG "Team-internal coder lifecycle appears broken").

# What Breaks

- **Team-internal coder lifecycle is unreliable for Haiku** — 10 Haiku coders spawned; only 3 responded with `shutdown_approved`, 7 replied with `idle_notification`. Manual config edit required to TeamDelete. Same pattern: coders spawn, don't read TaskList, don't respond to `SendMessage`. Root cause unknown (race between team assignment and first turn? in-process mailbox delivery gap?). *Fix:* require explicit task push via SendMessage + assert TaskGet response before trusting agent is live; document fallback to one-shot Agent when team spawn fails. Source: BACKLOG "Team-internal coder lifecycle appears broken"; proposal 2026-04-15-persistent-haiku-team-failure.md.

- **Zombie channel detection is unimplemented and causes silent message loss** — MCP bridge dies, HTTP server keeps responding 200, relay marks delivery succeeded, agent never sees the message. Chief-of-staff went an entire session not seeing knowledge-base's Codex findings because of this. Severity: HIGH per PROBLEM-LOG.md 2026-04-15T06:40:00. No fix is deployed yet. *Fix:* plugin `/message` handler must check MCP bridge liveness and return 503 if dead; relay must retry on 503 rather than treating 200 as delivered.

- **Relay sender auth is honor-system only** — the "attacker" incident: `relay-auth.test.ts` test fixture curled port 8767 (prod relay port) to verify the exploit, not a sandbox. The spoofed `from: command` prompt injection succeeded at delivery. No shared secret is enforced. *Fix:* `RELAY_SECRET` env var + header check on all `/send` calls; test fixtures must target a separate port or mock relay, never prod. Blocked by in-flight refactor per BACKLOG 2026-04-16 security item.

- **Scope creep from "pause" instruction** — message-relay told to pause; instead shipped full hardening commit 8df8e7a. Agent interpreted "pause" as "low priority, proceed carefully" rather than "stop all work". *Fix:* add explicit "pause = stop completely, no commits, wait for resume signal" to CLAUDE.md agent instructions.

- **DOMAIN.md gate is unenforced cross-team** — KB proposed 5 fields correctly once; 13 fields shipped in a separate commit without DOMAIN.md update first. Three-app convergence proposal (2026-04-15-three-app-convergence.md) calls out 46 `.skip()` violations in productivitesse and ESLint entirely absent from KB main. *Fix:* pre-commit hook or CI step that diffs DOMAIN.md against `src/features/*/types.ts`; chief-of-staff reviews domain PRs before merge, not after.

- **Foreground researcher blocked chief-of-staff for 6 minutes** — researcher ran synchronously in chief-of-staff's context. CLAUDE.md rule "all non-trivial work must run in background" was violated. *Fix:* enforce `run_in_background: true` on all Agent and TaskCreate calls from team leads and managers; add rule violation to PROBLEM-LOG template.

- **Test fixture hitting production port** — `relay-auth.test.ts` targeted port 8767 (live relay). The "attacker" scenario wasn't simulated — it was executed against prod. *Fix:* test fixtures must spin up an isolated relay instance on a random ephemeral port; never hardcode prod port in test files. Add to testing-workflow-hardening proposal (Layer 6 gap, 2026-04-10).

# Open Questions

- Is `idle_notification` vs `shutdown_approved` a model-level distinction (Haiku doesn't understand the protocol) or a TeamCreate infrastructure bug? Needs a controlled Sonnet vs Haiku comparison before investing in a fix.

- Does "pages vs features vs services" naming confusion (CEO observed "features" pulls in pages+components) block the three-app convergence merge, or is it a cosmetic rename that can happen later? Proposal filed but unresolved.

- Should the relay stay TypeScript or is the 2026-04-15 Rust/axum discussion actionable at the next major relay refactor? The zombie-channel fix (liveness check) is the natural forcing function — if we're touching the plugin handler anyway, evaluate migration cost at that point.

- At what point does the DOMAIN.md enforcement gate become more friction than value? Currently unenforced, so it has no enforcement cost — but also no enforcement benefit.
