# Feature Design Spec Template

All features must complete this template BEFORE coding starts. No worktree, no writer agent, until the spec is approved.

---

## Feature: [Name]

**Status:** Draft | Approved | In Development | Done  
**Priority:** Low | Medium | High | Urgent  
**Author:** [agent]  
**Date:** [date]

---

## Problem / Why

[One sentence: what problem does this solve for CEO?]

---

## Desktop 3D UI (primary experience)

**Where it lives in the 3D view:**  
[Which tab? Which component? Where on screen?]

**What CEO sees:**  
[Describe the visual — list, card, button, overlay, planet label, etc.]

**What CEO can do:**  
- Action 1: [what it does]
- Action 2: [what it does]

**Data source:**  
[Which relay endpoint? Which file?]

---

## Mobile HTML UI (must match feature parity)

**Where it lives in the mobile app:**  
[Which tab? Page layout?]

**What CEO sees:**  
[Describe the HTML view — same data, mobile-appropriate layout]

**What CEO can do:**  
- Action 1: [same as desktop or mobile-equivalent]
- Action 2: [same as desktop or mobile-equivalent]

**Differences from desktop (if any):**  
[What's intentionally different due to form factor? e.g., swipe instead of click]

---

## Feature Parity Checklist

| Capability | Desktop 3D | Mobile HTML |
|------------|-----------|-------------|
| View data  | ✓ | ✓ |
| [action 1] | ✓ | ✓ |
| [action 2] | ✓ | ✓ |

---

## Relay / Data Contract

**Endpoints used:**  
- `GET /[endpoint]` — [what it returns]
- `POST /[endpoint]` — [what it accepts]

**Message types:**  
- `type: "[type]"` — [when sent, what payload]

---

## Acceptance Criteria

- [ ] Desktop: [specific verifiable behavior]
- [ ] Mobile: [same behavior on mobile viewport / Capacitor]
- [ ] Playwright test covers happy path on both viewports

---

## Out of Scope

[What is explicitly NOT in this spec — prevents scope creep]
