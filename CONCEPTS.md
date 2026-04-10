# System Concepts

Every agent must understand these concepts. They define how work flows, how decisions get made, and how communication happens.

---

## The CEO Is Fire-and-Forget

**This is the most important rule in the system.**

The CEO asks, then moves on. They are managing many teams simultaneously and are not watching any single CLI window. They will not follow up. They will not ask again. They assume it is handled.

**Every result, answer, explanation, or completion MUST be pushed to the CEO.** Never assume they saw your CLI output. Never assume they read a file you wrote. If it matters, it must appear in front of them:
- Completions → relay message `[DONE]` to CEO
- Answers to questions → relay message + write to `~/environment/answers/`
- Explanations of problems → relay message + write to `~/environment/PROBLEM-LOG.md`
- Proposals → dashboard proposals panel + relay notification
- Anything requiring a decision → proposals panel, not just a message

**If you answer only in the CLI, the CEO will never see it.**

This is why we have proposals, Q&A, notifications, the inbox, and the Problem Log. Every system exists to push information to the CEO without requiring them to ask twice.

---

## The Lifecycle

```
CEO idea / observation
        │
        ▼
    BACKLOG           ← rough idea, not yet thought through, no agent assigned
        │
        │  agent picks it up, researches, designs
        ▼
    PROPOSAL          ← concrete plan, ready for CEO decision
        │
   ┌────┼────┐
   ▼    ▼    ▼
APPROVED REJECTED COMMENTED
   │       │         │
   ▼       ▼         ▼
 TASK   ARCHIVED  agent INBOX
   │              (needs-response)
   ▼                   │
 DONE            revised PROPOSAL
```

---

## Concepts

**BACKLOG** — Raw ideas and future work. CEO-owned. No agent has worked on it yet. Lives in `BACKLOG.md`. Sections: Backlog (ideas) → Active (approved, in progress) → Done.

**PROPOSAL** — An agent took a backlog item (or observed something) and came back with a concrete plan. Ready for CEO to decide. Lives in `~/environment/proposals/*.md` and the dashboard Proposals panel. Agents submit via `POST /proposals`.

**TASK** — Approved work, assigned to a team. Created when CEO approves a proposal. Tracked in BACKLOG.md Active section. Owned by a team lead.

**SPEC** — Design document required before coding starts. Both Desktop 3D and Mobile HTML sections required. Lives in `~/environment/specs/`. No worktree or writer until spec is approved.

**ISSUE** — Bug or polish item. No CEO approval needed. Teams pick up autonomously. Lives in `ISSUES.md`.

**MESSAGE** — Communication between agents or to CEO. Every message must declare its type (see below). Type determines how it is displayed and whether CEO attention is required.

**INBOX — Two Zones**

CEO's inbox is split into two visual zones:

**Zone 1 — Needs Your Input** (highlighted, badge count, stays until acknowledged):
These messages require CEO response before work can continue or a question can be resolved.

| Relay type | When to use |
|---|---|
| `waiting-for-input` | Agent is blocked, needs CEO decision to proceed |
| `escalate` | Urgent — crash, security issue, critical blocker |

Sub-types agents must declare in the message body prefix:
- `[EXPLAIN]` — CEO asked "why did X happen?" → answer surfaced here + written to PROBLEM-LOG.md
- `[OPTIONS]` — agent has 2-3 paths, CEO must pick one
- `[BLOCKED]` — agent cannot continue without CEO input
- `[?]` — agent question needing clarification

**Zone 2 — Updates** (dimmed, collapsible, no notification):
These messages are informational. CEO reads if curious, ignores if busy.

| Relay type | When to use |
|---|---|
| `done` | Task completed |
| `status` | Progress update, FYI |
| `message` | General communication, not urgent |

**The rule:** if CEO does not respond, work should still continue. If work cannot continue without CEO response, use `waiting-for-input`. Never send a status as `waiting-for-input` or vice versa.

**EXPLANATION** — A reactive, incident-specific diagnostic. When CEO asks "why did X break?" or "why was Y decision made?":
1. Triggered by a specific incident, failure, or confusion
2. Be sent as `waiting-for-input` with `[EXPLAIN]` prefix so it surfaces prominently
3. Be written to `~/environment/PROBLEM-LOG.md` so it persists permanently (tied to the incident)
4. May lead to a proposal for a systemic fix
- **Different from Q&A** — Explanations are backward-looking (what happened), Q&A is forward-looking (how does this work).
- **Different screen** — Explanations live in Problem Log, not Knowledge Board.

**AGENT INBOX** — Every agent has one. Message types:
- `task` — new work assigned, act on it
- `needs-response` — CEO commented on a proposal, reply expected
- `fyi` — informational, no reply needed
- `blocked` — something is waiting on you

**Q&A** — CEO learning questions, researched by teams. Proactive knowledge-building — "how does X work?", "what is Y?". Question in `~/environment/questions/`, answer in `~/environment/answers/`. Shows in the Knowledge Board. Persists as reference for the future.
- **Different from Explanations** — Q&A builds understanding, Explanations diagnose incidents.
- **Different screen** — Q&A lives in Knowledge Board, Explanations live in Problem Log.
- **Auto-triggered** — the `distill-ceo-message.sh` hook detects "I wonder / curious / I have a question" in CEO messages and creates question files automatically. Agents also trigger manually when they detect curiosity signals.

**DISTILLATION** — The system passively extracts side-effects from CEO conversations without the CEO having to ask explicitly.
- Q&A signal → question file created → researcher assigned → answer linked back
- Design discussion conclusion → agent writes proposal proactively
- End of session → agent self-checks for missed proposals, Q&A entries, PROBLEM-LOG entries
- Implemented via: `distill-ceo-message.sh` hook (zero-token, fires on every CEO message) + agent judgment for subtler signals

**OUTPUT FORMATS** — All system-produced files use frontmatter + markdown body. Frontmatter fields feed dashboard cards (title, summary, status). Body is prose for humans and LLMs.
- Canonical schemas: `~/environment/FORMATS.md`
- `summary` field in frontmatter is mandatory for CEO-facing files — shown on card without clicking
- File map: `~/environment/SYSTEM-MAP.md`

---

## Transition Rules

| Event | What happens |
|-------|-------------|
| CEO approves proposal | PM creates a Task in BACKLOG Active, assigns to team |
| CEO rejects proposal | Proposal archived with rejection reason |
| CEO comments on proposal | Comment goes to proposing agent's inbox as `needs-response` |
| Agent responds to comment | Revised proposal re-submitted, CEO notified |
| Task completed | Agent sends `[DONE]` message to CEO inbox, moves to BACKLOG Done |

---

## What Lives Where

| Thing | Location |
|-------|----------|
| Ideas / future work | `BACKLOG.md` |
| Active tasks | `BACKLOG.md` → Active section |
| Proposals awaiting decision | `~/environment/proposals/` + dashboard panel |
| Bugs and polish | `ISSUES.md` |
| Feature design specs | `~/environment/specs/` |
| CEO questions | `~/environment/questions/` |
| Answers to CEO questions | `~/environment/answers/` |
| Messages | Relay inbox (ephemeral) |
| Agent knowledge files | `~/environment/knowledge/[codebase]/` |

---

## Two Scopes

The environment contains two distinct scopes. Ownership, not file location, determines scope.

**Environment scope** — managers and domain experts. They own the system itself: relay infrastructure, CLAUDE.md files, CONCEPTS.md, data standards, agent architecture.
- Instances: `command`, `atlas`, `sentinel` (managers) + `matrix`/`system-expert`, `signal`/`communications-expert`, `security-expert` (experts)
- Experts are peers to managers — not subordinate. Any agent may consult them directly.
- Experts may run as **persistent Opus sessions** (full retained context, always ready) or be **spawned fresh** by managers. Both modes are valid.

**Project scope** — team leads and their crews. They own one product: features, UI, backend, tests.
- Instances: `productivitesse` (team lead) + coders, designers, spec-writers, testers under it
- Project teams do not have their own domain experts. They escalate upward.
- `~/environment/` is the system folder. Products like productivitesse and the relay server live inside it — but their team leads are still project-scoped, not environment-scoped.

---

## Agent Type vs Instance Name

An **agent type** is a definition file (`.claude/agents/{type}.md`). An **instance name** is a running session.

```
Type:     project-manager    (the definition — model, tools, identity)
Instance: prime              (a specific running session of that type)
```

One type can have many instances: `project-manager` → `command` (Sonnet), `atlas` (Haiku), `sentinel` (Haiku).

### Session Naming Rule — Three Names Must Match

Every session has three visible names. They MUST all be the same **instance name**:

| Name | Set by | Visible in |
|---|---|---|
| Relay agent name | `RELAY_AGENT_NAME={name}` env var | Relay routing, dashboard |
| Session name | `--name {name}` CLI flag | Claude Code mobile app |
| Workspace name | `cmux rename-workspace` | cmux workspace list |

Launch pattern:
```bash
RELAY_AGENT_NAME={name} claude --agent {type} --name {name} --resume $UUID
# Then rename workspace to match:
cmux rename-workspace --workspace "$WS" "{name}"
```

If these diverge: CEO sees wrong names on mobile, relay routes to the wrong place, managers can't find workspaces. **Never allow drift.**

---

## Agent File Format

Every file in `.claude/agents/` MUST have YAML frontmatter or TeamCreate cannot auto-load the agent by name:
```yaml
---
name: agent-name          # lowercase, hyphens, matches filename
description: One sentence — when to use this agent (TeamCreate reads this to select agents)
model: haiku | sonnet     # required — sets the model for this agent type
---
```
Without frontmatter, the file is an unloadable text document. The `description` field is what TeamCreate matches against — make it specific about the use case.

---

## Rules

- Proposals come from agents, not CEO. CEO decides, agents propose.
- No coding until spec is approved (DESIGN-PROCESS.md).
- `[DONE]` messages go to CEO inbox. Proposals go to proposals panel. Never mix.
- Rejected proposals are archived — they don't become backlog items.
- CEO comments on proposals → agent inbox, not a direct interrupt.

---

## Sub-Agent Visibility Rule

Every manager that spawns a sub-agent MUST register it in the relay hierarchy so CEO can see it in the 3D dashboard.

**Before spawning:**
```bash
curl -X POST http://localhost:8765/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name":"[parent]-writer-1","parent":"[your-name]","role":"writer","state":"active"}'
```

**After the agent finishes:**
```bash
curl -X POST http://localhost:8765/agents/[parent]-writer-1/state \
  -H "Content-Type: application/json" \
  -d '{"state":"done"}'
```

No exceptions. CEO watches the 3D view to follow work in progress. An agent that spawns workers without registering them is invisible to CEO.

---

## Agent Responsibilities — Be Proactive

**Agents must actively propose.** If you finish a task and see a better way, a missing feature, a risk, or an opportunity — write a proposal. Do not wait to be asked. CEO's job is to decide, not to discover problems. Your job is to surface them.

**Agents must contribute to Q&A.** When you research something and learn something the CEO would benefit from understanding — add a question + answer to `~/environment/questions/` and `~/environment/answers/`. The Q&A loop is how the CEO builds knowledge about the system. Every agent feeds it.

Examples of when to propose:
- You notice a recurring failure pattern → propose a fix
- You finish a feature and see the next logical improvement → propose it
- You discover a design gap, security issue, or inefficiency → propose a solution
- You complete research and have a clear recommendation → write the proposal

Examples of when to add a Q&A entry:
- You learned how a third-party system works → add it
- You discovered a non-obvious tradeoff → add it
- CEO asked a question verbally and you answered it → write it down so it persists

**Silence is not neutral.** An agent that only does what it's told and never proposes is underperforming. The system improves because agents push it forward.
