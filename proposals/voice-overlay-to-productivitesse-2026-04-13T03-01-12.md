---
title: Move Voice Overlay UI into Productivitesse
date: 2026-04-13T03:01:12
status: proposed
summary: Migrate all voice-bridge UI (recording overlay, toasts, menu bar icon) from ad-hoc Swift binaries into productivitesse Electron app — one codebase, same visual design, relay-connected.
---

# Move Voice Overlay UI into Productivitesse

## Problem

Voice-bridge UI is currently 3 separate compiled Swift binaries:
- `overlay_bin` — recording/success/error overlays (AppKit NSPanel)
- `menubar_icon` — yellow mic in menu bar (NSStatusItem)
- `toast_overlay` — right-side message toasts (NSPanel, polling queue file)

Each change requires recompiling Swift, restarting the daemon, and hoping osascript has display access. Hard to maintain, no hot reload, platform-locked to macOS Swift.

## Proposed Architecture

```
Python daemon (wake word)
    ↓ relay messages (type: "voice_state")
Relay :8767
    ↓ WebSocket subscription
productivitesse (Electron)
    → Tray icon (yellow/red mic)
    → Recording overlay window (top-left transparent BrowserWindow)
    → Toast window (bottom-right transparent BrowserWindow)
```

The Python daemon keeps doing wake word detection — OpenWakeWord is Python-only. The daemon just stops spawning Swift binaries and instead sends relay messages. productivitesse subscribes and renders everything.

## Relay Events (new message types)

Daemon sends these to relay when state changes:

| Event | type | body |
|---|---|---|
| Recording started | `voice_state` | `{ state: "recording", target: "command" }` |
| Recording stopped (success) | `voice_state` | `{ state: "delivered", target: "command" }` |
| Recording stopped (error) | `voice_state` | `{ state: "error", message: "..." }` |
| Returned to idle | `voice_state` | `{ state: "idle" }` |

Messages TO `ceo` already flow through relay — productivitesse subscribes to those for toasts (no change needed on daemon side for toasts).

## productivitesse Changes

### 1. Tray Icon
- Electron `Tray` API with SVG mic icon
- Yellow when `state: idle/delivered`
- Red when `state: recording`
- Click → show/hide agent grid (replaces or augments existing behavior)

### 2. Recording Overlay Window
- New `BrowserWindow`: `transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true`
- Position: top-left (x=18, y=30 from top)
- Size: W=420, H=54
- React component: dark background, yellow mic icon, "Recording… [agent name]" text
- Shows on `voice_state: recording`, hides on `voice_state: idle/delivered/error`

### 3. Delivered/Error Overlay Window
- Same BrowserWindow setup, top-left
- Shows for 2 seconds on `voice_state: delivered` or `voice_state: error`
- Green checkmark + "Delivered to [agent]" or red X + error message

### 4. Toast Window (right-side message stack)
- Persistent `BrowserWindow`, bottom-right, transparent, always-on-top
- Subscribes to relay messages where `to === "ceo"` and `from !== "ceo"`
- React component: stacked cards, each with colored agent name + body text
- Each card disappears after 7 seconds (setTimeout)
- Same dark card design as current toast_overlay.swift

### 5. Relay Subscription (new hook in productivitesse)
Add a `useVoiceState` hook that:
- Subscribes to relay WebSocket
- Filters `type === "voice_state"` messages
- Updates a Zustand store: `{ state, target, error }`
- Drives overlay window show/hide via Electron IPC

## Visual Design (exact match to current Swift UI)

Current Swift overlays use:
- Background: `rgba(13, 20, 38, 0.88)` (very dark navy)
- Agent name: `rgb(102, 178, 255)` (bright blue)
- Body text: `rgb(224, 235, 255)` (light blue-white)
- Corner radius: 12px
- Font: system font, 15pt regular / semibold for agent name
- Recording: yellow mic icon (SF Symbol `mic.fill`, yellow)
- Success: green SF Symbol or ✓ character

These translate directly to CSS — copy the colors exactly.

## Migration Steps

### Phase 1 — Relay events from daemon (1 coder, ~1 hour)
- Add `send_voice_state(state, target)` function to `wake_word.py`
- Call it at each state transition (recording started/stopped/error/idle)
- Remove Swift binary spawning for overlays (keep as fallback until Phase 3)

### Phase 2 — productivitesse overlay windows (1 coder, ~3 hours)
- Add tray icon with yellow/red mic
- Add recording overlay BrowserWindow + React component
- Add delivered overlay BrowserWindow + React component
- Wire to `useVoiceState` hook subscribing to relay

### Phase 3 — productivitesse toast window (1 coder, ~2 hours)
- Add persistent toast BrowserWindow
- Subscribe to relay messages to `ceo`
- Stacked card component with 7s auto-dismiss
- Match current Swift toast visual exactly

### Phase 4 — Remove Swift binaries (after Phase 3 verified)
- Delete `overlay_bin`, `menubar_icon`, `toast_overlay` Swift sources + binaries
- Remove Swift spawning from `wake_word.py`
- Update `run_wake.sh` to not kill these on startup

## Prerequisites

- productivitesse must be running for overlays to work (already true for CEO's workflow)
- Relay WebSocket endpoint must be reachable from productivitesse (already connected)
- productivitesse needs Electron `Tray` permission (already an Electron app, no new permissions)

## What Stays the Same

- Python daemon (`wake_word.py`) — wake word detection unchanged
- Relay as message bus — no new infrastructure
- Visual design — exact same colors, layout, font sizes
- `run_wake.sh` — still the launch script, just no Swift binary management

## Timeline

Phases 1-3 can run sequentially in a single session: ~6 hours total for one coder, or ~2 hours with 3 parallel coders (one per phase, phases 2-3 can run concurrently after phase 1 lands).

Phase 4 (cleanup) only after CEO confirms productivitesse overlays look correct.
