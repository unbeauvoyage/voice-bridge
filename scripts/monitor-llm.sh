#!/bin/bash
# Tier 2 monitor: adaptive LLM scan via LM Studio
# - Catches dialogs that Tier 1 bash scan missed (unknown patterns)
# - Auto-adds discovered patterns to monitor-patterns.txt so Tier 1 learns them
# - Adapts check interval based on time since last hit:
#     <2h  → 5 min  | 2-4h → 10 min | 4-6h → 20 min
#     6-8h → 30 min | >8h  → 60 min  | any hit → reset to 5 min

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
PATTERNS_FILE="$SCRIPTS_DIR/monitor-patterns.txt"
STATE_FILE="$SCRIPTS_DIR/.monitor-llm-state"
DISCOVERY_LOG="$SCRIPTS_DIR/pattern-discoveries.log"
LM_URL="http://localhost:1234/v1/chat/completions"
LMS="$HOME/.lmstudio/bin/lms"
PREFERRED_MODEL="qwen2.5-coder-3b-instruct-mlx"  # small MLX model for monitoring

# ── Ensure LM Studio server + model are running ────────────────────────────
ensure_lm_ready() {
  # Start server if not running
  if ! "$LMS" server status 2>/dev/null | grep -q "running"; then
    echo "[llm-monitor] Starting LM Studio server..."
    "$LMS" server start 2>/dev/null
    sleep 3
  fi

  # Load model if nothing loaded
  if ! "$LMS" ps 2>/dev/null | grep -q "\."; then
    echo "[llm-monitor] Loading $PREFERRED_MODEL..."
    "$LMS" load "$PREFERRED_MODEL" --yes 2>/dev/null &
    local load_pid=$!
    # Wait up to 60s for model to load
    local waited=0
    while ! "$LMS" ps 2>/dev/null | grep -qv "No models"; do
      sleep 3; waited=$((waited+3))
      [[ $waited -ge 60 ]] && { echo "[llm-monitor] Model load timed out"; return 1; }
    done
    echo "[llm-monitor] Model ready"
  fi
  return 0
}

# ── Load state ─────────────────────────────────────────────────────────────
last_hit_ts=$(grep "^last_hit_ts=" "$STATE_FILE" 2>/dev/null | cut -d= -f2)
[[ -z "$last_hit_ts" ]] && last_hit_ts=$(date +%s)

now=$(date +%s)
hours_since=$(( (now - last_hit_ts) / 3600 ))

if   [[ $hours_since -lt 2 ]]; then interval_min=5
elif [[ $hours_since -lt 4 ]]; then interval_min=10
elif [[ $hours_since -lt 6 ]]; then interval_min=20
elif [[ $hours_since -lt 8 ]]; then interval_min=30
else                                 interval_min=60
fi

echo "[llm-monitor] $(date '+%H:%M:%S') check — interval: ${interval_min}m (${hours_since}h since last hit)"

# ── Ensure LM Studio is up ─────────────────────────────────────────────────
if ! ensure_lm_ready; then
  echo "[llm-monitor] Could not start LM Studio — skipping"
  { echo "last_hit_ts=$last_hit_ts"; echo "interval_min=$interval_min"; } > "$STATE_FILE"
  exit 0
fi

# Get loaded model name
LM_MODEL=$(curl -s --max-time 3 http://localhost:1234/v1/models 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d.get('data') else 'local-model')" 2>/dev/null)
[[ -z "$LM_MODEL" ]] && LM_MODEL="local-model"

# ── Load known patterns (to skip already-covered dialogs) ──────────────────
mapfile -t KNOWN_PATTERNS < <(grep -v '^#' "$PATTERNS_FILE" 2>/dev/null | grep -v '^$')

WORKSPACES=$(cmux list-workspaces 2>/dev/null | awk '{print $1}' | tr -d '*')
found_something=false

for WS in $WORKSPACES; do
  PANE=$(cmux capture-pane --workspace "$WS" 2>/dev/null)

  # Quick check: any numbered dialog at all?
  if ! echo "$PANE" | grep -q "1\. Yes"; then
    continue
  fi

  # Already handled by Tier 1 known patterns? Skip.
  already_known=false
  for PATTERN in "${KNOWN_PATTERNS[@]}"; do
    if echo "$PANE" | grep -qi "$PATTERN"; then
      already_known=true
      break
    fi
  done
  # Tier 1 structural detectors
  if echo "$PANE" | grep -q "don't ask again"; then already_known=true; fi
  if echo "$PANE" | grep -q "Do you want to proceed" && echo "$PANE" | grep -q "3\. No"; then already_known=true; fi

  if $already_known; then continue; fi

  # ── Unknown dialog — ask LLM ──────────────────────────────────────────────
  echo "[llm-monitor] Unknown dialog in $WS — querying LLM..."

  PANE_SNIPPET=$(echo "$PANE" | tail -35 | head -30)
  PROMPT="You are a security monitor for a multi-agent Claude Code system on macOS.

Terminal output from workspace $WS:
\`\`\`
$PANE_SNIPPET
\`\`\`

1. Is there a permission approval dialog? (numbered choices like: 1. Yes / 2. Yes, allow... / 3. No)
2. If yes, is the action SAFE to auto-approve?
   SAFE: reading files, cat/tail/grep/ls, git status/log/diff, bun/npm/node builds, /tmp/ reads, ~/environment/ reads
   UNSAFE: rm/delete, git push/force, writing outside ~/environment/, curl to external hosts, system-level changes
3. Which option number? (prefer 2 = permanent allow, 1 = one-time yes)
4. A short grep pattern (5-40 chars) that will uniquely identify this dialog type for future bash script detection.

Reply in JSON only (no markdown, no explanation):
{\"has_dialog\":true,\"safe\":true,\"choice\":\"2\",\"pattern\":\"unique string\",\"reason\":\"brief\"}"

  PROMPT_JSON=$(python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" <<< "$PROMPT" 2>/dev/null)

  RESPONSE=$(curl -s --max-time 20 "$LM_URL" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$LM_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":$PROMPT_JSON}],\"temperature\":0.1,\"max_tokens\":200}" 2>/dev/null)

  CONTENT=$(python3 -c "
import sys,json
try:
    r=json.load(sys.stdin)
    print(r['choices'][0]['message']['content'].strip())
except:
    print('')
" <<< "$RESPONSE" 2>/dev/null)

  [[ -z "$CONTENT" ]] && echo "[llm-monitor] Empty LLM response" && continue

  # Parse decision
  DECISION=$(python3 -c "
import sys,json,re
text=sys.stdin.read().strip()
text=re.sub(r'\x60{3}json?\n?','',text).strip('\x60').strip()
try:
    d=json.loads(text)
    if not d.get('has_dialog'):
        print('no_dialog')
    elif not d.get('safe') or d.get('choice')=='escalate':
        print('escalate|' + str(d.get('reason','unknown')))
    else:
        choice=str(d.get('choice','2'))
        pattern=str(d.get('pattern') or '')
        reason=str(d.get('reason',''))
        print(f'approve|{choice}|{pattern}|{reason}')
except Exception as e:
    print(f'error|{e}')
" <<< "$CONTENT" 2>/dev/null)

  case "$DECISION" in
    no_dialog)
      echo "[llm-monitor] LLM: no dialog in $WS"
      ;;

    approve*)
      IFS='|' read -r _ choice pattern reason <<< "$DECISION"
      echo "[llm-monitor] LLM says safe in $WS (choice $choice): $reason — notifying command"
      found_something=true

      # Add pattern to file if meaningful and not duplicate (for tier-1 to detect faster next time)
      if [[ -n "$pattern" && ${#pattern} -ge 5 ]]; then
        if ! grep -qF "$pattern" "$PATTERNS_FILE" 2>/dev/null; then
          echo "$pattern" >> "$PATTERNS_FILE"
          echo "[$(date '+%Y-%m-%d %H:%M:%S')] ADDED '$pattern' — ws:$WS — $reason" >> "$DISCOVERY_LOG"
          echo "[llm-monitor] New pattern added: '$pattern'"
        fi
      fi

      SNIPPET=$(echo "$PANE" | tail -10 | tr '\n' ' ')
      curl -s -X POST http://localhost:8767/send \
        -H "Content-Type: application/json" \
        -d "{\"from\":\"llm-monitor\",\"to\":\"command\",\"type\":\"alert\",\"body\":\"Pane prompt in $WS — LLM says safe (suggested choice $choice): $reason — $(echo "$SNIPPET" | cut -c1-150)\"}" 2>/dev/null
      ;;

    escalate*)
      IFS='|' read -r _ reason <<< "$DECISION"
      echo "[llm-monitor] ESCALATE in $WS: $reason"
      SNIPPET=$(echo "$PANE" | tail -10 | tr '\n' ' ')
      curl -s -X POST http://localhost:8767/send \
        -H "Content-Type: application/json" \
        -d "{\"from\":\"llm-monitor\",\"to\":\"command\",\"type\":\"alert\",\"body\":\"ESCALATE $WS: $reason — $(echo "$SNIPPET" | cut -c1-150)\"}" 2>/dev/null
      ;;

    error*)
      echo "[llm-monitor] Parse error: $DECISION (raw: $CONTENT)"
      ;;
  esac
done

# ── Save state ──────────────────────────────────────────────────────────────
new_ts=$last_hit_ts
if [[ "$found_something" == true ]]; then
  new_ts=$(date +%s)
  echo "[llm-monitor] Hit found — interval resets to 5m next run"
fi
{ echo "last_hit_ts=$new_ts"; echo "interval_min=$interval_min"; } > "$STATE_FILE"
