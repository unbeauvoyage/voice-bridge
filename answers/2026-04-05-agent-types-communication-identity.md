# Complete Agent Architecture: Types, Communication, and Identity Design

**Date:** 2026-04-05T21:32:56
**Author:** system-lead
**Purpose:** Comprehensive study of all agent types in Claude Code, how they communicate, and how to design lean agent identities that ensure every spawned agent knows who it is.

## Source Documentation
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Subagent scope](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope)
- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)
- [Use subagent definitions for teammates](https://code.claude.com/docs/en/agent-teams#use-subagent-definitions-for-teammates)
- [Tools reference](https://code.claude.com/docs/en/tools-reference)
- [Interactive mode — Task list](https://code.claude.com/docs/en/interactive-mode#task-list)
- [Extend Claude Code — Features overview](https://code.claude.com/docs/en/features-overview)

---

## Part 1 — The Four Agent Types

Claude Code has exactly four ways an agent can exist. Understanding these precisely is the foundation for everything else.

### Type 1: Main Session
The CLI instance itself — what you get when you run `claude` or `claude --resume`.

- **Context:** Full conversation history, all project context
- **Tools:** All tools available (per permission mode)
- **Lifetime:** Until you exit or the session ends
- **Communication:** Can spawn subagents, create teams, use relay
- **CLAUDE.md:** Loaded automatically from working directory and ancestors
- **Identity:** Determined by `--agent <name>` flag or defaults to general assistant

**In our system:** command, consul, hq, productivitesse, voice-bridge, etc. are all main sessions launched via `claude --resume`.

### Type 2: Subagent (Agent tool)
An ephemeral worker spawned inside the parent session's process. Has its own context window but shares the parent's permissions.

- **Context:** Own isolated window. Gets ONLY: system prompt (from definition body), CLAUDE.md, git status, and the spawn prompt. Does NOT inherit parent's conversation history.
- **Tools:** Restricted by definition's `tools` field. Inherits all if omitted.
- **Lifetime:** Dies when done. Returns a summarized result to the parent.
- **Communication:** Can ONLY report results back to the parent. Cannot talk to other subagents. Cannot spawn nested subagents.
- **Identity:** From `.claude/agents/{name}.md` if spawned with `subagent_type`, otherwise ad-hoc from prompt.
- **Cost:** Lower — results summarized back, doesn't bloat parent context.

**Key properties:**
- Cannot be messaged after spawning (fire and forget)
- Cannot be kept alive for follow-up questions
- Cannot coordinate with other subagents
- Perfect for: focused reads, research tasks, one-shot analysis

**In our system:** used for atomic lookups (fetch a URL, read a file). Should NOT be used for multi-turn work, investigations, or anything needing follow-up.

### Type 3: Teammate (TeamCreate)
A separate, independent Claude Code instance that's part of a team. Has its own full context and can communicate with all other teammates.

- **Context:** Own full context window. Loads CLAUDE.md from working directory. Gets spawn prompt from lead. If using a subagent definition, gets the definition body APPENDED to system prompt.
- **Tools:** If using a subagent definition, inherits that definition's `tools` allowlist and `model`. Team coordination tools (`SendMessage`, task tools) are ALWAYS available even when `tools` restricts other tools.
- **Lifetime:** Persists until explicitly shut down or team cleaned up.
- **Communication:** Can send messages to any teammate by name. Can send to lead. Can broadcast to all. Messages delivered automatically (no polling).
- **Identity:** From subagent definition if referenced at spawn time, otherwise ad-hoc from lead's prompt.
- **Cost:** Higher — each teammate is a full Claude instance with its own context window.

**Key properties:**
- Shares a task list with all other teammates
- Can self-claim tasks when idle
- Can be messaged directly (Shift+Down in in-process mode, or click pane in split mode)
- ONE team per session — cannot create a second team
- Cannot spawn nested teams (only the lead creates teams)
- Permissions set at spawn time (inherits lead's mode)
- `skills` and `mcpServers` from subagent definition are NOT applied to teammates

**In our system:** used for persistent workers within a project (coders, reviewers, testers, researchers). The team lead session creates them.

### Type 4: Session-Wide Agent (`claude --agent`)
The main session itself takes on a specific agent's identity. The entire session runs with that agent's system prompt, tools, and model.

- **Context:** Full session context, but constrained by the agent definition
- **Tools:** Restricted to the agent definition's `tools` field
- **Lifetime:** Entire session
- **Communication:** All normal session capabilities
- **Identity:** Fully defined by the agent definition file

**In our system:** We could use this for spawning team lead sessions: `claude --agent team-lead --resume $UUID`. This would give team leads their identity automatically from the definition file instead of relying on CLAUDE.md reading.

---

## Part 2 — Communication Between Agent Types

This is the complete map of who can talk to whom and how.

### Native Claude Code Communication

```
Main Session (Lead)
  │
  ├── Agent tool ──→ Subagent ──→ returns result ──→ Main Session
  │                  (one-way, fire-and-forget)
  │
  ├── TeamCreate ──→ Teammate A ◄──► Teammate B
  │                      │              │
  │                      ▼              ▼
  │                  ┌─────────────────────┐
  │                  │   Shared Task List   │
  │                  │  (TaskCreate/Update)  │
  │                  └─────────────────────┘
  │
  └── SendMessage ──→ Teammate (by name)
       ◄── SendMessage ── Teammate → Lead
```

### Communication Matrix (Native)

| From ↓ \ To → | Parent | Subagent | Teammate | Other Teammate | External Session |
|---|---|---|---|---|---|
| **Main (Lead)** | — | Agent tool (spawn) | SendMessage | SendMessage | ❌ None |
| **Subagent** | Return value only | ❌ Cannot | ❌ Cannot | ❌ Cannot | ❌ Cannot |
| **Teammate** | SendMessage | ❌ Cannot | SendMessage | SendMessage | ❌ Cannot |

### Our Relay Communication (Fills the Gap)

Native Claude Code has NO mechanism for communication between separate sessions. Our relay fills this:

```
Session A (command)                    Session B (productivitesse)
  │                                         │
  └── relay_send("productivitesse", msg) ──→│
  │◄── relay_reply("command", response) ────┘
  │
  └── relay_send("consul", msg) ──→ Session C (consul)
```

### Combined Communication Architecture

```
╔══════════════════════════════════════════════════════════════╗
║                    RELAY LAYER                               ║
║   (cross-session: command ↔ consul ↔ hq ↔ productivitesse) ║
║   relay_send / relay_reply / channel plugin                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Session: productivitesse (team lead)                        ║
║  ┌────────────────────────────────────────────┐             ║
║  │  NATIVE TEAM LAYER                         │             ║
║  │  (within session: lead ↔ coder ↔ reviewer) │             ║
║  │  SendMessage / TaskList / broadcast         │             ║
║  │                                             │             ║
║  │  Lead ──→ Coder A (coder.md identity)      │             ║
║  │       ──→ Coder B (coder.md identity)      │             ║
║  │       ──→ Reviewer (code-reviewer.md)      │             ║
║  │       ──→ Tester (tester.md)               │             ║
║  │                                             │             ║
║  │  Shared Task List:                          │             ║
║  │  [x] Implement auth endpoint                │             ║
║  │  [~] Add input validation (Coder A)         │             ║
║  │  [ ] Write tests (blocked by validation)    │             ║
║  └────────────────────────────────────────────┘             ║
║                                                              ║
║  Session: command (manager, no team)                         ║
║  ┌────────────────────────────────────────────┐             ║
║  │  Uses Agent tool for atomic lookups         │             ║
║  │  (Haiku subagents, return and die)          │             ║
║  └────────────────────────────────────────────┘             ║
╚══════════════════════════════════════════════════════════════╝
```

### When to Use Which Communication

| Scenario | Use |
|---|---|
| Manager → Team lead (different sessions) | **relay_send** |
| Team lead → Coder (same session, teammates) | **SendMessage** (native) |
| Coder → Reviewer (same team) | **SendMessage** (native) |
| CEO → Any agent | **relay_send** (via jarvis) |
| Quick lookup, no follow-up needed | **Agent tool** (subagent, returns result) |
| Team coordination within a project | **Shared task list** (TaskCreate/TaskUpdate) |

---

## Part 3 — The Task List System

Claude Code has a built-in task list that we're not using. This is a major missed opportunity.

### How It Works

Tools: `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`
Toggle display: `Ctrl+T`
Shows up to 10 tasks in the terminal status area.

### Task States
- **Pending** — waiting to be started
- **In Progress** — claimed by a teammate
- **Completed** — done

### Task Dependencies
Tasks can depend on other tasks. A pending task with unresolved dependencies CANNOT be claimed until those dependencies complete. The system manages this automatically.

### Task Claiming
- Lead assigns explicitly: "Give task X to teammate Y"
- Self-claim: when a teammate finishes, it picks up the next unassigned, unblocked task
- File locking prevents race conditions when multiple teammates try to claim simultaneously

### Cross-Session Task Sharing
Set `CLAUDE_CODE_TASK_LIST_ID=project-name` to use a named directory in `~/.claude/tasks/`. Multiple sessions can share the same task list.

### Persistence
Tasks persist across context compactions. This is critical — when a teammate's context is compacted, the task list survives. The teammate can check what it was working on.

### How We Should Use Task Lists

**Team leads** should create task lists when spawning a team:
```
Create a task list:
1. Implement auth endpoint (assign to coder-a)
2. Implement user profile endpoint (assign to coder-b)  
3. Add input validation to auth (depends on task 1)
4. Write tests for auth (depends on task 3)
5. Code review all endpoints (depends on tasks 1, 2, 3)
```

This gives teammates:
- Clear work items
- Dependency ordering (no one starts tests before validation is done)
- Self-claiming when idle (no need for lead to manually assign every task)
- Visibility into what's done, what's blocked, what's next

---

## Part 4 — Lean Identity Design

### The Problem

When a team lead spawns a teammate without referencing an agent definition, the teammate gets:
- The lead's spawn prompt (ad-hoc, varies by "mood")
- CLAUDE.md from the working directory (shared rules)
- No structured identity

This produces inconsistent agents. The same "coder" role might get different instructions depending on when the lead spawns it.

### The Solution: Definition = Identity

Every agent definition file IS the identity. The frontmatter defines capabilities. The body defines behavior. Together they are complete and self-contained.

### Design Principles

1. **Frontmatter = what you CAN do** (capabilities, constraints)
2. **Body = who you ARE** (behavior, rules, communication patterns)
3. **CLAUDE.md = what EVERYONE knows** (project rules, shared context)
4. **Keep it short** — under 40 lines of body text. If you need more, you're over-specifying.

### The Lean Identity Template

```yaml
---
name: {role-name}
description: {when Claude should spawn this agent — be specific about the USE CASE}
model: {haiku|sonnet|opus}
tools: {comma-separated tool list, or omit for all}
isolation: worktree        # optional: for coders who need their own branch
memory: project            # optional: for agents that accumulate knowledge
color: {color}             # optional: visual identification
---

You are a **{role}** on the {project} team.

## What You Do
{2-3 bullets: your core responsibilities}

## Rules
{3-5 bullets: constraints and quality expectations}

## Communication
- Report completion to team lead: "DONE — {one sentence}"
- {Who you talk to directly, who you don't}
- Use SendMessage to contact teammates by name
- Check the task list (Ctrl+T) for your assignments

## When You're Done
- Mark your task as completed in the task list
- If you see unblocked tasks you can do, self-claim them
```

### Why This Works

1. **Consistent** — every coder gets the same identity regardless of when they're spawned
2. **Lean** — under 40 lines, fits comfortably in a context window alongside real work
3. **Self-contained** — the agent knows who it is, what it can do, and how to communicate
4. **Capability-constrained** — the `tools` field prevents agents from doing things they shouldn't
5. **Auto-loadable** — team lead says "spawn a coder" and Claude matches the description

### What Goes Where

| Information | Where it lives | Why |
|---|---|---|
| Agent's role and behavior | Agent definition body | Identity should be in the definition, not ad-hoc |
| Project conventions ("use pnpm") | CLAUDE.md | Shared by all agents, loaded automatically |
| Tool restrictions | Definition frontmatter `tools` | Hard constraint, not a suggestion |
| Model selection | Definition frontmatter `model` | Enforced at spawn time |
| Task-specific instructions | Spawn prompt from lead | Changes per task, not part of identity |
| Design system rules | DESIGN-SYSTEM.md | Reference material, not identity |

---

## Part 5 — Complete Agent Definition Set

These are ALL the role definitions our system needs. Each is designed to be lean, complete, and self-contained.

### How Each Tier Gets Its Identity

| Tier | Launched As | Identity Mechanism |
|---|---|---|
| Managers, Consultants, Team Leads | `claude --agent {name}` (persistent session) | `--agent` flag loads definition as session-wide identity |
| Specialists (spawned by managers) | TeamCreate with `subagent_type` | Definition body appended to teammate system prompt |
| Workers (spawned by team leads) | TeamCreate with `subagent_type` | Definition body appended to teammate system prompt |
| One-shots (atomic lookups) | Agent tool (subagent) | Ad-hoc prompt — no definition file needed |

**The rule:** If an agent persists longer than one task OR will ever be consulted by another agent, it MUST have a definition file in `.claude/agents/` and MUST be spawned via `--agent` or `subagent_type`. Only truly ephemeral one-shots (fetch a URL, parse a file) can be ad-hoc.

### Tier 1 — Managers (Haiku, coordinators)

Already exist: `command.md`, `consul.md`, `hq.md`
**Launch:** `claude --agent command --resume $UUID`
Managers route, delegate, and track. They spawn Sonnet/Opus specialists via TeamCreate when deep thinking is needed.

### Tier 2 — Consultants (Sonnet, domain experts)

Already exist: `system-lead.md`, `ux-lead.md`
**Launch:** `claude --agent system-lead --resume $UUID`
Consultants are independent sessions with domain expertise. Other agents consult them via relay. They are NOT teammates inside anyone's team — they're peer sessions.

Note: `communications-lead.md` also fits here — domain expert for relay health.

### Tier 3 — Team Leads (Sonnet, coordinators who spawn teams)

Exists: `team-lead.md` — needs update with team spawning rules.
**Launch:** `claude --agent team-lead --resume $UUID` from the project directory.
Also: `agency-lead.md` — correct for research projects.

### Tier 4 — Specialists (Sonnet/Opus, spawned by managers for thinking tasks)

**New definitions needed.** These are persistent teammates that managers spawn when they need deep work done. A Haiku manager cannot write a proposal — it spawns a Sonnet proposal-writer who does it.

| Definition | Model | Spawned By | Purpose |
|---|---|---|---|
| `proposal-writer.md` | sonnet | Managers | Writes proposals for CEO approval |
| `researcher.md` | sonnet | Managers or team leads | Investigates problems, gathers deep context |
| `investigator.md` | sonnet | Managers | Diagnoses system issues, root cause analysis |

### Tier 5 — Workers (spawned by team leads as teammates)

**These are the missing definitions that cause the identity problem.**

| Definition | Model | Tools | Color | Purpose |
|---|---|---|---|---|
| `coder.md` | sonnet | All | blue | Implements features in assigned worktree |
| `code-reviewer.md` | sonnet | Read, Glob, Grep, LSP | red | Reviews code, finds bugs, no write access |
| `tester.md` | haiku | Read, Glob, Grep, Bash | green | Runs tests, reports PASS/FAIL |
| `researcher.md` | sonnet | Read, Glob, Grep, WebFetch, WebSearch | yellow | Investigates problems, gathers context |
| `designer.md` | sonnet | Read, Write, Edit, Glob | purple | Maintains DESIGN-SYSTEM.md, reviews components |
| `spec-writer.md` | sonnet | Read, Write, Edit, Glob | orange | Writes feature specs after implementation |
| `proposal-writer.md` | sonnet | Read, Write, Edit, Glob, Grep, WebFetch, WebSearch | cyan | Writes proposals for CEO approval (spawned by managers) |

### Tier 5 — Specialized (session-specific)

Already exist: `jarvis.md`, `communicator.md`, `communications-lead.md`
These are special-purpose agents that don't fit the team pattern.

---

## Part 6 — Enforcing "Every Agent Has an Identity"

### The Enforcement Chain

```
CLAUDE.md (every agent reads this)
  └── Rule: "Every teammate MUST be spawned with a subagent definition reference"
  
team-lead.md (every team lead reads this)
  └── Rule: "Always use: Spawn a teammate using the {name} agent type"
  └── Rule: "NEVER describe a role ad-hoc — if no definition exists, create one first"
  └── Rule: "Always create a task list before assigning work"
  
command.md / consul.md / hq.md (managers)
  └── Rule: "When spawning team leads, use: claude --agent team-lead"
  └── Rule: "Know the one-team-per-session limit"
```

### What Needs to Change in Each File

#### 1. `CLAUDE.md` — Add to "TeamCreate vs Agent Tool" section:
```
## Agent Identity Rule
Every teammate MUST be spawned with a subagent definition reference.
"Spawn a teammate using the coder agent type to implement the auth endpoint."
NEVER describe roles ad-hoc. If a definition doesn't exist, create .claude/agents/{role}.md first.
```

#### 2. `team-lead.md` — Add "How to Manage Your Team" section:
```
## Creating Your Team
- Create ONE team per session (hard limit — you cannot create a second)
- Reference agent definitions by name: "Spawn a teammate using the coder agent type"
- NEVER give ad-hoc role descriptions — always reference a definition file
- To add members later: just spawn more teammates, don't delete the team
- To remove a member: ask them to shut down, don't delete the team

## Task Lists (Required)
- Create a task list BEFORE assigning work
- Define dependencies between tasks
- Let teammates self-claim unblocked tasks when idle
- Check task list with Ctrl+T

## Communication Within Your Team
- Teammates talk to each other directly via SendMessage (not through you)
- Coder → Reviewer → Tester is a direct chain
- You only receive status reports, not every detail
- Use broadcast sparingly (tokens scale with team size)
```

#### 3. `command.md`, `consul.md`, `hq.md` — Add spawning knowledge:
```
## Spawning Sessions
- Team leads: spawn with claude --agent team-lead in the project directory
- Team leads create teams, you don't — you delegate to them
- One team per team lead session (hard limit)
- If a team lead needs a fresh team, they must clean up the old one first
```

#### 4. `.claude/settings.json` — Enable agent teams:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

---

## Part 7 — What We Gain

### Before (Current State)
- Agents forget TeamCreate, fall back to subagents
- Teams spawned with ad-hoc roles that vary by mood
- No task lists — leads manually coordinate every assignment
- Leads try to create second teams, fail, delete first team
- Teammates don't know how to message each other
- No identity consistency across spawned agents

### After (With These Changes)
- Every worker role has a definition file with tools, model, and identity
- Team leads spawn by name: "using the coder agent type"
- Shared task lists with dependencies — teammates self-coordinate
- One-team rule is documented — leads add members, don't recreate
- Teammates use SendMessage natively — no relay needed for intra-team comms
- Every spawned agent gets the same identity every time, regardless of who spawned it or when

### The Two-Layer Architecture

```
CROSS-SESSION (our relay)     │  WITHIN-SESSION (native Claude Code)
                              │
command ↔ consul ↔ hq         │  productivitesse lead
command ↔ productivitesse     │    ├── coder-a (coder.md)
command ↔ voice-bridge        │    ├── coder-b (coder.md)
CEO ↔ jarvis ↔ command        │    ├── reviewer (code-reviewer.md)
                              │    ├── tester (tester.md)
Uses: relay_send/relay_reply  │    └── designer (designer.md)
                              │  
                              │  Uses: SendMessage, TaskList, broadcast
```

Relay handles cross-session. Native handles within-team. Clean separation.
