#!/bin/bash
# sleep-mac.sh — sleep the Mac on demand, even with caffeinate running
pkill -f "caffeinate" 2>/dev/null
sleep 1
osascript -e 'tell application "System Events" to sleep'
