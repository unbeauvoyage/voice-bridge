# Feature Design Spec: Extension Favorite-Star Action

**Status:** Draft  
**Priority:** High  
**Author:** phase4-coder-a  
**Date:** 2026-04-15  
**Project:** knowledge-base

---

## Problem / Why

The Chrome extension is the CEO's primary interface for the knowledge-base app. Currently, the extension modal can rate items (1-5 stars) and perform basic actions (tag, archive, delete), but cannot favorite/star items — a core workflow in the web app.

CEO needs to quickly mark items as favorites (one-click) without navigating to the web app. Favorite status should persist and be visible in both extension and web.

---

## Current State (what exists)

**Web app:**
- Star/favorite toggle available on every item (reader header, list filter by "most-starred")
- Mutation: `PATCH /items/:id { starred: boolean }`
- Query: `useToggleStarMutation()` invalidates items query on success
- Visual: filled/outline star icon, toggles on click
- Filtering: "Starred" filter shows only favorited items

**Extension:**
- Modal displays item detail (title, summary, TLDR, sections)
- Available actions: rate (1-5 stars), tag, archive, note, delete
- No favorite/star toggle
- Rating stars (1-5) are separate from favorite flag

---

## Target UX

### Extension Modal Header

**What CEO sees:**
- Item title at top
- Action buttons in header: **favorite icon** (outline when unfavorited, filled when favorited), rating stars, archive, delete
- Favorite icon positioned left of rating stars, similar visual weight

**What CEO can do:**
- Click favorite icon to toggle starred status
- Icon fills/unfills on click with visual feedback
- No modal close required; stays open for more actions
- Starred state persists immediately (optimistic update, confirmed by API)

### Parity with Web

| Capability | Web App | Extension |
|------------|---------|-----------|
| Toggle favorite | ✓ (star icon) | ✓ (star icon, same position/style) |
| Persist to DB | ✓ | ✓ (same API) |
| Visual feedback on click | ✓ (icon animates) | ✓ (icon animates) |
| Reflect in list | ✓ (filter/sort) | ✓ (reload updates list badge) |
| Cache invalidation | ✓ (React Query) | ✓ (invalidate items, collections) |

---

## Acceptance Criteria

1. **Action exists:** Extension modal header includes a favorite-star toggle (outline icon when false, filled when true)
2. **Click toggles state:** Click toggles starred status in UI immediately (optimistic)
3. **API persists:** PATCH sent to `/items/:id { starred: boolean }` on click
4. **Parity:** Icon style, position, animation match web app exactly
5. **No interruption:** Modal stays open after toggle; CEO can perform other actions
6. **Error recovery:** If API fails, state reverts with error toast; retry available
7. **Badge updates:** List view updates item's starred badge on modal close

---

## Out of Scope

- Rating stars (1-5) — separate feature, not affected
- Web app changes — this spec only covers extension
- Favorites collection or saved-search UI — extension lists favorites via existing filter
- Keyboard shortcuts — touch/click only

---

## Test Strategy

**File:** `tests/extension-favorite.spec.ts` (named by capability: "toggling favorite in extension modal")

**Test coverage:**
1. **Modal opens:** Extension modal renders with item detail (setup for all tests)
2. **Star icon visible:** Favorite icon appears in header, starts unfilled for unstarred item
3. **Click toggles UI:** Clicking star fills the icon (optimistic)
4. **API call sent:** Click triggers PATCH with `{ starred: true }`
5. **Success updates:** API returns 200; icon remains filled; items query invalidates
6. **Error reverts:** API returns 500; icon reverts to outline; error toast appears
7. **Starred item shows filled:** Open a pre-starred item; icon is already filled
8. **Accessibility:** Star icon has aria-label, keyboard focusable
9. **List reflects:** Close modal after toggle; refresh extension; list shows updated starred badge

---

## Implementation Notes

**Hook:** Reuse `useToggleStarMutation()` from web/src/data/apiClient (works in extension via shared API)

**Component location:** `web/chrome-extension/src/components/ItemModal.tsx` (existing component)

**State management:** React Query cache (same as web) — no new state needed

**Icon:** Use existing star SVG from web UI kit (outline/filled states)

**Visual feedback:** Icon animation on toggle (0.2s fill, same as web)

