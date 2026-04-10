#!/usr/bin/env bash
# watcher.sh — watches inbox.txt and injects messages into COMMAND's surface via cmux
# Runs in its own dedicated terminal surface so it's never blocked by COMMAND being busy.

INBOX="$HOME/environment/voice-relay/inbox.txt"
LOG="$HOME/environment/voice-relay/watcher.log"

# Dynamically find COMMAND's workspace and surface
find_command_surface() {
    cmux list-workspaces 2>/dev/null | grep "COMMAND" | sed 's/^[^w]*//; s/  .*//' | head -1
}

WORKSPACE=$(find_command_surface)
if [ -z "$WORKSPACE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Could not find COMMAND workspace" | tee -a "$LOG"
    exit 1
fi

SURFACE=$(cmux list-pane-surfaces --workspace "$WORKSPACE" 2>/dev/null | grep "COMMAND" | sed 's/^[^s]*//; s/  .*//' | head -1)
if [ -z "$SURFACE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Could not find COMMAND surface in $WORKSPACE" | tee -a "$LOG"
    exit 1
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

# Ensure inbox exists
touch "$INBOX"

log "Watcher started. Monitoring $INBOX"

while true; do
    sleep 2

    # Skip if inbox is empty
    if [ ! -s "$INBOX" ]; then
        continue
    fi

    # Read all lines into an array (bash 3 compatible — no mapfile)
    LINES=()
    while IFS= read -r line || [ -n "$line" ]; do
        LINES+=("$line")
    done < "$INBOX"

    # Clear the inbox immediately to avoid double-processing
    # We'll restore any failed lines below
    > "$INBOX"

    FAILED_LINES=()

    for LINE in "${LINES[@]}"; do
        # Skip blank lines
        [ -z "$LINE" ] && continue

        log "Injecting: ${LINE:0:80}"

        # Send the message
        if cmux send --workspace "$WORKSPACE" --surface "$SURFACE" "$LINE" 2>>"$LOG"; then
            cmux send-key --workspace "$WORKSPACE" --surface "$SURFACE" Enter 2>>"$LOG"
            log "Sent OK"
        else
            log "ERROR: cmux send failed for line: ${LINE:0:80} — will retry"
            FAILED_LINES+=("$LINE")
        fi

        sleep 0.3
    done

    # Re-queue any failed lines back to inbox
    if [ ${#FAILED_LINES[@]} -gt 0 ]; then
        for FAILED in "${FAILED_LINES[@]}"; do
            echo "$FAILED" >> "$INBOX"
        done
        log "Re-queued ${#FAILED_LINES[@]} failed line(s)"
    fi
done
