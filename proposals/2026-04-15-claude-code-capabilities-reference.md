---
title: Claude Code Capabilities Reference — CEO Direction #2
timestamp: 2026-04-15T16:45:00
status: proposal
summary: Complete reference for agents on Hooks, Skills, MCP, Remote Control, Channels. Read on startup.
---

# Claude Code Capabilities Reference

**Aligns with:** CEO Direction #2 (Agents Must Know Their Tools)

**Purpose:** Every agent should clearly understand what powers Claude Code gives them and when to use each.

## What Agents Should Know on Startup

When you launch a Claude Code session, you have these powers:

### 1. **Hooks — Code Execution Gates**

Hooks let you intercept and customize code execution in your session.

**Available Hooks:**
- `PreToolUse` — runs BEFORE a tool executes (can block or modify)
- `PostToolUse` — runs AFTER a tool executes (can log, validate, alert)
- `SessionStart` — runs once when session starts (setup, load config)
- `Stop` — runs when session ends (cleanup)
- `UserPromptSubmit` — runs when user sends a message (can reject/validate)

**When to use:**
- **Testing gates:** PostToolUse hook runs tsc + ESLint + tests after every code edit (see: `.claude/hooks/testing-gate/`)
- **Permission checks:** PreToolUse blocks dangerous Bash commands if not approved
- **Telemetry:** PostToolUse logs code changes to relay for dashboard visibility
- **Validation:** UserPromptSubmit rejects messages that fail content policy

**Location:** `~/.claude/hooks/{hook-name}/on-{trigger}.sh`

**Example:** `~/.claude/hooks/testing-gate/on-code-edit.sh` validates TypeScript + runs matching tests automatically.

---

### 2. **Skills — Slash Commands You Can Invoke**

Skills are shortcuts that do complex work. Invoke them with the `Skill` tool.

**Example Skills (if installed):**
- `/commit` — stage changes, write commit message, push
- `/review-pr` — review a pull request for bugs
- `/help` — show available skills
- `/codex:review` — hand off code to Codex for review
- `/codex:rescue` — escalate blocked problem to Codex

**When to use:**
- Instead of manually running git commands → `/commit`
- When code needs a second opinion → `/codex:review`
- When stuck >30 minutes → `/codex:rescue`
- Repetitive workflows → look for a skill first

**How to invoke:**
```python
Skill(skill="commit", args="-m 'Your message'")
```

**Limitation:** Some skills require context (e.g., `/codex` commands are full-Opus, expensive, use only when needed).

---

### 3. **MCP Plugins — Persistent Tools**

MCP (Model Context Protocol) plugins extend your capabilities with new tools.

**What you get:**
- Custom tools exposed to all agents in the session
- Persistent state (databases, registries, file systems)
- Real-time event streaming (notifications from the relay)

**Examples:**
- `relay-channel` plugin — sends/receives messages on the relay, gets notifications
- Custom plugins from `~/.claude/plugins/` — registered at session start

**When to use:**
- **Relay messaging:** Use relay-channel to send messages to CEO or other agents
- **Custom tools:** If a repetitive task isn't a skill, build an MCP plugin for it

**How to check what plugins are loaded:**
- Use `/help` or look at session logs
- Plugin tools appear in your tool list (Read, Bash, Relay, etc.)

---

### 4. **Remote Control — CEO Sends You Commands**

When session has `--remote-control` flag, CEO can send commands to you directly.

**What this enables:**
- CEO can send `/codex:review` command to you mid-task
- CEO can send `/loop` to make you repeat a task periodically
- CEO can send shell commands to run in your session

**Security:** Remote control respects your permission mode. If you launched with `acceptEdits`, CEO can request edits. If `bypassPermissions`, CEO can do anything.

**When enabled:** All team leads and manager agents launch with `--remote-control` so CEO can redirect them without killing the session.

---

### 5. **Channel Plugin — Push Notifications from Relay**

The channel plugin lets other agents **push messages to you** without you polling.

**What you get:**
- Messages appear as `<channel>` messages in your conversation
- You wake up immediately (no polling, no wait)
- Full message context delivered to you

**When to use:**
- Managers send you work assignments via channel
- CEO sends you commands via channel
- Other agents escalate to you via channel

**How to respond:**
- Read the message (appears in your context)
- Use `SendMessage` tool to reply to sender
- The relay handles delivery

**Limitation:** Requires `--dangerously-load-development-channels` flag until relay-channel is on Anthropic's allowlist.

---

### 6. **Tokens and Context Limits**

You have a token budget. Use it wisely.

**Budget:**
- Chat context: ~200k tokens (this conversation)
- API requests: ~15% per day (policy from CEO)
- Model: Haiku (cheaper, faster) unless escalated to Opus

**When you approach limits:**
- Session auto-compacts (keeps last N turns, summarizes earlier ones)
- `/compact` command manually triggers compaction
- Spawning agents in background keeps them off your token budget

**Strategy:**
- Use background agents (`run_in_background: true`) for long work
- Keep foreground work focused and short
- Spawn Opus only when Haiku can't solve a problem

---

### 7. **When to Use Which Tool**

**Decision Tree:**

```
Am I writing/editing code?
  → Use Bash, Read, Edit, Write, Glob, Grep

Do I need a second opinion?
  → Use /codex:review (Opus, ~30s)
  → Use /codex:adversarial-review (challenge assumptions)

Am I stuck >30min?
  → Use /codex:rescue (Opus, full hand-off)

Do I need to run a long process?
  → Use Bash(run_in_background: true)

Do I need to coordinate with other agents?
  → Use SendMessage (relay channel)

Do I need cross-project standards?
  → Ask Chief of Staff (system-expert level)

Is this a permission/security question?
  → Ask security-expert

Do I need deep research?
  → Spawn researcher agent (Agent tool)

Am I building a feature?
  → Spawn a coder agent (Agent tool)
```

---

## For Team Leads

**Your specific powers:**

1. **Spawn agents:** `Agent()` tool to create coders, testers, researchers
2. **Manage teams:** `TeamCreate()` to spawn a persistent team, `SendMessage()` to coordinate
3. **Track work:** `TaskCreate()` and `TaskUpdate()` to manage task lists
4. **Run builds:** `Bash(run_in_background: true)` to build without blocking
5. **Review code:** Use `/codex:review` before merging, `/codex:rescue` if coder is stuck
6. **Stay responsive:** Never block on a build or test — all long commands run in background

**Rule:** You stay available to the CEO at all times. Never be busy doing implementation work. That's what coders are for.

---

## For Project Managers

**Your specific powers:**

1. **Route work:** Parse CEO messages, forward to right agent/session
2. **File management:** Update BACKLOG.md, SESSIONS.md, ISSUES.md directly
3. **Spawn specialists:** Use Agent tool for research, proposals, domain experts
4. **Non-blocking:** All your work happens while you respond to the CEO

**Rule:** You don't code. You coordinate. Spawn agents for thinking work. Stay responsive.

---

## For All Agents

**First thing on startup:**
1. Read `.claude/agents/{your-role}.md` (your identity)
2. Read project CLAUDE.md (specializations)
3. Read environment CLAUDE.md (system rules)
4. Check this reference (Claude Code capabilities)

**Best practices:**
- Use `/codex:review` before major commits
- Use `/codex:rescue` if blocked (don't churn for hours)
- Use `Bash(run_in_background: true)` for anything >2 seconds
- Use relay-channel to coordinate with other agents
- Log your work to `.worklog/` (fire-and-forget, no cost)

---

**Chief of Staff**  
2026-04-15T16:45:00
