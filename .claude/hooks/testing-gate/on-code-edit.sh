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

# Skip ignored directories
if [[ "$FILE" =~ /node_modules/ ]] || \
   [[ "$FILE" =~ /\.claude/worktrees/ ]] || \
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
    echo ""
    echo "=== tsc ($TSCONFIG) — TIMEOUT ==="
    echo "tsc timeout — check manually"
  else
    # Filter to only lines mentioning the edited file (basename match)
    FILE_BASENAME=$(basename "$FILE")
    FILTERED=$(echo "$TSC_OUTPUT" | grep "$FILE_BASENAME" || true)
    if [[ -n "$FILTERED" ]]; then
      echo ""
      echo "=== tsc errors in $FILE_BASENAME ==="
      echo "$FILTERED"
    fi
    # If tsc failed but no errors match this file, stay silent — mid-refactor state
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

exit 0
