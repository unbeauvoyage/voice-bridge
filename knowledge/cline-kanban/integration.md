# Cline Kanban Integration Guide
Last updated: 2026-04-03
Source: ~/environment/reports/cline-kanban-research.md

## Four Integration Paths (Ranked by Reliability)

| Approach | Complexity | Reliability | Bidirectional | Documented |
|----------|-----------|-------------|---------------|------------|
| File-based (.agentkanban/) | Low | High | No (needs watcher) | Yes |
| CLI headless (--json) | Low | High | Partial | Yes |
| MCP Bridge | Medium | High | Yes | Yes (MCP spec) |
| gRPC Direct | High | Medium | Yes | Partial |

---

## Option A: File-Based Integration (Simplest, Recommended for Phase 1)

**Best for relay system at localhost:8765**

### Flow
```
CEO Request -> Relay -> File Writer -> .agentkanban/tasks/ -> Cline picks up task
```

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

### Task File Format (YAML Frontmatter)

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

### Key Advantage
Since tasks are **plain Markdown files with YAML frontmatter**, any external system can create/update tasks by writing files to `.agentkanban/tasks/`. The extension uses a file watcher to detect changes.

---

## Option B: CLI-Based Integration (Headless Mode)

**Good for triggering tasks, less good for feedback loops**

### Flow
```
CEO Request -> Relay -> cline task "prompt" --json -> Parse output -> Status update
```

### Example Implementation
```bash
cline task "Implement the new API endpoint for user profiles" --json -y 2>&1 | \
  while IFS= read -r line; do
    # Parse JSON messages, forward status to relay
    curl -s -X POST http://localhost:8765/send \
      -H 'Content-Type: application/json' \
      -d "{\"from\":\"cline\",\"to\":\"command\",\"body\":\"$line\"}"
  done
```

### CLI Commands Available
| Command | Purpose |
|---------|---------|
| `cline [prompt]` | Interactive mode or Kanban launch |
| `cline task <prompt>` | Run new task (--act, --plan, --yolo) |
| `cline history` | List previous tasks |
| `cline config` | Settings TUI |
| `cline auth` | Configure provider/API key |
| `cline mcp add` | Add MCP server |
| `cline kanban` | Launch Kanban board |

### Modes
- **`--json`** streams `ClineMessage` objects as newline-delimited JSON for machine consumption
- **`-y`/`--yolo`** auto-approves all actions
- **`--act`** for acting mode (default)
- **`--plan`** for planning only

---

## Option C: gRPC Integration (Most Powerful, Least Documented)

**For full programmatic control when docs stabilize**

### Flow
```
CEO Request -> Relay -> gRPC Client -> Cline Core -> Task execution
```

### Status
- Proto definitions available in Cline source (`src/standalone/`)
- Full programmatic control over task creation, monitoring, state
- API surface still being stabilized
- Not recommended until documentation improves

### What's Available (From Proto)
- `TaskServiceClient` - task management
- `StateServiceClient` - state synchronization
- Streaming support for real-time events
- External API proposal (GitHub issue #4886) closed as "completed"

---

## Option D: MCP Bridge (Most Elegant, Recommended for Phase 2)

**Bidirectional, leverages existing MCP infrastructure**

### Architecture
```javascript
// MCP relay-bridge server
// Cline connects to this MCP server, gaining tools like:
// - relay_send(to, message) - send messages through our relay
// - relay_poll(agent) - check for messages
// - task_create(title, desc) - create kanban tasks from relay messages

// Meanwhile, relay can invoke Cline through the MCP server's bidirectional channel
```

### Advantages
- Aligns with existing MCP channel infrastructure
- Cline has first-class MCP support
- Bidirectional communication
- Type-safe over JSON-RPC
- Follows established MCP patterns

### Why This is Elegant
- Cline already supports MCP servers as plugins
- Built-in MCP marketplace for installing servers
- Can auto-select servers based on conversation context
- Our system already uses MCP channels effectively

---

## Recommended Phased Approach for Productivitesse

### Phase 1: File-Based Quick Win
1. Add `.agentkanban/` directory to productivitesse project
2. Create a `board.yaml` with lanes matching workflow (backlog, active, review, done)
3. Build relay endpoint (`/cline/task`) that writes task files
4. When CEO requests change, relay creates both internal task AND Cline kanban card
5. Use `fs.watch()` on tasks directory to detect when Cline completes work

### Phase 2: MCP Bridge
1. Create MCP server exposing relay_send/relay_poll as tools
2. Register in Cline's MCP config
3. Cline agents communicate with relay system natively
4. Bidirectional: relay triggers Cline tasks, Cline reports back through relay

### Phase 3: gRPC Direct (When Docs Stabilize)
1. Connect directly to Cline Core's gRPC API
2. Full programmatic control over task creation, monitoring, state
3. Real-time streaming of agent progress back to relay/dashboard

---

## Integration Risks & Mitigations

### Risks
- **File format changes** - .agentkanban format could change between versions
- **gRPC breaking changes** - API is pre-documentation, expect churn
- **Worktree conflicts** - if both our system and Cline manage git worktrees, coordination needed
- **Authentication** - Cline API (api.cline.bot) requires bearer tokens; local gRPC may not
- **ACP is young** - Agent Client Protocol standard still being adopted

### Mitigations
- Start with file-based approach (most stable, least coupling)
- Pin Cline version in production
- Use MCP bridge for bidirectional communication
- Monitor Cline changelog for breaking changes
- Vendor .agentkanban schema validation
