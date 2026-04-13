#!/usr/bin/env bash
# PostToolUse hook — detects test runs and clears the dirty flag
# Input: JSON on stdin

INPUT=$(cat)
SESSION=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id','unknown'))" 2>/dev/null)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)
OUTPUT=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('tool_response',{}); print(r.get('stdout','') + r.get('output',''))" 2>/dev/null)

# Detect test commands
if echo "$COMMAND" | grep -qE "playwright|bun test|npx test|vitest|jest|pytest"; then
  CWD_HASH=$(echo "$PWD" | md5sum | cut -c1-8)
  TESTED_FILE="/tmp/tg-tested-${SESSION}-${CWD_HASH}"
  DIRTY_FILE="/tmp/tg-dirty-${SESSION}-${CWD_HASH}"

  # Check if tests passed
  if echo "$OUTPUT" | grep -qE "passed|✓|PASS|all tests"; then
    echo "$(date +%s) PASSED $COMMAND" > "$TESTED_FILE"
    # Clear dirty file — tests passed
    rm -f "$DIRTY_FILE"
  else
    echo "$(date +%s) FAILED $COMMAND" > "$TESTED_FILE"
  fi
fi
exit 0
