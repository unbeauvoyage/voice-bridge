#!/usr/bin/env bash
# PostToolUse hook — runs tsc --noEmit + eslint after .ts/.tsx edits
# Injects compiler/lint errors back into agent context if any

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_response.filePath // ""' 2>/dev/null)

# Only run for TypeScript files
echo "$FILE" | grep -qE '\.(ts|tsx)$' || exit 0

cd /Users/riseof/environment/projects/knowledge-base || exit 0

# --- tsc check ---
TSC_OUT=$(bunx tsc --noEmit 2>&1 | tail -3)
TSC_EXIT=$?

# --- eslint check (informational, does not block) ---
ESLINT_OUT=$(bunx eslint "$FILE" --max-warnings 0 2>&1 | tail -3 || true)

# Build combined output if either has issues
COMBINED=""
if [ $TSC_EXIT -ne 0 ] && [ -n "$TSC_OUT" ]; then
  COMBINED="TSC errors after edit of $FILE:\n$TSC_OUT"
fi
if echo "$ESLINT_OUT" | grep -qE '(error|warning)'; then
  if [ -n "$COMBINED" ]; then
    COMBINED="$COMBINED\n\nESLint issues in $FILE:\n$ESLINT_OUT"
  else
    COMBINED="ESLint issues in $FILE:\n$ESLINT_OUT"
  fi
fi

if [ -n "$COMBINED" ]; then
  echo -e "$COMBINED"
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$(echo -e "$COMBINED" | sed 's/"/\\"/g' | tr '\n' ' ')"
fi

exit 0
