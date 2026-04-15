---
title: Structured Event Logging (SQLite)
date: 2026-04-03
status: archived
archived_at: 2026-04-16
archived_reason: no action 13+ days
---

## Problem

Relay events (messages, permission requests, agent status changes) are ephemeral. There is no queryable history. Debugging agent communication failures requires reading raw pane output. The dashboard has no time-series data.

## Plan

1. **Schema** — single `events` table:
   ```sql
   CREATE TABLE events (
     id        INTEGER PRIMARY KEY AUTOINCREMENT,
     ts        INTEGER NOT NULL,  -- Unix ms
     type      TEXT NOT NULL,     -- 'message', 'permission', 'status', 'error', 'agent_start', 'agent_done'
     from_     TEXT,              -- sender agent name
     to_       TEXT,              -- recipient agent name or '*'
     session   TEXT,              -- session name if applicable
     payload   TEXT,              -- JSON blob of event-specific fields
     tags      TEXT               -- comma-separated tags for filtering
   );
   CREATE INDEX idx_ts ON events(ts);
   CREATE INDEX idx_type ON events(type);
   CREATE INDEX idx_from ON events(from_);
   ```

2. **What gets logged:**
   - Every relay message sent/received (type: `message`)
   - Permission requests and approvals/denials (type: `permission`)
   - Agent DONE signals (type: `agent_done`)
   - Relay errors (type: `error`)
   - Session start/stop events (type: `agent_start`, `agent_done`)

3. **Bun SQLite integration** — relay server adds a `db.ts` module using `bun:sqlite`. Write is synchronous (fast enough for this volume). No ORM needed.

4. **Retention** — daily cron job (Bun `--cron` or system cron) deletes rows older than 7 days:
   ```sql
   DELETE FROM events WHERE ts < (unixepoch() * 1000 - 604800000);
   ```

5. **Dashboard query API** — add `/api/events` endpoint to relay:
   - `GET /api/events?type=message&limit=50` — recent events by type
   - `GET /api/events?from=productivitesse&since=3600` — events from agent in last N seconds
   - `GET /api/events?session=dev-01` — all events for a session

6. **Migration path** — feature-flagged; relay starts logging when `RELAY_SQLITE=1` env var is set. Existing deployments unaffected until flag is set.

## Effort Estimate

4–6 hours (schema + Bun integration + retention cron + API endpoints + dashboard wiring)

## Dependencies

- Relay server must be running Bun (already is)
- No external dependencies — `bun:sqlite` is built-in
- Dashboard must be updated to call new `/api/events` endpoint

## Next Steps

- CEO approves schema and event types
- Implement `db.ts` module in relay
- Wire logging into relay message handler
- Add `/api/events` endpoint
- Set `RELAY_SQLITE=1` in relay startup script
- Update dashboard to display recent events
