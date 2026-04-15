#!/usr/bin/env python3
"""
Floating recording indicator window.
Launched by wake_word.py when recording starts, killed when recording stops.
Shows a small semi-transparent "Recording…" badge at top-right of the screen.
"""

import tkinter as tk
import sys

def main():
    root = tk.Tk()
    root.title("")
    root.overrideredirect(True)          # no title bar / window chrome
    root.attributes("-topmost", True)    # always on top
    root.attributes("-alpha", 0.82)      # semi-transparent

    # Red dot + label
    frame = tk.Frame(root, bg="#1a1a1a", padx=12, pady=8)
    frame.pack()

    dot = tk.Label(frame, text="●", fg="#ff3b30", bg="#1a1a1a", font=("SF Pro Display", 13))
    dot.pack(side="left", padx=(0, 6))

    label = tk.Label(frame, text="Recording…", fg="#ffffff", bg="#1a1a1a",
                     font=("SF Pro Display", 13, "bold"))
    label.pack(side="left")

    # Position: top-right, with some margin from the menu bar
    root.update_idletasks()
    w = root.winfo_reqwidth()
    h = root.winfo_reqheight()
    screen_w = root.winfo_screenwidth()
    margin = 20
    menu_bar_height = 28
    x = screen_w - w - margin
    y = menu_bar_height + margin
    root.geometry(f"+{x}+{y}")

    # Pulse animation: toggle dot color every 600ms
    colors = ["#ff3b30", "#ff6961"]
    state = [0]
    def pulse():
        state[0] ^= 1
        dot.config(fg=colors[state[0]])
        root.after(600, pulse)

    root.after(600, pulse)
    root.mainloop()


if __name__ == "__main__":
    main()
