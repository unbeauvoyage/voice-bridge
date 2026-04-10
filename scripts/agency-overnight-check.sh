#!/bin/bash
# Overnight agency monitor — runs every 20 minutes via launchd
# Detects: idle worklogs, busy-but-stale agents (stuck)
# Action: send WebSearch nudge; if stale >60min, restart session

TIMESTAMP=$(date '+%Y-%m-%dT%H:%M:%S')
LOG="/Users/riseof/environment/.worklog/agency-overnight.log"
mkdir -p "$(dirname "$LOG")"

# Agent registry: relay-name → worklog path | workspace-name
declare -A AGENTS
AGENTS["agency-bicycles"]="/Users/riseof/environment/agency/bicycles/.worklog/bicycles-lead.md|agency-bicycles"
AGENTS["agency-cars"]="/Users/riseof/environment/agency/cars/.worklog/cars-lead.md|agency-cars"
AGENTS["agency-coffee-shops"]="/Users/riseof/environment/agency/coffee-shops/.worklog/coffee-shops-lead.md|agency-coffee-shops"
AGENTS["agency-kabab-shops"]="/Users/riseof/environment/agency/kabab-shops/.worklog/kabab-shops-lead.md|agency-kabab-shops"
AGENTS["agency-housing-mortgage"]="/Users/riseof/environment/agency/housing-mortgage/.worklog/housing-lead.md|agency-housing-mortgage"
AGENTS["agency-routers"]="/Users/riseof/environment/agency/routers/.worklog/routers-lead.md|agency-routers"
AGENTS["agency-biz"]="/Users/riseof/environment/agency/business-opportunities/.worklog/business-opportunities-lead.md|agency-biz"
AGENTS["agency-vending"]="/Users/riseof/environment/agency/vending-machines/.worklog/vending-lead.md|agency-vending"
AGENTS["agency-laundry"]="/Users/riseof/environment/agency/coin-laundry/.worklog/coin-laundry-lead.md|agency-laundry"

send_nudge() {
  local agent="$1"
  local msg="$2"
  python3 -c "
import urllib.request, json, sys
payload = json.dumps({'from':'command','to':'$agent','type':'message','body':'''$msg'''}).encode()
req = urllib.request.Request('http://localhost:8765/send', data=payload, headers={'Content-Type':'application/json'}, method='POST')
try:
    urllib.request.urlopen(req, timeout=5)
    print('ok')
except Exception as e:
    print('err:', e, file=sys.stderr)
" 2>/dev/null
}

ACTIVE=()
NUDGED=()
STALE_BUSY=()

for agent in "${!AGENTS[@]}"; do
  IFS='|' read -r wl workspace <<< "${AGENTS[$agent]}"

  # Was worklog updated in last 20 minutes?
  if [ -f "$wl" ] && find "$wl" -newermt "20 minutes ago" 2>/dev/null | grep -q .; then
    ACTIVE+=("$agent")
    continue
  fi

  # Worklog is stale — check relay state
  relay_state=$(curl -s http://localhost:8765/status 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d.get('agents',{}).get('$agent',{}).get('state','unknown'))
" 2>/dev/null)

  # How stale is the worklog?
  stale_mins=999
  if [ -f "$wl" ]; then
    stale_mins=$(( ($(date +%s) - $(stat -f %m "$wl" 2>/dev/null || echo 0)) / 60 ))
  fi

  if [ "$relay_state" = "busy" ] && [ "$stale_mins" -gt 60 ]; then
    # BUSY-BUT-STALE: agent thinks it's working but hasn't written in >1hr — restart it
    STALE_BUSY+=("$agent (${stale_mins}min stale)")
    echo "[$TIMESTAMP] RESTART: $agent busy-but-stale ${stale_mins}min — closing and relaunching" >> "$LOG"

    # Close and relaunch
    ws_ref=$(cmux list-workspaces 2>/dev/null | grep "$workspace" | awk '{print $1}')
    if [ -n "$ws_ref" ]; then
      cmux close-workspace --workspace "$ws_ref" 2>/dev/null
    fi
    sleep 2

    # Determine CWD for this agent
    case "$agent" in
      agency-bicycles)    CWD="/Users/riseof/environment/agency/bicycles" ;;
      agency-cars)        CWD="/Users/riseof/environment/agency/cars" ;;
      agency-coffee-shops) CWD="/Users/riseof/environment/agency/coffee-shops" ;;
      agency-kabab-shops) CWD="/Users/riseof/environment/agency/kabab-shops" ;;
      agency-housing-mortgage) CWD="/Users/riseof/environment/agency/housing-mortgage" ;;
      agency-routers)     CWD="/Users/riseof/environment/agency/routers" ;;
      agency-biz)         CWD="/Users/riseof/environment/agency/business-opportunities" ;;
      agency-vending)     CWD="/Users/riseof/environment/agency/vending-machines" ;;
      agency-laundry)     CWD="/Users/riseof/environment/agency/coin-laundry" ;;
    esac

    # Copy standard settings to ensure Bash is allowed
    mkdir -p "$CWD/.claude"
    cp /Users/riseof/environment/agency/.claude-settings-template.json "$CWD/.claude/settings.json"

    # Relaunch
    bash /Users/riseof/environment/scripts/spawn-session.sh agency-lead "$workspace" "$CWD" haiku >> "$LOG" 2>&1
    sleep 12

    # Inject fresh start without --resume
    new_ws=$(cmux list-workspaces 2>/dev/null | grep "$workspace" | awk '{print $1}')
    if [ -n "$new_ws" ]; then
      NEW_CMD="RELAY_AGENT_NAME=$workspace RELAY_SESSION_ID=$(python3 -c 'import uuid; print(uuid.uuid4())') claude --agent agency-lead --model haiku --dangerously-load-development-channels plugin:relay-channel@relay-plugins --permission-mode bypassPermissions --name $workspace --remote-control"
      cmux send --workspace "$new_ws" "$NEW_CMD" 2>/dev/null
      cmux send-key --workspace "$new_ws" Enter 2>/dev/null
      sleep 10
      cmux send --workspace "$new_ws" "1" 2>/dev/null
      cmux send-key --workspace "$new_ws" Enter 2>/dev/null
      sleep 8
    fi

    # Send opening brief — use WebSearch
    send_nudge "$agent" "Fresh restart. Work is never finished — there is no done. Read your worklog to see what you know, then immediately find the thinnest assumption in your research and go verify it. Use WebSearch. Find the sub-niche. Find the exceptional deal. Find the competitor no one has named yet. Write everything to worklog. Keep pushing without stopping."

  else
    # Just idle or mildly stale — send a nudge
    NUDGED+=("$agent")
    send_nudge "$agent" "Work is never finished. Read your worklog — find the finding with the most uncertainty and research it. Find the sub-niche inside the niche. Verify a number from a second source. Stress-test a business model. Find a competitor and research their pricing and weaknesses. There is always another layer. Use WebSearch. Write to worklog. Keep pushing."
  fi
done

echo "[$TIMESTAMP] Active: ${ACTIVE[*]} | Nudged: ${NUDGED[*]} | Restarted: ${STALE_BUSY[*]}" >> "$LOG"
