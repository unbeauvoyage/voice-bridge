---
title: OpenTelemetry Token Tracking
date: 2026-04-03
status: archived
archived_at: 2026-04-16
archived_reason: no action 13+ days
---

> **NEEDS UPDATE (2026-04-13):** This proposal references old relay endpoints (`POST /tokens/report`, `GET /tokens/summary`) and old storage paths (`~/.relay/tokens/`). These were never implemented and the relay architecture has since changed (lean relay at port 8767). The core idea (token budget tracking + alerts) remains valid, but the implementation plan must be revised for the lean relay and the heartbeat-daemon infrastructure that now exists.

## Problem

COMMAND enforces a ~15%/day token budget across all agents, tracked manually by reading session output. There is no programmatic signal when an agent approaches or hits its limit. Budget pacing is reactive (COMMAND notices overuse after the fact) rather than proactive (agents pause automatically at threshold).

## Plan

### 1. What Claude Code exposes

Claude Code does not natively emit OTel traces. Token usage is available via:

- **`/cost` command output** — session token count and cost, human-readable
- **Claude API responses** — `usage.input_tokens` and `usage.output_tokens` in each API response (only accessible if calling the API directly, not via Claude Code CLI)
- **Session worklogs** — agents write token summaries if instructed

The realistic path is **scraping `/cost` output or worklog data**, not native OTel instrumentation. True OTel export would require Claude Code to emit spans — it does not currently do this.

### 2. Practical token tracking architecture

Rather than waiting for native OTel support, implement a lightweight scraper-based tracker:

**a. Agent self-reporting (near-term)**

Agents periodically run `/cost` and relay the output to a token-tracking endpoint:
```
POST /tokens/report  {agent: "engineer-1", session_tokens: 12400, cost_usd: 0.18, timestamp: ...}
```
Frequency: every 10 minutes, or on task completion.

**b. Token tracking service (relay addition)**

Add a `/tokens` namespace to the relay:
- `POST /tokens/report` — receive agent reports
- `GET /tokens/summary` — return total tokens used today, per-agent breakdown
- Budget configured via env var: `DAILY_TOKEN_BUDGET_PERCENT=15`

Persist to `~/.relay/tokens/YYYY-MM-DD.json` (daily rollup).

**c. Budget alerts**

When an agent's report pushes total daily usage past 80% of budget:
- Relay notifies COMMAND: "Token budget at 80% — consider pausing non-critical agents"

At 100%:
- Relay notifies COMMAND: "Daily token budget reached — recommend pausing all teams"
- COMMAND decides whether to pause (never automatic — token decisions are strategic)

### 3. OTel collector setup (future state)

If/when Claude Code adds native OTel support:
- Run a local OTel collector (otelcol) on port 4317
- Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317` in Claude Code env
- Collector exports to Prometheus or a local file sink
- COMMAND reads Prometheus metrics or a simple dashboard

This is the aspirational state. Plan for it by keeping the token tracking service interface OTel-compatible (same metric names), so migration is a swap of the ingest path.

### 4. Dashboard integration

Simple approach: relay exposes `GET /tokens/summary` as JSON. COMMAND reads this endpoint during its monitoring loop. No external dashboard needed.

If a visual dashboard is wanted later: export to a local Prometheus instance, scrape with Grafana. But this is optional — JSON endpoint is sufficient for budget enforcement.

### 5. Implementation steps

1. Add `/tokens` namespace to relay with report and summary endpoints
2. Add daily token file persistence to `~/.relay/tokens/`
3. Add budget threshold alerts (80% warning, 100% hard notify) to relay
4. Update agent startup instructions: run `/cost` every 10 minutes and POST to `/tokens/report`
5. Wire COMMAND monitoring loop to read `/tokens/summary` during status checks
6. Test: simulate agents hitting 80% and 100% budget → verify COMMAND notified via channel
7. Document OTel migration path in relay README for when native support arrives

## Effort estimate

Medium — ~70 lines of TypeScript for the relay additions. Agent instruction updates are config changes, not code.

## Dependencies

- Relay HTTP server (already running)
- Agents must be able to run `/cost` and parse output (or just relay raw output — relay parses)
- Daily budget figure confirmed with CEO (currently ~15%/day of what total? Need absolute token count or cost cap)

## Open Questions

- What is the absolute daily token budget? "15% per day" implies a weekly total — need the ceiling number to set thresholds.
- Should budget alerts auto-pause agents, or only notify COMMAND? Proposal assumes notify-only (CEO decides).

## Next Steps

CEO approves + clarifies budget ceiling → relay engineer implements token endpoints → update agent instructions → monitor for one week and tune thresholds.
