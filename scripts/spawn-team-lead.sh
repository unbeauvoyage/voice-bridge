#!/bin/bash
# spawn-team-lead.sh — Launch a team lead session (convenience wrapper)
# Usage: spawn-team-lead.sh <name> <uuid> <cwd>
# Example: spawn-team-lead.sh productivitesse $UUID ~/environment/projects/productivitesse

DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/spawn-session.sh" team-lead "$1" "$3" "" "$2"
