# Cline Kanban Research Findings
Last updated: 2026-04-03
Source: ~/environment/reports/cline-kanban-research.md

## Key Questions and Answers

### Q: Is Cline Kanban a published tool or research project?
**A:** Cline Kanban is a terminal-launched web application maintained in a public repository (https://github.com/cline/kanban) with 776 commits and 467 stars as of April 2026. It's actively maintained and separate from the Cline VS Code extension, though they share Cline Core. It's described as a "research preview" but is production-usable.

### Q: What's the difference between "Cline Kanban" and "VS Code Agent Kanban"?
**A:** 
- **Cline Kanban:** Official Cline tool, browser-based, launched from terminal, no documented external API
- **VS Code Agent Kanban:** Third-party extension (appsoftwareltd/vscode-agent-kanban), file-based tasks (.agentkanban/), Elastic License 2.0
Both can coexist in the Cline ecosystem.

### Q: Can Cline Kanban be integrated with an external relay system?
**A:** Yes. Four integration paths exist (file-based, CLI headless, gRPC, MCP bridge). File-based is most stable and requires no API calls—just file system operations. The VS Code Agent Kanban format (.agentkanban/tasks/) is the most integration-friendly since it's plain Markdown with YAML frontmatter.

### Q: What's the recommended integration approach for a relay system?
**A:** Start with **Phase 1 (file-based)**: write task files to `.agentkanban/tasks/` directory. The VS Code Agent Kanban extension watches this directory and picks up changes automatically. Then move to **Phase 2 (MCP bridge)** for bidirectional communication once file-based is stable. gRPC integration is possible but API documentation is still evolving.

### Q: Does Cline Kanban support task linking and dependencies?
**A:** Yes. Tasks can be linked (Cmd+click) to create dependency chains. When a card completes and is trashed, linked tasks auto-start. This is built into the Kanban UI.

### Q: What happens when a task card is executed?
**A:** 
1. An ephemeral git worktree is created with a new branch
2. A dedicated terminal is spawned for that worktree
3. An agent is launched in that context
4. Hooks display latest message/tool call on the card for monitoring
5. Inline diff review with PR-style commenting is available
6. Results appear in the task conversation history

### Q: Does Cline Kanban support multiple simultaneous tasks?
**A:** Yes. That's its primary use case. Unlike the VS Code extension (which has a single active Task at a time in the Controller), Cline Kanban CLI instances can run tasks in parallel with separate git worktrees and terminals.

### Q: Can Cline work with external MCP servers?
**A:** Yes. Cline has first-class MCP support with:
- Built-in MCP marketplace for installing servers
- Custom MCP servers can be created on demand
- MCP rules auto-select servers based on conversation context
- External tools connect via MCP stdio or URL transport

### Q: What's the current state of Cline's external API (gRPC)?
**A:** 
- Proto definitions are available in the Cline source (`src/standalone/`)
- The external API proposal (GitHub issue #4886) was closed as "completed"—functionality is covered by the gRPC system
- Full gRPC documentation is pending
- The API surface is still evolving; breaking changes are possible
- **Not recommended for production integration until docs stabilize**

### Q: How does Cline Core manage state?
**A:** 
- `StateManager` persists settings and task state to disk (JSON files)
- gRPC-over-postMessage transport for type-safe, streaming communication between webview and extension
- State is broadcast via `postStateToWebview()` with aggregated `ExtensionState`
- Single active `Task` instance per Controller (in extension mode)

### Q: Can I write task files directly and have Cline pick them up?
**A:** Yes, this is the file-based integration approach. Since .agentkanban task files are plain Markdown with YAML frontmatter, any external system can create/update tasks by writing files. The VS Code Agent Kanban extension uses a file watcher to detect changes automatically.

### Q: What's the task file naming convention?
**A:** `task_<YYYY-MM-DD>_<id>_<slug>.md` where:
- Date is extracted from the ISO8601 timestamp
- ID is typically base36(timestamp) or UUID
- Slug is lowercase, hyphenated, max 40 characters
- Example: `task_2026-04-03_abc123_implement-auth.md`

### Q: Are there hooks available for custom logic injection?
**A:** Yes. Cline v3.36+ introduced hooks for:
- Pre/post hooks on tool execution
- File change detection
- Command execution hooks
- Custom logic injection points
Kanban uses hooks to display agent status on cards.

### Q: Can Cline run headless in JSON mode for machine consumption?
**A:** Yes. `cline task "prompt" --json` streams `ClineMessage` objects as newline-delimited JSON. Each line is a JSON object with `type`, `timestamp`, and `content` fields. Also supports `-y`/`--yolo` for auto-approval.

### Q: Does Cline support the Agent Client Protocol (ACP)?
**A:** Yes. When started with `--acp`, Cline runs as an ACP server over stdio with JSON-RPC 2.0 communication. This works with JetBrains, Neovim, Zed, and any ACP-compatible editor. It translates between ACP protocol and Cline's internal gRPC architecture.

### Q: What are the main risks with Cline integration?
**A:** 
- **gRPC API not fully documented** — source available but API surface evolving
- **File format changes** — .agentkanban format could change between versions
- **Worktree conflicts** — if both systems manage git worktrees, coordination needed
- **Authentication** — Cline API (api.cline.bot) requires bearer tokens; local gRPC may not
- **ACP is young** — standard still being adopted across editors
- **Cline Kanban is research preview** — may change significantly

### Q: What's the mitigation strategy?
**A:** 
- Start with file-based approach (most stable, least coupling)
- Pin Cline version in production
- Use MCP bridge for bidirectional communication (leverages existing infrastructure)
- Monitor Cline changelog for breaking changes
- Vendor .agentkanban schema validation

### Q: Can Cline tasks be created programmatically from an external system?
**A:** Yes, multiple ways:
1. **File-based (simplest):** Write Markdown files with YAML frontmatter to `.agentkanban/tasks/`
2. **CLI (medium):** Call `cline task "prompt" --json` and parse the output
3. **MCP bridge (most elegant):** Create an MCP server exposing task creation as a tool
4. **gRPC (most powerful, least documented):** Connect directly to Cline Core's gRPC services

### Q: What tooling is needed to implement Phase 1 (file-based integration)?
**A:** 
- A file writer (Node.js fs module, Python pathlib, etc.)
- YAML parser/dumper library
- File watcher to detect when tasks complete (fs.watch or similar)
- Knowledge of the .agentkanban/tasks/ directory location in your project
- No additional dependencies on Cline CLI itself

### Q: How would relay system and Cline tasks coordinate?
**A:** 
1. CEO requests change via relay
2. Relay endpoint `/cline/task` receives request
3. File writer creates task file in `.agentkanban/tasks/`
4. Cline Kanban UI or CLI picks up the new task
5. Agent executes the task in its worktree
6. File watcher detects lane change (to "done")
7. Relay notifies CEO of completion

This keeps both systems in sync without tight API coupling.
