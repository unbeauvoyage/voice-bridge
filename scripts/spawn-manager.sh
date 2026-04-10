#!/bin/bash
# spawn-manager.sh — Launch a project manager (convenience wrapper)
# Usage: spawn-manager.sh <name> <uuid> [cwd] [model]
# Example: spawn-manager.sh command $UUID ~/environment sonnet
# Example: spawn-manager.sh atlas $UUID ~/environment        (defaults to haiku from agent def)

DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/spawn-session.sh" project-manager "$1" "${3:-~/environment}" "$4" "$2"
