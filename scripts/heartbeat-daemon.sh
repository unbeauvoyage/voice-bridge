#!/usr/bin/env bash
# Heartbeat daemon — keeps agents from going idle.
# Every 30 minutes, sends a relay message to every online agent.
# Online = has a relay-channel pid file in /tmp.
# Agents receive it as a <channel> message and self-assess.

RELAY_URL="${RELAY_URL:-http://localhost:8767}"
LOG_DIR="$HOME/.worklog/heartbeats"
mkdir -p "$LOG_DIR"

# Agents to skip — system/infrastructure, not decision-makers
SKIP_AGENTS="heartbeat system relay jarvis ceo command consul hq"

HEARTBEAT_MSG="Heartbeat. What are you currently working on? If you have tasks in progress, continue them. If you are idle: check ~/environment/BACKLOG.md for items in your domain, pick one and start, or write a proposal in ~/environment/proposals/ toward the direction the CEO is moving. Log your status to ~/.worklog/heartbeats/\$(echo \$RELAY_AGENT_NAME).md in one sentence. If you are idle with no clear next action and no relevant BACKLOG items — message the CEO right now via relay (type: waiting-for-input) and ask what you should be doing. Do not stay silent. For context on what the CEO is building toward, read: ~/.worklog/ceo-direction.md — use it to align your proposals and work."

send_to_agent() {
  local agent="$1"
  python3 -c "
import urllib.request, json, sys
msg = {'from':'heartbeat','to':'$agent','type':'message','body':'''$HEARTBEAT_MSG'''}
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

echo "[heartbeat] daemon started, interval=30min"

while true; do
  TS=$(date "+%Y-%m-%dT%H:%M:%S")
  PINGED=0
  FAILED=0

  for pidfile in /tmp/relay-channel-*.pid; do
    [ -f "$pidfile" ] || continue
    AGENT=$(basename "$pidfile" .pid | sed 's/^relay-channel-//')

    # Skip system agents
    if echo "$SKIP_AGENTS" | grep -qw "$AGENT"; then
      continue
    fi

    if send_to_agent "$AGENT"; then
      echo "[$TS] ✓ $AGENT" >> "$LOG_DIR/dispatch.log"
      PINGED=$((PINGED + 1))
    else
      echo "[$TS] ✗ $AGENT (send failed)" >> "$LOG_DIR/dispatch.log"
      FAILED=$((FAILED + 1))
    fi
  done

  echo "[$TS] cycle done — pinged=$PINGED failed=$FAILED" >> "$LOG_DIR/dispatch.log"

  sleep 1800  # 30 minutes
done
