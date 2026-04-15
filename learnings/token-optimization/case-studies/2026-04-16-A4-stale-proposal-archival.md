---
title: "A4: Archive stale proposals (2026-04-03 to 2026-04-06)"
date: 2026-04-16T05:30:00
type: case-study
task: A4
category: directory-hygiene
anti_pattern_ref: AP5
summary: 19 proposals with no action for 13+ days moved to proposals/archive/ with status:archived. 12 approved/done left in place.
---

## What changed

Scanned all proposals dated 2026-04-03 through 2026-04-06. Applied the rule: if status is `approved`/`rejected`/`archived`/`done` → leave in place. Otherwise → update frontmatter and move to `proposals/archive/`.

Created `proposals/archive/` directory.

## Before / After

| Metric | Before | After |
|---|---|---|
| proposals/2026-04-03 to 04-06 | 31 files | 12 in proposals/, 19 in proposals/archive/ |
| proposals/ total file count | ~148 | ~53 (proposals/ main) |

## Files archived (19)

Status before archival → archived:
- `proposed` (14): codex-code-reviews, github-issues-vs-local, information-taxonomy, persistent-codebase-experts, philosophy-exploration-system, proposal-qa-workflows, proposal-vs-message-rules, session-exit-instructions, structured-event-logging, voice-controlled-dashboard, image-attachment-spec, mobile-3d-view, ux-audit-type-scale-and-button-consistency, productivitesse-feature-refactor
- `needs-update` (3): otel-token-tracking, inbox-retention-policy, relay-delivery-confirmation
- empty (2): mobile-tab-overload-and-action-surface, unified-mobile-attention-architecture

## Files kept (12)

- `approved`: active-notification-system, dynamic-agent-hierarchy-3d, findings-shared-index, kanban-auto-execution, message-templates, proposal-voice-action, mission-control-surface-layer, mobile-notifications-bottom-sheet, ux-audit-inbox-timestamp-and-zone1-badge, ux-audit-navbar-overflow, ux-audit-notification-urgency-differentiation (11)
- `done`: permission-persistence (1)

## Decision rationale

Proposals with no action for 13+ days fall into two categories:
1. Forgotten — nobody acted on them, they may never be revisited
2. Implicitly decided — behavior changed without the proposal being formally approved

Either way, keeping them in `proposals/` active directory adds ambient noise and token cost without value. Archiving preserves them with a clear `archived_reason` so they can be revived if needed.

Cross-reference: Anti-Pattern AP5 (Leaving proposals in pending forever).

## Tokens saved

- Per scan: ~3-5k tokens (19 archived files × avg 50 lines × ~10 tokens/line)
- Indirect: proposals/ is now scannable at a glance (53 files vs 148 before both A2 and A4)

## Reversibility

Fully reversible: `mv proposals/archive/2026-04-0{3,4,6}-*.md proposals/` and revert frontmatter status. All original content preserved.

## Gotchas

- `needs-update` status was treated as "not decided" — archived. This is correct: `needs-update` means the proposal author acknowledged it was stale but nobody resolved it.
- Empty status (no `status:` line in frontmatter) was treated as `proposed`. Both files with empty status were from 2026-04-06 and had clearly not been acted on.
- `done` (permission-persistence) was kept in place — `done` means it was implemented, which is equivalent to `approved`. A done proposal is a historical record of a decision.

## Rule derived

Add to chief-of-staff weekly checklist: scan proposals/ for files older than 7 days with status `proposed`/`needs-update` and either ping CEO for decision or archive. After 14 days, auto-archive without ping.

## Related

- ANTI-PATTERNS.md: AP5
- TOKEN-OPTIMIZATION.md: Leak #4
- Commit: environment main `39599fa`
