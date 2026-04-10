# Common Rules for All Projects

## RELATION TO CLAUDE.MD HIERARCHY

**This is the COMMON MODULE referenced by all project CLAUDE.md files (environment, productivitesse, voice-bridge, agencies, etc.).**

**Hierarchy:**
- **~/environment/CLAUDE.md** — Environment-scoped rules (meta-manager behavior, session management, agent types for environment only)
- **~/.claude/CLAUDE-common-to-all-projects.md** (THIS FILE) — Rules shared by all projects: team management, agent spawning, communication, task coordination
- **Project CLAUDE.md files** (e.g., productivitesse/CLAUDE.md) — Project-specific extensions that reference both parent files

**Update relationship:**
- When team management practices change → update THIS file
- All projects inherit these rules automatically
- Project CLAUDE.md files reference this file with `See .claude/CLAUDE-common-to-all-projects.md`
- Projects should NOT duplicate these rules — reference them instead

---

This file defines how teams work across all projects. Every project CLAUDE.md references this.

## Agent Team Functions (Claude Code Built-in Tools)

These are the built-in tools available to all agents for team coordination. **Use these — not relay messages — for team operations.**

### Communication
| Tool | Purpose |
|------|---------|
| `SendMessage` | Send a message to a teammate by name. **This is the only way to talk to teammates** — your plain text output is NOT visible to other agents. Use `{"to": "name", "message": "text", "summary": "5 words"}`. Broadcast to all: `{"to": "*", ...}` |
| `SendMessage` (shutdown) | To shut down a teammate: `{"to": "name", "message": {"type": "shutdown_request", "reason": "why"}}`. The teammate must approve with `shutdown_response`. |

### Team Management
| Tool | Purpose |
|------|---------|
| `TeamCreate` | Create a new team with teammates. Spawns agents that stay alive and can receive follow-up messages via SendMessage. Use for multi-step work requiring coordination. |
| `TeamDelete` | Delete the entire team and clean up. **All teammates must be shut down first** (send shutdown_request to each via SendMessage, wait for approval, then call TeamDelete). |

### Removing a Single Agent from a Team

To shut down ONE agent while keeping the rest of the team alive:

1. Send `SendMessage` shutdown_request to the agent — it will shut down
2. Manually remove it from the team config:
   ```bash
   cd ~/.claude/teams/{team-name}
   # Edit config.json, remove the agent from the "members" array
   # (Keep other members intact)
   ```
3. The agent is now removed from the team, others stay alive

This is the workaround until there's a built-in API for selective agent removal.

### Task Tracking
| Tool | Purpose |
|------|---------|
| `TaskCreate` | Create a task to track work. Fields: `subject`, `description`, `activeForm` (spinner text). |
| `TaskUpdate` | Update task status (`pending` → `in_progress` → `completed`), set `owner`, add dependencies. |
| `TaskGet` | Read a task's current state before updating. |
| `TaskList` | List all tasks and their statuses. |
| `TaskStop` | Stop a running background task by ID. |

### One-Shot Agents (No Team)
| Tool | Purpose |
|------|---------|
| `Agent` | Spawn a one-shot agent for atomic tasks. Fire-and-forget — you get one result back, no follow-up messages. **ALWAYS USE `run_in_background: true` — NEVER RUN IN FOREGROUND.** |

### Key Rules
- **SendMessage, not relay** — relay messages are chat; teammates can ignore them. SendMessage is the real communication channel.
- **Shutdown flow:** SendMessage shutdown_request → wait for shutdown_response → TeamDelete
- **Follow-up vs new task:** Before assigning new work, ask: is this a follow-up (reuse agent) or new task (close current agents, spawn fresh)?

### Agent Spawning Strategy — IMPORTANT

**STANDARD RULE: ALL RESEARCH AND CODING TASKS USE TEAMCREATE**

- All research tasks (investigation, exploration, analysis) → use `TeamCreate`
- All coding tasks (features, bugfixes, refactors) → use `TeamCreate`
- Keep the team alive until work is merged into `dev`
- Assign tasks via `TaskCreate` and `TaskUpdate`
- Get feedback, iterate, refine
- When work is merged to dev and stable, gracefully shut down via `SendMessage` shutdown_request → `TeamDelete`

**Why:** Research and coding always need follow-ups, clarifications, iterations, and feedback. A one-shot agent can't handle this. TeamCreate allows consultation, course-correction, and proper task tracking.

**EXCEPTION: One-Shot Agents (truly atomic only)**
- Use `Agent` tool ONLY for fire-and-forget, zero-iteration tasks
- **ALWAYS with `run_in_background: true`** — NEVER run in foreground (blocks the manager and CEO can't reach you)
- Examples: fetch a single URL, read a file, run a quick check, deploy to both phones (if fully scripted)
- Do NOT use for anything with uncertainty or potential follow-ups

**IN PRACTICE:** Start with TeamCreate. One-shot agents are rare exceptions for scripted, no-brainer tasks.

### Spawning a Single Persistent Teammate (Without TeamCreate)

Sometimes you need one persistent teammate without the full TeamCreate infrastructure. Use the `Agent` tool with the `team_name` parameter:

```
Agent(
  description: "Short task description",
  model: "opus",
  team_name: "project-cleanup",      # Add to existing team
  name: "cleanup-investigator",       # Unique name within that team
  prompt: "Full system prompt for the teammate...",
  run_in_background: true             # ALWAYS background
)
```

**This does:**
1. Spawns a single persistent agent into the team
2. Agent can receive SendMessage follow-ups (because `team_name` makes it persistent)
3. Agent can create/claim tasks, be assigned work, etc.
4. No TeamCreate overhead — just a single teammate

**When to use:**
- You need ONE persistent teammate, not a coordinated team
- The work might need follow-up or iteration
- You want to avoid managing full team infrastructure

**After work is done:**
- Send `SendMessage` shutdown_request to the teammate
- Wait for shutdown_response
- The team can stay alive with others, or you can TeamDelete it when empty

**Key difference:**
- `Agent` without `team_name` = one-shot, fire-and-forget, no follow-ups
- `Agent` with `team_name` = persistent, can receive messages, can be managed like a teammate

