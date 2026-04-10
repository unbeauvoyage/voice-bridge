#!/bin/bash
# Start Tier 2 adaptive LLM monitoring loop
# Check if running: pgrep -fa monitor-llm
# Stop: pkill -f monitor-llm.sh

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="$SCRIPTS_DIR/.monitor-llm-state"

pkill -f "monitor-llm.sh" 2>/dev/null
sleep 1

# Init state if missing
if [[ ! -f "$STATE_FILE" ]]; then
  { echo "last_hit_ts=$(date +%s)"; echo "interval_min=5"; } > "$STATE_FILE"
fi

echo "[llm-monitor] Starting adaptive loop (PID $$)"

while true; do
  bash "$SCRIPTS_DIR/monitor-llm.sh"

  # Read interval set by last run (may have changed)
  interval_min=$(grep "^interval_min=" "$STATE_FILE" 2>/dev/null | cut -d= -f2)
  [[ -z "$interval_min" ]] && interval_min=5

  echo "[llm-monitor] Next check in ${interval_min}m"
  sleep $(( interval_min * 60 ))
done
