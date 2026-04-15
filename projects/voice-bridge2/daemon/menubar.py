#!/usr/bin/env python3
"""
Menu bar recording indicator for voice-bridge.
Watches /tmp/wake-word-recording:
  - file exists  → shows "⏺ REC" in the menu bar
  - file absent  → hides the indicator
"""

from pathlib import Path
import rumps

STATE_FILE = Path("/tmp/wake-word-recording")


class RecordingIndicator(rumps.App):
    def __init__(self):
        super().__init__(" ", quit_button=None)

    @rumps.timer(0.25)
    def check_state(self, _sender):
        self.title = "⏺ REC" if STATE_FILE.exists() else " "


if __name__ == "__main__":
    RecordingIndicator().run()
