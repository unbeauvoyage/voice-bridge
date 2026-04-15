#!/usr/bin/env bash
# PostToolUse hook — runs tsc + eslint + bun test after TypeScript edits
# Agent sees errors immediately, mid-coding, before moving on.
# Output: JSON with hookSpecificOutput.additionalContext (Claude Code injects into model context)
#
# .compiler-debt.md pattern: first run captures baseline; subsequent runs diff to show ONLY new errors.
# Ported from productivitesse/.claude/hooks (commit 0fb6273).

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print(ti.get('file_path', ti.get('path', '')))
" 2>/dev/null || echo "")

# Only run for TypeScript source files under src/ or server/ (not .d.ts, not config)
if [[ ! "$FILE" =~ /projects/voice-bridge2/(src|server)/.*\.ts$ ]] || [[ "$FILE" =~ \.d\.ts$ ]]; then
  exit 0
fi

PROJECT="/Users/riseof/environment/projects/voice-bridge2"
cd "$PROJECT"

DEBT_FILE="$PROJECT/.claude/.compiler-debt.md"

# ── tsc (all three projects: node + web + server) ────────────────────────────
TSC_OUT=$(
  {
    npx tsc --noEmit -p tsconfig.node.json --composite false 2>&1
    npx tsc --noEmit -p tsconfig.web.json --composite false 2>&1
    npx tsc --noEmit -p tsconfig.server.json --composite false 2>&1
  } | grep " error TS" || true
)

if [ ! -f "$DEBT_FILE" ]; then
  echo "$TSC_OUT" > "$DEBT_FILE"
  KNOWN_COUNT=$(echo "$TSC_OUT" | grep -c "error TS" 2>/dev/null || echo 0)
  TSC_SUMMARY="tsc: baseline captured (${KNOWN_COUNT} pre-existing stored in .compiler-debt.md)"
else
  KNOWN=$(cat "$DEBT_FILE")
  NEW_ERRORS=$(comm -13 <(echo "$KNOWN" | sort) <(echo "$TSC_OUT" | sort) 2>/dev/null || true)
  KNOWN_COUNT=$(echo "$KNOWN" | grep -c "error TS" 2>/dev/null || echo 0)
  if [ -z "$NEW_ERRORS" ]; then
    TSC_SUMMARY="tsc: clean (${KNOWN_COUNT} pre-existing suppressed)"
  else
    NEW_COUNT=$(echo "$NEW_ERRORS" | grep -c "error TS" 2>/dev/null || echo 0)
    SNIPPET=$(echo "$NEW_ERRORS" | head -3 | tr '\n' '; ')
    TSC_SUMMARY="tsc: ${NEW_COUNT} NEW ERRORS (${KNOWN_COUNT} pre-existing suppressed) — ${SNIPPET}"
  fi
fi

# ── eslint (single-file, cheap) ──────────────────────────────────────────────
ESLINT_RAW=$(npx eslint "$FILE" --max-warnings 0 2>&1 || true)
if echo "$ESLINT_RAW" | grep -qE "^\s+[0-9]+:[0-9]+\s+error"; then
  ERR_COUNT=$(echo "$ESLINT_RAW" | grep -cE "^\s+[0-9]+:[0-9]+\s+error" || echo "?")
  SNIPPET=$(echo "$ESLINT_RAW" | grep -E "^\s+[0-9]+:[0-9]+\s+error" | head -2 | tr '\n' '; ')
  ESLINT_SUMMARY="eslint: ${ERR_COUNT} error(s) — ${SNIPPET}"
else
  WARN_COUNT=$(echo "$ESLINT_RAW" | grep -cE "^\s+[0-9]+:[0-9]+\s+warning")
  ESLINT_SUMMARY="eslint: clean (${WARN_COUNT:-0} warnings)"
fi

# ── unit tests (bun test, colocated *.test.ts) ───────────────────────────────
BASENAME=$(basename "$FILE" .ts)
DIR=$(dirname "$FILE")
TEST_FILE="${DIR}/${BASENAME}.test.ts"

# Skip if the edited file IS the test file itself
if [[ "$FILE" == *".test.ts" ]]; then
  TEST_FILE="$FILE"
fi

if [ -f "$TEST_FILE" ]; then
  BUN_RAW=$(bun test "$TEST_FILE" 2>&1 || true)
  # Match only NON-ZERO fail counts ("1 fail" or more); bun always prints "0 fail" on pass
  if echo "$BUN_RAW" | grep -qE "^\s*[1-9][0-9]* fail"; then
    FAIL_COUNT=$(echo "$BUN_RAW" | grep -oE "[1-9][0-9]* fail" | head -1 | grep -oE "[0-9]+" || echo "?")
    SNIPPET=$(echo "$BUN_RAW" | grep -E "(✗|error:)" | head -3 | tr '\n' '; ')
    TEST_SUMMARY="tests: ${FAIL_COUNT} FAILING — ${SNIPPET}"
  else
    PASS_COUNT=$(echo "$BUN_RAW" | grep -oE "[0-9]+ pass" | head -1 | grep -oE "[0-9]+" || echo "?")
    TEST_SUMMARY="tests: ${PASS_COUNT} passed"
  fi
else
  TEST_SUMMARY="tests: no test file for $(basename "$FILE")"
fi

# ── emit JSON context injection ───────────────────────────────────────────────
CONTEXT="${TSC_SUMMARY} | ${ESLINT_SUMMARY} | ${TEST_SUMMARY}"
printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' \
  "$(echo "$CONTEXT" | sed 's/"/\\"/g' | tr '\n' ' ')"

exit 0
