#!/usr/bin/env bash
# Command 2-hour worklog review daemon.
# Every 2 hours, asks command to read worklogs and task lists across all active teams.

RELAY_URL="${RELAY_URL:-http://localhost:8767}"
LOG_FILE="$HOME/.worklog/command-review.log"

MSG="2-hour check. Read worklogs and task lists across all active teams. For each team that has a relay-channel PID file, check their worklog in ~/.worklog/heartbeats/{name}.md and any task lists at ~/.claude/tasks/. Report: (1) what each team shipped in the last 2 hours, (2) any team that looks stuck or idle, (3) any team that needs CEO input. Send a single status summary to CEO (type: status) unless something is urgent (type: escalate)."

echo "[$(date '+%Y-%m-%dT%H:%M:%S')] command-review daemon started, interval=2h" >> "$LOG_FILE"

while true; do
  TS=$(date '+%Y-%m-%dT%H:%M:%S')
  python3 -c "
import urllib.request, json, sys
msg = {'from':'system-scheduler','to':'command','type':'message','body':'''$MSG'''}
data = json.dumps(msg).encode()
req = urllib.request.Request('$RELAY_URL/send', data=data, headers={'Content-Type':'application/json'}, method='POST')
try:
    urllib.request.urlopen(req, timeout=5)
    print('ok')
except Exception as e:
    print(f'err: {e}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null
  echo "[$TS] sent review prompt to command" >> "$LOG_FILE"
  sleep 7200
done
