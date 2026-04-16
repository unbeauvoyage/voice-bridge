#!/usr/bin/env bash
# Test suite for team-sweep.sh
# RED-first: these tests fail until the implementation exists.
# Run: bash scripts/test-team-sweep.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWEEP="$SCRIPT_DIR/team-sweep.sh"
PASS=0
FAIL=0

# ── helpers ─────────────────────────────────────────────────────────────────

pass() { echo "PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }
assert_eq()  { [[ "$1" == "$2" ]] && pass "$3" || fail "$3 (got '$1', want '$2')"; }
assert_contains() { [[ "$1" == *"$2"* ]] && pass "$3" || fail "$3 (value '$1' missing '$2')"; }
assert_json_valid() {
  python3 -c "import json,sys; json.load(open('$1'))" 2>/dev/null && pass "$2" || fail "$2 (not valid JSON)"
}

# ── setup ────────────────────────────────────────────────────────────────────

TMPDIR_BASE="$(mktemp -d /tmp/sweep-test.XXXXXX)"
trap 'rm -rf "$TMPDIR_BASE"' EXIT

REPORT="$TMPDIR_BASE/sweep-report.json"

# ── Test 1: Script exists and is executable ──────────────────────────────────

[[ -f "$SWEEP" ]] && pass "team-sweep.sh exists" || fail "team-sweep.sh exists"
[[ -x "$SWEEP" ]] && pass "team-sweep.sh is executable (chmod +x)" || fail "team-sweep.sh is executable (chmod +x)"

# ── Test 2: Script exits 0 always (even with no worklogs) ───────────────────
# The script must be resilient — missing worklogs = offline, not crash.

SWEEP_REPORT="$REPORT" \
  SWEEP_WORKLOG_ROOT="$TMPDIR_BASE/worklogs" \
  SWEEP_RELAY_URL="http://localhost:9999" \
  SWEEP_DRY_RUN=1 \
  bash "$SWEEP" 2>/dev/null
STATUS=$?
assert_eq "$STATUS" "0" "script exits 0 when no worklogs exist"

# ── Test 3: Output file is valid JSON ────────────────────────────────────────

assert_json_valid "$REPORT" "produces valid JSON report"

# ── Test 4: active classification — worklog updated <45 min ago ─────────────
# Create a mock worklog dir with a recently-modified file.

mkdir -p "$TMPDIR_BASE/worklogs/knowledge-base"
touch "$TMPDIR_BASE/worklogs/knowledge-base/team-lead.md"
# touch sets mtime to now — should be classified 'active'

SWEEP_REPORT="$REPORT" \
  SWEEP_WORKLOG_ROOT="$TMPDIR_BASE/worklogs" \
  SWEEP_RELAY_URL="http://localhost:9999" \
  SWEEP_DRY_RUN=1 \
  bash "$SWEEP" 2>/dev/null

STATE=$(python3 -c "
import json
r = json.load(open('$REPORT'))
print(r.get('teams', {}).get('knowledge-base', {}).get('state', 'MISSING'))
")
assert_eq "$STATE" "active" "recently-modified worklog → active"

# ── Test 5: idle-short classification — worklog updated 50 min ago ──────────

mkdir -p "$TMPDIR_BASE/worklogs/productivitesse"
FIFTY_MIN_AGO=$(date -v -50M +%Y%m%d%H%M.%S 2>/dev/null || date -d "50 minutes ago" +%Y%m%d%H%M.%S 2>/dev/null || echo "")
if [[ -n "$FIFTY_MIN_AGO" ]]; then
  touch -t "$FIFTY_MIN_AGO" "$TMPDIR_BASE/worklogs/productivitesse/team-lead.md"
else
  # fallback: create file, then backdate with python
  touch "$TMPDIR_BASE/worklogs/productivitesse/team-lead.md"
  python3 -c "
import os,time
os.utime('$TMPDIR_BASE/worklogs/productivitesse/team-lead.md', (time.time()-3000, time.time()-3000))
"
fi

SWEEP_REPORT="$REPORT" \
  SWEEP_WORKLOG_ROOT="$TMPDIR_BASE/worklogs" \
  SWEEP_RELAY_URL="http://localhost:9999" \
  SWEEP_DRY_RUN=1 \
  bash "$SWEEP" 2>/dev/null

STATE=$(python3 -c "
import json
r = json.load(open('$REPORT'))
print(r.get('teams', {}).get('productivitesse', {}).get('state', 'MISSING'))
")
assert_eq "$STATE" "idle-short" "worklog 50 min old → idle-short (no alert)"

# ── Test 6: idle-long classification — worklog updated >120 min ago ─────────

mkdir -p "$TMPDIR_BASE/worklogs/voice-bridge"
python3 -c "
import os,time
open('$TMPDIR_BASE/worklogs/voice-bridge/team-lead.md', 'w').close()
os.utime('$TMPDIR_BASE/worklogs/voice-bridge/team-lead.md', (time.time()-8000, time.time()-8000))
"

SWEEP_REPORT="$REPORT" \
  SWEEP_WORKLOG_ROOT="$TMPDIR_BASE/worklogs" \
  SWEEP_RELAY_URL="http://localhost:9999" \
  SWEEP_DRY_RUN=1 \
  bash "$SWEEP" 2>/dev/null

STATE=$(python3 -c "
import json
r = json.load(open('$REPORT'))
print(r.get('teams', {}).get('voice-bridge', {}).get('state', 'MISSING'))
")
assert_eq "$STATE" "idle-long" "worklog >120 min old → idle-long"

# ── Test 7: offline when no worklog dir exists for an agent ─────────────────
# myenglishbook has no worklog dir at all

SWEEP_REPORT="$REPORT" \
  SWEEP_WORKLOG_ROOT="$TMPDIR_BASE/worklogs" \
  SWEEP_RELAY_URL="http://localhost:9999" \
  SWEEP_DRY_RUN=1 \
  SWEEP_TEAMS="myenglishbook" \
  bash "$SWEEP" 2>/dev/null

STATE=$(python3 -c "
import json
r = json.load(open('$REPORT'))
print(r.get('teams', {}).get('myenglishbook', {}).get('state', 'MISSING'))
")
assert_eq "$STATE" "offline" "no worklog dir → offline"

# ── Test 8: only ONE relay message posted per run even if multiple idle-long ─
# SWEEP_DRY_RUN=1 means the script logs relay calls to report instead of POSTing.

mkdir -p "$TMPDIR_BASE/worklogs2/alpha" "$TMPDIR_BASE/worklogs2/beta"
python3 -c "
import os,time
for n in ['alpha','beta']:
    p = '$TMPDIR_BASE/worklogs2/' + n + '/team-lead.md'
    open(p, 'w').close()
    os.utime(p, (time.time()-8000, time.time()-8000))
"

SWEEP_REPORT="$REPORT" \
  SWEEP_WORKLOG_ROOT="$TMPDIR_BASE/worklogs2" \
  SWEEP_TEAMS="alpha beta" \
  SWEEP_RELAY_URL="http://localhost:9999" \
  SWEEP_DRY_RUN=1 \
  bash "$SWEEP" 2>/dev/null

RELAY_CALLS=$(python3 -c "
import json
r = json.load(open('$REPORT'))
print(r.get('relay_calls_this_run', 0))
")
assert_eq "$RELAY_CALLS" "1" "at most one relay message per run (dedup)"

# ── Test 9: idempotent — second run within 4h does NOT re-post ──────────────
# Simulate a previous notify by writing a dedup entry into the report first.

python3 -c "
import json, time
r = {
  'teams': {},
  'relay_calls_this_run': 0,
  'last_notified': {
    'alpha': time.time() - 60,   # 1 min ago — within 4h window
    'beta':  time.time() - 60
  }
}
json.dump(r, open('$REPORT','w'))
"

SWEEP_REPORT="$REPORT" \
  SWEEP_WORKLOG_ROOT="$TMPDIR_BASE/worklogs2" \
  SWEEP_TEAMS="alpha beta" \
  SWEEP_RELAY_URL="http://localhost:9999" \
  SWEEP_DRY_RUN=1 \
  bash "$SWEEP" 2>/dev/null

RELAY_CALLS=$(python3 -c "
import json
r = json.load(open('$REPORT'))
print(r.get('relay_calls_this_run', 0))
")
assert_eq "$RELAY_CALLS" "0" "no re-notify within 4h dedup window"

# ── Test 10: re-notifies after 4h have elapsed ──────────────────────────────

python3 -c "
import json, time
r = {
  'teams': {},
  'relay_calls_this_run': 0,
  'last_notified': {
    'alpha': time.time() - 14500,  # >4h ago
    'beta':  time.time() - 14500
  }
}
json.dump(r, open('$REPORT','w'))
"

SWEEP_REPORT="$REPORT" \
  SWEEP_WORKLOG_ROOT="$TMPDIR_BASE/worklogs2" \
  SWEEP_TEAMS="alpha beta" \
  SWEEP_RELAY_URL="http://localhost:9999" \
  SWEEP_DRY_RUN=1 \
  bash "$SWEEP" 2>/dev/null

RELAY_CALLS=$(python3 -c "
import json
r = json.load(open('$REPORT'))
print(r.get('relay_calls_this_run', 0))
")
assert_eq "$RELAY_CALLS" "1" "re-notifies after 4h elapsed"

# ── summary ──────────────────────────────────────────────────────────────────

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] && echo "ALL PASS" && exit 0 || echo "SOME FAILED" && exit 1
