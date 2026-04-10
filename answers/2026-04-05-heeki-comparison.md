---
date: 2026-04-05T21:32:56
question: How does heeki's agent team approach compare to ours?
source: https://heeki.medium.com/collaborating-with-agents-teams-in-claude-code-f64a465f3c11
---

# Heeki's Agent Team Approach vs Ours

## Key Differences

| Aspect | Heeki | Us |
|---|---|---|
| Team lifetime | One-off per issue, dies after | Persistent sessions across tasks |
| Agent identity | No predefined definitions, lead picks ad-hoc | Defined types in `.claude/agents/` with frontmatter |
| Coordination | Native Claude Code only (task list, SendMessage) | Two layers — relay (cross-session) + native (within-team) |
| Specs | Human writes detailed specs FIRST | Agents write specs (often skipped) |
| Human role | Heavy — writes specs, tests UX for hours | Minimal — CEO is fire-and-forget |
| Scale | 1 team at a time | 20+ agents across multiple projects |

## What They Do Better (steal these)
1. **Specs-first** — team spawn prompt includes the spec. Enforced structurally.
2. **Simplicity** — native Claude Code features only, no custom infra.
3. **Prompt logging** — saves every prompt to `prompts_issue_###.md`.
4. **Permission allow-lists** — explicit allows, no bypassPermissions.

## What We Do Better
1. **Scale** — multi-project, multi-team, simultaneous.
2. **Hands-off CEO** — fire-and-forget, agents handle the rest.
3. **Persistence** — agents accumulate knowledge across tasks.
4. **Cross-project coordination** — relay enables inter-project communication.

## Verdict
Their approach is better for solo dev, issue-by-issue. Ours is better for multi-project org with hands-off CEO. We should adopt their specs-first and prompt-logging discipline within our team structure.
