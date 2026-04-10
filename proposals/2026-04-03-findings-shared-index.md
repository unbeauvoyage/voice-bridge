---
title: FINDINGS.md Shared Knowledge Index
date: 2026-04-03
status: approved
---

## Problem

Cross-agency knowledge is siloed in individual `.worklog/` files. Agencies repeat research already done by other teams. No mechanism exists to surface prior findings at project start.

## Plan

1. Create `~/environment/FINDINGS.md` with a simple append-only format:
   ```
   [agency] [YYYY-MM-DD] [finding summary] [tags]
   ```
   Example:
   ```
   productivitesse 2026-04-01 Supabase free tier has 500MB limit; hits ceiling at ~50k users #database #scaling
   ```

2. Add a step to the agent completion template: before sending `DONE`, append a 3-bullet summary to FINDINGS.md. Each bullet = one finding in the format above.

3. Dashboard reads FINDINGS.md and surfaces the last 20 entries in the status view. Tag filter optional.

4. Bootstrap: write a one-off script that scans existing `.worklog/` files, extracts key findings using a Haiku subagent, and bulk-appends to FINDINGS.md. Run once; mark bootstrapped entries with `[bootstrap]` tag.

5. Add to CLAUDE.md: agents must check FINDINGS.md for relevant prior work before starting research tasks.

## Effort Estimate

3–4 hours (file creation + agent instruction update + bootstrap script + dashboard integration)

## Dependencies

- No infrastructure changes needed
- Bootstrap requires Haiku subagent access to `.worklog/` files

## Next Steps

- CEO approves format
- Add append instruction to agent completion template in CLAUDE.md
- Run bootstrap script
- Add FINDINGS.md read step to agent startup checklist
