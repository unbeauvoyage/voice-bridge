#!/bin/bash
# resume-session.sh — Resume a named session with all standard flags pre-applied.
# No need to type --dangerously-load-development-channels, --permission-mode, etc.
#
# Usage:
#   resume-session.sh <name>
#   resume-session.sh productivitesse
#   resume-session.sh command
#
# To add a new session: add a line to the SESSIONS block below.
# Format: name|agent-type|uuid|cwd|model
#   model is optional — leave blank for default (sonnet)

set -e

NAME=$1
if [ -z "$NAME" ]; then
  echo "Usage: resume-session.sh <name>"
  echo ""
  echo "Known sessions:"
  awk -F'|' '/^[^#]/ && NF>=4 { printf "  %-28s %s\n", $1, $4 }' "$(dirname "$0")/resume-session.sh" | grep -v "^$" | grep -v "NAME\|TYPE\|UUID"
  exit 1
fi

# ---------------------------------------------------------------------------
# SESSIONS — add new sessions here
# Format: name|agent-type|uuid|cwd|model
# ---------------------------------------------------------------------------
SESSIONS="
command|project-manager|f54b472b-25d0-4e29-a7fd-a400ce91b754|~/environment|sonnet
consul|project-manager|a87a7ce9-987e-45da-a392-fc3cebbd1962|~/environment|sonnet
chief-of-staff|chief-of-staff|d27b5433-2f32-4273-b783-aefee1654f37|~/environment|sonnet
productivitesse|team-lead|5ff9b28e-d6d4-4529-90d3-d3df8bee30d3|~/environment/projects/productivitesse|sonnet
voice-bridge|team-lead|2bde1283-e5bc-416d-936d-8fc116f2d4a9|~/environment/projects/voice-bridge2|sonnet
knowledge-base|team-lead|3d844227-46b1-49e2-a872-8a3834beb639|~/environment/projects/knowledge-base|sonnet
hq|project-manager|d1d8eace-b3bd-4e49-bf9f-71c7987428e1|~/environment/hq|sonnet
agency-bicycles|agency-lead|3e1a569b-117f-4d2e-a893-a289d0ec6df1|~/environment/agency/bicycles|sonnet
agency-cars|agency-lead|96edbd5f-f78d-442e-84c7-643c2675463e|~/environment/agency/cars|sonnet
agency-coffee-shops|agency-lead|d92973d9-b436-41d9-a70e-29492336151f|~/environment/agency/coffee-shops|sonnet
agency-kabab-shops|agency-lead|6a5b294e-267a-4aa0-8c1e-8ffe0b20ac05|~/environment/agency/kabab-shops|sonnet
agency-housing-mortgage|agency-lead|94a3d1fa-cc27-4ca0-9dfe-7d35953a74de|~/environment/agency/housing-mortgage|sonnet
agency-routers|agency-lead|7c0b6d82-3d7f-429c-b638-7232dcb4e26b|~/environment/agency/routers|sonnet
agency-biz|agency-lead|1fdd7b66-550f-4d1d-8967-0bd2c1d85fb1|~/environment/agency/business-opportunities|sonnet
"

# Look up the session
ROW=$(echo "$SESSIONS" | grep "^${NAME}|" | head -1)
if [ -z "$ROW" ]; then
  echo "ERROR: Unknown session '${NAME}'"
  echo ""
  echo "Known sessions:"
  echo "$SESSIONS" | grep -v '^$' | awk -F'|' '{ printf "  %-28s (type: %s)\n", $1, $2 }'
  exit 1
fi

TYPE=$(echo "$ROW" | cut -d'|' -f2)
UUID=$(echo "$ROW" | cut -d'|' -f3)
CWD=$(echo "$ROW" | cut -d'|' -f4)
MODEL=$(echo "$ROW" | cut -d'|' -f5)

# Expand ~ in CWD
CWD=$(eval echo "$CWD")

# Model flag
MODEL_FLAG=""
if [ -n "$MODEL" ]; then
  MODEL_FLAG="--model $MODEL"
fi

echo "=== Resuming '$NAME' ==="
echo "  Type:  $TYPE"
echo "  UUID:  $UUID"
echo "  CWD:   $CWD"
echo "  Model: ${MODEL:-default}"
echo ""

cd "$CWD"
exec env RELAY_AGENT_NAME="$NAME" claude \
  --agent "$TYPE" \
  --name "$NAME" \
  $MODEL_FLAG \
  --dangerously-load-development-channels plugin:relay-channel@relay-plugins \
  --permission-mode bypassPermissions \
  --resume "$UUID" \
  --remote-control
