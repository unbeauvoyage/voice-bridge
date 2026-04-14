#!/usr/bin/env bash
# Agent self-check daemon — every 2 hours, asks all connected agents:
# "What can you do now?" — forces them to check their todos and backlog.
# Different from heartbeat (30-min status ping) — this is a capability/autonomy prompt.

RELAY_URL="${RELAY_URL:-http://localhost:8767}"
LOG_DIR="$HOME/.worklog/heartbeats"
mkdir -p "$LOG_DIR"

# Agents to skip — system/infrastructure, not decision-makers
SKIP_AGENTS="heartbeat system relay jarvis ceo command consul hq"

SELFCHECK_MSG="Self-check. What can you do right now? Look at: (1) Your active task list (if you have a team), (2) ~/environment/BACKLOG.md items in your domain, (3) ~/environment/proposals/ — are there approved proposals you should act on? (4) ~/.worklog/ceo-direction.md — CEO priorities. If you have unfinished work: continue it. If you have no unfinished work but have a clear next action: start it now. If you are truly blocked: message CEO (type: waiting-for-input) and explain what decision is needed. Log one sentence to ~/.worklog/heartbeats/\$(echo \$RELAY_AGENT_NAME).md."

send_to_agent() {
  local agent="$1"
  python3 -c "
import urllib.request, json, sys
msg = {'from':'system-scheduler','to':'$agent','type':'message','body':'''$SELFCHECK_MSG'''}
data = json.dumps(msg).encode()
req = urllib.request.Request('$RELAY_URL/send', data=data, headers={'Content-Type':'application/json'}, method='POST')
try:
    r = urllib.request.urlopen(req, timeout=5)
    print('ok')
except Exception as e:
    print(f'err: {e}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null
}

echo "[$(date '+%Y-%m-%dT%H:%M:%S')] agent-selfcheck daemon started, interval=2h" >> "$LOG_DIR/dispatch.log"

while true; do
  TS=$(date '+%Y-%m-%dT%H:%M:%S')
  PINGED=0
  FAILED=0

  for pidfile in /tmp/relay-channel-*.pid; do
    [ -f "$pidfile" ] || continue
    AGENT=$(basename "$pidfile" .pid | sed 's/^relay-channel-//')

    if echo "$SKIP_AGENTS" | grep -qw "$AGENT"; then
      continue
    fi

    if send_to_agent "$AGENT"; then
      echo "[$TS] selfcheck ✓ $AGENT" >> "$LOG_DIR/dispatch.log"
      PINGED=$((PINGED + 1))
    else
      echo "[$TS] selfcheck ✗ $AGENT (failed)" >> "$LOG_DIR/dispatch.log"
      FAILED=$((FAILED + 1))
    fi
  done

  echo "[$TS] selfcheck cycle done — pinged=$PINGED failed=$FAILED" >> "$LOG_DIR/dispatch.log"
  sleep 7200
done
