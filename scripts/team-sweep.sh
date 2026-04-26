#!/usr/bin/env bash
# team-sweep.sh — zero-token team activity monitor
# Classifies each team lead as: active / idle-short / idle-long / offline
# Posts ONE relay message per run if any team needs attention.
# Idempotent: dedup marker in $SWEEP_REPORT prevents re-notify within 4h.
#
# Configuration via env vars (all have defaults):
#   SWEEP_REPORT        — output JSON path (default: ~/environment/.sweep-report.json)
#   SWEEP_WORKLOG_ROOT  — if set, resolves as $ROOT/$TEAM (for testing)
#   SWEEP_TEAMS         — space-separated list of teams (default: all 5)
#   SWEEP_RELAY_URL     — relay base URL (default: http://localhost:8767)
#   SWEEP_DRY_RUN       — if "1", skip HTTP POST; record relay_calls_this_run in report
#   SWEEP_FROM          — relay sender name (default: team-sweep)

set -uo pipefail

# ── Concurrency guard (macOS-compatible PID file) ────────────────────────────
LOCK_FILE="/tmp/team-sweep.pid"
if [[ -f "$LOCK_FILE" ]]; then
  OLD_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [[ -n "$OLD_PID" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[sweep] Another instance (PID $OLD_PID) is running — exiting" >&2
    exit 0
  fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ── Configuration ────────────────────────────────────────────────────────────
SWEEP_REPORT="${SWEEP_REPORT:-$HOME/environment/.sweep-report.json}"
RELAY_URL="${SWEEP_RELAY_URL:-http://localhost:8767}"
DRY_RUN="${SWEEP_DRY_RUN:-0}"
# Relay requires a registered agent name — chief-of-staff is the meta-manager
RELAY_FROM="${SWEEP_FROM:-chief-of-staff}"
RELAY_TO="command"

DEFAULT_TEAMS="knowledge-base productivitesse message-relay voice-bridge myenglishbook"
TEAMS="${SWEEP_TEAMS:-$DEFAULT_TEAMS}"

# ── Thresholds (seconds) ─────────────────────────────────────────────────────
ACTIVE_THRESHOLD=2700        # 45 min
IDLE_SHORT_THRESHOLD=7200    # 120 min
NOTIFY_DEDUP_WINDOW=14400    # 4h

# ── Resolve worklog dir for a team ───────────────────────────────────────────
get_worklog_dir() {
  local team="$1"
  if [[ -n "${SWEEP_WORKLOG_ROOT:-}" ]]; then
    echo "$SWEEP_WORKLOG_ROOT/$team"
    return
  fi
  case "$team" in
    knowledge-base)  echo "$HOME/environment/projects/knowledge-base/.worklog" ;;
    productivitesse) echo "$HOME/environment/projects/productivitesse/.worklog" ;;
    message-relay)   echo "$HOME/environment/message-relay/.worklog" ;;
    voice-bridge)    echo "$HOME/environment/projects/voice-bridge2/.worklog" ;;
    myenglishbook)   echo "$HOME/environment/projects/myenglishbook/.worklog" ;;
    *)               echo "$HOME/environment/projects/$team/.worklog" ;;
  esac
}

# ── Load existing report for dedup state ────────────────────────────────────
EXISTING_LAST_NOTIFIED="{}"
if [[ -f "$SWEEP_REPORT" ]]; then
  EXISTING_LAST_NOTIFIED=$(python3 -c "
import json, sys
try:
  r = json.load(open('$SWEEP_REPORT'))
  print(json.dumps(r.get('last_notified', {})))
except:
  print('{}')
" 2>/dev/null || echo "{}")
fi

# ── Classify each team ───────────────────────────────────────────────────────
NOW=$(date +%s)
TEAMS_JSON="{}"
ALERT_TEAMS=""   # space-separated "team:state" pairs

for TEAM in $TEAMS; do
  WORKLOG_DIR=$(get_worklog_dir "$TEAM")

  if [[ ! -d "$WORKLOG_DIR" ]]; then
    STATE="offline"
  else
    LATEST_MTIME=$(find "$WORKLOG_DIR" -maxdepth 1 -name "*.md" -type f \
      -exec stat -f "%m" {} \; 2>/dev/null | sort -n | tail -1 || echo "")

    if [[ -z "$LATEST_MTIME" ]]; then
      STATE="offline"
    else
      AGE=$(( NOW - LATEST_MTIME ))
      if (( AGE <= ACTIVE_THRESHOLD )); then
        STATE="active"
      elif (( AGE <= IDLE_SHORT_THRESHOLD )); then
        STATE="idle-short"
      else
        STATE="idle-long"
      fi
    fi
  fi

  TEAMS_JSON=$(python3 -c "
import json, sys
t = json.loads(sys.argv[1])
t[sys.argv[2]] = {'state': sys.argv[3], 'worklog_dir': sys.argv[4]}
print(json.dumps(t))
" "$TEAMS_JSON" "$TEAM" "$STATE" "$WORKLOG_DIR")

  if [[ "$STATE" == "idle-long" || "$STATE" == "offline" ]]; then
    ALERT_TEAMS="$ALERT_TEAMS $TEAM:$STATE"
  fi
done

ALERT_TEAMS="${ALERT_TEAMS# }"  # strip leading space

# ── Dedup: decide whether to send a relay notification ──────────────────────
RELAY_CALLS_THIS_RUN=0
NEW_LAST_NOTIFIED="$EXISTING_LAST_NOTIFIED"

if [[ -n "$ALERT_TEAMS" ]]; then
  NEEDS_NOTIFY=0
  for ENTRY in $ALERT_TEAMS; do
    TEAM="${ENTRY%%:*}"
    LAST_TS=$(python3 -c "
import json, sys
d = json.loads(sys.argv[1])
print(d.get(sys.argv[2], 0))
" "$EXISTING_LAST_NOTIFIED" "$TEAM" 2>/dev/null || echo "0")
    # Strip fractional seconds for arithmetic
    LAST_TS_INT="${LAST_TS%.*}"
    AGE_SINCE_NOTIFY=$(( NOW - ${LAST_TS_INT:-0} ))
    if (( AGE_SINCE_NOTIFY >= NOTIFY_DEDUP_WINDOW )); then
      NEEDS_NOTIFY=1
      break
    fi
  done

  if [[ "$NEEDS_NOTIFY" == "1" ]]; then
    SUMMARY="Team sweep alert:"
    for ENTRY in $ALERT_TEAMS; do
      TEAM="${ENTRY%%:*}"
      STATE="${ENTRY##*:}"
      SUMMARY="$SUMMARY $TEAM=$STATE,"
    done
    SUMMARY="${SUMMARY%,}"

    if [[ "$DRY_RUN" == "1" ]]; then
      echo "[sweep] DRY_RUN: would POST to relay: $SUMMARY" >&2
      RELAY_CALLS_THIS_RUN=1
    else
      PAYLOAD_FILE=$(mktemp /tmp/sweep-payload.XXXXXX)
      python3 - "$RELAY_FROM" "$RELAY_TO" "$SUMMARY" >"$PAYLOAD_FILE" <<'PYEOF'
import json, sys
print(json.dumps({'from': sys.argv[1], 'to': sys.argv[2], 'type': 'status', 'body': sys.argv[3]}))
PYEOF
      HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$RELAY_URL/send" \
        -H "Content-Type: application/json" \
        -d "@$PAYLOAD_FILE" \
        2>/dev/null || echo "000")
      rm -f "$PAYLOAD_FILE"
      echo "[sweep] relay POST → $HTTP_STATUS" >&2
      RELAY_CALLS_THIS_RUN=1
    fi

    # Update last_notified for alerted teams
    NEW_LAST_NOTIFIED=$(python3 -c "
import json, time, sys
d = json.loads(sys.argv[1])
for entry in sys.argv[2].split():
  team = entry.split(':')[0]
  d[team] = time.time()
print(json.dumps(d))
" "$EXISTING_LAST_NOTIFIED" "$ALERT_TEAMS")
  fi
fi

# ── Write report ─────────────────────────────────────────────────────────────
python3 -c "
import json, time, sys
teams = json.loads(sys.argv[1])
last_notified = json.loads(sys.argv[2])
calls = int(sys.argv[3])
report = {
  'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
  'teams': teams,
  'relay_calls_this_run': calls,
  'last_notified': last_notified
}
with open(sys.argv[4], 'w') as f:
  json.dump(report, f, indent=2)
" "$TEAMS_JSON" "$NEW_LAST_NOTIFIED" "$RELAY_CALLS_THIS_RUN" "$SWEEP_REPORT"

echo "[sweep] done → $SWEEP_REPORT" >&2
exit 0
