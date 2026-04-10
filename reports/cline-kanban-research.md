# Cline Kanban Research Report

**Date:** 2026-04-03
**Author:** cline-researcher (command agent)
**Purpose:** Comprehensive analysis of Cline's Kanban/task management architecture for relay system integration

---

## 1. What Cline's Kanban Actually Is

Cline Kanban is a **terminal-launched web application** that provides a browser-based kanban board for orchestrating multiple CLI coding agents in parallel. It is a separate tool from the Cline VS Code extension, though they share the same core engine (Cline Core).

### Key Facts
- **Launch:** `npx kanban` or `cline kanban` from any git repository root
- **Runtime:** Local web server serving a browser UI
- **Stack:** TypeScript (97.1% of codebase), Apache 2.0 license
- **Repo:** https://github.com/cline/kanban (776 commits, 467 stars as of April 2026)
- **Agent Support:** Works with Cline CLI, Claude Code, and Codex agents

### How It Works
1. User creates task cards (manually or via agent decomposition of a prompt)
2. Each task card gets its own **ephemeral git worktree** and dedicated terminal
3. Hitting "play" on a card spawns an agent in that worktree
4. Tasks can be **linked** (Cmd+click) to create dependency chains
5. When a card completes and is trashed, linked tasks auto-start
6. Hooks display the latest message/tool call on each card for at-a-glance monitoring
7. Inline diff review with PR-style commenting is built in

---

## 2. Two Kanban Systems (Important Distinction)

There are **two separate kanban systems** relevant here:

### 2a. Cline Kanban (cline/kanban)
- The official Cline parallel agent orchestrator
- Browser-based, launched from terminal
- Tasks managed internally, no documented external API for task CRUD
- Uses git worktrees for isolation
- Detects installed CLI agents automatically

### 2b. VS Code Agent Kanban (appsoftwareltd/vscode-agent-kanban)
- A **third-party VS Code extension** with a file-based task format
- Uses `.agentkanban/tasks/` directory with Markdown + YAML frontmatter
- Version-control friendly, designed for agent workflows
- Has chat commands (`/new`, `/task`, `/worktree`, etc.)
- License: Elastic License 2.0

Both are relevant because Cline's ecosystem supports both approaches.

---

## 3. Task File Format (VS Code Agent Kanban)

### Directory Structure
```
.agentkanban/
  board.yaml           # Lane definitions and base prompt
  memory.md            # Global memory (user-resettable)
  INSTRUCTION.md       # Managed workflow instructions
  tasks/               # Flat task storage
    task_<date>_<id>_<title>.md
    todo_<date>_<id>_<title>.md
    archive/           # Archived tasks
  logs/                # Diagnostic output (optional)
```

### Task File YAML Frontmatter
```yaml
---
title: "Implement user authentication"
lane: doing          # todo | doing | done
created: 2026-04-03T10:00:00Z
updated: 2026-04-03T12:30:00Z
description: "Add JWT-based auth to the API"
priority: high       # critical | high | medium | low | none
assignee: "agent-1"
labels: [backend, auth]
dueDate: 2026-04-10
sortOrder: 1
worktree:            # auto-managed
  branch: agentkanban/implement-user-auth
  path: ../repo-worktrees/implement-user-auth
  created: 2026-04-03T10:00:00Z
---

## Conversation

### user
Implement JWT authentication for the Express API...

### agent
I'll start by creating the auth middleware...

[comment: CEO wants this using RS256 not HS256]
```

### Key Insight for Integration
Since tasks are **plain Markdown files with YAML frontmatter**, any external system can create/update tasks by simply writing files to `.agentkanban/tasks/`. The extension uses a file watcher to detect changes.

---

## 4. Cline Core Architecture

### Controller (Central Orchestrator)
- Owns a single active `Task` instance at a time
- Manages `StateManager` (singleton state cache), `McpHub`, `AuthService`
- Core methods: `initTask()`, `cancelTask()`, `postStateToWebview()`, `togglePlanActMode()`

### Task Lifecycle
1. `initTask()` assembles system prompts, builds context, starts agent loop
2. LLM returns `ApiStream` (async generator of tokens)
3. Response parsed into text and tool-use blocks
4. `ToolExecutor` dispatches tool execution (files, commands, browser, MCP)
5. Human approval via `Task.ask()` (suspends execution)
6. Tool results appended to history; next turn begins
7. Completion via `attempt_completion` block

### State Management
- `StateManager` persists settings and task state to disk (JSON files)
- gRPC-over-postMessage transport for type-safe, streaming communication between webview and extension
- State broadcast via `postStateToWebview()` with aggregated `ExtensionState`

---

## 5. Integration Points (APIs, Interfaces)

### 5a. Cline CLI + gRPC (Primary Programmatic Interface)
Cline Core runs as a Node.js process exposing a **gRPC API**:
- Task creation and management
- State synchronization
- Multi-instance orchestration
- Multiple frontends can attach simultaneously (even over network)

**CLI Commands:**
| Command | Purpose |
|---------|---------|
| `cline [prompt]` | Interactive mode or Kanban launch |
| `cline task <prompt>` | Run new task (--act, --plan, --yolo) |
| `cline history` | List previous tasks |
| `cline config` | Settings TUI |
| `cline auth` | Configure provider/API key |
| `cline mcp add` | Add MCP server |
| `cline kanban` | Launch Kanban board |

**Headless/JSON mode:** `cline task "prompt" --json` streams `ClineMessage` objects as newline-delimited JSON for machine consumption.

**YOLO mode:** `cline task "prompt" -y` auto-approves all actions.

### 5b. Agent Client Protocol (ACP)
When started with `--acp`, Cline CLI operates as an **ACP server over stdio**:
- JSON-RPC 2.0 communication (single-line JSON, newline-terminated)
- Session creation with working directory and MCP server specifications
- Translates between ACP protocol and Cline's internal gRPC architecture
- Works with JetBrains, Neovim, Zed, and any ACP-compatible editor

### 5c. MCP (Model Context Protocol) - Plugin System
Cline supports MCP servers as plugins:
- Built-in marketplace for installing MCP servers
- Can create custom MCP servers on demand
- MCP rules auto-select servers based on conversation context
- External tools connect via MCP stdio or URL transport

### 5d. Hooks System (v3.36+)
Cline v3.36 introduced hooks for injecting custom logic:
- Pre/post hooks on tool execution
- Can trigger external scripts on file changes, command execution, etc.
- Kanban uses hooks to display agent status on cards

### 5e. File-Based Interface (.agentkanban/)
The simplest integration path:
- Write Markdown files with YAML frontmatter to `.agentkanban/tasks/`
- File watcher picks up changes automatically
- No API calls needed, just file system operations

### 5f. External API (gRPC - Documented but Evolving)
The external API proposal (GitHub issue #4886) was **closed as completed** — functionality covered by the gRPC system. Full gRPC documentation is pending, but the source is available. The gRPC services include:
- `TaskServiceClient` - task management
- `StateServiceClient` - state synchronization
- Streaming support for real-time events

---

## 6. Recommended Integration Approach: Relay -> Cline Tasks

### Option A: File-Based Integration (Simplest, Most Reliable)
**Best for our relay system at localhost:8765**

```
CEO Request -> Relay -> File Writer -> .agentkanban/tasks/ -> Cline picks up task
```

**Implementation:**
```javascript
// relay-cline-bridge.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function createClineTask(projectDir, { title, description, priority = 'medium', labels = [] }) {
  const tasksDir = path.join(projectDir, '.agentkanban', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });

  const now = new Date().toISOString();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const id = Date.now().toString(36);
  const filename = `task_${now.slice(0,10)}_${id}_${slug}.md`;

  const frontmatter = {
    title,
    lane: 'todo',
    created: now,
    updated: now,
    description,
    priority,
    labels,
  };

  const content = `---\n${yaml.dump(frontmatter)}---\n\n## Conversation\n\n### user\n${description}\n`;
  
  fs.writeFileSync(path.join(tasksDir, filename), content);
  return filename;
}

function updateTaskLane(projectDir, taskFile, newLane) {
  const filepath = path.join(projectDir, '.agentkanban', 'tasks', taskFile);
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.replace(/^lane:\s*.+$/m, `lane: ${newLane}`);
  content = content.replace(/^updated:\s*.+$/m, `updated: ${new Date().toISOString()}`);
  fs.writeFileSync(filepath, content);
}
```

**Relay webhook handler:**
```javascript
// In relay server (localhost:8765)
app.post('/cline/task', (req, res) => {
  const { project, title, description, priority } = req.body;
  const projectDir = path.join(process.env.HOME, 'environment', 'projects', project);
  const filename = createClineTask(projectDir, { title, description, priority });
  res.json({ success: true, file: filename });
});
```

### Option B: CLI-Based Integration (More Features, Requires Cline Installed)
```
CEO Request -> Relay -> cline task "prompt" --json -> Parse output -> Status update
```

```bash
# Create a task in headless mode
cline task "Implement the new API endpoint for user profiles" --json -y 2>&1 | \
  while IFS= read -r line; do
    # Parse JSON messages, forward status to relay
    curl -s -X POST http://localhost:8765/send \
      -H 'Content-Type: application/json' \
      -d "{\"from\":\"cline\",\"to\":\"command\",\"body\":\"$line\"}"
  done
```

### Option C: gRPC Integration (Most Powerful, Least Documented)
```
CEO Request -> Relay -> gRPC Client -> Cline Core -> Task execution
```

This requires connecting to Cline's gRPC services directly. The proto definitions are in the Cline source (`src/standalone/`). This gives full programmatic control but the API surface is still being stabilized.

### Option D: MCP Bridge (Elegant, Bidirectional)
Create a custom MCP server that bridges relay <-> Cline:

```javascript
// mcp-relay-bridge server
// Cline connects to this MCP server, gaining tools like:
// - relay_send(to, message) - send messages through our relay
// - relay_poll(agent) - check for messages
// - task_create(title, desc) - create kanban tasks from relay messages

// Meanwhile, relay can invoke Cline through the MCP server's bidirectional channel
```

This is the most architecturally elegant approach since Cline already has first-class MCP support and our system already uses MCP channels.

---

## 7. Recommended Approach for Productivitesse

Given our relay system at localhost:8765 and the existing MCP channel infrastructure:

### Phase 1: File-Based Quick Win
1. Add `.agentkanban/` directory to productivitesse project
2. Create a `board.yaml` with lanes matching our workflow (backlog, active, review, done)
3. Build a relay endpoint (`/cline/task`) that writes task files
4. When CEO requests a change, relay creates both our internal task AND a Cline kanban card
5. Use `fs.watch()` on the tasks directory to detect when Cline completes work

### Phase 2: MCP Bridge
1. Create an MCP server that exposes relay_send/relay_poll as tools
2. Register it in Cline's MCP config
3. Cline agents can now communicate with our relay system natively
4. Bidirectional: relay can trigger Cline tasks, Cline can report back through relay

### Phase 3: gRPC Direct (When Docs Stabilize)
1. Connect directly to Cline Core's gRPC API
2. Full programmatic control over task creation, monitoring, and state
3. Real-time streaming of agent progress back to relay/dashboard

---

## 8. Limitations and Risks

### Limitations
- **gRPC API not fully documented** - source is available but API surface is evolving
- **Cline Kanban is a research preview** - may change significantly
- **VS Code Agent Kanban is third-party** (ELv2 license) - different from official Cline Kanban
- **Single active task in VS Code extension** - Controller owns one Task at a time (Kanban uses separate CLI instances to work around this)
- **File-based approach requires convention** - both systems must agree on frontmatter schema

### Risks
- **File format changes** - .agentkanban format could change between versions
- **gRPC breaking changes** - API is pre-documentation, expect churn
- **Worktree conflicts** - if both our system and Cline manage git worktrees, coordination needed
- **Authentication** - Cline API (api.cline.bot) requires bearer tokens; local gRPC may not
- **ACP is young** - standard is still being adopted across editors

### Mitigations
- Start with file-based approach (most stable, least coupling)
- Pin Cline version in production
- Use MCP bridge for bidirectional communication (leverages existing infrastructure)
- Monitor Cline changelog for breaking changes

---

## 9. Key Technical References

- **Cline Main Repo:** https://github.com/cline/cline
- **Cline Kanban Repo:** https://github.com/cline/kanban
- **VS Code Agent Kanban:** https://github.com/appsoftwareltd/vscode-agent-kanban
- **Cline Kanban Docs:** https://docs.cline.bot/kanban/overview
- **Cline API Docs:** https://docs.cline.bot/api/overview
- **Cline CLI/ACP Docs:** https://docs.cline.bot/cline-cli/acp-editor-integrations
- **ACP Standard:** https://acpserver.org/
- **DeepWiki Architecture:** https://deepwiki.com/cline/cline
- **External API Issue (Closed):** https://github.com/cline/cline/issues/4886
- **Hooks (v3.36):** https://cline.ghost.io/cline-v3-36-hooks/

---

## 10. Summary

**Cline offers four integration paths** for our relay system, ranked by reliability and ease:

| Approach | Complexity | Reliability | Bidirectional | Documented |
|----------|-----------|-------------|---------------|------------|
| File-based (.agentkanban/) | Low | High | No (needs watcher) | Yes |
| CLI headless (--json) | Low | High | Partial | Yes |
| MCP Bridge | Medium | High | Yes | Yes (MCP spec) |
| gRPC Direct | High | Medium | Yes | Partial |

**Recommendation:** Start with file-based task creation (Phase 1) for immediate wins, then build an MCP bridge (Phase 2) for bidirectional relay<->Cline communication. The MCP bridge aligns with our existing MCP channel infrastructure and Cline's first-class MCP support.
