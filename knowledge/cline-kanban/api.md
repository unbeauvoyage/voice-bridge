# Cline Kanban API Reference
Last updated: 2026-04-03
Source: ~/environment/reports/cline-kanban-research.md

## File-Based Interface: .agentkanban/ Schema

### Root Configuration: board.yaml
```yaml
lanes:
  - id: backlog
    title: Backlog
    type: backlog
  - id: todo
    title: To Do
    type: todo
  - id: doing
    title: Doing
    type: doing
  - id: review
    title: Review
    type: review
  - id: done
    title: Done
    type: done
basePrompt: "You are a skilled software engineer..."
```

### Global Memory: memory.md
User-resettable workspace for shared context and learnings. Format: freeform Markdown.

### Task Files: tasks/task_<date>_<id>_<title>.md

#### Frontmatter Schema
```yaml
---
title: string                    # Required: card title
lane: string                     # Required: "todo" | "doing" | "done" | "backlog" | "review"
created: ISO8601                 # Required: creation timestamp
updated: ISO8601                 # Required: last update timestamp
description: string              # Optional: task description
priority: string                 # Optional: "critical" | "high" | "medium" | "low" | "none"
assignee: string                 # Optional: agent name or user identifier
labels: array<string>            # Optional: ["backend", "auth", "urgent"]
dueDate: ISO8601                 # Optional: deadline
sortOrder: number                # Optional: display order within lane
worktree:                        # Optional: git worktree metadata (auto-managed)
  branch: string                 # git branch name
  path: string                   # relative path to worktree
  created: ISO8601               # when worktree was created
---
```

#### Conversation Section
```markdown
## Conversation

### user
Initial prompt or request from user/CEO...

### agent
Agent response with actions, decisions...

[comment: CEO notes or instructions]
```

### Directory Structure
```
.agentkanban/
├── board.yaml              # Lane definitions and base prompt
├── memory.md               # Global shared context
├── INSTRUCTION.md          # Workflow instructions (managed)
├── tasks/                  # All task files
│   ├── task_2026-04-03_abc123_title.md
│   ├── todo_2026-04-03_def456_title.md
│   └── archive/            # Completed/archived tasks
└── logs/                   # Optional diagnostic logs
```

---

## CLI Commands

### Task Creation
```bash
cline task "prompt text" [options]
```

**Options:**
- `--json` - Stream `ClineMessage` objects as newline-delimited JSON
- `-y`/`--yolo` - Auto-approve all actions
- `--act` - Acting mode (default)
- `--plan` - Planning only (no execution)

### Kanban Launch
```bash
cline kanban
# Launches browser UI on localhost (port varies, typically 3000-5000)
```

### Other Commands
```bash
cline [prompt]      # Interactive mode
cline history       # List previous tasks
cline config        # Settings TUI
cline auth          # Configure provider/API key
cline mcp add       # Add MCP server
```

---

## Headless JSON Output Format

### ClineMessage Structure
Newline-delimited JSON objects emitted when using `--json` flag:

```json
{
  "type": "message" | "tool_use" | "completion" | "error",
  "timestamp": "ISO8601",
  "content": {
    "text": "string",
    "tool": {
      "name": "string",
      "arguments": {}
    }
  }
}
```

### Parsing Strategy
```javascript
// For each line in stdout:
const message = JSON.parse(line);
switch(message.type) {
  case 'message':
    // Status update
    break;
  case 'tool_use':
    // Action being taken
    break;
  case 'completion':
    // Task finished
    break;
  case 'error':
    // Error occurred
    break;
}
```

---

## Agent Client Protocol (ACP)

### When Cline Runs with --acp Flag
```bash
cline --acp
```

**Protocol:** JSON-RPC 2.0 over stdio
- Single-line JSON, newline-terminated
- Session creation with working directory
- MCP server specifications
- Works with JetBrains, Neovim, Zed, any ACP-compatible editor

### Translates Between
- ACP protocol (external)
- Cline's internal gRPC architecture

---

## MCP (Model Context Protocol) Integration

### Cline's MCP Support
- Built-in MCP marketplace for installing servers
- Custom MCP servers can be created on demand
- MCP rules auto-select servers based on conversation context
- External tools connect via MCP stdio or URL transport

### Using MCP with Cline
```bash
cline mcp add <server-spec>
```

### MCP Server Example
```javascript
// Custom MCP server that Cline connects to
// Exposes tools like:
// - relay_send(to: string, message: string)
// - relay_poll(agent: string)
// - task_create(title: string, description: string)
```

---

## Hooks System (v3.36+)

### Purpose
Inject custom logic before/after tool execution.

### Trigger Events
- Pre/post tool execution
- File change detection
- Command execution hooks
- Custom logic injection

### Usage in Kanban
Hooks display agent status on cards for at-a-glance monitoring.

---

## gRPC Services (Internal API)

### Available Services (Proto-Based)
```proto
// Task management
service TaskService {
  rpc CreateTask(TaskRequest) returns (TaskResponse);
  rpc GetTask(GetTaskRequest) returns (Task);
  rpc ListTasks(ListTasksRequest) returns (stream Task);
  rpc UpdateTask(UpdateTaskRequest) returns (TaskResponse);
  rpc CancelTask(CancelTaskRequest) returns (TaskResponse);
}

// State synchronization
service StateService {
  rpc GetState(GetStateRequest) returns (ExtensionState);
  rpc UpdateState(UpdateStateRequest) returns (StateResponse);
  rpc WatchState(WatchStateRequest) returns (stream ExtensionState);
}
```

### Access
- Proto definitions in Cline source (`src/standalone/`)
- gRPC-over-postMessage transport for webview <-> extension
- External API proposal (GitHub issue #4886) closed as "completed"
- Full documentation pending

---

## State Management Interfaces

### StateManager
Persists settings and task state to disk (JSON files).

**Key Responsibilities:**
- Store task metadata
- Persist user configuration
- Enable state recovery on restart

### ExtensionState (Broadcast Object)
Aggregated state sent to webview via `postStateToWebview()`.

**Includes:**
- Current active task
- All task history
- User preferences
- MCP server status
- Authentication tokens

---

## Integration Implementation Examples

### File Writer Helper (JavaScript)
```javascript
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

### Relay Webhook Handler (JavaScript)
```javascript
// In relay server (localhost:8765)
app.post('/cline/task', (req, res) => {
  const { project, title, description, priority } = req.body;
  const projectDir = path.join(process.env.HOME, 'environment', 'projects', project);
  const filename = createClineTask(projectDir, { title, description, priority });
  res.json({ success: true, file: filename });
});
```

---

## Naming Conventions

### Task File Naming
```
task_<date>_<id>_<title>.md
├── date: YYYY-MM-DD (from ISO8601 timestamp)
├── id: base36(timestamp) or UUID
└── title: lowercase, hyphenated, max 40 chars

Example: task_2026-04-03_abc123_implement-auth.md
```

### Git Worktree Branches
```
agentkanban/<task-slug>
Example: agentkanban/implement-user-auth
```

### Worktree Directory Structure
```
../repo-worktrees/<task-slug>/
Example: ../repo-worktrees/implement-user-auth/
```
