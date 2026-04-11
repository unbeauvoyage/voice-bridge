#!/usr/bin/env bash
# Claude Code hook → relay /hook-event
# Usage: hook-event.sh <event-type>
# Reads JSON from stdin (hook payload), POSTs to relay. Fire-and-forget, never blocks Claude.

EVENT_TYPE="${1:-unknown}"
RELAY="http://localhost:8767"
AGENT_NAME="${HUB_AGENT_NAME:-${RELAY_AGENT_NAME:-unknown}}"

INPUT=$(cat)
if [ -z "$INPUT" ]; then exit 0; fi

# Extract fields from hook JSON
SESSION_ID=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id',''))" 2>/dev/null || echo "")
TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
HOOK_EVENT=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('hook_event_name','$EVENT_TYPE'))" 2>/dev/null || echo "$EVENT_TYPE")

# Build payload and POST (silent, non-blocking)
PAYLOAD=$(python3 -c "
import sys, json
inp = json.loads('''$INPUT''' if '''$INPUT''' else '{}')
tool_input = inp.get('tool_input', {}) or {}
cmd = tool_input.get('command') or tool_input.get('file_path') or ''
summary = str(cmd)[:120] if cmd else None
out = {
    'agent': '$AGENT_NAME',
    'session_id': '$SESSION_ID',
    'event': '$HOOK_EVENT',
    'tool': '$TOOL_NAME' or None,
    'summary': summary,
}
print(json.dumps(out))
" 2>/dev/null)

if [ -n "$PAYLOAD" ]; then
  curl -sf -X POST "$RELAY/hook-event" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    > /dev/null 2>&1 || true
fi

exit 0
