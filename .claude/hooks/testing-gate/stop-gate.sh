#!/usr/bin/env bash
# Stop hook — blocks agent from finishing if untested code changes exist
# Input: JSON on stdin. Output: {"decision":"block","reason":"..."} to block, nothing to allow.

INPUT=$(cat)
SESSION=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id','unknown'))" 2>/dev/null)

CWD_HASH=$(echo "$PWD" | md5sum | cut -c1-8)
DIRTY_FILE="/tmp/tg-dirty-${SESSION}-${CWD_HASH}"

# Only block if there are dirty (edited but untested) code files
if [ -f "$DIRTY_FILE" ] && [ -s "$DIRTY_FILE" ]; then
  DIRTY_COUNT=$(wc -l < "$DIRTY_FILE" | tr -d ' ')
  FILES=$(cat "$DIRTY_FILE" | awk '{print $2}' | sort -u | head -5 | tr '\n' ', ' | sed 's/,$//')
  echo '{"decision":"block","reason":"You modified '"$DIRTY_COUNT"' source file(s) ('"$FILES"') but have not run tests since. Run the relevant test suite and show pass/fail output before finishing."}'
fi
# Log agent status on every clean stop (not blocked)
if [ -n "$RELAY_AGENT_NAME" ]; then
  STATUS_LOG="$HOME/.worklog/heartbeats/${RELAY_AGENT_NAME}.md"
  mkdir -p "$(dirname "$STATUS_LOG")"
  TS=$(date "+%Y-%m-%dT%H:%M:%S")
  # Extract a brief status hint from the last assistant message if available
  LAST_MSG=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('last_assistant_message',''))[:120])" 2>/dev/null | tr '\n' ' ')
  echo "[$TS] $LAST_MSG" >> "$STATUS_LOG"
fi
exit 0
