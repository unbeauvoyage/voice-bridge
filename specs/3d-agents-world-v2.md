# UX Spec — 3D Agents World v2

**Author:** ux-lead  
**Date:** 2026-04-04  
**For:** productivitesse writer team  
**Status:** Ready to build

---

## What already exists (don't duplicate)

| Thing | Where | Status |
|---|---|---|
| `TopDownCameraController` | `Scene.tsx:279` | EXISTS — ortho, pan/zoom, rotate disabled |
| `PerspectiveCameraController` | `Scene.tsx:~160` | EXISTS — perspective, lerp focus, localStorage save/restore |
| `topDown` state toggle | `Scene.tsx:480` | EXISTS — defaults to `false` (wrong — change to `true`) |
| `buildTreeLayout()` | `Scene.tsx:60` | EXISTS — fixed spacing, no drag |
| `AgentMoonOrbit` | `AgentMoon.tsx:46` | EXISTS — instant unmount bug on empty children |
| Camera localStorage save/restore | `Scene.tsx:loadCameraState/saveCameraState` | EXISTS — only in perspective controller |

---

## Change 1 — Default to Top-Down

**File:** `Scene.tsx:480`

```ts
// BEFORE:
const [topDown, setTopDown] = useState(false);

// AFTER:
const [topDown, setTopDown] = useState(true);
```

That's it. `TopDownCameraController` already works correctly for top-down. Making it the default satisfies CEO ask #2 (top-down by default).

---

## Change 2 — Mouse Button Mapping

**Files:** `Scene.tsx` — both camera controllers.

CEO wants:
- **Left mouse** = pan (translate)
- **Middle mouse** = orbit/tilt  
- **Scroll wheel** = zoom (unchanged)

**In `TopDownCameraController`** (currently has `enableRotate={false}`):
```tsx
<OrbitControls
  enablePan={true}
  enableZoom={true}
  enableRotate={true}           // change: allow tilt via middle mouse
  mouseButtons={{
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: THREE.MOUSE.PAN,
  }}
  minZoom={20}
  maxZoom={200}
  maxPolarAngle={Math.PI / 2.4} // soft limit: prevents flipping to underneath
/>
```

`maxPolarAngle` prevents accidental full-flip. Top-down starts at 0 polar angle; CEO can tilt to ~75° but not flip under the scene.

**In `PerspectiveCameraController`** — add the same `mouseButtons` config to the OrbitControls inside it.

**Touch controls** (iPad):
- One finger = pan (already OrbitControls default for touch)
- Pinch = zoom (already default)
- Two-finger rotate = orbit/tilt (already default for touch)
No change needed for touch — the three.js defaults are correct.

---

## Change 3 — Persistent Camera State for Top-Down Mode

**File:** `Scene.tsx` — `TopDownCameraController`

Currently `TopDownCameraController` does NOT save camera position to localStorage. Add the same `loadCameraState`/`saveCameraState` pattern used in `PerspectiveCameraController`:

```tsx
function TopDownCameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsType>(null);
  
  // Restore on mount
  useEffect(() => {
    const saved = loadCameraState();
    if (saved) {
      camera.position.set(...saved.pos);
      controlsRef.current?.target.set(...saved.target);
      controlsRef.current?.update();
    }
  }, []);

  // Save on change
  // (reuse the existing onChange pattern from PerspectiveCameraController)
  return (
    <>
      <OrthographicCamera makeDefault position={[0, 20, 0]} rotation={[-Math.PI/2, 0, 0]} zoom={55} near={0.1} far={100} />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }}
        maxPolarAngle={Math.PI / 2.4}
        minZoom={20}
        maxZoom={200}
        onChange={() => {
          if (controlsRef.current) saveCameraState(camera.position, controlsRef.current.target);
        }}
      />
    </>
  );
}
```

`loadCameraState` and `saveCameraState` already exist in Scene.tsx — reuse them directly.

---

## Change 4 — Draggable Planet Positions

This is the largest change. Positions are currently computed by `buildTreeLayout()` and immutable.

### Architecture

Introduce a `pinnedPositions` map stored in localStorage: `Map<agentId, [x, y, z]>`. When a planet is dragged, its new world position is stored here. On re-render, `buildTreeLayout()` computes the base layout, then `pinnedPositions` overrides specific planets. All children of a dragged parent shift by the same delta.

```ts
// New localStorage helpers (add to Scene.tsx):
function loadPinnedPositions(): Record<string, [number,number,number]> {
  try { return JSON.parse(localStorage.getItem('planet-pins') ?? '{}'); } catch { return {}; }
}
function savePinnedPositions(pins: Record<string, [number,number,number]>) {
  try { localStorage.setItem('planet-pins', JSON.stringify(pins)); } catch { }
}
```

### Effective position computation

```ts
const pinnedPositions = useMemo(() => loadPinnedPositions(), []); // load once

const positions = useMemo(() =>
  agents.map(a => {
    const base = posMap.get(a.id.toLowerCase()) ?? [0,0,0] as [number,number,number];
    const pin = pinnedPositions[a.id.toLowerCase()];
    return pin ?? base;
  }),
  [agents, posMap, pinnedPositions]
);
```

When a boss planet is dragged, all agents whose `getParent()` chain leads to it shift by the same delta. (Apply delta to all children in `pinnedPositions`.)

### Drag interaction on AgentPlanet

Add `onDragEnd?: (agentId: string, newPos: [number,number,number]) => void` prop to `AgentPlanet`.

Drag detection:
- `onPointerDown` → set isDragging = true, capture pointer
- `onPointerMove` → if isDragging, raycast mouse position onto the XZ plane (y=0) → newPos
- `onPointerUp` → save to pinnedPositions, call onDragEnd, release pointer capture

**Prevent orbit during drag:** call `e.stopPropagation()` on pointerDown when starting drag. This prevents OrbitControls from picking up the event.

### Snap grid

Grid unit: **0.5 world units**. On drag end, snap position to nearest grid point:
```ts
function snap(v: number, grid = 0.5): number {
  return Math.round(v / grid) * grid;
}
const snapped: [number,number,number] = [snap(newPos[0]), newPos[1], snap(newPos[2])];
```

**Visual feedback during drag:** Render a faint dot grid on the XZ plane while any drag is in progress. Use `instancedMesh` for performance (one draw call for ~200 grid dots). Dots should be `rgba(255,255,255,0.06)`, radius 0.04, at y=-0.1 (just below planets). Hide when no drag active.

### Reset Layout button

Add a "Reset Layout" button in the Scene overlay (near the existing top-down toggle). Clicking it:
1. Calls `localStorage.removeItem('planet-pins')`
2. Triggers re-render (force state update)

This restores all planets to computed tree layout.

---

## Change 5 — iPad Responsive Layout

**Problem:** `MAX_WIDTH = 13` and `LEVEL_Y` spacings are fixed. On iPad (~768px), the scene container may be narrower and planets at the extremes clip out of view.

**Fix in `buildTreeLayout()`:**

Pass viewport width to the function and scale `MAX_WIDTH` accordingly:

```ts
function buildTreeLayout(agentIds: string[], viewportWidth = 1440): Map<string, [number,number,number]> {
  // Scale max width: full desktop = 13, iPad portrait = 8, iPad landscape = 11
  const MAX_WIDTH = viewportWidth < 768 ? 7 : viewportWidth < 1024 ? 9 : 13;
  // ...rest unchanged
}
```

In `SceneContent`, pass `window.innerWidth` to `buildTreeLayout` (or derive from a hook). Recompute when window resizes (debounced).

**Camera auto-fit on load (top-down):** When `TopDownCameraController` mounts for the first time (no saved camera state), compute the bounding box of all planet positions and set the orthographic zoom to fit all planets with 20% padding. Formula:
```ts
const bbox = {
  minX: Math.min(...positions.map(p => p[0])),
  maxX: Math.max(...positions.map(p => p[0])),
  minZ: Math.min(...positions.map(p => p[2])),
  maxZ: Math.max(...positions.map(p => p[2])),
};
const span = Math.max(bbox.maxX - bbox.minX, bbox.maxZ - bbox.minZ);
const zoom = (viewportWidth * 0.8) / (span + 4); // 4 = padding in world units
```

Pass `positions` to `TopDownCameraController` for this calculation.

---

## Change 6 — Moon Disappear Fix

**File:** `AgentMoon.tsx:46`

**Root cause:** `if (children.length === 0) return null` — instant unmount with no animation. When an agent is removed, `agentHierarchy` updates → children array becomes empty → moon group vanishes.

**Fix:** Use a `previousChildren` ref to keep the last non-empty children list alive during an exit animation:

```tsx
export function AgentMoonOrbit({ parentPosition, children }: AgentMoonOrbitProps) {
  const [displayChildren, setDisplayChildren] = useState(children);
  const [exiting, setExiting] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (children.length > 0) {
      // New children arrived — stop any exit, update display
      clearTimeout(exitTimer.current);
      setExiting(false);
      setDisplayChildren(children);
    } else if (displayChildren.length > 0 && !exiting) {
      // Children gone — trigger exit animation, unmount after 400ms
      setExiting(true);
      exitTimer.current = setTimeout(() => setDisplayChildren([]), 400);
    }
    return () => clearTimeout(exitTimer.current);
  }, [children]);

  if (displayChildren.length === 0) return null;

  // Pass exiting to the group for opacity fade-out
  return (
    <group
      ref={groupRef}
      position={parentPosition}
      // Fade out opacity when exiting
      // Note: use useFrame to animate opacity on material, or wrap in a CSS-like fade
    >
      {/* ... existing moon rendering, with opacity * (exiting ? 0 : 1) lerped via useFrame */}
    </group>
  );
}
```

For the fade: add an `opacity` ref, `useFrame` lerps it toward 0 when `exiting === true`. All moon materials use this `opacity` multiplier via `transparent + opacity`. Exit duration: 400ms.

---

## What NOT to build (out of scope)

- Grouping UI (visual box around a team) — out of scope v2
- Labels on org-link lines — out of scope
- Mini-map overview — out of scope
- Agent-to-agent drag (drag one agent under a different parent) — out of scope; use relay for hierarchy changes
- Tester agent setup — productivitesse owns this; not a UX spec concern

---

## Acceptance Criteria

- [ ] Default camera is top-down on first load
- [ ] Left mouse = pan; middle mouse = orbit/tilt; scroll = zoom (both camera modes)
- [ ] `maxPolarAngle` prevents flipping under the scene
- [ ] Camera position persists across refresh in top-down mode
- [ ] All planets visible on 768px-wide viewport without horizontal overflow
- [ ] Auto-fit zoom on first load (no saved state) fits all agents with padding
- [ ] Dragging a planet saves its position to localStorage
- [ ] Dragging a boss planet moves all its children by the same delta
- [ ] Positions restored from localStorage on refresh
- [ ] Snap-to-grid (0.5 units) on drag release
- [ ] Faint dot grid visible only during active drag
- [ ] "Reset Layout" clears pinned positions and restores computed layout
- [ ] Moons fade out over 400ms when agent is removed (no instant disappear)
- [ ] Moons reappear (fade in) if agent is re-added
