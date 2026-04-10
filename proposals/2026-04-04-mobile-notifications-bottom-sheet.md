---
title: "Mobile Notifications — Bottom-Sheet Cards, Swipe-Up to Dismiss"
proposedBy: ux-lead
agent: productivitesse
status: approved
ts: 2026-04-04T07:27:35
---

# Mobile Notifications — Bottom-Sheet Cards, Swipe-Up to Dismiss

**Submitted:** 2026-04-04T07:27:35  
**Scope:** `NotificationStack.tsx` — mobile-specific rendering path

---

## Current Problem on Mobile

`NotificationStack.tsx` renders with:
```ts
position: 'fixed',
bottom: 80,
right: 24,
width: 308,
```

On a 375px iPhone:
- **Width overflow**: 308px card + 24px from right = card left edge at 43px from left. Passes, barely. On 320px devices (iPhone SE), it clips.
- **Tab bar collision**: `bottom: 80` assumes 80px clearance. The mobile tab bar is `~60px content + ~34px safe area inset = ~94px total`. At `bottom: 80`, the notification card sits **behind the tab bar** — tapped buttons on the card are intercepted by tab buttons.
- **Card deck stacking**: The offset stacking pattern (`translateY(-4px) translateX(-2px) scale(0.97)`) creates a visually complex layered effect that's appropriate on desktop but adds cognitive load on a 375px screen where every pixel counts.
- **Right-anchored**: Thumb reach zone on a right-handed user is bottom-center to bottom-right. A right-anchored card at 308px means the "Reply" button (left side of the card) is at the far left of the screen — hardest to reach.
- **Dismiss button ✕**: Positioned top-right of the card. On mobile, the top-right corner of a notification card is the most thumb-hostile location.

---

## Proposed Mobile Design

### Layout

Full-width card, centered, positioned **above the tab bar**:

```
┌──────────────────────────────────────────┐
│                                          │  ← full viewport
│                                          │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │  ▬▬▬  (drag handle)                  │ │  ← notification card
│ │  command  [DONE]           × dismiss  │ │
│ │  Task completed: wrote 3 files…       │ │
│ │  [Reply]            [Inbox →]         │ │
│ └──────────────────────────────────────┘ │
│         +2 more  ↑                       │  ← badge
└────[Voice]──[Dashboard]──[Inbox]─────────┘  ← tab bar
```

Card dimensions:
- Width: `calc(100vw - 32px)` — 16px margin each side
- Position: `bottom: calc(tabBarHeight + env(safe-area-inset-bottom) + 12px)`
- Border radius: `16px 16px 8px 8px` (more rounded at top, consistent with iOS sheet language)

Tab bar height: The tab bar doesn't have a fixed JS-accessible height. Recommend: CSS variable `--tab-bar-height: 60px` set on the root, used in the notification positioning. Or: render notification inside the tab bar's sibling flow (in `MobileLayout`), above the tab bar div, so DOM order handles the spacing automatically.

### Drag Handle

A `4×36px` pill at the top-center of the card (same pattern as `mobile__drag-pill` in `mobile.css`):
```css
.mobile-notif__handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255,255,255,0.2);
  margin: 8px auto 0;
}
```

Visual affordance: CEO sees the pill and knows to swipe. No instruction needed.

### Swipe-Up to Dismiss

Touch gesture handler on the card:
```
onTouchStart → record startY
onTouchMove  → compute dy = currentY - startY
               if dy < 0 (swipe up): translateY(dy) with dampening (dy * 0.6)
               if dy > 0 (swipe down): translateY(dy * 0.3) — slight resistance
onTouchEnd   → if dy < -60: dismiss (slide card off top)
               if dy > 40:  minimize (future — for now, same as dismiss)
               else: snap back to origin
```

Dismiss animation: `translateY(-100vh)` with `transition: transform 0.25s ease-in`.  
Return animation: `translateY(0)` with `transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)`.

**Why swipe up?** iOS native notifications use swipe-left to clear, but swipe-up is consistent with iOS sheet dismiss (bottom sheets dismiss by swiping down, but notifications — which come from top — dismiss by swiping up). For bottom-origin cards, swipe-up = "send away" which is spatially intuitive.

### Single Card + "+N more" Badge

No stacking on mobile. **One card at a time** (the most urgent one — same urgency sort from the notification escalation proposal):

```
escalate > waiting-for-input > status/message > done
```

If N more notifications exist: a small badge **below** the card:
```
┌─────────────────────────────────────┐
│  [notification card]                │
└─────────────────────────────────────┘
         +2 more — tap Inbox
```

Tapping "+N more" navigates to the Inbox tab and dismisses the card. This is the right behavior — multiple pending notifications means CEO should review the inbox, not cycle through a stack one by one.

**No left/right swipe-to-cycle**: Adds gesture conflict (left/right has no intuitive meaning for notifications vs tab navigation). Keep it simple: see most urgent, handle it or go to Inbox.

### Action Buttons — Thumb-Zone Optimized

Current desktop card:
```
[ Reply ]  [ Inbox ]  [ Dismiss ]    ← three equal buttons
```

Mobile card (thumb zone = bottom of screen, center-right):
```
[ Reply ──────────── ] [ → Inbox ]
```

Two buttons only, full-width row:
- **Reply** (wider, left): opens inline quick-reply textarea below card
- **→ Inbox** (shorter, right): jumps to inbox + dismisses

"Dismiss" is replaced by the swipe-up gesture. An ✕ button is retained but repositioned to the card header (alongside agent name) where it doesn't compete with the action buttons.

### Inline Reply on Mobile

When "Reply" is tapped:
- Card expands downward to show a `<textarea>` + send button
- Keyboard slides up; the card stays above keyboard (use `position: fixed` with `bottom` adjusted when keyboard is visible via `visualViewport` API or `window.addEventListener('resize')`)
- Send → reply sent, card dismissed

### Urgency Color

`escalate` notifications: card border-left becomes `4px solid #ff6b6b` (red accent). No other styling change — the type badge already shows `ESCALATE` in red. The border provides an instant glanceable urgency signal even before CEO reads the text.

`waiting-for-input`: `4px solid #ffd700` (gold).

`done` / `message`: no border accent (or `1px solid rgba(255,255,255,0.1)`).

---

## Implementation

### Where to Add

The `NotificationStack` component currently has no mobile/desktop branching. Two options:

**Option A: Single component, platform-branched rendering**
```tsx
export function NotificationStack() {
  const mobile = useIsNarrowScreen(); // or isMobile()
  if (mobile) return <MobileNotificationCard ... />;
  return <DesktopNotificationStack ... />;
}
```

**Option B: Separate `MobileNotificationCard` mounted in `MobileLayout`**
MobileLayout already wraps everything. It can mount a `<MobileNotificationCard />` above the tab bar div:
```tsx
<div style={{ flex: 1, overflow: 'hidden' }}>
  {/* active tab content */}
</div>
<MobileNotificationCard />   ← above tab bar in DOM
<div style={tabBar}>         ← tab bar
  ...
</div>
```

**Recommendation: Option B.** The desktop `NotificationStack` is positioned `fixed` and untouched. The mobile card is DOM-ordered naturally above the tab bar — no z-index fighting, no `bottom` calculation headaches. Clean separation.

### `MobileNotificationCard` Props

Receives same data from store as `NotificationStack`:
```ts
const notifications = useStore((s) => s.notifications); // sorted by urgency
const topNotif = notifications[0]; // most urgent
const overflowCount = notifications.length - 1;
```

### CSS

Add to `mobile.css`:
```css
@keyframes mobileNotifSlideUp {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
.mobile-notif { animation: mobileNotifSlideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
```

---

## Auto-Dismiss on Mobile

`done` notifications: **auto-dismiss after 5s** on mobile. CEO is glancing at the screen; they don't need to manually clear every "Task complete" card.

`waiting-for-input` / `escalate`: **never auto-dismiss** on mobile. CEO must explicitly swipe or tap Inbox.

This default is different from desktop where auto-dismiss is opt-in. On mobile, the tab bar and screen space mean persistent done-cards create more friction than value.

---

## Summary of Differences from Desktop

| Aspect | Desktop | Mobile |
|--------|---------|--------|
| Position | fixed bottom-right, 308px wide | above tab bar, full width |
| Stack | 3-card deck offset | single card |
| Dismiss | ✕ button | swipe up |
| Overflow | "+N more" badge | "+N more → Inbox" button |
| Auto-dismiss | off by default | on for `done` |
| Urgency visual | type badge color | border-left color stripe |
| Reply | inline expand on notification | inline textarea, keyboard-aware |
| Settings | ⚙ gear menu | removed (settings in voice page) |
