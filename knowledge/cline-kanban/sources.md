# Cline Kanban Research Sources
Last updated: 2026-04-03
Source: ~/environment/reports/cline-kanban-research.md

## Primary Repositories

### Cline (Official)
- **URL:** https://github.com/cline/cline
- **Type:** Main Cline agent orchestration framework
- **Tech:** TypeScript
- **Relevant paths in repo:**
  - `src/standalone/` - gRPC service definitions and external API
  - `src/core/` - Cline Core engine (shared by extension and CLI)
  - `src/services/` - StateManager, McpHub, AuthService

### Cline Kanban (Official)
- **URL:** https://github.com/cline/kanban
- **Type:** Terminal-launched web application for parallel task orchestration
- **Stats:** 776 commits, 467 stars (April 2026)
- **License:** Apache 2.0
- **Tech Stack:** TypeScript (97.1% of codebase)
- **Purpose:** Browser-based kanban board for orchestrating multiple CLI agents

### VS Code Agent Kanban (Third-Party)
- **URL:** https://github.com/appsoftwareltd/vscode-agent-kanban
- **Type:** VS Code extension with file-based task format
- **License:** Elastic License 2.0
- **Task Storage:** `.agentkanban/` directory with Markdown + YAML frontmatter
- **Relevant for:** Understanding the file-based integration approach and task schema

---

## Documentation Resources

### Official Cline Docs
- **Cline Kanban Docs:** https://docs.cline.bot/kanban/overview
- **Cline API Docs:** https://docs.cline.bot/api/overview
- **Cline CLI/ACP Docs:** https://docs.cline.bot/cline-cli/acp-editor-integrations

### Standards and Specifications
- **Agent Client Protocol (ACP):** https://acpserver.org/
- **Model Context Protocol (MCP):** [Implicit reference; Cline has built-in support]

### Alternative Resources
- **DeepWiki Cline Architecture:** https://deepwiki.com/cline/cline
- **Cline Hooks Announcement (v3.36):** https://cline.ghost.io/cline-v3-36-hooks/

---

## GitHub Issues and Proposals

### External API Proposal
- **Issue:** https://github.com/cline/cline/issues/4886
- **Status:** Closed as "completed"
- **Relevance:** The external API functionality is covered by the gRPC system. Full gRPC documentation is pending.

---

## Key Technical References from Research

### Cline Core Architecture (From Source)
- **Controller:** Central orchestrator managing single active Task instance
- **StateManager:** Persists settings and task state to disk (JSON files)
- **McpHub:** Manages MCP server connections and tool execution
- **AuthService:** Handles API key and authentication token management
- **Task Lifecycle:** initTask() → ApiStream → parsing → ToolExecutor dispatch → approval → history append → next turn → completion

### Integration Code Examples (From Research)
These code examples are from the research report and demonstrate integration patterns:
- **File Writer Helper:** JavaScript functions for creating/updating task files
- **YAML Frontmatter Schema:** Complete task metadata structure
- **Relay Webhook Handler:** Example `/cline/task` endpoint

---

## Version and Compatibility Information

### Cline Release Timeline
- **Cline v3.36+:** Introduced hooks system for custom logic injection
- **Latest (April 2026):** Kanban repo at 776 commits with active development

### Compatibility Matrix
- **Cline CLI:** Works with Claude Code, Codex agents
- **VS Code Extension:** Single active Task in Controller (workarounds via Kanban CLI instances)
- **ACP Integration:** Works with JetBrains, Neovim, Zed editors
- **MCP Support:** Built-in marketplace, custom servers, stdio/URL transport

---

## Related Ecosystems

### Agent Orchestration
- **Claude Code:** Anthropic's official CLI for Claude
- **Codex:** Secondary agent framework compatible with Cline Kanban
- **VS Code Extension:** Alternative frontend for Cline Core

### Development Standards
- **Git Worktrees:** Used by Kanban for task isolation
- **gRPC:** Type-safe RPC framework for Cline Core API
- **MCP (Model Context Protocol):** First-class plugin system
- **JSON-RPC 2.0:** Protocol for ACP and external communication

---

## Research Methodology Notes

The research report synthesized information from:
1. Official GitHub repositories (Cline, Kanban, VS Code Agent Kanban)
2. Cline documentation website (docs.cline.bot)
3. Source code analysis (proto definitions, TypeScript implementation)
4. Issue discussions (External API proposal #4886)
5. Release notes and blog posts (Hooks announcement v3.36)
6. Third-party ecosystem analysis

The report identified two distinct kanban systems and evaluated four integration approaches (file-based, CLI, gRPC, MCP) with specific tradeoffs for the relay system at localhost:8765.

---

## Files Referenced in Knowledge Base

These knowledge files provide structured information for expert agents:
- `overview.md` — Architecture overview, key concepts, what Cline Kanban is
- `integration.md` — How to integrate with relay system (focus on MCP bridge path)
- `api.md` — All endpoints, types, interfaces (file-based .agentkanban/ schema, CLI flags, MCP tools)
- `findings.md` — Q&A pairs answering specific research questions
- `sources.md` — This file (GitHub URLs, commit SHAs, paths studied)
