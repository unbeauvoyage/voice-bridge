# Design Process

## Rule: Spec Before Code

No writer agent is spawned, no worktree is created, until a design spec is approved.

## The Gate

```
Idea → Design Spec (DESIGN-SPEC-TEMPLATE.md) → CEO Approval → Feature Team
```

**Not:**
```
Idea → Feature Team → "oh we forgot mobile"
```

## Who Writes the Spec

- **Command** writes specs for system/infrastructure features
- **Productivitesse team lead** writes specs for UI features
- **Jarvis** submits CEO questions and uncertainties as spec stubs

Specs go to: `~/environment/specs/[feature-name].spec.md`

## What Makes a Spec "Done"

1. Both Desktop 3D and Mobile HTML sections are filled out
2. Feature parity checklist is complete (no blanks)
3. Relay/data contract is defined
4. Acceptance criteria are written as testable statements

## Two-UI Parity Rule

Every user-facing feature ships on BOTH:
- **Desktop:** 3D React Three Fiber view (primary on mac browser + Electron)
- **Mobile:** HTML page in bottom tab navigation (primary on iPhone Capacitor app)

If the mobile version is "just a list view" of the same data with the same actions, that's fine. The goal is not visual identical — it's **feature identical**. CEO should be able to do the same things on phone as on desktop.

## Retrofitting is Forbidden

If a feature ships on desktop-only, it must be treated as incomplete. It stays in ISSUES.md as open until mobile parity is done. No "we'll add mobile later" — spec it upfront.

## Example: Inbox Feature (what went wrong)

- Desktop: Inbox tab with reply capability  
- Mobile: No inbox tab, no reply  
- Result: CEO tries to reply on phone, can't, gets confused

**Correct process would have been:**
1. Write spec with both Desktop (Inbox tab, reply button) and Mobile (Inbox page, inline reply)
2. Get approval
3. Spawn one writer that implements BOTH at once

## Spec Review

Team leads review specs before submitting to CEO:
- Does it solve the actual problem?
- Are both UIs designed?
- Is the data contract clear?

Command reviews for system impact (relay changes, new endpoints).

CEO approves or requests changes. Then work begins.
