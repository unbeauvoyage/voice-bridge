---
title: Relay Sender Authentication (URGENT)
date: 2026-04-03
status: pending
---

## Problem

Any process on the machine can send relay messages or query `/status`. There is no sender verification. A rogue or compromised process could impersonate agents, flood channels, or read session topology. Risk increases as the system scales to more agents and projects.

## Plan

1. **Shared secret** — generate a single `RELAY_SECRET` (32-byte hex, stored in `~/environment/.env`). All agents and the relay server load it from the environment.

2. **Auth header** — every relay API request must include:
   ```
   X-Relay-Secret: <RELAY_SECRET>
   ```
   Relay server rejects requests missing or with wrong header with `401 Unauthorized`.

3. **Implementation steps:**
   a. Add `RELAY_SECRET` to `~/environment/.env` (generate once with `openssl rand -hex 32`)
   b. Relay server reads `process.env.RELAY_SECRET` on startup; if unset, logs a warning but continues (migration grace period)
   c. Add auth middleware to all relay endpoints (`/send`, `/status`, `/hook/permission/*`, `/api/events`)
   d. Update `relay_send` MCP tool to include the header automatically (reads from env)
   e. Update any direct `curl` calls in agent scripts to include the header

4. **`/status` access control** — beyond shared secret, `/status` returns full session topology only if `X-Relay-Admin: 1` is also present. Standard agents get a restricted view (their own session only).

5. **Migration plan:**
   - Week 1: Deploy auth-aware relay with grace period (warn but don't reject missing secret)
   - Week 2: All agents updated to send header (update CLAUDE.md + relay_send tool)
   - Week 3: Enforce — reject unauthenticated requests

6. **Secret rotation** — update `RELAY_SECRET` in `.env`, restart relay and all active sessions. No stored tokens to invalidate.

## Effort Estimate

3–4 hours (middleware + env setup + relay_send tool update + agent instruction update)

## Dependencies

- `RELAY_SECRET` must be distributed to all agent environments (single `.env` file, already sourced)
- `relay_send` MCP tool must be updated before enforcement week

## Next Steps

- CEO approves auth mechanism and migration timeline
- Generate `RELAY_SECRET`, add to `.env`
- Implement auth middleware in relay server
- Update `relay_send` tool
- Update CLAUDE.md with auth requirement
- Set enforcement deadline
