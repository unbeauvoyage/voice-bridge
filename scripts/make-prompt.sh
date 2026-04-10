#!/bin/bash
# Usage: make-prompt.sh <template-name> [key=value ...]
# Example: make-prompt.sh team-lead project=productivitesse
#
# Reads .claude/agents/<template>.md and replaces {key} placeholders.
# Prints the result to stdout for use in launch commands.

AGENTS_DIR="$(dirname "$0")/../.claude/agents"
TEMPLATE="$1"
shift

if [ -z "$TEMPLATE" ]; then
  echo "Usage: make-prompt.sh <template-name> [key=value ...]" >&2
  exit 1
fi

FILE="$AGENTS_DIR/$TEMPLATE.md"
if [ ! -f "$FILE" ]; then
  echo "Template not found: $FILE" >&2
  exit 1
fi

CONTENT=$(cat "$FILE")

for pair in "$@"; do
  KEY="${pair%%=*}"
  VALUE="${pair#*=}"
  CONTENT="${CONTENT//\{$KEY\}/$VALUE}"
done

echo "$CONTENT"
