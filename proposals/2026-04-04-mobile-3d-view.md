---
title: "3D Agent View on Mobile — Touch-Friendly Tab with Bottom Sheet Detail"
proposedBy: ux-lead
agent: productivitesse
status: pending
ts: 2026-04-04T07:27:35
---

# 3D Agent View on Mobile — Touch-Friendly Tab with Bottom Sheet Detail

**Submitted:** 2026-04-04T07:27:35  
**Scope:** MobileLayout + Scene + AgentPlanet — mobile-specific behavior layer

---

## What Exists Today

The 3D scene (`Scene.tsx`) already has meaningful mobile awareness:
- Star count: 800 on mobile vs 2500 on desktop
- Post-processing (Bloom, ChromaticAberration): **disabled on mobile** via `enablePostprocessing()`
- DPR cap: 2.0 on mobile vs 3.0 on desktop
- `OrbitControls` in `Scene.tsx`: already supports **pinch-to-zoom and drag-to-pan via touch** — no additional code needed for basic touch navigation
- HoloPanelLeft/Right: already accept a `visible` prop — set to `false` and they render `null`

The only thing missing: `MobileLayout.tsx` never mounts the `Scene` at all. The agents tab exists on desktop but the mobile layout's 5-tab definition (`voice | dashboard | inbox | knowledge | requests`) omits it entirely.

**This means the full 3D infrastructure is already tuned for mobile — it just needs to be exposed.**

---

## Design

### 1. New Tab: "Agents" in MobileLayout

Add `'agents'` to the `Tab` union and insert it in the bottom tab bar.

Icon: `"✦"` (or a simple grid/node icon) — distinct from dashboard `"⬡"`.  
Label: `"Agents"`

Tab order recommendation (6 tabs):
```
Voice | Dashboard | Agents | Inbox | Knowledge | Requests
```

At 375px, 6 tabs = 62.5px each. Tab labels will be short (`"Agents"` = 6 chars). Font at 10px fits cleanly.

### 2. Mobile Scene: Stripped Layout

When `activeTab === 'agents'` in MobileLayout, render a full-screen container with the Scene:

```tsx
{activeTab === 'agents' && (
  <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
    <Scene mobile />
  </div>
)}
```

`Scene.tsx` receives an optional `mobile` prop. In mobile mode:
- `HoloPanelLeft` and `HoloPanelRight`: `visible={false}` (already supported)
- `EventLog`: **not rendered** (it's mounted below the scene in the desktop agents tab layout, not in Scene itself — desktop `App.tsx` adds it; mobile never would)
- Camera toggle button: repositioned from `top: 12, right: 12` to a bottom control strip

### 3. Bottom Control Strip (mobile only)

Instead of a top-right floating button, mobile gets a centered strip at the bottom (above the tab bar):

```
┌─────────────────────────────────────────┐
│           3D SCENE CANVAS               │
│                                         │
│  [planet]    [planet]                   │
│        [planet]                         │
└─────────────────────────────────────────┘
  [ ⟳ Reset ]   [ 3D | Top ]   [ List ▾ ]
   bottom strip — above tab bar
```

Three buttons:
- **Reset**: returns camera to default position (tapping when disoriented is common on mobile)
- **3D | Top**: toggle between perspective and orthographic, same as current desktop button
- **List ▾**: opens agent list as a scrollable overlay (alternative to tapping planets, for when CEO wants to jump directly to an agent)

Strip height: 44px. Positioned above the bottom tab bar.

### 4. Agent Detail — Bottom Sheet (replaces HoloPanelRight)

On desktop, tapping a planet opens `HoloPanelRight` with agent details. On mobile, no side panel fits. Instead: **a bottom sheet slides up from the bottom edge**.

Bottom sheet contents (same data as `AgentDetailPanel` in HoloPanelRight):
- Agent name + color dot
- Status indicator
- Current task (full text, scrollable)
- Last 3 messages (from/to summary)
- "Open in Messages" button (switches to messages tab with that agent filtered)

Sheet behavior:
- Slides up with a spring animation (200ms)
- Drag handle at top (same as mobile drag-pill pattern already in `mobile.css`)
- Swipe down or tap backdrop to close
- Height: ~50% of viewport (or taller if agent has much content)
- Deselect (clear `selectedAgentId`) when closed

Implementation note: `useStore`'s `selectedAgentId` state is already the trigger. A `MobileAgentSheet` component listens to `selectedAgentId` and renders the sheet when non-null. Positioned `fixed` at bottom, z-index above the 3D canvas.

### 5. AgentPlanet Touch Behavior — Tap Instead of Hover

`AgentPlanet.tsx` currently shows the task expansion card on `onMouseEnter` / `onMouseLeave`. On mobile, hover does not fire.

Two changes:
1. Task expansion: triggered by tapping the compact task pill (already has `pointerEvents: 'auto'`). State change: `setTaskExpanded(v => !v)` on `onClick` of the pill element.
2. The expanded card is `position: absolute` above the planet — on mobile this may render behind the canvas or off-screen. Recommend: on mobile, skip the expanded hover card entirely and let the bottom sheet show the full task. The compact pill (truncated to 160px) is sufficient in the 3D view; full detail lives in the sheet.

Conditional: if `isMobile()` → disable hover expand, don't render the expanded `div`. The bottom sheet is the expansion surface.

---

## Performance Assessment

| Metric | Desktop | Mobile (current, but hidden) | Mobile (exposed) |
|--------|---------|------------------------------|-----------------|
| Stars | 2500 | 800 | 800 |
| Post-processing | Bloom + CA | OFF | OFF |
| DPR | up to 3× | capped 2× | capped 2× |
| Planet count | all agents | same | same |
| Touch controls | mouse | OrbitControls touch ✓ | OrbitControls touch ✓ |

No additional performance work is required. The existing mobile tuning is sufficient. If agent count grows beyond ~20, planet labels may cluster — but that's a future tree-layout problem, not a mobile-specific one.

---

## Implementation Scope

| File | Change |
|------|--------|
| `MobileLayout.tsx` | Add `'agents'` tab, mount `Scene` in full-screen div |
| `Scene.tsx` | Accept `mobile?: boolean` prop; swap top-right button for bottom strip; pass `visible={false}` to HoloPanels in mobile mode |
| `AgentPlanet.tsx` | Disable hover expand on mobile; tap-to-select only |
| New: `MobileAgentSheet.tsx` | Bottom sheet component, renders when `selectedAgentId` is set on mobile |
| `mobile.css` | Bottom strip styles, sheet animation |

No relay, store, or backend changes required.

---

## What's Deliberately Out of Scope (v1)

- EventLog on mobile (raw system logs — low CEO value on phone)
- AgentLink active-message animations on mobile (visual complexity without interaction value)
- Moons (sub-agent orbits) on mobile — too small to tap meaningfully. Show planet only; sub-agents visible in the bottom sheet's agent detail.
- Top-down orthographic mode on mobile — available via the toggle but not the default view.
