#!/usr/bin/env bash
# PostToolUse hook — marks session dirty when code files are edited
# Input: JSON on stdin with tool_name, tool_input, session_id

INPUT=$(cat)
TOOL=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null)
SESSION=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id','unknown'))" 2>/dev/null)
FILE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); ti=d.get('tool_input',{}); print(ti.get('file_path', ti.get('new_string','')))" 2>/dev/null)

# Only track source code files (not docs, not CLAUDE.md, not .md files)
if [[ "$FILE" =~ \.(ts|tsx|js|jsx|py|swift|go|rs)$ ]]; then
  CWD_HASH=$(echo "$PWD" | md5sum | cut -c1-8)
  DIRTY_FILE="/tmp/tg-dirty-${SESSION}-${CWD_HASH}"
  echo "$(date +%s) $FILE" >> "$DIRTY_FILE"
fi
exit 0
