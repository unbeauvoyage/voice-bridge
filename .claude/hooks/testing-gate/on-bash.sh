#!/usr/bin/env bash
# PostToolUse hook — detects test runs and clears the dirty flag.
# Input: JSON on stdin.
#
# Pass detection requires BOTH:
#   1. Tool exit_code == 0 (the test process itself reported success)
#   2. A structural pass marker in stdout (e.g. "N passed", "Tests: N passed")
# This avoids the false-positive where the word "passed" appears in a stack
# trace, file path, or comment of a FAILING test run.

INPUT=$(cat)
SESSION=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id','unknown'))" 2>/dev/null)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)
OUTPUT=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('tool_response',{}); print(r.get('stdout','') + r.get('output',''))" 2>/dev/null)
EXIT_CODE=$(echo "$INPUT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('tool_response',{})
# Different harness versions name this differently
ec=r.get('exit_code', r.get('exitCode', r.get('returncode', r.get('code'))))
print('' if ec is None else ec)
" 2>/dev/null)

# Detect a test command at the START of the command (so 'cat package.json | grep \"bun test\"'
# does NOT count as running tests). Anchored match; allow leading 'cd ... && ' prefix.
TEST_CMD_RE='(^|&&[[:space:]]*|;[[:space:]]*)(npx[[:space:]]+)?(playwright|bun test|bun run test|npm test|npm run test|yarn test|pnpm test|pnpm playwright|vitest|jest|pytest|cargo test|go test)\b'
if echo "$COMMAND" | grep -qE "$TEST_CMD_RE"; then
  CWD_HASH=$(echo "$PWD" | md5sum | cut -c1-8)
  TESTED_FILE="/tmp/tg-tested-${SESSION}-${CWD_HASH}"
  DIRTY_FILE="/tmp/tg-dirty-${SESSION}-${CWD_HASH}"

  # Structural pass markers — actual runner summary lines, not stray words.
  PASS_MARKER_RE='([0-9]+[[:space:]]+passed)|(Tests:[[:space:]]+[0-9]+[[:space:]]+passed)|(PASS[[:space:]]+[^[:space:]]+\.(test|spec)\.)|(ok[[:space:]]+[0-9]+[[:space:]]+-)'
  PASS_MARKER_OK=0
  if echo "$OUTPUT" | grep -qE "$PASS_MARKER_RE"; then
    PASS_MARKER_OK=1
  fi

  # Exit-code gate. Empty means harness didn't supply it — fall back to marker only,
  # but log conservatively. Non-zero = fail regardless of stdout.
  if [ -n "$EXIT_CODE" ] && [ "$EXIT_CODE" != "0" ]; then
    echo "$(date +%s) FAILED exit=$EXIT_CODE $COMMAND" > "$TESTED_FILE"
  elif [ "$PASS_MARKER_OK" = "1" ]; then
    echo "$(date +%s) PASSED $COMMAND" > "$TESTED_FILE"
    rm -f "$DIRTY_FILE"
  else
    # Test command ran, exit was 0 (or unknown), but no pass marker — could be
    # zero-tests run, snapshot-only, or unfamiliar runner. Don't clear dirty.
    echo "$(date +%s) AMBIGUOUS no-marker $COMMAND" > "$TESTED_FILE"
  fi
fi
exit 0
