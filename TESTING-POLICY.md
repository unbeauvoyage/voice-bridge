# Testing & Review Policy

Mandatory for all teams. No exceptions. Nothing ships untested.

## The Rule

Every feature must pass this pipeline before committing:

```
Code → Review → Build → UI Test → VIP Commit
```

Skip any step = commit rejected.

## Code Review

**Who reviews:** Every team spawns a dedicated reviewer (TeamCreate agent with "reviewer" role). The reviewer:
- Reads the diff before commit
- Checks for: TypeScript errors, security issues (OWASP top 10), missing error handling at boundaries, breaking changes
- Uses `/codex:review` when available (interactive sessions)
- Uses `codex exec` for non-interactive sessions

**When:** Before every VIP commit. No self-review — the person who wrote the code cannot review it.

**Output:** Reviewer approves or requests changes. Changes must be made before proceeding.

## Build Verification

After review approval:
```bash
npm run build          # Must exit 0
npx tsc --noEmit       # Must exit 0 (if TypeScript project)
```

Build failure = no commit. Fix first.

## UI Testing

**Who tests:** Every team spawns a dedicated tester (TeamCreate agent with "tester" role). The tester:
- Writes Playwright tests for every user-visible feature
- Runs full test suite before commit
- Reports: X/Y tests passing, any failures with details

**What to test:**
- Every new UI component renders correctly
- Every interactive element works (click, type, submit)
- Every data display shows real data (not placeholder/empty)
- Every API endpoint returns expected data
- Regression: existing tests still pass

**Tools:**
- **Web/Electron UI:** Playwright (primary)
- **Native desktop interaction:** NutJS (when Playwright can't reach it)
- **Mobile:** Playwright on localhost (Capacitor web layer) + manual device test for native features

**Minimum coverage per commit:**
- New feature = at least 1 Playwright test covering the happy path
- Bug fix = at least 1 test that reproduces the bug and confirms the fix

## VIP Commit

Only after ALL of the above pass:
```bash
git add [specific files]
git commit -m "description"
```

Commit message must include: what was built AND what was tested.

## Team Structure

Each project team should have:
```
Team Lead (writes code, coordinates)
  ├── Engineer(s) (write code)
  ├── Reviewer (reviews all code before commit)
  └── Tester (writes and runs tests)
```

Small teams: reviewer and tester can be the same agent, but NEVER the person who wrote the code.

## Enforcement

- Command checks: did the commit message mention tests? Did Playwright run?
- Productivitesse already has 14+ Playwright tests — this is the standard all teams must match
- Teams that ship untested code get flagged in the morning briefing

## Exceptions

- Documentation-only changes: review required, no UI test needed
- Config/env changes: review required, build verification required, no UI test needed
- Research/agency projects: no UI to test, but findings must be verified (sources checked)
