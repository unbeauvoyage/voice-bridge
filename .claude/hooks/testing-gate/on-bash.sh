#!/usr/bin/env bash
# PostToolUse hook — detects test runs and clears the dirty flag.
# Input: JSON on stdin.
#
# Pass detection requires ALL THREE:
#   1. The LAST segment of the command pipeline is a test runner (so a chain
#      like `bun test foo && cat output.txt | grep passed` is NOT counted —
#      its last segment is grep, not a test runner).
#   2. Tool exit_code == 0 (the test process itself reported success).
#   3. A structural pass marker appears in stdout (e.g. "N passed", "PASS path/",
#      "test result: ok. N passed", "ok N -").
#
# Why all three: each is a hole the others plug.
#   - Without (1), false-positives on cat-in-pipe, echo, grep-anywhere.
#   - Without (2), a runner that prints "passed" while exiting non-zero clears.
#   - Without (3), a non-test command that happens to be in the test runner
#     allowlist (no real such case but defensive) and exits 0 clears.

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

# Extract the LAST segment of the command pipeline.
# Splits on && / || / ; / | (any of which sequences another command after).
# Trims surrounding whitespace.
LAST_SEGMENT=$(python3 -c "
import sys, re
cmd = sys.argv[1]
# Split on shell command separators that introduce a new command.
parts = re.split(r'\s*(?:&&|\|\||;|\|)\s*', cmd)
parts = [p.strip() for p in parts if p.strip()]
print(parts[-1] if parts else '')
" "$COMMAND")

# Test command detector — ANCHORED to the last segment.
# Accepts: playwright, bun test, bun run test[:variant], npm test,
#   npm run test[:variant], yarn test[:variant], pnpm test[:variant],
#   pnpm playwright, vitest, jest, pytest, cargo test, go test.
# Multiple spaces between tokens are tolerated via [[:space:]]+.
TEST_CMD_RE='^(npx[[:space:]]+)?(playwright|bun[[:space:]]+test|bun[[:space:]]+run[[:space:]]+test(:[a-zA-Z0-9_-]+)?|npm[[:space:]]+test|npm[[:space:]]+run[[:space:]]+test(:[a-zA-Z0-9_-]+)?|yarn[[:space:]]+test(:[a-zA-Z0-9_-]+)?|pnpm[[:space:]]+test(:[a-zA-Z0-9_-]+)?|pnpm[[:space:]]+playwright|vitest|jest|pytest|cargo[[:space:]]+test|go[[:space:]]+test)([[:space:]]|$)'

if echo "$LAST_SEGMENT" | grep -qE "$TEST_CMD_RE"; then
  CWD_HASH=$(echo "$PWD" | md5sum | cut -c1-8)
  TESTED_FILE="/tmp/tg-tested-${SESSION}-${CWD_HASH}"
  DIRTY_FILE="/tmp/tg-dirty-${SESSION}-${CWD_HASH}"

  # Structural pass markers — actual runner summary lines, not stray words.
  # Covers: vitest/jest ("N passed"), bun test ("N pass" — no trailing d),
  # Tests: header, Playwright PASS lines, TAP "ok N -",
  # cargo "test result: ok. N passed; ...", go "ok package 0.1s".
  PASS_MARKER_RE='([0-9]+[[:space:]]+pass)|(Tests:[[:space:]]+[0-9]+[[:space:]]+passed)|(PASS[[:space:]]+[^[:space:]]+\.(test|spec)\.)|(ok[[:space:]]+[0-9]+[[:space:]]+-)|(test[[:space:]]+result:[[:space:]]+ok\.[[:space:]]+[0-9]+[[:space:]]+passed)|(^ok[[:space:]]+[^[:space:]]+[[:space:]]+[0-9]+\.[0-9]+s)'
  PASS_MARKER_OK=0
  if echo "$OUTPUT" | grep -qE "$PASS_MARKER_RE"; then
    PASS_MARKER_OK=1
  fi

  # Exit-code gate. Empty means harness didn't supply it — fall back to pass
  # marker alone (structural marker is strong enough: "N passed" can't appear
  # in a failing bun/jest/playwright run). This handles Claude Code harness
  # versions that omit exit_code from tool_response.
  if [ -z "$EXIT_CODE" ]; then
    if [ "$PASS_MARKER_OK" = "1" ]; then
      echo "$(date +%s) PASSED no-exit-code-marker-only $COMMAND" > "$TESTED_FILE"
      rm -f "$DIRTY_FILE"
    else
      echo "$(date +%s) AMBIGUOUS no-exit-code-no-marker $COMMAND" > "$TESTED_FILE"
    fi
  elif [ "$EXIT_CODE" != "0" ]; then
    echo "$(date +%s) FAILED exit=$EXIT_CODE $COMMAND" > "$TESTED_FILE"
  elif [ "$PASS_MARKER_OK" = "1" ]; then
    echo "$(date +%s) PASSED $COMMAND" > "$TESTED_FILE"
    rm -f "$DIRTY_FILE"
  else
    # Last segment was a test runner, exit 0, but no pass marker — could be
    # zero-tests run, snapshot-only, or an unfamiliar runner. Don't clear dirty.
    echo "$(date +%s) AMBIGUOUS no-marker $COMMAND" > "$TESTED_FILE"
  fi
fi
exit 0
