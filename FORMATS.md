# Output Formats

Every file the system produces uses the same pattern:
- **Frontmatter** (YAML) — machine-readable fields for dashboard cards, filtering, routing
- **Body** (Markdown) — prose for humans and LLMs to read

The dashboard reads frontmatter to render cards (title, summary, status badge).
Clicking a card shows the full body. Agents read both.

**Rule:** Every output file MUST have frontmatter. If a field is unknown at write time, use `(pending)`.

---

## Proposal

File location: `~/environment/proposals/YYYY-MM-DD-slug.md`

```yaml
---
type: proposal
title: Short title shown on card headline
summary: One sentence — what this proposes and why (shown on card without clicking)
status: pending | approved | rejected | commented | archived
author: agent-name
created: 2026-04-06T12:00:00
priority: high | medium | low
project: environment | productivitesse | relay | voice-bridge | (omit if cross-cutting)
---
```

Body: problem statement → proposed solution → technical design → tradeoffs → next steps.

---

## Q&A Question

File location: `~/environment/questions/YYYY-MM-DD-slug.md`

```yaml
---
type: question
title: Short question (shown on Knowledge Board card)
status: open | researching | answered
asked: 2026-04-06T12:00:00
asked-by: ceo
triggered-by: manual | distiller
answer: ~/environment/answers/YYYY-MM-DD-slug.md  (fill in when answered)
---
```

Body: full question text and any context the CEO provided.

---

## Q&A Answer

File location: `~/environment/answers/YYYY-MM-DD-slug.md`

```yaml
---
type: answer
title: Question rephrased as a statement (what was learned)
summary: One sentence TL;DR — the core finding
status: answered | partial | outdated
author: agent-name
created: 2026-04-06T12:00:00
question: ~/environment/questions/YYYY-MM-DD-slug.md
---
```

Body: full research, findings, recommendations. Link sources.

---

## Issue

Individual issue files in `~/environment/issues/YYYY-MM-DD-slug.md`
(ISSUES.md remains a quick kanban view; individual files are the source of truth for complex issues)

```yaml
---
type: issue
title: Short description of the problem
summary: One sentence — what breaks and when
status: open | in-progress | fixed | wontfix
project: productivitesse | relay | voice-bridge | system
severity: low | medium | high | critical
created: 2026-04-06T12:00:00
fixed-in: (commit hash when fixed)
---
```

Body: steps to reproduce, expected vs actual, proposed fix.

---

## Worklog

File location: `~/.worklog/{agent-name}.md`

```yaml
---
type: worklog
agent: agent-name
session-start: 2026-04-06T12:00:00
---
```

Body: rolling log of work done, decisions made, findings. Most recent entry at top.
Format each entry: `## YYYY-MM-DDTHH:MM:SS — [one-line summary]` then details.

---

## Knowledge File

File location: `~/environment/knowledge/{codebase}/{topic}.md`

```yaml
---
type: knowledge
title: Topic name
summary: What this file contains and when to consult it
codebase: productivitesse | relay | voice-bridge | system
created: 2026-04-06T12:00:00
updated: 2026-04-06T12:00:00
---
```

Body: reference knowledge about the codebase. Facts, patterns, gotchas.

---

## Problem Log Entry

File: `~/environment/PROBLEM-LOG.md` (append-only, one `##` section per incident)

```markdown
## YYYY-MM-DDTHH:MM:SS — [Incident title]

**Severity:** low | medium | high | critical
**Affected:** what system/feature broke
**Root cause:** one sentence
**Fix:** what was done
**Systemic fix:** what prevents recurrence (or "none identified")
**Written by:** agent-name
```

---

## Deploy Notification

Every deploy notification sent via relay MUST include a structured changelog. Two outputs required:

**1. Relay message to CEO** (type: `done`):
```
Deployed v2.4.1 — 3 changes:
- Fixed relay reconnect on mobile wake
- Inbox Zone 1 badge now clears on tap
- Agent grid refreshes without full reload
```

**2. changelog.json written to app static assets** (fetched by the UI on load):
```json
{
  "version": "v2.4.1",
  "ts": "2026-04-06T14:22:00",
  "changes": [
    "Fixed relay reconnect on mobile wake",
    "Inbox Zone 1 badge now clears on tap",
    "Agent grid refreshes without full reload"
  ]
}
```

Rules:
- `changes` is a flat array of plain-English strings — no technical jargon, no commit hashes
- 3–5 items max; group small fixes into one line if needed
- `version` and `ts` are required; never omit
- The relay message and changelog.json must describe the same set of changes

---

## Timestamp Rule

All timestamps: `YYYY-MM-DDTHH:MM:SS` (ISO 8601, seconds required).
Get real time: `date "+%Y-%m-%dT%H:%M:%S"` — never hardcode or use date-only.

---

## Summary Field Rule

Every file that reaches the CEO (proposals, answers, issues) MUST have a `summary` field in frontmatter.
This is what renders on the card without the CEO having to click. Make it genuinely useful —
not a restatement of the title, but the one thing the CEO needs to know at a glance.
