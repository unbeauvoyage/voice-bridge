#!/bin/bash
# Relay CEO CLI messages to the message relay so they appear in app chat
# Called by Claude Code UserPromptSubmit hook
# Stdin: JSON payload like {"prompt": "...", "session_id": "...", ...}

RELAY_URL="http://localhost:8765"

# Read JSON from stdin
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('prompt',''))" 2>/dev/null)

# Skip empty messages or system-level slash commands
if [ -z "$PROMPT" ] || echo "$PROMPT" | grep -qE '^/'; then
  exit 0
fi

# Skip relay-surfaced messages to prevent feedback loops.
# poll-messages.sh prefixes surfaced messages with "[MESSAGE from ...]:"
# and the relay-channel plugin injects "<channel source=" tags.
# Sending these back to the relay would cause exponential nesting.
if echo "$PROMPT" | grep -qE '^\[MESSAGE from |\[MESSAGE from |<channel source='; then
  exit 0
fi

# Skip if this session is a named agent (not the CEO's session).
# Named agents have RELAY_AGENT_NAME set; only unset/CEO sessions should relay.
if [ -n "$RELAY_AGENT_NAME" ]; then
  exit 0
fi

# Route: if message starts with @agent-name: strip prefix and target that agent
# Otherwise send to 'command' (the default destination)
TO="command"
if echo "$PROMPT" | grep -qE '^@[a-zA-Z0-9_-]+:'; then
  TO=$(echo "$PROMPT" | sed 's/^@\([^:]*\):.*/\1/')
  PROMPT=$(echo "$PROMPT" | sed 's/^@[^:]*: *//')
fi

# POST to relay /send endpoint
curl -s -X POST "$RELAY_URL/send" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "from=ceo" \
  --data-urlencode "to=$TO" \
  --data-urlencode "type=message" \
  --data-urlencode "body=$PROMPT" \
  > /dev/null 2>&1 || true

exit 0
