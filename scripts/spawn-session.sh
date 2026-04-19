#!/bin/bash
# spawn-session.sh — Universal session launcher
# Ensures: agent type loaded, three names aligned, channel plugin, remote-control, bypass permissions
#
# Usage: spawn-session.sh <type> <name> [cwd] [model] [uuid]
#
# Arguments:
#   type  — agent definition name (e.g. project-manager, team-lead, system-lead)
#   name  — instance name (e.g. command, atlas, productivitesse, matrix)
#   cwd   — working directory (default: ~/environment)
#   model — model override (default: from agent def). Use "haiku", "sonnet", "opus"
#   uuid  — session UUID to resume (default: generate new)
#
# Examples:
#   spawn-session.sh project-manager command                              # PM named "command", default model
#   spawn-session.sh project-manager atlas ~/environment haiku            # Haiku PM named "atlas"
#   spawn-session.sh project-manager command ~/environment sonnet         # Sonnet PM (chief of staff)
#   spawn-session.sh team-lead productivitesse ~/environment/projects/productivitesse
#   spawn-session.sh system-lead matrix ~/environment sonnet
#   spawn-session.sh team-lead voice-bridge ~/environment/projects/voice-bridge sonnet $UUID

set -e

TYPE=$1
NAME=$2
CWD=${3:-~/environment}
MODEL=$4
UUID=${5:-$(python3 -c "import uuid; print(uuid.uuid4())")}

if [ -z "$TYPE" ] || [ -z "$NAME" ]; then
  echo "Usage: spawn-session.sh <type> <name> [cwd] [model] [uuid]"
  echo ""
  echo "Types: project-manager, team-lead, system-lead, ux-lead, agency-lead, etc."
  echo "Name:  instance name (command, atlas, productivitesse, matrix, etc.)"
  echo "Model: haiku, sonnet, opus (optional — defaults to agent def)"
  exit 1
fi

# Guard: this script is for managers only.
# Team leads and coders use TeamCreate — not this script.
KNOWN_MANAGERS="command atlas sentinel"
CALLER="${RELAY_AGENT_NAME:-}"
if [ -n "$CALLER" ]; then
  IS_MANAGER=false
  for m in $KNOWN_MANAGERS; do
    [ "$CALLER" = "$m" ] && IS_MANAGER=true && break
  done
  if [ "$IS_MANAGER" = false ]; then
    echo "ERROR: spawn-session.sh is for managers only (command, atlas, sentinel)."
    echo "  Caller: $CALLER"
    echo "  Team leads and coders must use TeamCreate to spawn teammates."
    echo "  If you need a new top-level session, ask a manager."
    exit 1
  fi
fi

# Expand ~ in CWD
CWD=$(eval echo "$CWD")

# Check agent definition exists
AGENT_FILE="$CWD/.claude/agents/${TYPE}.md"
GLOBAL_AGENT_FILE="$HOME/.claude/agents/${TYPE}.md"
ENV_AGENT_FILE="$HOME/environment/.claude/agents/${TYPE}.md"

if [ ! -f "$AGENT_FILE" ] && [ ! -f "$GLOBAL_AGENT_FILE" ] && [ ! -f "$ENV_AGENT_FILE" ]; then
  echo "ERROR: No agent definition found for type '${TYPE}'"
  echo "Expected: .claude/agents/${TYPE}.md (project, user, or ~/environment level)"
  exit 1
fi

# Build model flag
MODEL_FLAG=""
if [ -n "$MODEL" ]; then
  MODEL_FLAG="--model $MODEL"
fi

# Generate a unique session ID for this launch
SESSION_ID=$(python3 -c "import uuid; print(uuid.uuid4())")

echo "=== Launching Session ==="
echo "  Type:      $TYPE"
echo "  Name:      $NAME"
echo "  CWD:       $CWD"
echo "  Model:     ${MODEL:-from agent def}"
echo "  UUID:      $UUID"
echo "  SessionID: $SESSION_ID"
echo ""

# --- Duplicate Prevention ---
# Check workspace
EXISTING=$(cmux list-workspaces 2>/dev/null | grep -w "$NAME" | head -1 || true)
if [ -n "$EXISTING" ]; then
  echo "ERROR: Workspace '$NAME' already exists. Close it first or pick a different name."
  echo "  $EXISTING"
  exit 1
fi

# Kill any existing Claude sessions with the same --name before launching.
# One name = one session, enforced at spawn time.
# The plugin handles its own PID-file stale-kill on startup.
EXISTING_CLAUDE_PIDS=$(ps aux | grep -- "--name $NAME" | grep -v grep | awk '{print $2}')
if [ -n "$EXISTING_CLAUDE_PIDS" ]; then
  echo "WARNING: Existing Claude session(s) for '$NAME' detected. Terminating before spawn..."
  for PID in $EXISTING_CLAUDE_PIDS; do
    echo "  Killing PID $PID"
    kill "$PID" 2>/dev/null || true
  done
  sleep 2  # Wait for child processes (bun plugins) to die
fi

# Ensure agent definition is accessible from session's CWD
# Claude Code resolves --agent relative to the session's working directory
PROJECT_AGENT_FILE="$CWD/.claude/agents/${TYPE}.md"
if [ ! -f "$PROJECT_AGENT_FILE" ]; then
  mkdir -p "$CWD/.claude/agents"
  # Copy from env-level definitions
  if [ -f "$ENV_AGENT_FILE" ]; then
    cp "$ENV_AGENT_FILE" "$PROJECT_AGENT_FILE"
    echo "  Copied agent def: $ENV_AGENT_FILE → $PROJECT_AGENT_FILE"
  elif [ -f "$GLOBAL_AGENT_FILE" ]; then
    cp "$GLOBAL_AGENT_FILE" "$PROJECT_AGENT_FILE"
    echo "  Copied agent def: $GLOBAL_AGENT_FILE → $PROJECT_AGENT_FILE"
  fi
fi

# Launch in cmux workspace
WS=$(cmux new-workspace --cwd "$CWD" \
  --command "RELAY_AGENT_NAME=$NAME RELAY_SESSION_ID=$SESSION_ID claude --agent $TYPE $MODEL_FLAG --dangerously-load-development-channels plugin:relay-channel@relay-plugins --permission-mode bypassPermissions --resume $UUID --name $NAME --remote-control" \
  2>/dev/null | sed 's/OK //')

# Rename workspace to match instance name
cmux rename-workspace --workspace "$WS" "$NAME" 2>/dev/null

echo "  Workspace: $WS (renamed to $NAME)"

# Auto-approve the "local development" channel prompt
# Wait for Claude to start and show the prompt
sleep 5
cmux send --workspace "$WS" "1" 2>/dev/null && cmux send-key --workspace "$WS" Enter 2>/dev/null

echo ""
echo "=== Session '$NAME' launched ==="
echo "  Relay:     RELAY_AGENT_NAME=$NAME"
echo "  Session:   --name $NAME"
echo "  Workspace: $NAME"
echo "  UUID:      $UUID"
echo "  SessionID: $SESSION_ID"
echo ""
echo "All three names aligned. Channel approval sent."
echo "Session ID passed to channel plugin via RELAY_SESSION_ID env var."
