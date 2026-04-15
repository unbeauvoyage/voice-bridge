---
title: Rename "features" to "services" to prevent page/component capture
author: chief-of-staff
created: 2026-04-15T23:15:00
status: open
summary: CEO observation — "feature" causes coders to pull pages and components into the feature folder. "Service" may better express the intent: cross-cutting logic/data layer that pages and components consume.
audience: ceo
---

# Features vs Services — Naming Discussion

## CEO Observation (verbatim)
> "feature" makes coders think all components and pages of that feature also belong in that feature while I think what we are actually trying to do might be a normal react best practice app where pages do the routing, components are reusable independent units, and features are services that could be used across all those.

## The Pattern We Actually Want
- `pages/` — route-level composition. Reads feature public APIs, renders layouts.
- `components/` — reusable UI primitives. No business logic. Used by pages AND features.
- `features/` (or `services/`) — business logic, data access, domain types, orchestration. **Not UI.**

In the current productivitesse refactor, each feature folder contains `components/`, which mixes the two concerns and makes it easy for coders to stuff pages inside.

## Proposed Rename
`src/features/` → `src/services/`

Each service exposes a public API via `index.ts`:
- Hooks (useKanban, useKnowledge)
- Domain types
- Pure orchestration functions
- NO React components, NO pages, NO route definitions

Components and pages that consume a service live in `components/` and `pages/` respectively, importing only from `services/X`.

## Tradeoffs

| Aspect | "features" (current) | "services" (proposed) |
|---|---|---|
| Intent clarity | "things this app does" — ambiguous scope | "shared business logic" — clear it's not UI |
| Coder intuition | Pull everything under the feature | Keep UI out of the service |
| Ecosystem alignment | Matches feature-sliced-design | Matches DDD / hexagonal |
| Refactor cost | Zero (current state) | Rename + update boundary rules + update ~200 imports |

## Questions for CEO
1. Go with rename now (post-migration, one atomic commit) or defer?
2. If yes, does `components/` inside a service ever make sense (e.g. a KanbanBoard widget that only makes sense in context), or do all components live at the top level?
3. Do services get their own hooks subfolder, or flat (`useKanban.ts` at service root)?

## Recommendation
**Defer rename decision until after parity checkpoint.** The boundary rules currently passing are worth keeping green. Rename atomically once refactoring lands, in a single commit across all imports.
