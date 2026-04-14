---
title: GitHub Issues vs ISSUES.md
date: 2026-04-03
status: proposed
---

# GitHub Issues vs ISSUES.md
**Proposed:** 2026-04-03
**For:** CEO
**Status:** pending

## Problem

The system currently tracks issues in `~/environment/ISSUES.md` — a local markdown file with checkboxes. A 3D React Three Fiber dashboard reads this file via a watcher and displays issues in real-time. The question is whether to migrate to GitHub Issues, stay local, or adopt a hybrid approach.

## Comparison

### ISSUES.md (Current)

| Factor | Assessment |
|--------|------------|
| Latency | Zero — agents read/write directly, no network round-trips |
| Reliability | No external dependencies; works offline |
| Dashboard integration | Already works — file watcher, real-time updates |
| Agent ergonomics | Trivial: read file, find checkbox, flip it, write back |
| Rate limits | None |
| Auth | None required |
| Search | `grep` — fast, scriptable |
| History | Git-tracked if desired |
| Mobile access | Read-only via file sync (e.g. iCloud/Dropbox) |
| External collaboration | Not supported |

**Weaknesses:** No labels/milestones, no cross-referencing with commits, no built-in audit trail, no assignee field (though easily added in markdown).

---

### GitHub Issues

| Factor | Assessment |
|--------|------------|
| Latency | ~100–500ms per API call; every read/write is HTTP |
| Reliability | Requires internet; GitHub outages break the workflow |
| Dashboard integration | Requires polling the GitHub API (adds complexity, latency, token management) |
| Agent ergonomics | Requires `gh` CLI or API calls with auth tokens |
| Rate limits | 5000 req/hr (authenticated) — tight for 13 agents doing frequent updates |
| Auth | PAT or app token needed in every agent session |
| Search | Full-text search, labels, filters, milestones |
| History | Built-in audit trail |
| Mobile access | Full GitHub mobile app |
| External collaboration | First-class |

**Weaknesses:** Overkill for a single-person + AI-agent team. Rate limits become a real concern with 13 agents writing issues frequently. Dashboard complexity jumps significantly. Every agent action adds network latency and a potential failure point.

---

### Hybrid (ISSUES.md primary + GitHub sync)

Two variants:

**A. ISSUES.md as source of truth, periodic GitHub mirror**
- Agents work locally (zero latency, no auth)
- A sync script runs on a schedule (e.g., every 15 min) or on-demand
- GitHub Issues used for CEO's mobile visibility and external reference
- Dashboard stays on the file watcher — no changes needed

**B. GitHub Issues as source of truth, local cache**
- Agents write to GitHub via `gh` CLI
- A cache file (e.g., `ISSUES.cache.md`) is refreshed periodically for dashboard and offline use
- More complex; introduces cache-invalidation problems

Variant A is substantially simpler and preserves all current advantages.

## Recommendation

**Stay with ISSUES.md, with optional one-way sync to GitHub (Hybrid A).**

The core argument is that this system's primary users are AI agents, not humans browsing GitHub. The local file model is a near-perfect fit: zero latency, no auth, no rate limits, grep-friendly, already integrated with the 3D dashboard. GitHub Issues adds meaningful value only at the edges — mobile access for the CEO and cross-referencing commits — and both can be addressed without migrating the source of truth.

Switching to GitHub Issues as the primary store would degrade the tightest feedback loops in the system (agent → file → dashboard) in exchange for features that matter less given the team structure. With 13 agents potentially writing issues simultaneously, the 5000 req/hr rate limit is also a genuine constraint that would require throttling logic.

The hybrid sync approach gives the CEO mobile access and the option of `gh issue list` filtering without touching the agents' core workflow.

## If Hybrid: Implementation

Minimal sync script (`~/environment/scripts/sync-issues-to-github.sh`):

```bash
#!/bin/bash
# One-way sync: ISSUES.md open checkboxes → GitHub Issues (create if not exists)
# Run manually or on a cron when CEO wants mobile visibility

REPO="<owner>/<repo>"  # set to your issues repo

grep -E '^\- \[ \]' ~/environment/ISSUES.md | while read -r line; do
  title=$(echo "$line" | sed 's/^- \[ \] //')
  # Check if already open on GitHub before creating
  existing=$(gh issue list --repo "$REPO" --search "$title" --json number -q '.[0].number' 2>/dev/null)
  if [ -z "$existing" ]; then
    gh issue create --repo "$REPO" --title "$title" --body "Synced from ISSUES.md"
  fi
done
```

Close completed issues separately (match by title, close if checkbox now checked).

This script is stateless, idempotent, and can run as a scheduled task or on-demand. It does not require agents to have GitHub credentials.

## Next Steps

1. **CEO decision:** Stay local only, or enable hybrid sync for mobile access?
2. If hybrid: create the sync script and schedule it (cron or manual)
3. If hybrid: identify the GitHub repo to mirror into (can be a private repo just for this purpose)
4. No changes needed to agents, dashboard, or ISSUES.md format regardless of decision
