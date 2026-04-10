# Cline Kanban Overview
Last updated: 2026-04-03
Source: ~/environment/reports/cline-kanban-research.md

## What Is Cline Kanban?

Cline Kanban is a **terminal-launched web application** for orchestrating multiple CLI coding agents in parallel. It provides a browser-based kanban board interface distinct from the Cline VS Code extension, though both share the same core engine (Cline Core).

### Key Characteristics
- **Launch:** `npx kanban` or `cline kanban` from git repository root
- **Runtime:** Local web server with browser UI
- **Tech Stack:** TypeScript (97.1%), Apache 2.0 license
- **Repository:** https://github.com/cline/kanban (776 commits, 467 stars as of April 2026)
- **Compatibility:** Works with Cline CLI, Claude Code, and Codex agents

## Core Workflow

1. User creates task cards (manually or via agent task decomposition)
2. Each task card gets its own **ephemeral git worktree** and dedicated terminal
3. Clicking "play" on a card spawns an agent in that worktree
4. Tasks can be **linked** (Cmd+click) to create dependency chains
5. Linked tasks auto-start when a parent card is trashed/completed
6. Hooks display latest message/tool call on each card for at-a-glance status
7. Built-in inline diff review with PR-style commenting

## Architecture: Two Kanban Systems

### 1. Cline Kanban (Official)
- Official Cline parallel agent orchestrator
- Browser-based, launched from terminal
- No documented external API for task CRUD
- Uses git worktrees for task isolation
- Auto-detects installed CLI agents

### 2. VS Code Agent Kanban (Third-Party)
- Third-party VS Code extension (appsoftwareltd/vscode-agent-kanban)
- File-based task format: `.agentkanban/tasks/` with Markdown + YAML frontmatter
- Version-control friendly, agent-workflow-optimized
- Chat commands: `/new`, `/task`, `/worktree`, etc.
- License: Elastic License 2.0

Both are relevant to Cline's ecosystem and can coexist.

## Cline Core Architecture

### Controller (Central Orchestrator)
- Owns a single active `Task` instance at a time
- Manages `StateManager`, `McpHub`, `AuthService`
- Key methods: `initTask()`, `cancelTask()`, `postStateToWebview()`, `togglePlanActMode()`

### Task Lifecycle
1. `initTask()` assembles system prompts, builds context, starts agent loop
2. LLM returns `ApiStream` (async generator of tokens)
3. Response parsed into text and tool-use blocks
4. `ToolExecutor` dispatches execution (files, commands, browser, MCP)
5. Human approval via `Task.ask()` (suspends execution)
6. Tool results appended to history; next turn begins
7. Completion via `attempt_completion` block

### State Management
- `StateManager` persists settings and task state to disk (JSON files)
- gRPC-over-postMessage transport for type-safe, streaming communication between webview and extension
- State broadcast via `postStateToWebview()` with aggregated `ExtensionState`

## Key Limitations

- **Single active task in VS Code extension** - Controller owns one Task at a time (Kanban CLI instances work around this)
- **gRPC API not fully documented** - source available but API surface is evolving
- **Cline Kanban is research preview** - may change significantly
- **File-based integration requires convention** - both systems must agree on frontmatter schema
