---
title: Orphan Plugin Process Cleanup
date: 2026-04-03
status: pending
---

## Problem

Channel plugin processes (launched per session) survive session restarts. After enough restarts, multiple orphaned plugin processes accumulate, consuming ports and memory, and causing duplicate message delivery or stale channel registrations.

## Plan

1. **PID file per session** — when a plugin launches, it writes its PID to `~/environment/.pids/<session-name>.pid`. On clean shutdown, the file is removed.

2. **Kill-on-launch script** — before starting a new plugin for a session, check for an existing PID file:
   ```bash
   PID_FILE=~/environment/.pids/${SESSION}.pid
   if [ -f "$PID_FILE" ]; then
     OLD_PID=$(cat "$PID_FILE")
     kill "$OLD_PID" 2>/dev/null || true
     rm "$PID_FILE"
   fi
   ```
   This runs as the first step of the plugin launch script.

3. **Relay registration override** — relay tracks one plugin registration per session name. When a new registration arrives for an existing session, the old entry is replaced and the relay sends a `goodbye` signal to the old plugin's channel. No duplicate delivery.

4. **Startup sweep** — on relay server start, scan `~/environment/.pids/` and kill any PIDs that are still alive but not registered with the current relay instance. Cleans up orphans from previous relay restarts.

5. **Implementation steps:**
   a. Create `~/environment/.pids/` directory
   b. Update plugin launch script to write PID file and run kill-on-launch check
   c. Add cleanup on plugin exit (trap `EXIT` signal to remove PID file)
   d. Add relay registration override logic in relay server
   e. Add startup sweep to relay initialization

6. **Verification** — add `/api/plugins` endpoint to relay listing active plugin PIDs and session names. Manager can query to confirm no orphans.

## Effort Estimate

2–3 hours (PID file logic + kill script + relay override + startup sweep)

## Dependencies

- Plugin launch script must be modifiable (not hardcoded in Claude Desktop config)
- Relay server must support per-session registration tracking (may already exist)

## Next Steps

- CEO approves PID file approach
- Create `.pids/` directory
- Update plugin launch script
- Implement relay registration override
- Test by restarting a session twice and confirming only one plugin process remains
- Add `/api/plugins` endpoint for verification
