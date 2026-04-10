#!/bin/bash
# Start the Tier 1 monitoring loop (5-second polling)
# Run once: bash ~/environment/scripts/start-monitor.sh
# Check if running: pgrep -fa monitor-agents
# Stop: pkill -f monitor-agents.sh

# Kill any existing loop
pkill -f "monitor-agents.sh" 2>/dev/null
sleep 1

echo "[monitor] Starting 5s loop (PID $$)"
while true; do
  bash ~/environment/scripts/monitor-agents.sh 2>/dev/null
  sleep 5
done
