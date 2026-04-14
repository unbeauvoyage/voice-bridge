---
title: Rules — Proposal vs Message
date: 2026-04-03
status: proposed
---

# Rules: When Does Something Become a Proposal vs a Message?

**Author:** Command
**Date:** 2026-04-03

## The Distinction

| Type | When to use | CEO action |
|------|-------------|------------|
| **Proposal** | Agent proposes something that needs CEO's explicit decision | Approve / Reject / Do this |
| **Message (Inbox)** | Status update, FYI, completion report, question | Read it / reply if needed |

## Triggers for Proposal Creation

Something becomes a Proposal when it answers YES to ANY of these:
1. **Does it require CEO approval before proceeding?** → Proposal
2. **Is it a new feature, design decision, or architectural change?** → Proposal
3. **Does it involve spending significant team resources?** → Proposal
4. **Would a "no" from CEO stop or change the work?** → Proposal

Examples of **Proposals**:
- "productivitesse proposes building a CEO Inbox tab"
- "Team wants to merge VoiceBridge into Productivitesse"
- "Proposal: use SQLite instead of file system"
- "Design: 3-button action system for proposals"

Examples of **Messages (Inbox)**:
- "DONE — Inbox panel merged, 46/46 tests"
- "Vite cache cleared, dashboard back up"
- "Agent task labels fixed (705204e)"
- "3D hierarchy phase 3+4 complete"

## How Jarvis Should Route

**When agent submits a design/feature suggestion:**
1. Detect: is this asking for CEO approval or just reporting?
2. If approval needed → POST to relay `/proposals` with: `{task: "short title", agent: "ceo", proposedBy: "agent-name"}`
3. CEO sees it in the Proposals panel with Approve/Reject/Do this
4. Also send a relay message to CEO: "productivitesse has proposed: [title] — see Proposals panel"

**When agent reports completion:**
1. Send relay message with `[DONE]` prefix
2. Do NOT create a proposal — this is informational
3. CEO sees it in Inbox

## Acknowledgment Pattern

When Jarvis routes a proposal, always tell CEO explicitly:
> "[Agent] has proposed: [one-line title]. See Proposals panel to approve."

This way CEO knows to look at Proposals, not hunt for it in Inbox.

## Agents Must Self-Classify

When agents complete work, they should send TWO things if applicable:
1. A done message to Inbox: `relay_send(to: "ceo", type: "done", body: "DONE — X")`
2. A proposal if they want CEO input on next steps: `POST /proposals`

They should never mix these — done reports go to Inbox, decision requests go to Proposals.
