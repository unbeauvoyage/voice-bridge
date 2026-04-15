#!/bin/bash
# Wrapper that launches Python.app via osascript so it runs in a GUI/audio session.
# Direct launch from pm2 (no TTY, no audio session) causes PyAudio to return silent
# (zero) audio from external USB devices like Fifine SC3. osascript has proper
# GUI/WindowServer + CoreAudio session access even when spawned from a daemon.
DAEMON_DIR="/Users/riseof/environment/projects/voice-bridge/daemon"
PYTHON_APP="/opt/homebrew/Cellar/python@3.14/3.14.0/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python"
SCRIPT="$DAEMON_DIR/wake_word.py"
LOG_FILE="/tmp/wake-word-audio.log"

# Forward all args to the Python script
ARGS="$@"

# Ensure log file exists
> "$LOG_FILE"

# Build command for osascript — must be a single quoted string.
# Args are safe (no special chars from pm2 config).
OSCMD="PYTHONPATH='$DAEMON_DIR/.venv/lib/python3.14/site-packages' '$PYTHON_APP' -u '$SCRIPT' $ARGS > '$LOG_FILE' 2>&1 & echo \$!"

# Launch via osascript to inherit GUI audio session
PID=$(osascript -e "do shell script \"$OSCMD\"")
echo "[run_daemon] launched PID=$PID via osascript"

# Stream log output to stdout so pm2 captures it
tail -f "$LOG_FILE" &
TAIL_PID=$!

# Cleanup on exit
cleanup() {
    kill $TAIL_PID 2>/dev/null
    kill $PID 2>/dev/null
    echo "[run_daemon] exited"
}
trap cleanup EXIT INT TERM

# Wait until the Python process exits
while kill -0 "$PID" 2>/dev/null; do
    sleep 1
done

echo "[run_daemon] wake-word process $PID exited"
