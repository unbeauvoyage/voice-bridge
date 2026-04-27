#!/bin/bash
# Wake-word daemon launcher.
# MUST be called from a terminal (cmux/Terminal.app) context — NOT from pm2 or LaunchAgent.
# macOS CoreAudio requires process ancestry through a GUI terminal for external USB mics.
#
# Usage:
#   ./start_daemon.sh            # start if not running
#   ./start_daemon.sh --restart  # kill existing, start fresh
#   ./start_daemon.sh --stop     # stop only
#   ./start_daemon.sh --status   # check status

DAEMON_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_APP="/opt/homebrew/Cellar/python@3.14/3.14.0/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python"
PID_FILE="/tmp/wake-word.pid"
LOG_FILE="/tmp/wake-word-live.log"
ARGS="--target command --start-threshold 0.3 --stop-threshold 0.35"

stop_daemon() {
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "[wake-word] Stopping PID $OLD_PID..."
            kill "$OLD_PID"
            sleep 1
        fi
        rm -f "$PID_FILE"
    fi
    # Also kill any stray processes
    pkill -f "wake_word.py" 2>/dev/null
}

QUIET=false
[ "${1:-}" = "--quiet" ] && QUIET=true && shift

case "${1:-}" in
    --stop)
        stop_daemon
        echo "[wake-word] Stopped."
        exit 0
        ;;
    --status)
        if [ -f "$PID_FILE" ] && kill -0 "$(cat $PID_FILE)" 2>/dev/null; then
            echo "[wake-word] Running (PID $(cat $PID_FILE))"
        else
            echo "[wake-word] Not running"
        fi
        exit 0
        ;;
    --restart)
        stop_daemon
        ;;
    *)
        # Check if already running
        if [ -f "$PID_FILE" ] && kill -0 "$(cat $PID_FILE)" 2>/dev/null; then
            $QUIET || echo "[wake-word] Already running (PID $(cat $PID_FILE))"
            exit 0
        fi
        ;;
esac

export PYTHONPATH="$DAEMON_DIR/.venv/lib/python3.14/site-packages"
cd "$DAEMON_DIR/.."

echo "[wake-word] Starting daemon (logging to $LOG_FILE)..."
nohup "$PYTHON_APP" -u daemon/wake_word.py $ARGS >> "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$PID_FILE"
echo "[wake-word] Started PID=$PID"
