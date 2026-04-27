#!/bin/bash
# Restart wake word daemon with proper GUI/Aqua ancestry for CoreAudio/mic access.
#
# IMPORTANT: Do NOT use launchctl kickstart — it loses GUI ancestry and the mic
# goes silent (audio_level=0). The daemon must be started via osascript so macOS
# grants TCC microphone access.
#
# This script:
#   1. Unloads the LaunchAgent (stops launchd auto-restart)
#   2. Kills any remaining instances
#   3. Relaunches via osascript (restores GUI ancestry → mic works)

echo "[restart] Unloading LaunchAgent..."
launchctl unload ~/Library/LaunchAgents/com.riseof.wake-word.plist 2>/dev/null

echo "[restart] Killing existing wake_word.py processes..."
pkill -f "wake_word.py" 2>/dev/null
sleep 1

echo "[restart] Starting daemon via osascript (GUI ancestry)..."
osascript -e 'do shell script "PYTHONPATH=daemon/.venv/lib/python3.14/site-packages /opt/homebrew/Cellar/python@3.14/3.14.0/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python -u daemon/wake_word.py --target command --start-threshold 0.3 --stop-threshold 0.35 > /tmp/wake-word-launchd.log 2>&1 &"'

sleep 2
PID=$(pgrep -f wake_word.py)
COUNT=$(echo "$PID" | grep -c .)
echo "[restart] Done. Running instances: $COUNT, PID(s): $PID"
echo "[restart] Log: /tmp/wake-word-launchd.log"
