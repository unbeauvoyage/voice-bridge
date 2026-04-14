#!/bin/bash
# Called after a code change to ensure changes are reflected.
#
# Usage: bash scripts/reflect.sh [changed-file-path]
#
# For frontend changes (app.tsx, styles.css): Bun HMR pushes to browser automatically — no restart needed.
# For server-side changes (server.ts, db.ts, queue.ts, etc.): restarts the server.
# For extension changes: manual reload in edge://extensions is always required.

CHANGED="${1:-}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if echo "$CHANGED" | grep -qE "src/(server|db|queue|summarize|embed|extract|config|logger)"; then
  echo "Server-side change detected — restarting server..."
  pkill -f "bun.*src/server.ts" 2>/dev/null || true
  sleep 1
  bun --hot run "$PROJECT_DIR/src/server.ts" >> /tmp/kb-server.log 2>&1 &
  sleep 2
  if curl -s http://127.0.0.1:3737/health > /dev/null 2>&1; then
    echo "Server restarted OK — http://127.0.0.1:3737"
  else
    echo "WARNING: server did not respond on :3737 — check /tmp/kb-server.log"
  fi
else
  echo "Frontend-only change — HMR pushes to browser automatically (no restart needed)"
  if curl -s http://127.0.0.1:3737/health > /dev/null 2>&1; then
    echo "Server is running OK"
  else
    echo "WARNING: server is down! Start it with: bun run dev"
  fi
fi

echo ""
echo "Note: extension changes always require manual reload in edge://extensions"
