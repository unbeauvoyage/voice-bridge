---
title: "A3: Archive knowledge-base-refactor zombie team directory"
date: 2026-04-16T05:20:00
type: case-study
task: A3
category: team-directory-hygiene
anti_pattern_ref: AP4
summary: knowledge-base-refactor team (TeamDelete'd but never cleaned) archived. 1521-line inbox removed from wake path. Saves ~15k tokens per wake.
---

## What changed

Created `~/.claude/teams/archive/` directory. Moved `~/.claude/teams/knowledge-base-refactor/` into it.

The team had been ordered TeamDelete'd weeks earlier but the filesystem directory was never cleaned. Its team-lead.json inbox had grown to 1521 lines.

## Before / After

| Metric | Before | After |
|---|---|---|
| knowledge-base-refactor/inboxes/team-lead.json | 1521 lines | Archived |
| Other inboxes (react-query-lead, zustand-lead, team-lead-opus) | 280 + 30 + 13 = 323 lines | Archived |
| Total inbox lines in zombie dir | ~1844 lines | 0 |

**UUID teams checked:**
- `25c2a24d-03d7-4e98-874a-3f1dc507c9c8`: mtime 2026-04-15, left in place (active within 7 days)
- `f6c28738-8c31-4006-bb90-ab69f16872c5`: mtime 2026-04-15, left in place (active within 7 days)

## Decision rationale

A team inbox is read when the agent wakes up. Even if the team is "dead," if the directory exists and an agent somehow references it, the inbox content pays the context cost. The knowledge-base-refactor team was confirmed dead (TeamDelete had been ordered). Keeping it served no purpose.

Cross-reference: Anti-Pattern AP4 (Never truncating inboxes or worklogs).

## Tokens saved

- ~15k tokens per potential wake (1844 lines × ~10 tokens/line)
- More importantly: reduces ambient noise in `~/.claude/teams/`

## Reversibility

Fully reversible: `mv ~/.claude/teams/archive/knowledge-base-refactor ~/.claude/teams/`. All data preserved in archive.

## Gotchas

- This is a filesystem operation only — no git commit. Teams directories are not in the environment git repo.
- The two UUID-named teams were initially suspected to be zombies (UUID names = no human-chosen name = possibly auto-generated). But both showed mtime 2026-04-15, meaning they were active recently. Left in place.
- Always verify mtime before archiving UUID teams — the UUID naming is the diagnostic trigger, not sufficient evidence of being zombie.

## Rule derived

If a team has been ordered TeamDelete'd, the filesystem cleanup MUST follow immediately. Add to team-lead shutdown checklist: "After TeamDelete returns success, verify `~/.claude/teams/{name}/` no longer exists."

## Related

- ANTI-PATTERNS.md: AP4
- TOKEN-OPTIMIZATION.md: Leak #2
- No git commit (filesystem outside repo)
