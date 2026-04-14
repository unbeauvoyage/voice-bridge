#!/usr/bin/env bash
# PostToolUse hook — runs tsc --noEmit after .ts/.tsx edits
# Injects compiler errors back into agent context if any

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_response.filePath // ""' 2>/dev/null)

# Only run for TypeScript files
echo "$FILE" | grep -qE '\.(ts|tsx)$' || exit 0

cd /Users/riseof/environment/projects/knowledge-base || exit 0
OUT=$(bunx tsc --noEmit 2>&1)
EXIT=$?

if [ $EXIT -ne 0 ] && [ -n "$OUT" ]; then
  TRUNCATED=$(echo "$OUT" | head -20)
  # Print to stdout so agent sees errors
  echo "TSC errors detected after editing $FILE:"
  echo "$TRUNCATED"
  # Inject as additionalContext so model gets it in context
  ESCAPED=$(echo "$TRUNCATED" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"TSC errors after edit of %s:\n%s"}}\n' "$FILE" "$TRUNCATED"
fi

exit 0
