#!/bin/bash
# spawn-worker.sh — Launch a worker agent (default permissions, no channel plugin)
# Usage: spawn-worker.sh <name> <session-uuid> <cwd>
# Example: spawn-worker.sh my-worker abc123 ~/environment/projects/myproject

NAME=$1
UUID=$2
CWD=$3

if [ -z "$NAME" ] || [ -z "$UUID" ] || [ -z "$CWD" ]; then
  echo "Usage: spawn-worker.sh <name> <uuid> <cwd>"
  exit 1
fi

cd "$CWD" && RELAY_AGENT_NAME=$NAME claude \
  --resume "$UUID" \
  --name "$NAME" \
  --remote-control
