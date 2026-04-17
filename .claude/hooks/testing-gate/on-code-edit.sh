#!/usr/bin/env bash
# PostToolUse hook — runs tsc + matching unit test on every TypeScript file edit
# Input: JSON on stdin with tool_name, tool_input, session_id
# Exit 0 always — never block the edit, just report errors

INPUT=$(cat)

# Extract the file path using python3 (already a dependency in the system)
FILE=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print(ti.get('file_path', ''))
" 2>/dev/null || true)

# Skip if no file path
if [[ -z "$FILE" ]]; then
  exit 0
fi

# Skip if not a .ts or .tsx file
if [[ ! "$FILE" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

# Skip ignored directories (NOT worktrees — coders work there and need error feedback)
if [[ "$FILE" =~ /node_modules/ ]] || \
   [[ "$FILE" =~ /dist/ ]] || \
   [[ "$FILE" =~ /build/ ]] || \
   [[ "$FILE" =~ /out/ ]]; then
  exit 0
fi

ENVIRONMENT_ROOT="/Users/riseof/environment"

# Run a command with a timeout (macOS-compatible — no `timeout` binary needed)
# Usage: run_with_timeout <seconds> <cmd> [args...]
# Returns exit code of the command, or 124 on timeout
run_with_timeout() {
  local secs="$1"
  shift
  "$@" &
  local pid=$!
  (
    sleep "$secs"
    kill "$pid" 2>/dev/null
  ) &
  local watcher=$!
  wait "$pid" 2>/dev/null
  local exit_code=$?
  kill "$watcher" 2>/dev/null
  wait "$watcher" 2>/dev/null
  return $exit_code
}

# Walk up from the file's directory to find the project root (has package.json)
find_project_root() {
  local dir
  dir=$(dirname "$1")
  while [[ "$dir" != "$ENVIRONMENT_ROOT" && "$dir" != "/" ]]; do
    if [[ -f "$dir/package.json" ]]; then
      echo "$dir"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  # Check the environment root itself
  if [[ -f "$ENVIRONMENT_ROOT/package.json" ]]; then
    echo "$ENVIRONMENT_ROOT"
    return 0
  fi
  return 1
}

PROJECT_ROOT=$(find_project_root "$FILE") || {
  echo "[hook] No package.json found for $FILE — skipping tsc"
  exit 0
}

# Determine which tsconfig to use
pick_tsconfig() {
  local file="$1"
  local root="$2"

  # Bun server path — must come before generic /src/ check
  if [[ "$file" =~ /server/ ]]; then
    if [[ -f "$root/tsconfig.server.json" ]]; then
      echo "tsconfig.server.json"
      return
    fi
  fi

  # Node/electron paths
  if [[ "$file" =~ /electron/ ]] || \
     [[ "$file" =~ /src/main/ ]] || \
     [[ "$file" =~ /src/preload/ ]]; then
    if [[ -f "$root/tsconfig.node.json" ]]; then
      echo "tsconfig.node.json"
      return
    fi
  fi

  # Web paths
  if [[ "$file" =~ /src/ ]]; then
    if [[ -f "$root/tsconfig.web.json" ]]; then
      echo "tsconfig.web.json"
      return
    fi
  fi

  # Fallback
  if [[ -f "$root/tsconfig.json" ]]; then
    echo "tsconfig.json"
    return
  fi

  echo ""
}

TSCONFIG=$(pick_tsconfig "$FILE" "$PROJECT_ROOT")

CONTEXT_ERRORS=""

# Run tsc with timeout, but only show errors for the edited file
# This matches IDE behavior: squiggles on the file you're editing, not a global dump.
# Cross-file errors surface naturally when those files are edited.
if [[ -n "$TSCONFIG" ]]; then
  TSC_OUTFILE=$(mktemp /tmp/hook-tsc-XXXXXX)
  (cd "$PROJECT_ROOT" && bunx tsc --noEmit -p "$TSCONFIG" > "$TSC_OUTFILE" 2>&1) &
  TSC_PID=$!
  (
    sleep 30
    kill "$TSC_PID" 2>/dev/null
    echo "TIMEOUT" >> "$TSC_OUTFILE"
  ) &
  WATCHER_PID=$!
  wait "$TSC_PID" 2>/dev/null
  TSC_EXIT=$?
  kill "$WATCHER_PID" 2>/dev/null
  wait "$WATCHER_PID" 2>/dev/null
  TSC_OUTPUT=$(cat "$TSC_OUTFILE")
  rm -f "$TSC_OUTFILE"

  if grep -q "^TIMEOUT$" <<< "$TSC_OUTPUT" 2>/dev/null; then
    CONTEXT_ERRORS+=$'\n'"=== tsc ($TSCONFIG) — TIMEOUT ===\ntsc timeout — check manually"
  else
    # Filter to only lines mentioning the edited file (basename match)
    FILE_BASENAME=$(basename "$FILE")
    FILTERED=$(echo "$TSC_OUTPUT" | grep "$FILE_BASENAME" || true)
    if [[ -n "$FILTERED" ]]; then
      CONTEXT_ERRORS+=$'\n'"=== tsc errors in $FILE_BASENAME ===\n$FILTERED"
    fi
    # If tsc failed but no errors match this file, stay silent — mid-refactor state
  fi
fi

# Run ESLint on the edited file — catches architectural boundary violations immediately
# (no-restricted-imports, eslint-plugin-boundaries) — same as IDE red squiggles
ESLINT_CONFIG=""
if [[ -f "$PROJECT_ROOT/eslint.config.mjs" ]]; then
  ESLINT_CONFIG="$PROJECT_ROOT/eslint.config.mjs"
elif [[ -f "$PROJECT_ROOT/eslint.config.js" ]]; then
  ESLINT_CONFIG="$PROJECT_ROOT/eslint.config.js"
elif [[ -f "$PROJECT_ROOT/.eslintrc.js" ]]; then
  ESLINT_CONFIG="$PROJECT_ROOT/.eslintrc.js"
fi

if [[ -n "$ESLINT_CONFIG" ]]; then
  ESLINT_OUTFILE=$(mktemp /tmp/hook-eslint-XXXXXX)
  (cd "$PROJECT_ROOT" && bunx eslint --no-fix --max-warnings=0 "$FILE" > "$ESLINT_OUTFILE" 2>&1) &
  ESLINT_PID=$!
  (
    sleep 20
    kill "$ESLINT_PID" 2>/dev/null
    echo "TIMEOUT" >> "$ESLINT_OUTFILE"
  ) &
  EWATCHER_PID=$!
  wait "$ESLINT_PID" 2>/dev/null
  ESLINT_EXIT=$?
  kill "$EWATCHER_PID" 2>/dev/null
  wait "$EWATCHER_PID" 2>/dev/null
  ESLINT_OUTPUT=$(cat "$ESLINT_OUTFILE")
  rm -f "$ESLINT_OUTFILE"

  if grep -q "^TIMEOUT$" <<< "$ESLINT_OUTPUT" 2>/dev/null; then
    CONTEXT_ERRORS+=$'\n'"=== eslint — TIMEOUT ==="
  elif [[ $ESLINT_EXIT -ne 0 ]]; then
    CONTEXT_ERRORS+=$'\n'"=== eslint errors in $(basename "$FILE") ===\n$ESLINT_OUTPUT"
  fi
fi

# Run matching test file if it exists
FILE_DIR=$(dirname "$FILE")
FILE_BASE=$(basename "$FILE" .tsx)
FILE_BASE=$(basename "$FILE_BASE" .ts)

# Look for {basename}.test.ts alongside the edited file
TEST_FILE=""
if [[ -f "$FILE_DIR/${FILE_BASE}.test.ts" ]]; then
  TEST_FILE="$FILE_DIR/${FILE_BASE}.test.ts"
elif [[ -f "$FILE_DIR/${FILE_BASE}.test.tsx" ]]; then
  TEST_FILE="$FILE_DIR/${FILE_BASE}.test.tsx"
fi

if [[ -n "$TEST_FILE" ]]; then
  # Get relative path from project root
  REL_TEST="${TEST_FILE#$PROJECT_ROOT/}"
  echo ""
  echo "=== bun test $REL_TEST ==="
  TEST_OUTFILE=$(mktemp /tmp/hook-test-XXXXXX)
  (cd "$PROJECT_ROOT" && bun test "$REL_TEST" > "$TEST_OUTFILE" 2>&1) &
  TEST_PID=$!
  (
    sleep 30
    kill "$TEST_PID" 2>/dev/null
    echo "TIMEOUT" >> "$TEST_OUTFILE"
  ) &
  TWATCHER_PID=$!
  wait "$TEST_PID" 2>/dev/null
  kill "$TWATCHER_PID" 2>/dev/null
  wait "$TWATCHER_PID" 2>/dev/null
  cat "$TEST_OUTFILE"
  rm -f "$TEST_OUTFILE"
fi

# Inject tsc/eslint errors into the agent's context window via additionalContext
# Claude Code PostToolUse hooks can return JSON with hookSpecificOutput.additionalContext
# which is injected directly into the model's context — stdout echo is ignored by agents
if [[ -n "$CONTEXT_ERRORS" ]]; then
  FILE_BASENAME=$(basename "$FILE")
  python3 -c "
import json, sys
errors = sys.argv[1]
fname = sys.argv[2]
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PostToolUse',
    'additionalContext': f'🛑 TypeScript/ESLint errors in {fname}. The pre-commit gate WILL block your commit. Fix these NOW before continuing — do not defer:\n{errors}'
  }
}))
" "$CONTEXT_ERRORS" "$FILE_BASENAME"
fi

# POST telemetry to relay for dashboard visibility
AGENT_NAME="${RELAY_AGENT_NAME:-unknown}"
TSC_ERRORS_JSON="[]"
ESLINT_ERRORS_JSON="[]"

if [[ -n "$FILTERED" ]]; then
  # Escape and JSON-encode tsc errors (one per line → JSON array)
  TSC_ERRORS_JSON=$(echo "$FILTERED" | python3 -c "
import sys, json
lines = [l.rstrip() for l in sys.stdin if l.strip()]
print(json.dumps(lines))
" 2>/dev/null || echo "[]")
fi

if [[ -n "$ESLINT_OUTPUT" && $ESLINT_EXIT -ne 0 ]]; then
  ESLINT_ERRORS_JSON=$(echo "$ESLINT_OUTPUT" | head -20 | python3 -c "
import sys, json
lines = [l.rstrip() for l in sys.stdin if l.strip()]
print(json.dumps(lines))
" 2>/dev/null || echo "[]")
fi

# Fire-and-forget POST to relay telemetry endpoint
python3 -c "
import urllib.request, json, os, sys
payload = json.dumps({
  'agent': os.environ.get('RELAY_AGENT_NAME', 'unknown'),
  'file': sys.argv[1],
  'tscErrors': json.loads(sys.argv[2]),
  'eslintErrors': json.loads(sys.argv[3]),
}).encode()
try:
  req = urllib.request.Request('http://localhost:8767/hook/telemetry', data=payload, headers={'Content-Type':'application/json'}, method='POST')
  urllib.request.urlopen(req, timeout=2)
except: pass
" "$FILE" "$TSC_ERRORS_JSON" "$ESLINT_ERRORS_JSON" 2>/dev/null &

exit 0
