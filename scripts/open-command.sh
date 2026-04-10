#!/bin/bash
# Opens the COMMAND meta-manager session with bypassPermissions mode.
# Run this from any terminal to launch COMMAND.

COMMAND_UUID="f54b472b-25d0-4e29-a7fd-a400ce91b754"

HUB_AGENT_NAME=command HUB_SESSION_ID="$COMMAND_UUID" claude \
  --dangerously-load-development-channels plugin:hub-channel@hub-plugins \
  --permission-mode bypassPermissions \
  --resume "$COMMAND_UUID" \
  --remote-control
