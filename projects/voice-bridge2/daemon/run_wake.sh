#!/bin/bash
# Direct launcher for wake-word daemon.
# Used by the LaunchAgent (com.riseof.wake-word) instead of pm2.
# LaunchAgents run in the user's GUI/Aqua session and have CoreAudio access.
DAEMON_DIR="/Users/riseof/environment/projects/voice-bridge2/daemon"
PYTHON_APP="/opt/homebrew/Cellar/python@3.14/3.14.3_1/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python"

# Kill any existing instance before starting — prevents duplicate daemons
pkill -f "wake_word.py" 2>/dev/null
sleep 0.5

export PYTHONPATH="$DAEMON_DIR/.venv/lib/python3.14/site-packages"
cd "$DAEMON_DIR/.."
exec "$PYTHON_APP" -u daemon/wake_word.py \
    --target command \
    --start-threshold 0.3 \
    --stop-threshold 0.15
