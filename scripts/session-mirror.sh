#!/usr/bin/env bash
# session-mirror.sh — Mirror last assistant turn to relay after every Stop.
# Registered as a Stop hook in ~/.claude/settings.json.
# Only runs when RELAY_AGENT_NAME is set (skips anonymous/worker sessions).

set -euo pipefail

# Skip if no relay identity
[[ -z "${RELAY_AGENT_NAME:-}" ]] && exit 0

RELAY_URL="${RELAY_HTTP_URL:-http://localhost:8767}"

# Read hook payload from stdin
HOOK_INPUT=$(cat)
[[ -z "$HOOK_INPUT" ]] && exit 0

# Extract transcript path (Stop hook provides this)
TRANSCRIPT=$(echo "$HOOK_INPUT" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('transcript_path',''))" 2>/dev/null || echo "")

[[ -z "$TRANSCRIPT" || ! -f "$TRANSCRIPT" ]] && exit 0

# Extract last assistant text from JSONL (may be multiple text blocks — join them)
LAST_BODY=$(python3 - "$TRANSCRIPT" <<'PYEOF'
import sys, json

path = sys.argv[1]
last_text = ""
try:
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("type") != "assistant":
                continue
            msg = obj.get("message", {})
            content = msg.get("content", [])
            if not isinstance(content, list):
                continue
            parts = [b["text"] for b in content if b.get("type") == "text" and b.get("text", "").strip()]
            if parts:
                last_text = " ".join(parts)
except Exception:
    pass
print(last_text)
PYEOF
)

[[ -z "$LAST_BODY" || "$LAST_BODY" == "None" ]] && exit 0

# Truncate to 2000 chars
BODY="${LAST_BODY:0:2000}"
if [[ ${#LAST_BODY} -gt 2000 ]]; then
  BODY="${BODY}…"
fi

# Compute body hash for dedup
BODY_HASH=$(echo "$BODY" | md5 2>/dev/null || echo "$BODY" | md5sum | cut -c1-32)

# Dedup 1: skip if identical to last mirrored body (local file)
DEDUP_FILE="/tmp/smirror-${RELAY_AGENT_NAME}.hash"
if [[ -f "$DEDUP_FILE" ]]; then
  PREV=$(cat "$DEDUP_FILE" 2>/dev/null || echo "")
  [[ "$PREV" == "$BODY_HASH" ]] && exit 0
fi

# Dedup 2: skip if body matches the most recent relay message from this agent
# (prevents double-posting when agent already communicates via relay directly)
RELAY_LAST=$(curl -sf --max-time 2 "${RELAY_URL}/history/${RELAY_AGENT_NAME}" 2>/dev/null | \
  python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  msgs = [m for m in d.get('messages', []) if m.get('from') == '${RELAY_AGENT_NAME}']
  print(msgs[-1].get('body', '')[:2000] if msgs else '')
except: print('')
" 2>/dev/null || echo "")

if [[ -n "$RELAY_LAST" ]]; then
  RELAY_HASH=$(echo "$RELAY_LAST" | md5 2>/dev/null || echo "$RELAY_LAST" | md5sum | cut -c1-32)
  [[ "$RELAY_HASH" == "$BODY_HASH" ]] && { echo "$BODY_HASH" > "$DEDUP_FILE"; exit 0; }
fi

echo "$BODY_HASH" > "$DEDUP_FILE"

# Build JSON payload
PAYLOAD=$(python3 -c "
import json, sys, os
print(json.dumps({
  'from': os.environ.get('RELAY_AGENT_NAME', 'unknown'),
  'to': 'ceo',
  'type': 'message',
  'body': sys.argv[1],
}))
" "$BODY" 2>/dev/null)

[[ -z "$PAYLOAD" ]] && exit 0

# POST to relay — fire and forget, never block Claude
curl -sf -X POST "${RELAY_URL}/send" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  >/dev/null 2>&1 || true

exit 0
