---
title: Merge VoiceBridge into Productivitesse
date: 2026-04-03
status: approved
---
# Plan: Merge VoiceBridge into Productivitesse

**Status:** CEO Approved
**Author:** Command
**Date:** 2026-04-03
**Priority:** HIGH

## Goal
Combine VoiceBridge (better mobile voice UI) with Productivitesse (better desktop + 3D dashboard) into a single application. Mobile gets bottom tab navigation with Voice and Dashboard pages.

## Current State

### Productivitesse (the bigger app)
- **Desktop:** Electron with full dashboard, 3D agent view, panels, messaging
- **Mobile:** Capacitor with basic MobileApp.tsx (361 lines) — tap-to-record, messages, agent select
- **Stack:** React Router v7, Vite, TypeScript strict

### VoiceBridge (the voice specialist)
- **Desktop:** Electron with voice recording UI (168 lines)
- **Mobile:** Capacitor iOS app with tap-to-record, stop screen, messages
- **Backend:** Bun server with Whisper integration, daemon for always-on mic
- **Stack:** React, Vite, TypeScript, Bun

## Plan

### Phase 1: Save & Remove (branch safety)
1. Create branch `archive/mobile-v1` from current main — preserves Productivitesse's existing mobile code
2. Remove `src/features/mobile/MobileApp.tsx` and `src/features/mobile/mobile.css` from main
3. Keep `src/features/mobile/api.ts` — the relay API client is reusable

### Phase 2: Port VoiceBridge Voice UI
1. Copy VoiceBridge's `electron/src/App.tsx` into Productivitesse as `src/features/mobile/VoicePage.tsx`
2. Adapt imports: use Productivitesse's relay API (`api.ts`) instead of VoiceBridge's direct fetch
3. Keep the recording UX intact: tap-to-record, timer, waveform, message display
4. Add voice-bridge server URL config (currently hardcoded to localhost:3030)

### Phase 3: Responsive 3D Dashboard Page
1. Create `src/features/mobile/DashboardPage.tsx`
2. Import the existing `DashboardApp` component (same one used in desktop)
3. Add responsive CSS: smaller panels, touch-friendly buttons, portrait orientation
4. R3F Canvas should work on mobile WebGL — test with Capacitor

### Phase 4: Bottom Tab Navigation
1. Create `src/features/mobile/MobileLayout.tsx` with iOS-style bottom tab bar
2. Two tabs: "Voice" (mic icon) and "Dashboard" (grid icon)
3. Use React Router nested routes for tab switching
4. Tab bar fixed to bottom with safe-area-inset padding (notch/Dynamic Island)
5. Active tab highlighted with accent color

### Phase 5: Wire Up Mobile Route
1. Update `app/routes/mobile.tsx` (or create if needed) to use MobileLayout
2. Capacitor config points to this route on mobile
3. Test: Capacitor → mobile layout → tab switch between Voice and Dashboard

### Phase 6: Test
1. Playwright tests for mobile viewport (375x812)
2. Voice recording flow works on mobile
3. 3D dashboard renders on mobile viewport
4. Tab navigation switches pages correctly
5. Build + deploy to real iPhone via Capacitor

## Files Changed
```
src/features/mobile/
  ├── MobileLayout.tsx    (NEW — tab bar + routing)
  ├── VoicePage.tsx       (NEW — ported from VoiceBridge)
  ├── DashboardPage.tsx   (NEW — responsive 3D dashboard wrapper)
  ├── api.ts              (KEEP — relay API client)
  ├── mobile.css          (UPDATE — add tab bar styles, responsive dashboard)
  └── MobileApp.tsx       (REMOVE — replaced by MobileLayout)
```

## What Happens to VoiceBridge Project
- VoiceBridge backend (Bun server + Whisper) stays as-is — it's the transcription server
- VoiceBridge frontend gets absorbed into Productivitesse
- VoiceBridge Electron app becomes unnecessary (Productivitesse desktop is better)
- VoiceBridge iOS app becomes unnecessary (Productivitesse Capacitor replaces it)
- VoiceBridge repo stays for the backend server; frontend code archived

## Risks
- R3F 3D rendering on mobile WebGL — may need performance fallback (2D view)
- Voice recording permissions on iOS Capacitor — need to test
- Large component tree on mobile — may need lazy loading for Dashboard tab

## Worktree
Feature team works on: `feature/mobile-merge` branch, port 5184
