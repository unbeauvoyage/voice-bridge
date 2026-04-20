#!/bin/bash
# spawn-session.sh — Universal session launcher
# Ensures: agent type loaded, three names aligned, channel plugin, remote-control, bypass permissions
#
# Usage: spawn-session.sh <name> [type] [cwd] [model] [--resume]
#
# Arguments:
#   name  — instance name (e.g. command, atlas, productivitesse, matrix) [REQUIRED]
#   type  — agent definition name (default: team-lead). E.g. project-manager, system-lead, ux-lead
#   cwd   — working directory (default: current directory)
#   model — model override (default: from agent def). Use "haiku", "sonnet", "opus"
#   --resume — resume existing session (optional, can appear anywhere after name)
#
# Examples:
#   spawn-session.sh command                                    # Team-lead named "command"
#   spawn-session.sh command project-manager                    # PM named "command"
#   spawn-session.sh atlas project-manager ~/environment haiku  # Haiku PM named "atlas"
#   spawn-session.sh productivitesse team-lead ~/environment/projects/productivitesse
#   spawn-session.sh command --resume                           # Resume existing "command" session
#   spawn-session.sh command project-manager --resume

set -e

NAME=$1
TYPE=${2:-team-lead}
RESUME_FLAG=""
CWD=$(pwd)
MODEL=""

# Parse remaining arguments (cwd, model, --resume)
shift 2 2>/dev/null || shift || true
for arg in "$@"; do
  if [ "$arg" = "--resume" ]; then
    RESUME_FLAG="--resume"
  elif [ -z "$CWD" ] || [[ "$CWD" == "~/environment" ]] && [[ "$arg" == /* ]] || [[ "$arg" == ~* ]]; then
    # First path-like arg becomes cwd
    CWD="$arg"
  elif [ -z "$MODEL" ] && { [ "$arg" = "haiku" ] || [ "$arg" = "sonnet" ] || [ "$arg" = "opus" ]; }; then
    MODEL="$arg"
  fi
done

if [ -z "$NAME" ]; then
  echo "Usage: spawn-session.sh <name> [type] [cwd] [model] [--resume]"
  echo ""
  echo "Arguments:"
  echo "  name  — instance name (command, atlas, productivitesse, matrix, etc.) [REQUIRED]"
  echo "  type  — agent type (default: team-lead)"
  echo "          E.g. project-manager, system-lead, ux-lead, agency-lead"
  echo "  cwd   — working directory (default: current directory)"
  echo "  model — haiku, sonnet, opus (optional)"
  echo "  --resume — resume existing session"
  echo ""
  echo "Examples:"
  echo "  spawn-session.sh command"
  echo "  spawn-session.sh command project-manager"
  echo "  spawn-session.sh atlas project-manager ~/environment haiku"
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

# Generate UUID (for --resume flag, allows resuming a previous session)
UUID=$(python3 -c "import uuid; print(uuid.uuid4())")

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

echo "=== Spawning Session ==="
echo "  Name:  $NAME"
echo "  Type:  $TYPE"
echo "  CWD:   $CWD"
echo "  Model: ${MODEL:-from agent def}"
echo "  UUID:  $UUID"
echo ""

# --- Cleanup & Restart ---
# Kill any existing Claude sessions with the same --name before launching.
# One name = one session, enforced at spawn time.
# The plugin handles its own PID-file stale-kill on startup.
EXISTING_CLAUDE_PIDS=$(ps aux | grep -- "--name $NAME" | grep -v grep | awk '{print $2}')
if [ -n "$EXISTING_CLAUDE_PIDS" ]; then
  echo "Terminating existing session(s) for '$NAME'..."
  for PID in $EXISTING_CLAUDE_PIDS; do
    kill "$PID" 2>/dev/null || true
  done
  sleep 1  # Wait for child processes (bun plugins) to die
fi

# If workspace still exists after killing the session, delete it and recreate fresh
EXISTING=$(cmux list-workspaces 2>/dev/null | grep -w "$NAME" | head -1 || true)
if [ -n "$EXISTING" ]; then
  echo "Cleaning up existing workspace..."
  cmux kill-workspace --workspace "$NAME" 2>/dev/null || true
  sleep 1
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
  --command "RELAY_AGENT_NAME=$NAME claude --agent $TYPE $MODEL_FLAG --dangerously-load-development-channels plugin:relay-channel@relay-plugins --permission-mode bypassPermissions $RESUME_FLAG $UUID --name $NAME --remote-control" \
  2>/dev/null | sed 's/OK //')

# Rename workspace to match instance name
cmux rename-workspace --workspace "$WS" "$NAME" 2>/dev/null

echo "  Workspace: $WS (renamed to $NAME)"

# Auto-approve the "local development" channel prompt
# Wait for Claude to start and show the prompt
sleep 5
cmux send --workspace "$WS" "1" 2>/dev/null && cmux send-key --workspace "$WS" Enter 2>/dev/null

echo ""
echo "=== Session '$NAME' started ==="
echo "  RELAY_AGENT_NAME=$NAME"
echo "  --name $NAME"
echo "  Workspace: $NAME"
echo "  UUID: $UUID"
echo ""
echo "Channel approval sent automatically."
