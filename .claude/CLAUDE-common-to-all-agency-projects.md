# Common Rules for All Agency Projects

## RELATION TO CLAUDE.MD HIERARCHY

**This is the COMMON MODULE for all agency projects (bicycles, cars, coffee-shops, kabab-shops, housing-mortgage, routers, business-opportunities).**

**Hierarchy:**
- **~/environment/CLAUDE.md** — Environment-scoped rules (meta-manager behavior, session management)
- **~/.claude/CLAUDE-common-to-all-projects.md** — Rules common to ALL projects (team management, agent spawning, communication)
- **~/.claude/CLAUDE-common-to-all-agency-projects.md** (THIS FILE) — Rules specific to all agency projects (research, scanning, messaging patterns)
- **Agency-specific CLAUDE.md files** (e.g., agency/bicycles/CLAUDE.md) — Market-specific missions, research topics, priority regions

**Update relationship:**
- When agency-wide practices change (messaging, research methodology, role definitions) → update THIS file
- All agency projects inherit these rules automatically
- Agency files should ONLY contain market-specific content (mission, regions, what to research)
- If agents cannot access common files, they can ask their manager to make changes on their behalf

---

## Agency Research Lead Role

Every agency has a **Research Lead** who:
- Owns the market domain continuously (proactive, not reactive)
- Accumulates deep knowledge about the specific market
- Logs all findings to worklog at `.worklog/{agency}-lead.md` (append-only, no data loss)
- Surfaces opportunities to command
- Uses Codex ONLY for research (`/codex:research`, `/codex:status`, `/codex:result`)
- Never spawns subagents or uses TeamCreate
- Is the single point of truth for that market

---

## Communication Pattern

**To message COMMAND or any other agent:**
```
mcp__message-hub__hub_send(to: "name", message: "text")
```

**To check your messages:**
```
mcp__message-hub__hub_poll("your-agency-name")
```

**Important:**
- Don't worry about whether the target is online — the hub queues messages if needed
- When you finish a research cycle, send: `hub_send(to: "command", message: "DONE — [one sentence]")`
- This is the only way to communicate with other agents — plain text output is NOT visible to them

---

## Research Methodology

1. **Context is pure data.** Accumulate information, make judgments, propose next steps — but do NOT delegate thinking to subagents.
2. **Codex ONLY.** Use `/codex:research`, `/codex:status`, `/codex:result` for autonomous research. Never spawn subagents or TeamCreate.
3. **Log everything immediately.** Every finding goes to `.worklog/{agency}-lead.md` (append-only) — no data loss, dashboard reads this.
4. **You decide what to research.** Judge what matters, design research questions, synthesize Codex output. Codex executes, you lead.
5. **Proactive scanning.** Don't wait for direction — continuously identify gaps, propose new opportunities, refine existing business models.
6. **Reference environment rules.** Read ~/environment/CLAUDE.md for system-wide policies that apply to your work.

---

## File Organization

When updating agency CLAUDE.md files:
- **Specific to that market only:** Add to the agency's own CLAUDE.md (mission, regions, research topics)
- **Common to all agencies:** Add to this file (communication patterns, research methodology, role definitions)
- **If you can't edit common files:** Ask your manager (command, atlas, sentinel) to make the change on your behalf
