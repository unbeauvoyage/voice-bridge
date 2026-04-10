#!/usr/bin/env bash
# UserPromptSubmit hook — detects CEO signal triggers in messages
# Fires Q&A creation when CEO expresses curiosity or asks questions
# Zero-token: pure bash pattern matching, no LLM involved

set -euo pipefail

RELAY_URL="${HUB_URL:-http://localhost:8765}"
AGENT="${RELAY_AGENT_NAME:-${HUB_AGENT_NAME:-unknown}}"

# Read hook payload from stdin (Claude Code passes JSON)
PAYLOAD=$(cat 2>/dev/null || echo "{}")
PROMPT=$(echo "$PAYLOAD" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # Try multiple field names Claude Code might use
    print(d.get('prompt', d.get('message', d.get('content', ''))))
except:
    print('')
" 2>/dev/null || echo "")

[ -z "$PROMPT" ] && exit 0

# Normalize for pattern matching
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# --- Q&A trigger detection ---
# Conservative patterns: genuine curiosity signals only
QA_TRIGGER=0
if echo "$PROMPT_LOWER" | grep -qE \
  "(i (always |)(wonder|wondered)|i'?m curious|i have a question|always wondered|one thing i('ve| have) always|makes me wonder|got me wondering)"; then
  QA_TRIGGER=1
fi

if [ "$QA_TRIGGER" -eq 1 ]; then
  # Deduplicate: hash first 80 chars, skip if fired in last 5 minutes
  HASH=$(echo "$PROMPT" | head -c 80 | shasum | cut -c1-8)
  LOCK="/tmp/distill-qa-${HASH}"
  if [ -f "$LOCK" ]; then
    AGE=$(( $(date +%s) - $(stat -f %m "$LOCK" 2>/dev/null || echo 0) ))
    [ "$AGE" -lt 300 ] && exit 0
  fi
  touch "$LOCK"

  # Short excerpt for the relay message (first 150 chars, escaped for JSON)
  EXCERPT=$(echo "$PROMPT" | head -c 150 | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" 2>/dev/null || echo "\"[excerpt unavailable]\"")

  # Timestamp for the question file
  TS=$(date "+%Y-%m-%dT%H:%M:%S")
  DATE=$(date "+%Y-%m-%d")

  # Write question file directly (idempotent — uses hash in filename)
  QFILE="${HOME}/environment/questions/${DATE}-distilled-${HASH}.md"
  if [ ! -f "$QFILE" ]; then
    cat > "$QFILE" <<QEOF
---
type: question
title: CEO curiosity — distilled from conversation
status: open
asked: ${TS}
asked-by: ceo
triggered-by: distiller
session: ${AGENT}
answer: (pending)
---

${PROMPT}
QEOF
  fi

  # Notify command to assign a researcher
  curl -sf -X POST "${RELAY_URL}/send" \
    -H "Content-Type: application/json" \
    -d "{\"from\":\"distiller\",\"to\":\"command\",\"type\":\"task\",\"body\":\"[Q&A SIGNAL] CEO expressed curiosity in ${AGENT} session. Question file written: ${QFILE}. Assign researcher and link answer when complete.\"}" \
    2>/dev/null || true
fi

exit 0
