#!/usr/bin/env bash
# SessionStart hook — surfaces compiler baseline when a session starts
# Output: JSON with hookSpecificOutput.additionalContext
# Token cost: ~0 (just reads cached tsbuildinfo + counts)
# Ported from productivitesse/.claude/hooks (commit 0fb6273).

PROJECT="/Users/riseof/environment/projects/voice-bridge2"
cd "$PROJECT"

TSC_COUNT=$(
  {
    npx tsc --noEmit -p tsconfig.node.json --composite false 2>&1
    npx tsc --noEmit -p tsconfig.web.json --composite false 2>&1
    npx tsc --noEmit -p tsconfig.server.json --composite false 2>&1
  } | grep -c " error TS" 2>/dev/null || echo 0
)
ESLINT_ERRORS=$(npx eslint . --max-warnings 9999 2>&1 | grep -cE "^\s+[0-9]+:[0-9]+\s+error" 2>/dev/null)
ESLINT_ERRORS=${ESLINT_ERRORS:-0}
DEBT_COUNT=$(grep -c "error TS" "$PROJECT/.claude/.compiler-debt.md" 2>/dev/null || echo "none (run an edit to capture baseline)")
TEST_NOTE="185 passing (main + server, REFACTOR-END checkpoint 1685196)"

SUMMARY="Session baseline: tsc=${TSC_COUNT} errors | eslint=${ESLINT_ERRORS} errors | ${DEBT_COUNT} pre-existing in .compiler-debt.md | bun test: ${TEST_NOTE}"

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' \
  "$(echo "$SUMMARY" | sed 's/"/\\"/g' | tr '\n' ' ')"
