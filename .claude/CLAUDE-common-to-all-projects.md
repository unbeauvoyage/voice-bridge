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

---

## Testing Strategy — Mandatory for All Projects

**Tests are the living spec.** A coder reading the test suite should understand what the feature does, what it handles gracefully, and what it never does. Tests are not a metric — they are documentation that fails loudly.

### Spec-first workflow — the only allowed pattern

**The spec directs the coder. Not the other way around.**

Specs are written before implementation. They translate requirements into concrete descriptions of what needs to be built. The coder implements against the spec. The tester verifies against the same spec. Both work from one shared source of truth — independently, without needing to talk to each other.

**Specs travel as files, not as verbal requests.** Verbal "here's what to test" instructions are volatile — they get lost, misunderstood, and create blocking back-and-forth. A spec file is persistent, reviewable, and non-blocking.

**The required workflow:**

```
Requirement arrives at team lead
        ↓
Team lead assigns coder + tester (team lead stays free)
        ↓
Coder writes specs/feature-name.md FIRST
  — as a planning document for itself, before writing any code
  — what to build, inputs/outputs, edge cases, expected behaviors
        ↓
Coder implements against its own spec
Tester reads same spec → writes/runs tests against it
        ↓
Both aligned to one document. No verbal handoff needed.
```

**The spec is the coder's planning tool, not an afterthought.** The coder writes it before implementation to think through what they're about to build. It doubles as the tester's input — the tester never needs a verbal briefing because the spec file says everything.

**Why team lead must NOT write specs:**
Same reason they never code. It blocks them. The team lead commissions the work (assigns coder + tester), then steps back entirely.

**Testers never accept verbal test instructions.** If a tester is told "test X" without a spec file, they must ask for the spec first. The spec is the handoff artifact — not a message.

**When to use a dedicated spec-writer:** For complex or ambiguous features where design needs to be thought through before a coder starts — spawn a spec-writer first, then hand the spec to the coder. For standard features, the coder owns both.

### Standard team composition for any feature

| Role | Job |
|---|---|
| `coder` | **Writes spec first** (`specs/feature-name.md`) as a planning step, then implements against it. May write narrow unit tests for internal logic only. |
| `tester` | Reads spec → **writes and runs all integration/E2E tests** verifying each described behavior. Independent of coder — catches what coder assumed was correct. |
| `code-reviewer` | Verifies implementation matches spec. Blocks merge if spec is missing or tests don't cover it. |
| `spec-writer` | Optional — use for complex/ambiguous features where design needs dedicated thinking before coding starts. |

**Why coder and tester are separate:** If the coder writes both code and tests, they'll unconsciously test what they built — including any misunderstandings. The tester's independence is the point. They verify against the spec, not against the code.

**Exception — unit tests:** Coder may write narrow unit tests for internal implementation details (a tricky algorithm, a state machine) that only make sense in context. Everything else — integration tests, E2E flows, API contract tests — belongs to the tester.

**Rule: coder writes spec before writing code. Tester writes tests from the spec. No PR merges without both.**

### Test categories (apply to every project)

1. **Silent-failure guards** — things that break invisibly without a test:
   - Platform adapter unavailable → method must not crash
   - Network response has wrong shape → must return safe default, never throw
   - State transitions — wrong state entered silently

2. **Business logic** — core flows the product depends on:
   - Permission lifecycle: request → approve/deny → removed from pending
   - Queue/retry logic: message fails → retried N times → gives up gracefully
   - MIME/format fallbacks: preferred type unavailable → next type tried

3. **E2E smoke tests** (Playwright) — one test per major user flow:
   - User taps button → result appears
   - User sends message → relay receives it on port 8767
   - User approves permission → agent unblocks

### What NOT to test

- UI pixel rendering / snapshot tests
- Third-party library internals
- Trivial getters/setters with no logic

### Test description rule

Every `it()` or `test()` must read as a plain-English spec sentence:
- ✅ `it('returns [] when agents field is missing in status response')`
- ✅ `it('resolves without throwing when Capacitor plugin is unavailable')`
- ❌ `it('works')`
- ❌ `it('test 1')`

### Project testing policy file

Every project must have `TESTING-POLICY.md` at its root. Minimum contents:
- Mandatory test categories for this project
- Exact commands to run all tests
- What CI checks

Reference: `~/environment/projects/knowledge-base/TESTING-POLICY.md`

### Full testing standards

See `.claude/modules/code-standards.md` Rule 7 for the complete testing standard.

