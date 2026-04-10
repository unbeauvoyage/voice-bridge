---
title: Back Tap Recording Setup
created: 2026-04-04T07:42:15
---

# How to Set Up Back Tap Recording

Back-tapping the iPhone triggers the Productivitesse app to start (or stop) recording immediately — no need to unlock, find the app, or tap a button.

## How it works

iPhone Back Tap → iOS Shortcut → opens `productivitesse://record` URL → app comes to foreground and toggles recording.

- If the app was in the background: it comes to foreground and **starts** recording instantly.
- If already recording: back-tap again to **stop** and send the voice message.

---

## One-time setup (5 minutes)

### Step 1 — Create the Shortcut

1. Open the **Shortcuts** app on your iPhone.
2. Tap **+** to create a new shortcut.
3. Tap **Add Action**, search for **Open URLs**, tap it.
4. In the URL field, type exactly: `productivitesse://record`
5. Tap the shortcut name at the top and rename it to **"Record Voice"**.
6. Tap **Done**.

### Step 2 — Assign Back Tap

1. Open **Settings** → **Accessibility** → **Touch** → **Back Tap**.
2. Choose either **Double Tap** or **Triple Tap** (triple is less accidental).
3. Scroll down to **Shortcuts** section and tap **Record Voice**.
4. Done.

---

## Using it

1. **Back-tap** (2× or 3× depending on your setting) anywhere on the back of the phone.
2. Productivitesse comes to the foreground and immediately starts recording.
3. Speak your message.
4. **Back-tap again** to stop — the recording is transcribed and sent to your selected agent.

---

## Notes

- You do **not** need to unlock your phone first — back tap works from the lock screen if you allow it (Settings → Face ID & Passcode → Allow Access When Locked → Shortcuts).
- The active agent (who receives the message) is whoever is selected in the Voice tab's "Send to agent" picker.
- The URL scheme `productivitesse://` is already registered in the app — no additional configuration needed.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Nothing happens on back tap | Check Accessibility → Touch → Back Tap has "Record Voice" assigned |
| App opens but doesn't start recording | Ensure microphone permission is granted (Settings → Productivitesse → Microphone) |
| Shortcut shows error | Confirm the URL is exactly `productivitesse://record` (no spaces, lowercase) |
