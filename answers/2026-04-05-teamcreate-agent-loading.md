# How Subagents, Agent Teams, and TeamCreate Work in Claude Code

**Date:** 2026-04-05T21:27:17
**Updated from:** CEO Q&A on TeamCreate agent loading + deep study of official docs

## Source Documentation
- [Create custom subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Choose the subagent scope](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope)
- [Use subagent definitions for teammates](https://code.claude.com/docs/en/agent-teams#use-subagent-definitions-for-teammates)
- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams)

---

## Part 1 — Two Distinct Systems

Claude Code has **two** parallel work systems. They are NOT interchangeable.

### Subagents (the Agent tool)
- Run **inside** the parent session's process
- Have their own context window but share the parent's permissions
- **Cannot** message each other — only report results back to the caller
- **Cannot** spawn other subagents (no nesting)
- Results are summarized back to the parent, preserving parent's context
- Die when done — ephemeral by design
- Lower token cost

### Agent Teams (TeamCreate / teammates)
- Each teammate is a **separate Claude Code instance** (own process, own context)
- Share a **task list** — teammates claim and complete tasks
- **Can** message each other directly (via mailbox, not relay)
- Have a **team lead** (the session that created them) who coordinates
- Persist until explicitly shut down or team is cleaned up
- Higher token cost (each teammate has full context window)
- **Experimental** — requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings

### The Critical Difference
| | Subagents | Agent Teams |
|---|---|---|
| Communication | Results back to parent only | Teammates talk to each other |
| Coordination | Parent manages everything | Shared task list, self-coordination |
| Lifetime | Dies when done | Persists until shutdown |
| Best for | Focused tasks, result is all that matters | Complex work requiring discussion/collaboration |
| Context | Own window, results summarized to parent | Own window, fully independent |

---

## Part 2 — Subagent Definitions (the .md files in .claude/agents/)

### Required YAML Frontmatter

```yaml
---
name: code-reviewer          # lowercase + hyphens, must be unique
description: When Claude should delegate to this agent  # CRITICAL field
model: sonnet                # sonnet | opus | haiku | inherit | full-model-id
---

System prompt goes here in markdown.
This becomes the agent's instructions.
```

### All Supported Frontmatter Fields

| Field | Required | What it does |
|---|---|---|
| `name` | **Yes** | Unique ID — used in `subagent_type`, `@agent-name`, `--agent name` |
| `description` | **Yes** | When Claude should delegate — this is the auto-selection trigger |
| `tools` | No | Allowlist of tools (e.g. `Read, Glob, Grep, Bash`). Inherits all if omitted |
| `disallowedTools` | No | Denylist — removed from inherited or specified tools |
| `model` | No | Model to use. Defaults to `inherit` (parent's model) |
| `permissionMode` | No | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | No | Max agentic turns before subagent stops |
| `skills` | No | Skills injected at startup (full content, not just names) |
| `mcpServers` | No | MCP servers available to this subagent (inline or reference) |
| `hooks` | No | Lifecycle hooks scoped to this subagent |
| `memory` | No | Persistent memory: `user`, `project`, or `local` |
| `background` | No | `true` = always run in background |
| `effort` | No | `low`, `medium`, `high`, `max` (Opus only) |
| `isolation` | No | `worktree` = run in temporary git worktree (auto-cleaned if no changes) |
| `color` | No | Display color: `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` |
| `initialPrompt` | No | Auto-submitted as first turn when used with `--agent` |

### Scope Priority (highest wins)

| Priority | Location | Scope |
|---|---|---|
| 1 (highest) | Managed settings | Organization-wide |
| 2 | `--agents` CLI flag | Current session only |
| 3 | `.claude/agents/` | Current project |
| 4 | `~/.claude/agents/` | All projects for this user |
| 5 (lowest) | Plugin `agents/` directory | Where plugin is enabled |

Our agents in `~/environment/.claude/agents/` are **project-scoped** (priority 3). They're visible to all sessions started from `~/environment/` or its subdirectories.

### How Subagents are Invoked

Three ways, from least to most explicit:

1. **Automatic** — Claude reads the `description` of all available subagents and delegates when a task matches. Include "use proactively" in description for eager delegation.

2. **Natural language** — "Use the code-reviewer subagent to check my changes." Claude decides whether to delegate.

3. **@-mention** — `@"code-reviewer (agent)" look at the auth changes` — guarantees that subagent runs.

4. **Session-wide** — `claude --agent code-reviewer` — entire session uses that agent's prompt, tools, model.

---

## Part 3 — Agent Teams (TeamCreate)

### How to Create a Team

Tell Claude to create an agent team in natural language:
```
Create an agent team to refactor these modules in parallel.
Use Sonnet for each teammate. Spawn 3 teammates:
- One for the auth module
- One for the database layer
- One for the API endpoints
```

Claude creates a team with:
- **Team lead** — the main session that coordinates
- **Teammates** — separate Claude instances that each work on tasks
- **Shared task list** — teammates claim and complete tasks
- **Mailbox** — messaging system for inter-agent communication

### Using Subagent Definitions for Teammates

**This is the key connection between the two systems.**

When spawning a teammate, reference a subagent type by name:
```
Spawn a teammate using the security-reviewer agent type to audit the auth module.
```

The teammate:
- Uses that definition's `tools` allowlist and `model`
- Gets the definition's body **appended** to its system prompt (not replacing it)
- Keeps team coordination tools (`SendMessage`, task tools) even if `tools` restricts other tools
- Does **NOT** inherit `skills` or `mcpServers` from the subagent definition (teammates load these from project/user settings)

### Task List (Shared Coordination)

Tasks have three states: **pending**, **in progress**, **completed**.
Tasks can have dependencies — blocked tasks auto-unblock when dependencies complete.

The lead creates tasks. Teammates either:
- Get tasks assigned by the lead
- Self-claim the next unassigned, unblocked task when idle

Task claiming uses file locking to prevent race conditions.

Press **Ctrl+T** to toggle the task list (in-process mode).

### Teammate Communication

- **message** — send to one specific teammate by name
- **broadcast** — send to all teammates (use sparingly, token cost scales)
- Messages are delivered automatically — no polling needed
- When a teammate finishes, it automatically notifies the lead

### Display Modes

- **In-process** (default) — all teammates in one terminal. `Shift+Down` to cycle between them.
- **Split panes** — each teammate in own tmux/iTerm2 pane. Requires tmux or iTerm2 with `it2` CLI.

### Key Limitations

- **One team per session** — clean up current team before starting new one
- **No nested teams** — teammates cannot spawn their own teams
- **Lead is fixed** — can't transfer leadership
- **No session resumption** — `/resume` doesn't restore in-process teammates
- **Permissions set at spawn** — all teammates start with lead's permission mode
- **Task status can lag** — teammates sometimes forget to mark tasks complete

### Quality Gates (Hooks)

| Hook | When | Use for |
|---|---|---|
| `TeammateIdle` | Teammate about to go idle | Exit code 2 sends feedback, keeps them working |
| `TaskCreated` | Task being created | Exit code 2 prevents creation with feedback |
| `TaskCompleted` | Task being marked complete | Exit code 2 prevents completion with feedback |

### Shutting Down

- Ask lead to shut down specific teammate: "Ask the researcher to shut down"
- Teammate can approve or reject shutdown
- When done, ask lead to "Clean up the team" — removes shared resources
- **Always use lead to clean up** — teammates shouldn't run cleanup

### Best Practices from Docs

1. **3-5 teammates** for most workflows — balances parallel work with coordination overhead
2. **5-6 tasks per teammate** keeps everyone productive
3. **Give enough context** in spawn prompt — teammates don't inherit lead's conversation history
4. **Avoid file conflicts** — break work so each teammate owns different files
5. **Start with research/review** tasks before attempting parallel implementation
6. **Wait for teammates** — tell lead "Wait for your teammates to complete their tasks before proceeding" if it starts implementing itself

---

## Part 4 — Lessons Learned for Our System

### What We Were Doing Wrong

1. **Managers forgetting TeamCreate** — Agents fall back to spawning subagents (Agent tool) for work that needs persistence and inter-agent communication. Root cause: no clear rule in agent identity files about when to use which.

2. **Creating teams without identities** — Team leads spawn TeamCreate agents with ad-hoc role descriptions instead of referencing defined subagent types. The role varies based on the team lead's mood. Root cause: team leads don't know about `subagent_type` or that `.claude/agents/` definitions exist.

3. **Trying to create a second team** — There's a hard Claude Code limitation: **one team per session**. Agents don't know this and try to create a new team, fail, then try to delete the first team. Fix: document this in team-lead.md.

4. **Deleting teams instead of adding members** — You CAN add new teammates to an existing team. You don't need to destroy and recreate. Fix: document the "add teammate" pattern.

5. **No task lists** — Team leads directly tell teammates what to do instead of creating a shared task list. Teammates lose track of what's done, what's blocked, what's next. The task list is a built-in coordination mechanism we're not using.

6. **Not using the inbox** — Teammates have built-in messaging (`SendMessage`, `broadcast`). We route everything through the relay instead of using the native team communication.

### What We Should Change

**For Managers (command, consul, hq):**
- When they need to "create a session" (spawn a team lead), they should document: use `claude --agent team-lead` or reference the `team-lead` subagent definition
- Managers should know the one-team-per-session limit
- Managers should know that subagent definitions work for both Agent tool AND TeamCreate

**For Team Leads (productivitesse, voice-bridge, etc.):**
- Must reference agent definitions when spawning teammates: "Spawn a teammate using the code-reviewer agent type"
- Must use the **shared task list** — create tasks with dependencies, let teammates self-claim
- Must know: one team only, add members to existing team, don't destroy and recreate
- Must know about `Shift+Down` to cycle between teammates, `Ctrl+T` for task list
- Should use teammate messaging (`SendMessage`, `broadcast`) for team-internal communication

**For Agent Definitions (.claude/agents/):**
- Every role that gets spawned repeatedly needs a definition file
- Missing definitions we should create: `code-reviewer`, `coder`, `tester`, `researcher`, `designer`, `spec-writer`
- Each definition should have: `name`, `description`, `model`, `tools` (restricted appropriately), and a focused system prompt

**For CLAUDE.md / Modules:**
- Add a "How to Spawn Agents" section that is crystal clear:
  - Subagent (Agent tool) = ephemeral, one-shot, no inter-agent comms
  - TeamCreate = persistent, shared task list, inter-agent messaging
  - One team per session — add members, don't recreate
  - Always reference agent definitions by name, never ad-hoc
  - Always create a task list for the team

### New Agent Definitions Needed

| Name | Model | Tools | Purpose |
|---|---|---|---|
| `coder` | sonnet | All | Implements features in assigned worktree |
| `code-reviewer` | sonnet | Read, Glob, Grep | Reviews code, no write access |
| `tester` | haiku | Read, Glob, Grep, Bash | Runs tests, reports PASS/FAIL |
| `researcher` | sonnet | Read, Glob, Grep, WebFetch, WebSearch | Investigates problems, gathers context |
| `designer` | sonnet | Read, Write, Edit, Glob | Maintains DESIGN-SYSTEM.md |
| `spec-writer` | sonnet | Read, Write, Edit, Glob | Writes feature specs after implementation |

---

## Part 5 — Files That Need Updating

### 1. `.claude/agents/team-lead.md` — Add team spawning rules
- How to create a team (natural language to Claude)
- MUST reference agent definitions when spawning teammates
- MUST create a task list with dependencies
- One team per session — add members, don't recreate
- Use Shift+Down to cycle teammates, Ctrl+T for task list
- Use SendMessage/broadcast for team comms, not relay for intra-team

### 2. `.claude/agents/command.md`, `consul.md`, `hq.md` — Add session/team creation rules
- How to spawn a team lead session
- Know that team leads use TeamCreate, not managers
- Know the one-team-per-session limit

### 3. `CLAUDE.md` — Update "TeamCreate vs Agent Tool" section
- Currently says "TeamCreate for all team work" — correct but not enough
- Needs: always reference agent definitions by name, always create task list, one team per session
- Needs: link to team-lead.md for the full TeamCreate usage guide

### 4. New agent definition files in `.claude/agents/`
- `coder.md`, `code-reviewer.md`, `tester.md`, `researcher.md`, `designer.md`, `spec-writer.md`
- These are the workhorse roles that team leads spawn repeatedly

### 5. `.claude/settings.json` (or project settings)
- Enable agent teams: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"`
- Pre-approve common teammate permissions to reduce friction
