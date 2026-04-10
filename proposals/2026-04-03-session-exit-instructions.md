---
title: session-exit.md Final-State Instructions
date: 2026-04-03
status: pending
---

## Problem

When agents go idle or are compacted, final-state instructions are lost. There is no persistent mechanism for managers to leave cleanup or handoff instructions that survive context compaction.

## Plan

1. Create `~/environment/session-exit.md` as a structured file with per-session instructions:
   ```
   ## [session-name]
   - [instruction]
   - [instruction]
   last-updated: YYYY-MM-DD
   ```

2. Agents check `session-exit.md` for their session entry:
   - On startup (after reading HANDOFF.md and SESSIONS.md)
   - Before going idle (natural pause in work)
   - When receiving a shutdown signal

3. Supported instruction types:
   - `archive: <path>` — copy working files to a destination before exit
   - `notify: <channel>` — send a completion message to a channel
   - `run: <command>` — execute a cleanup command
   - `block-until: <condition>` — hold idle state until condition is met (e.g., file exists)
   - `handoff-to: <agent>` — send current task summary to another agent

4. Meta-manager writes instructions to `session-exit.md` when launching or managing a session. Entries are removed after the session successfully executes them (or explicitly cleared by manager).

5. Integrate with `sessions.md`: add `exit-instructions: yes/no` column so dashboard shows which sessions have pending exit instructions.

## Effort Estimate

2–3 hours (file format + agent startup/idle hook + manager write tooling + sessions.md column)

## Dependencies

- Agents must read `session-exit.md` on startup — requires CLAUDE.md update
- Sessions without channel support fall back to cmux pane read for acknowledgment

## Next Steps

- CEO approves instruction types
- Add read step to agent startup checklist in CLAUDE.md
- Define which agents implement idle-check (all persistent agents)
- Test with one session before rolling out broadly
