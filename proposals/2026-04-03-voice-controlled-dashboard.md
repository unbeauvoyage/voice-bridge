---
title: Voice-Controlled Dashboard Interface
date: 2026-04-03
status: proposed
---

# Voice-Controlled Dashboard Interface
**Proposed:** 2026-04-03
**For:** CEO
**Status:** pending

## Problem

The 3D agent dashboard (React Three Fiber) requires mouse/keyboard interaction. The CEO operates remotely and via voice. Controlling the dashboard by voice currently requires routing through AI inference (token cost, latency, hallucination risk). We need a deterministic, zero-inference voice command layer that maps speech to dashboard actions with sub-100ms execution time after transcription.

---

## Architecture

```
Voice → Whisper → Text → Command Parser → Structured Command → Handler → Dashboard API → UI Adapter → R3F/Babylon/etc
                              ↑                                     ↑
                       Pattern Registry                      Abstract Interface
                     (category buckets,                   (swappable per engine)
                      fuzzy matching)
```

### Layers

| Layer | Responsibility | Framework coupling |
|---|---|---|
| **Voice Input** | Mic capture → Whisper transcription | None (already exists) |
| **Command Parser** | Text → `{ action, target, params }` | None |
| **Command Registry** | Pattern map, fuzzy match, category index | None |
| **DashboardController** | Dispatch, lifecycle, plugin surface | None |
| **Dashboard API** | Abstract interface (showPanel, zoom, etc.) | None |
| **UI Adapter** | R3F/Babylon/Pixi implementation of Dashboard API | Framework-specific |

Only the UI Adapter touches framework code. Swapping 3D engines means writing a new adapter — everything above it stays unchanged.

---

## Command Structure

All commands resolve to a normalized object:

```typescript
interface DashboardCommand {
  action: string;          // "show" | "hide" | "zoom" | "navigate" | "approve" | "assign" | "filter" | "sort" | "refresh" | "help"
  target: string;          // "proposals" | "messages" | "issues" | "agents" | "reports" | ...
  params: Record<string, unknown>;  // action-specific
  raw: string;             // original transcribed text (for logging)
  confidence: number;      // 0-1, match quality from fuzzy matching
}
```

Examples:

```typescript
{ action: "show",     target: "proposals",  params: {},                       raw: "show proposals",              confidence: 1.0 }
{ action: "show",     target: "messages",   params: { from: "command", limit: 5 }, raw: "show last 5 messages from command", confidence: 0.94 }
{ action: "zoom",     target: "issues",     params: {},                       raw: "zoom to issues",              confidence: 1.0 }
{ action: "approve",  target: "proposal",   params: { id: 3 },                raw: "approve proposal 3",          confidence: 0.97 }
{ action: "assign",   target: "issue",      params: { to: "productivitesse" }, raw: "assign issue to productivitesse", confidence: 0.91 }
{ action: "filter",   target: "agents",     params: { status: "idle" },       raw: "show idle agents",            confidence: 0.88 }
{ action: "navigate", target: "agent",      params: { name: "command" },      raw: "go to command agent",         confidence: 0.95 }
{ action: "help",     target: "navigation", params: {},                       raw: "what navigation commands",    confidence: 0.99 }
```

---

## Command Parser Design

### Pattern matching — not LLM

The parser uses a two-stage pipeline:

**Stage 1 — Slot extraction (regex)**

Patterns are compiled regexes with named capture groups:

```javascript
// Pattern definition
{
  pattern: /^show\s+(?:last\s+(?<limit>\d+)\s+)?messages(?:\s+from\s+(?<from>\w+))?$/i,
  action: "show",
  target: "messages",
  params: (match) => ({
    limit: match.groups.limit ? parseInt(match.groups.limit) : undefined,
    from: match.groups.from
  })
}
```

**Stage 2 — Fuzzy fallback (Levenshtein / trigram)**

If no regex matches exactly, normalize the input (lowercase, strip filler words) and compare against a pre-built index of command canonical forms. Score by trigram similarity. If best score > threshold (0.75), dispatch. Below threshold, speak "I didn't catch that command."

Filler words stripped before matching:
`please, could you, can you, hey, um, uh, ok, okay, actually, just`

```javascript
// "show props" → normalized "show proposals" → trigram score 0.87 → match
// "zoom in on issues" → normalized "zoom issues" → trigram score 0.91 → match
```

### Number extraction

Spoken numbers are normalized before matching:
- "three" → 3
- "proposal three" → proposal 3
- "last five messages" → limit: 5

Uses a small lookup table (`one→1` through `twenty→20`) plus digit passthrough.

---

## Module API

### DashboardController

```typescript
class DashboardController {
  // Registration
  registerCommand(pattern: CommandPattern): void
  registerCategory(name: string, description: string): void
  setAdapter(adapter: DashboardAdapter): void

  // Execution
  execute(text: string): Promise<CommandResult>
  executeCommand(cmd: DashboardCommand): Promise<CommandResult>

  // Discovery
  listCommands(category?: string): CommandInfo[]
  findCommand(text: string): CommandMatch | null  // dry run, no side effects

  // Lifecycle
  onBeforeExecute(hook: (cmd: DashboardCommand) => void): void
  onAfterExecute(hook: (cmd: DashboardCommand, result: CommandResult) => void): void
  onUnknown(hook: (text: string) => void): void
}
```

### DashboardAdapter interface

```typescript
interface DashboardAdapter {
  // Panels
  showPanel(name: string, options?: PanelOptions): void
  hidePanel(name: string): void
  togglePanel(name: string): void
  focusPanel(name: string): void

  // Camera / spatial
  zoom(target: string, level?: number): void
  navigate(target: string): void
  resetCamera(): void

  // Data
  filter(target: string, criteria: Record<string, unknown>): void
  sort(target: string, by: string, direction?: "asc" | "desc"): void
  refresh(target?: string): void

  // Actions
  approve(target: string, id: number | string): Promise<void>
  reject(target: string, id: number | string): Promise<void>
  assign(target: string, to: string, id?: number | string): Promise<void>
  open(target: string, id?: number | string): Promise<void>

  // Feedback
  notify(message: string, level?: "info" | "warn" | "error"): void
  highlight(target: string, id?: number | string): void
  speak(text: string): void  // TTS feedback to CEO
}
```

### CommandPattern definition

```typescript
interface CommandPattern {
  id: string                    // unique, kebab-case
  category: string              // "navigation" | "data" | "actions" | "settings" | "help"
  description: string           // shown in help
  examples: string[]            // canonical spoken forms, used for fuzzy index
  pattern: RegExp               // primary match
  aliases?: RegExp[]            // additional patterns for same command
  handler: (match: RegExpMatchArray, adapter: DashboardAdapter) => Promise<void>
  requiresConfirmation?: boolean // "approve", "reject" actions prompt before executing
}
```

---

## MCP Integration

The DashboardController can be wrapped as an MCP server, exposing:

### MCP Tools exposed

```
dashboard_execute(text: string) → CommandResult
  Execute a natural-language command string

dashboard_command(action, target, params) → CommandResult  
  Execute a structured command directly (agents use this)

dashboard_list_commands(category?) → CommandInfo[]
  List available commands, optionally filtered by category

dashboard_status() → { activePanels, cameraTarget, lastCommand }
  Query current dashboard state
```

### Flow: CEO voice → MCP

```
CEO voice
  → Whisper transcription
  → Command Parser (local JS, no tokens)
  → DashboardController.execute(text)
    → [optional] MCP tool call if dashboard is remote/sandboxed
      → dashboard_command({ action, target, params })
        → UI Adapter
          → Camera/panel update
```

### Flow: Agent programmatic control

```
Agent (e.g., productivitesse team-lead)
  → relay_send to command: "highlight issue 42"
  → command agent calls dashboard_command tool
  → issues panel highlights row 42
```

Agents that need to push status to the dashboard (e.g., "I just finished a task, light up my node") call `dashboard_command` directly without going through voice. Same handler, same adapter.

---

## Framework Decoupling Strategy

### The adapter contract is the seam

All framework-specific code lives in `adapters/r3f-adapter.ts` (or babylon, pixi, etc.). The contract is `DashboardAdapter`. Swapping engines:

1. Write `adapters/babylon-adapter.ts` implementing `DashboardAdapter`
2. Call `controller.setAdapter(new BabylonAdapter(scene))`
3. Done. Commands, patterns, registry unchanged.

### State is owned by the controller, not the adapter

The adapter is stateless — it receives instructions and executes them. Panel visibility state, current filter state, active camera target — all stored in the controller's state model. This means:

- The adapter can be replaced mid-session without losing state
- Two adapters can run simultaneously (e.g., 3D view + 2D fallback)
- Tests mock the adapter trivially

### File layout

```
voice-dashboard/
  src/
    controller.ts         # DashboardController class
    parser.ts             # text → DashboardCommand
    registry.ts           # pattern registration, fuzzy index
    types.ts              # DashboardCommand, DashboardAdapter, etc.
    normalizer.ts         # filler word removal, spoken number conversion
    fuzzy.ts              # trigram similarity
    commands/
      navigation.ts       # show, hide, zoom, navigate commands
      data.ts             # filter, sort, refresh commands
      actions.ts          # approve, reject, assign commands
      settings.ts         # theme, layout, verbosity commands
      help.ts             # help, list commands
    adapters/
      r3f-adapter.ts      # React Three Fiber implementation
      mock-adapter.ts     # for tests
    mcp/
      server.ts           # MCP server wrapping DashboardController
      tools.ts            # MCP tool definitions
  tests/
    parser.test.ts
    commands.test.ts
    fuzzy.test.ts
```

---

## Example Commands (60+)

### Navigation (camera / panel)

| Voice | Action |
|---|---|
| "show proposals" | showPanel('proposals') |
| "show messages" | showPanel('messages') |
| "show issues" | showPanel('issues') |
| "show agents" | showPanel('agents') |
| "show reports" | showPanel('reports') |
| "hide proposals" | hidePanel('proposals') |
| "close issues" | hidePanel('issues') |
| "zoom to issues" | zoom('issues') |
| "zoom to command agent" | zoom('agent:command') |
| "zoom out" | resetCamera() |
| "go to proposals" | navigate('proposals') |
| "focus on messages" | focusPanel('messages') |
| "show overview" | resetCamera() + showAll() |
| "show everything" | showAll() |

### Data — messages

| Voice | Action |
|---|---|
| "show last 5 messages" | showPanel('messages', { limit: 5 }) |
| "show last 5 messages from command" | filter('messages', { from: 'command', limit: 5 }) |
| "show messages from productivitesse" | filter('messages', { from: 'productivitesse' }) |
| "show unread messages" | filter('messages', { unread: true }) |
| "show all messages" | filter('messages', {}) |

### Data — proposals

| Voice | Action |
|---|---|
| "show pending proposals" | filter('proposals', { status: 'pending' }) |
| "show approved proposals" | filter('proposals', { status: 'approved' }) |
| "open proposal 3" | open('proposal', 3) |
| "show proposal details" | focusPanel('proposals') |

### Data — issues

| Voice | Action |
|---|---|
| "show open issues" | filter('issues', { status: 'open' }) |
| "show critical issues" | filter('issues', { priority: 'critical' }) |
| "show issues for productivitesse" | filter('issues', { assignee: 'productivitesse' }) |
| "sort issues by priority" | sort('issues', 'priority', 'desc') |
| "sort issues by date" | sort('issues', 'date', 'desc') |
| "open issue 42" | open('issue', 42) |

### Data — agents

| Voice | Action |
|---|---|
| "show idle agents" | filter('agents', { status: 'idle' }) |
| "show active agents" | filter('agents', { status: 'active' }) |
| "show all agents" | filter('agents', {}) |
| "zoom to command agent" | zoom('agent:command') |
| "zoom to productivitesse" | zoom('agent:productivitesse') |
| "show agent hierarchy" | showPanel('hierarchy') |

### Actions — proposals

| Voice | Action |
|---|---|
| "approve proposal 3" | approve('proposal', 3) + confirm prompt |
| "reject proposal 2" | reject('proposal', 2) + confirm prompt |
| "approve all pending proposals" | approveAll('proposals') + confirm prompt |

### Actions — issues

| Voice | Action |
|---|---|
| "assign issue to productivitesse" | assign('issue', 'productivitesse') |
| "assign issue 7 to command" | assign('issue', 'command', 7) |
| "close issue 12" | close('issue', 12) |
| "mark issue 5 critical" | update('issue', 5, { priority: 'critical' }) |

### Refresh / sync

| Voice | Action |
|---|---|
| "refresh" | refresh() |
| "refresh messages" | refresh('messages') |
| "refresh proposals" | refresh('proposals') |
| "reload everything" | refresh() |

### Settings

| Voice | Action |
|---|---|
| "dark mode" | setSetting('theme', 'dark') |
| "light mode" | setSetting('theme', 'light') |
| "increase text size" | setSetting('textSize', +1) |
| "mute notifications" | setSetting('notifications', false) |
| "enable verbose mode" | setSetting('verbosity', 'verbose') |

### Help

| Voice | Action |
|---|---|
| "help" | speak(listCommands()) |
| "what can I say" | speak(listCommands()) |
| "navigation commands" | speak(listCommands('navigation')) |
| "action commands" | speak(listCommands('actions')) |
| "show all commands" | showPanel('command-reference') |
| "what did I just do" | speak(lastCommand.raw) |

---

## Scaling to Hundreds of Commands

### Category buckets

Commands registered by category. Parser checks category buckets in priority order (actions first — highest intent specificity, then navigation, data, settings, help). Each bucket is a flat array of compiled patterns — O(n) scan but n is bounded per category.

### Fuzzy index (pre-built at register time)

When a command is registered, its `examples` strings are tokenized into trigrams and stored in a flat index. On unmatched input, the normalized text is scored against all index entries. Trigram similarity is O(examples × avg_trigrams) — fast enough at 500+ commands.

### Category-scoped fuzzy search

If input starts with a known action word ("show", "zoom", "approve"), fuzzy search is scoped to that category only. Reduces search space ~5x.

### Command versioning

As command count grows, patterns can conflict. Each pattern has a numeric `priority` (default 100). Higher priority wins on ambiguous match. Conflicts logged at register time.

---

## Next Steps

1. **Scaffold module** — `voice-dashboard/` with types, controller skeleton, mock adapter
2. **Implement parser** — regex patterns + trigram fuzzy for the 60 commands listed above
3. **Wire to existing Whisper pipeline** — controller.execute(transcribedText)
4. **Build R3F adapter** — implement DashboardAdapter against the current 3D scene API
5. **MCP server** — wrap controller, expose tools, connect to agent relay
6. **Test coverage** — parser tests for all 60 commands + fuzzy edge cases
7. **CEO review** — demo voice → panel transition in dev environment

---

## Open Questions for CEO

- Should `approve` / `reject` commands require a spoken confirmation ("confirm") before executing, or execute immediately?
- Should the MCP server be part of the same process as the dashboard, or a separate sidecar?
- Priority: parser + R3F adapter first, or MCP server first?
