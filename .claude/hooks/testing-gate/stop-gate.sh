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
exit 0
