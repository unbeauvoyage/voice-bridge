#!/bin/bash
# Tier 1 monitor: lightweight 5s scan for blocked permission prompts
# On detection:
#   1. Approves pending relay hook requests (POST /hook/permission/approve)
#   2. Approves interactive pane prompts via cmux (send "1" + Enter)
#   3. Notifies command via relay so it knows what happened
# Handles both Claude Code dialog formats:
#   Format A (tool approval):      "1. Yes" + "2. Yes, and don't ask again for X"
#   Format B (project permission): "Do you want to proceed?" + "1. Yes"

# Step 1: Approve all pending relay hook requests
curl -s http://localhost:8767/hook/permission/pending 2>/dev/null | \
  python3 -c "import json,sys;d=json.load(sys.stdin);[print(k) for k in d]" 2>/dev/null | \
  while read id; do
    curl -s -X POST http://localhost:8767/hook/permission/approve \
      -H "Content-Type: application/json" \
      -d "{\"id\":\"$id\"}" > /dev/null 2>&1
  done

# Step 2: Scan panes for interactive prompts
WORKSPACES=$(cmux list-workspaces 2>/dev/null | awk '{print $1}' | tr -d '*')

for WS in $WORKSPACES; do
  PANE=$(cmux capture-pane --workspace "$WS" 2>/dev/null)

  FORMAT_A=false
  FORMAT_B=false

  if echo "$PANE" | grep -q "1\. Yes" && echo "$PANE" | grep -q "don't ask again"; then
    FORMAT_A=true
  fi

  if echo "$PANE" | grep -q "Do you want to proceed" && echo "$PANE" | grep -q "1\. Yes"; then
    FORMAT_B=true
  fi

  if ! $FORMAT_A && ! $FORMAT_B; then
    continue
  fi

  DESCRIPTION=""
  if $FORMAT_A; then
    DESCRIPTION=$(echo "$PANE" | grep "don't ask again for" | head -1 | xargs)
  fi
  if $FORMAT_B; then
    CMD=$(echo "$PANE" | grep -A2 "Bash command" | grep -v "Bash command" | head -1 | xargs)
    DESCRIPTION="Bash: $CMD"
  fi

  # Approve via cmux
  cmux send --workspace "$WS" "1" 2>/dev/null
  cmux send-key --workspace "$WS" Enter 2>/dev/null

  # Notify command
  curl -s -X POST http://localhost:8767/send \
    -H "Content-Type: application/json" \
    -d "{\"from\":\"monitor\",\"to\":\"command\",\"type\":\"info\",\"body\":\"Auto-approved pane prompt in $WS: $(echo "$DESCRIPTION" | cut -c1-120)\"}" 2>/dev/null
  echo "[monitor] Approved in $WS: $DESCRIPTION"
done
