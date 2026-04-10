#!/bin/bash
# Agency research monitoring — run every 15 minutes
# Tracks: worklog changes, session health, relay connectivity

TIMESTAMP=$(date '+%Y-%m-%dT%H:%M:%S')
LOG_FILE="/Users/riseof/environment/.worklog/agency-monitor.log"

mkdir -p "$(dirname "$LOG_FILE")"

{
  echo "[$TIMESTAMP] AGENCY MONITOR CHECK"
  echo ""
  
  # Check worklog changes in last 15 minutes
  echo "Worklogs updated in last 15 minutes:"
  updated_count=0
  for agency in bicycles cars coffee-shops kabab-shops housing-mortgage routers business-opportunities; do
    worklog="/Users/riseof/environment/agency/$agency/.worklog/${agency%-*}-lead.md"
    if [ -f "$worklog" ]; then
      if find "$worklog" -newermt "15 minutes ago" 2>/dev/null | grep -q .; then
        lines=$(wc -l < "$worklog")
        echo "  ✓ $agency — $lines lines"
        ((updated_count++))
      fi
    fi
  done
  
  if [ $updated_count -eq 0 ]; then
    echo "  ⚠ NO UPDATES in last 15 minutes"
  fi
  
  echo ""
  echo "Session health:"
  
  # Check if agencies are still connected to relay
  relay_agents=$(curl -s http://localhost:8765/status 2>/dev/null | grep -o '"name":"agency-[^"]*"' | wc -l)
  echo "  Agencies connected to relay: $relay_agents/7"
  
  # Check workspace status
  echo ""
  echo "Workspace status:"
  cmux list-workspaces 2>/dev/null | grep "agency-" | wc -l | xargs echo "  Active workspaces:"
  
  echo ""
  echo "---"
  echo ""
  
} >> "$LOG_FILE"

# Print summary to stdout
tail -20 "$LOG_FILE"
