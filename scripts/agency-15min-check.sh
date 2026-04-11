#!/bin/bash
# Run every 15 minutes to verify agency research progress
# Tracks: worklog updates, research velocity, relay connectivity

TIMESTAMP=$(date '+%Y-%m-%dT%H:%M:%S')
LOG_FILE="/Users/riseof/environment/.worklog/agency-monitor.log"
mkdir -p "$(dirname "$LOG_FILE")"

# Check worklog updates in last 15 minutes
UPDATED=0
TOTAL_NEW_LINES=0
AGENCIES=("bicycles" "cars" "coffee-shops" "kabab-shops" "housing-mortgage" "routers" "business-opportunities")

for agency in "${AGENCIES[@]}"; do
  worklog="/Users/riseof/environment/agency/$agency/.worklog/${agency%-*}-lead.md"
  if [ -f "$worklog" ] && find "$worklog" -newermt "15 minutes ago" 2>/dev/null | grep -q .; then
    ((UPDATED++))
    lines=$(wc -l < "$worklog" 2>/dev/null || echo "0")
    TOTAL_NEW_LINES=$((TOTAL_NEW_LINES + lines))
  fi
done

# Check relay connectivity
RELAY_AGENTS=$(curl -s http://localhost:8767/status 2>/dev/null | grep -o '"name":"agency-' | wc -l)

# Log result with research summary
echo "[$TIMESTAMP] RESEARCH: $UPDATED/7 teams | $RELAY_AGENTS/7 relay | total $TOTAL_NEW_LINES lines" >> "$LOG_FILE"

# If less than 5 agencies updated, send wake-up messages
if [ $UPDATED -lt 5 ]; then
  echo "[$TIMESTAMP] WARNING: Only $UPDATED/7 teams active — sending wake-up messages" >> "$LOG_FILE"

  for agency in "${AGENCIES[@]}"; do
    worklog="/Users/riseof/environment/agency/$agency/.worklog/${agency%-*}-lead.md"
    if [ ! -f "$worklog" ] || ! find "$worklog" -newermt "15 minutes ago" 2>/dev/null | grep -q .; then
      curl -s -X POST "http://localhost:8767/send" \
        -H "Content-Type: application/json" \
        -d "{\"from\":\"command\",\"to\":\"agency-${agency}\",\"type\":\"message\",\"body\":\"Research check: Keep iterating. Identify gaps, pipe Codex research, log findings, find more gaps. Never stop.\"}" \
        > /dev/null 2>&1
    fi
  done
fi
