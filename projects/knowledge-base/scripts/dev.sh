#!/bin/bash
# Start the dev server with HMR and auto-restart on crash.
# Keep this terminal open — HMR requires a persistent process.
# Frontend changes (app.tsx, styles.css) push to browser automatically.
# Server-side changes (server.ts, db.ts, etc.) hot-reload the server process.

pkill -f "bun.*src/server.ts" 2>/dev/null || true
sleep 0.3

cd "$(dirname "$0")/.."

while true; do
  echo "[watchdog] Starting server..."
  bun --hot run src/server.ts >> /tmp/kb-server.log 2>&1
  EXIT=$?
  echo "[watchdog] Server exited with code $EXIT. Restarting in 2s..."
  sleep 2
done
