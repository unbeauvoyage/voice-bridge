#!/bin/bash
# Cleanly restart the KB dev server after code changes.
# Run this after every coder task to ensure changes are reflected.
# The watchdog (dev.sh) will auto-restart the server process.
# After this runs, the browser needs ONE Cmd+R to reconnect HMR.

pkill -f "bun.*src/server.ts" 2>/dev/null || true
sleep 1

# Verify watchdog picks it back up
for i in 1 2 3 4 5; do
  if pgrep -f "bun.*src/server.ts" > /dev/null; then
    echo "✓ Server restarted. Browser needs one Cmd+R to reconnect."
    exit 0
  fi
  sleep 1
done

# Watchdog not running — start fresh
cd "$(dirname "$0")/.."
bash scripts/dev.sh &
sleep 2
echo "✓ Server started fresh. Browser needs one Cmd+R to reconnect."
