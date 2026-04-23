# System Bootstrap Guide

Complete reconstruction guide for the multi-agent Claude Code environment at `~/environment/`. A fresh Mac with Claude Code installed can be brought to a fully running state by following this document end-to-end.

---

## Quick Start Checklist

1. [ ] Install system dependencies: nvm/Node v24.11.0, bun 1.3+, Python 3.14, ffmpeg, pm2, cmux
2. [ ] Clone the environment repo to `~/environment/`
3. [ ] Clone `message-relay` as a submodule and build it: `cd ~/environment/message-relay && npm install && npm run build`
4. [ ] Install relay dependencies: `cd ~/environment/message-relay && npm install`
5. [ ] Install voice-bridge dependencies: `cd ~/environment/projects/voice-bridge2 && bun install && pip install -r daemon/requirements.txt` in a Python 3.14 venv
6. [ ] Create the `~/.claude/relay-channel/` directory for channel port files
7. [ ] Copy `~/.claude/settings.json` (see Section 2) — contains all hooks and plugin config
8. [ ] Install pm2 processes: `cd ~/environment/message-relay && pm2 start ecosystem.config.js && pm2 save`
9. [ ] Add additional pm2 processes: whisper-server, voice-bridge-server, voice-bridge-indicator
10. [ ] Install LaunchAgents: `com.riseof.pm2.plist` (auto-resurrect pm2) and `com.riseof.wake-word.plist` (wake-word daemon)
11. [ ] Load LaunchAgents: `launchctl load ~/Library/LaunchAgents/com.riseof.pm2.plist && launchctl load ~/Library/LaunchAgents/com.riseof.wake-word.plist`
12. [ ] Verify relay is running: `curl -s http://localhost:8767/health`
13. [ ] Spawn the `command` session: `~/environment/scripts/spawn-session.sh project-manager command ~/environment sonnet`
14. [ ] Spawn other persistent agents (atlas, sentinel, matrix, signal, productivitesse, voice-bridge)

---

## 1. CLAUDE.md Hierarchy

The system uses a three-tier hierarchy of instruction files. All Claude Code sessions load them automatically based on working directory.

### Tier 1 — Environment (`~/environment/CLAUDE.md`)

The source of truth for all system-wide rules. Key sections:

- **Identity detection** — every agent runs `echo $RELAY_AGENT_NAME` on startup and reads its definition from `~/.claude/agents/$name.md`
- **Background rule** — all commands over ~2 seconds use `Bash(run_in_background: true)`; blocking = CEO cannot reach you
- **Session naming** — relay name, `--name`, and cmux workspace must all match exactly; enforced by `spawn-session.sh`
- **Agent identity rule** — every persistent agent must have a definition file in `.claude/agents/`; type vs instance name are distinct
- **TDD is absolute** — failing test first, report test name before implementing, no `skip()`, show real test output before reporting done
- **Fire-and-forget CEO** — every result must be pushed via relay; CLI-only output is invisible to CEO
- **Message types** — `done`/`status`, `waiting-for-input`, `escalate`, `message` — wrong type misroutes CEO attention
- **Database standard** — Drizzle ORM; SQLite default, PostgreSQL for production; same schema works for both
- **Output formats** — all output files use frontmatter + markdown body; canonical schemas in `~/environment/FORMATS.md`
- **Passive distillation** — CEO curiosity phrases trigger Q&A file creation and relay signal to command
- **Model policy** — command/PMs: Sonnet; domain experts: Sonnet; disposable one-shots: Haiku; Opus only when task is genuinely hard
- **cmux valid uses** — pane reading, channel approval on launch, emergency terminal injection only; never for messaging
- **BACKLOG structure** — Backlog / Active / Done / Learnings; only CEO moves items to Active

### Tier 2 — Common to all projects (`~/environment/.claude/CLAUDE-common-to-all-projects.md`)

Applies to every project. Key sections:

- **Agent team tools** — `SendMessage`, `TeamCreate`, `TeamDelete`, `TaskCreate/Update/Get/List/Stop`, `Agent`
- **TeamCreate for everything** — all research and coding tasks; Agent tool only for truly atomic one-shots
- **Persistent single teammate** — `Agent` with `team_name` parameter for one persistent agent without full TeamCreate
- **Testing strategy** — spec-first workflow; coder writes `specs/feature-name.md` before any code; tester reads spec independently; no verbal handoffs
- **Test categories** — silent-failure guards, business logic, E2E smoke tests (Playwright); no pixel snapshots, no library internals

### Tier 3 — Project CLAUDE.md files

Each project file extends the environment file and documents what it overrides and why. Never duplicates rules — always references the parent with `See ~/environment/CLAUDE.md`.

**`~/environment/projects/productivitesse/CLAUDE.md`** adds:
- Branch policy: `main` = production (CEO approval only), `dev`/feature = normal development
- Git rebase policy: rebase not merge for feature branches; fast-forward only into dev
- Parallel agent worktrees in `.claude/worktrees/{name}/`
- Visual verification: Playwright screenshot + Read tool to visually confirm UI features
- OTA server on port 8769 for over-the-air iOS deploys
- Capacitor config (`capacitor.config.ts`) for iOS builds

**`~/environment/projects/knowledge-base/CLAUDE.md`** adds:
- Bun-first rules: `bun` over `node`, `Bun.serve()` over express, `bun:sqlite` over better-sqlite3
- Chrome extension as primary interface — features must work in extension first
- Two test layers: `tests/*.spec.ts` (Playwright E2E) and `src/db/*.test.ts` (`bun test` unit)
- Restart server after every task: `bash scripts/restart-server.sh`

---

## 2. Hooks (`~/.claude/settings.json`)

The settings file wires all hooks, registers plugins, and sets global permissions. The complete file lives at `~/.claude/settings.json`. Key sections:

### Global env and permissions
```json
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
  "permissions": {
    "allow": ["mcp__message-relay__relay_send", "mcp__message-relay__relay_poll", "mcp__message-relay__relay_status"]
  },
  "skipDangerousModePermissionPrompt": true,
  "model": "sonnet",
  "voiceEnabled": true
}
```

`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` enables `TeamCreate`/`SendMessage`/`TaskCreate` tools.

### SessionStart hooks
1. `bash ~/environment/message-relay/scripts/register-session.sh` — POSTs `{session_id, agent_name}` to `http://localhost:8767/register-session`. Uses `RELAY_AGENT_NAME` env var. Silent if relay is down.
2. `node ~/.claude/agent-flow/hook.js` — AgentFlow visualization hook (timeout 2s).

### UserPromptSubmit hooks
1. `bash ~/environment/message-relay/scripts/poll-messages.sh` — fetches unread messages for this agent from `/history/{agent}` and surfaces them as `[MESSAGE from X]: ...` in the prompt context. Uses cursor file at `~/.claude/hub-cursor-{agent}`.
2. `bash ~/environment/scripts/distill-ceo-message.sh` (async) — pattern-matches CEO curiosity phrases (`I wonder`, `I'm curious`, etc.), writes a question file to `~/environment/questions/`, and POSTs a `[Q&A SIGNAL]` to command.
3. `/Users/riseof/environment/scripts/relay-ceo-message.sh` — relays the raw CEO CLI message to `http://localhost:8767/send` (to `command` by default, or `@agent-name:` prefix to target a specific agent). Skips if `RELAY_AGENT_NAME` is set (agent sessions, not CEO).

### PermissionRequest hook
- HTTP POST to `http://localhost:8767/hook/permission` (timeout 60s) — relay routes to manager for approve/deny. This is the Tier 3 permission monitoring path.

### PreToolUse hooks
1. `bash ~/environment/bin/hook-event.sh PreToolUse` (async) — POSTs `{agent, session_id, event, tool, summary}` to `http://localhost:8767/hook-event` for dashboard activity tracking.
2. AgentFlow hook.

### PostToolUse hooks
1. `bash ~/environment/bin/hook-event.sh PostToolUse` (async) — same as PreToolUse but fires after.
2. `bash /Users/riseof/environment/.claude/hooks/testing-gate/on-code-edit.sh` (async) — marks session dirty when `.ts/.tsx/.js/.jsx/.py/.swift/.go/.rs` files are edited. Writes to `/tmp/tg-dirty-{session}-{cwd-hash}`.
3. `bash /Users/riseof/environment/.claude/hooks/testing-gate/on-bash.sh` (async) — detects test commands (`playwright`, `bun test`, `vitest`, `jest`, `pytest`); if tests pass, clears the dirty flag. If tests fail, records failure.
4. AgentFlow hook.

### Stop hooks
1. `bash /Users/riseof/environment/.claude/hooks/testing-gate/stop-gate.sh` (timeout 30s) — **blocking gate**. If dirty file exists (code edited but no test run since), returns `{"decision":"block","reason":"..."}` listing the edited files. Agent cannot finish until tests are run.
2. `bash ~/environment/bin/hook-event.sh Stop` (async) — fires hook-event for Stop.
3. `bash ~/environment/scripts/session-mirror.sh` (async) — reads last assistant text from the session transcript JSONL, deduplicates against relay history, and POSTs it to relay so it appears in the dashboard chat even if the agent didn't explicitly send a message.
4. AgentFlow hook.

### Other hooks
- `PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `Notification`, `SessionEnd` — all fire the AgentFlow hook.

### Status line
Custom status bar formula showing context window: `ctx: X% used / Y% left | Zk tokens`.

### Enabled plugins
```json
"enabledPlugins": {
  "rust-analyzer-lsp@claude-plugins-official": true,
  "swift-lsp@claude-plugins-official": true,
  "hub-channel@hub-plugins": true,
  "codex@openai-codex": true,
  "relay-channel@relay-plugins": true
}
```

### Plugin marketplace registrations
```json
"extraKnownMarketplaces": {
  "hub-plugins": { "source": { "source": "directory", "path": "/Users/riseof/environment/message-relay/marketplace" } },
  "openai-codex": { "source": { "source": "github", "repo": "openai/codex-plugin-cc" } },
  "relay-plugins": { "source": { "source": "directory", "path": "/Users/riseof/environment/message-relay/marketplace" } }
}
```

Both `hub-plugins` and `relay-plugins` point to the same directory: `~/environment/message-relay/marketplace/`.

---

## 3. Plugins

### relay-channel plugin

**Location:** `~/environment/message-relay/marketplace/relay-channel/`

**What it does:** Each Claude Code session runs this as a local MCP channel plugin. It starts an HTTP server on a random port, writes the port to `~/.claude/relay-channel/{agent-name}.port`, and registers with the relay. When the relay wants to deliver a message to an agent, it reads the port file and POSTs to `http://127.0.0.1:{port}/message`. The agent receives the message as a `<channel source="relay" from="...">` tag — no terminal injection needed.

**How it is loaded:** All session launches include:
```bash
claude --dangerously-load-development-channels plugin:relay-channel@relay-plugins
```
The `relay-plugins` marketplace entry resolves to `~/environment/message-relay/marketplace/`, where `relay-channel/` lives.

**First-launch approval:** The first time a session loads a development channel plugin, Claude Code shows a numbered prompt. `spawn-session.sh` automatically sends `1` + Enter via cmux after a 5-second delay to approve it.

**Port files:** After approval, port files are written to `~/.claude/relay-channel/{name}.port`. The relay reads these to deliver messages. Stale port files from dead sessions are cleaned up by `spawn-session.sh` before launching.

**Heartbeat:** The plugin re-registers with the relay every 30 seconds, surviving relay restarts.

### hub-channel plugin

**Location:** `~/environment/message-relay/marketplace/channel-plugin/` (same marketplace dir, different subfolder)

Also registered as `hub-channel@hub-plugins`. Used for hub-style message delivery — same marketplace directory as relay-plugins.

### codex plugin

Registered from GitHub (`openai/codex-plugin-cc`). Provides `/codex:review`, `/codex:adversarial-review`, `/codex:rescue`, `/codex:status`, `/codex:result` slash commands for interactive sessions.

### AgentFlow plugin

**Location:** `~/.claude/agent-flow/hook.js`

Fires on every hook event (PreToolUse, PostToolUse, SubagentStart, SubagentStop, Notification, SessionEnd). Provides the visual node graph in the AgentFlow panel.

---

## 4. Session Spawn Scripts

### Primary script: `~/environment/scripts/spawn-session.sh`

**Usage:**
```bash
spawn-session.sh <type> <name> [cwd] [model] [uuid]
```

**Parameters:**
- `type` — agent definition name (e.g. `project-manager`, `team-lead`, `system-expert`)
- `name` — instance name (e.g. `command`, `atlas`, `productivitesse`, `matrix`)
- `cwd` — working directory; defaults to `~/environment`
- `model` — optional model override (`haiku`, `sonnet`, `opus`); defaults to agent definition's `model` field
- `uuid` — session UUID to resume; generates a new one if omitted

**What the script does:**
1. Guards against non-manager callers (only `command`, `atlas`, `sentinel` may call this)
2. Checks for existing workspace with the same name — exits if duplicate found
3. Checks for stale port files at `~/.claude/relay-channel/{name}.port` — validates or removes them
4. Kills any existing Claude processes with `--name {name}` to prevent channel conflicts
5. Copies agent definition from `~/environment/.claude/agents/{type}.md` into the project's `.claude/agents/` if not already there
6. Launches via cmux with all required flags: `RELAY_AGENT_NAME={name}`, `RELAY_SESSION_ID={id}`, `--agent {type}`, `--dangerously-load-development-channels plugin:relay-channel@relay-plugins`, `--permission-mode bypassPermissions`, `--resume {uuid}`, `--name {name}`, `--remote-control`
7. Renames the cmux workspace to the instance name
8. Waits 5 seconds and sends `1` + Enter to approve the channel plugin prompt

**The full launch command built by the script:**
```bash
RELAY_AGENT_NAME={name} RELAY_SESSION_ID={session_id} claude \
  --agent {type} \
  --model {model} \
  --dangerously-load-development-channels plugin:relay-channel@relay-plugins \
  --permission-mode bypassPermissions \
  --resume {uuid} \
  --name {name} \
  --remote-control
```

### Convenience wrappers

**`~/environment/scripts/spawn-manager.sh`:**
```bash
spawn-manager.sh <name> <uuid> [cwd] [model]
# Calls: spawn-session.sh project-manager $name $cwd $model $uuid
```

**`~/environment/scripts/spawn-team-lead.sh`:**
```bash
spawn-team-lead.sh <name> <uuid> <cwd>
# Calls: spawn-session.sh team-lead $name $cwd "" $uuid
```

### Environment variables used by spawn

| Variable | Set by | Purpose |
|---|---|---|
| `RELAY_AGENT_NAME` | spawn-session.sh | Agent's messaging identity; read by hooks and the channel plugin |
| `RELAY_SESSION_ID` | spawn-session.sh | Unique per-launch ID; passed to channel plugin to associate with the relay session |
| `RELAY_PARENT_AGENT` | optional, caller-set | If set, register-session.sh includes it in the registration payload as parent |
| `HUB_AGENT_NAME` | alias for RELAY_AGENT_NAME | Legacy compatibility; poll-messages.sh reads either |
| `HUB_URL` | optional | Override for relay URL; defaults to `http://localhost:8767` |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `~/.claude/settings.json` env | Enables TeamCreate/SendMessage/Task tools |

---

## 5. Relay Setup

### Architecture

The lean relay is a Fastify HTTP server that also runs a WebSocket server for dashboard streaming. It lives in `~/environment/message-relay/` (git submodule).

**Ports:**
- `8767` — HTTP (primary relay, used by all agents)
- `8768` — HTTPS (same relay-lean process, `LEAN_RELAY_HTTPS=true`)

**WebSocket endpoint:** `ws://localhost:8767/dashboard` — streams JSONL watcher events (agent activity) plus a snapshot of known sessions on connect. 30-second heartbeat.

### Key relay endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/send` | Route a message to an agent or CEO |
| `GET` | `/health` | Liveness check |
| `GET` | `/status` | List agents and their channel status |
| `GET` | `/channels` | List active channel registrations |
| `GET` | `/history/{agent}` | Message history for an agent |
| `POST` | `/register-session` | Called by SessionStart hook to link session_id to agent name |
| `POST` | `/hook/permission` | PermissionRequest hook target; queues for manager approval |
| `POST` | `/hook-event` | PreToolUse/PostToolUse/Stop activity events |
| `POST` | `/proposals` | Write a proposal file to `~/environment/proposals/` |

### Message delivery path

```
Agent calls relay_send(to: "target", ...)
    → relay reads ~/.claude/relay-channel/{target}.port
    → POST http://127.0.0.1:{port}/message
    → channel plugin receives it
    → agent sees <channel source="relay" from="..."> tag
```

If no port file exists, the message is queued on disk in `~/environment/message-relay/queues/{target}.json` and delivered when the agent next registers.

### pm2 processes

Defined in `~/environment/message-relay/ecosystem.config.js`:

| pm2 name | Script | Port/purpose |
|---|---|---|
| `message-relay-lean` | `dist/relay-lean.js` | HTTP relay on port 8767 |
| `message-relay-lean-https` | `dist/relay-lean.js` | HTTPS relay on port 8768 |
| `monitor-tier1` | `scripts/start-monitor.sh` | 5-second pane polling for permission dialogs |
| `monitor-tier2` | `scripts/start-monitor-llm.sh` | LLM-assisted monitoring (currently stub) |

Additional pm2 processes (registered separately, not in ecosystem.config.js):

| pm2 name | Script | Purpose |
|---|---|---|
| `whisper-server` | whisper.cpp binary | Speech-to-text on port 8766 |
| `voice-bridge-server` | `bun run server/index.ts` | Voice bridge HTTP/WebSocket server on port 3030 |
| `voice-bridge-indicator` | `daemon/menubar.py` | macOS menu bar status indicator |

### Build and start relay
```bash
cd ~/environment/message-relay
npm install
npm run build          # tsc → dist/
pm2 start ecosystem.config.js
pm2 save               # persist process list for LaunchAgent resurrection
```

### Relay source structure
```
message-relay/
  src/
    relay-lean.ts     # main server
    relay-core.ts     # core routing logic
    persistence.ts    # message queue / history storage
    delivery.ts       # channel delivery (port file lookup + HTTP POST)
    discovery.ts      # agent session discovery
    jsonlWatcher.ts   # JSONL transcript watcher for dashboard
    types.ts          # shared types
    logger.ts
    mime-sniff.ts
    send-dedup.ts
  marketplace/
    relay-channel/    # channel plugin (Bun, MCP SDK)
    channel-plugin/   # hub-channel variant
    plugins/
      relay-channel/  # symlink or copy for relay-plugins marketplace
  ecosystem.config.js
```

---

## 6. Agent Definitions

All definitions live in `~/environment/.claude/agents/`. Each file has YAML frontmatter (`name`, `description`, `model`, optionally `tools`, `color`, `isolation`) followed by the system prompt body.

| File | Instance name | Model | Role |
|---|---|---|---|
| `project-manager.md` | `command`, `atlas`, `sentinel` | haiku (sonnet for command) | Routes messages, files BACKLOG/SESSIONS/ISSUES, spawns specialists |
| `chief-of-staff.md` | `chief-of-staff` | sonnet | Cross-project coding manager; owns standards and architecture |
| `team-lead.md` | `productivitesse`, `voice-bridge` | sonnet | Coordinates feature work; never codes; spawns coders/reviewers/testers |
| `system-expert.md` | `matrix` | sonnet | Owns CLAUDE.md files, CONCEPTS.md, relay architecture docs, BACKLOG hygiene |
| `communications-expert.md` | `signal` | sonnet | Owns relay health; monitors queue depth, zombie channels, delivery failures |
| `ux-expert.md` | `prism` | sonnet | CEO experience; owns dashboard UX, information architecture |
| `security-expert.md` | _(spawned on demand)_ | sonnet | Reviews risky operations; approves or denies high-risk permission requests |
| `agency-lead.md` | agency instance names | sonnet | Research/analysis project leads (non-coding) |
| `coder.md` | feature-named (e.g. `auth-endpoint`) | sonnet | TDD implementer; writes failing test first; works in assigned worktree |
| `code-reviewer.md` | _(spawned per review)_ | sonnet | Read-only reviewer; verifies against spec |
| `tester.md` | _(spawned per test cycle)_ | sonnet | Writes and runs integration/E2E tests from spec |
| `test-writer.md` | _(spawned pre-implementation)_ | sonnet | Writes test plan before coder starts |
| `researcher.md` | _(spawned per task)_ | sonnet | Deep investigation; produces structured findings with sources |
| `designer.md` | _(persistent in TeamCreate)_ | sonnet | Maintains `DESIGN-SYSTEM.md`; reviews components before build |
| `spec-writer.md` | _(spawned for complex features)_ | sonnet | Writes `specs/{feature}.spec.md` for ambiguous requirements |
| `proposal-writer.md` | _(spawned per proposal)_ | sonnet | Designs concrete plans in `~/environment/proposals/` format |
| `agentflow-expert.md` | _(spawned on demand)_ | sonnet | AgentFlow visualization specialist |
| `quality-auditor.md` | _(spawned on demand)_ | sonnet | Audits code quality across projects |

**Current top-level sessions (as of 2026-04-13):**

| Instance | Type | Model | CWD |
|---|---|---|---|
| `command` | project-manager | sonnet | ~/environment |
| `atlas` | project-manager | haiku | ~/environment |
| `sentinel` | project-manager | haiku | ~/environment |
| `matrix` | system-expert | sonnet | ~/environment |
| `prism` | ux-expert | sonnet | ~/environment |
| `signal` | communications-expert | sonnet | ~/environment |
| `productivitesse` | team-lead | sonnet | ~/environment/projects/productivitesse |
| `voice-bridge` | team-lead | sonnet | ~/environment/projects/voice-bridge2 |

---

## 7. Module Files

All modules live in `~/environment/.claude/modules/`. They are referenced from `CLAUDE.md` by filename; agents read the active one on startup.

| File | Purpose |
|---|---|
| `comms-relay.md` | **Active comms module.** Documents session types, relay messaging architecture, fallback chain (relay_send → queued → direct HTTP → cmux emergency), channel health protocol, dead channel response, relay-down response. |
| `comms-direct.md` | Alternate comms mode (not currently active). Direct cmux terminal injection without relay. |
| `sessions.md` | Session naming rules, workspace deduplication, `spawn-session.sh` usage, TeamCreate lifecycle rule, session resume protocol. |
| `monitoring.md` | Three-tier permission monitoring: Tier 1 = bash polling (5s, zero tokens); Tier 2 = local LLM review (planned); Tier 3 = event-driven hooks via relay (target architecture). |
| `code-standards.md` | 14 rules: feature-based folder structure, Zustand slice-per-feature, behavior-first file naming, no barrel index files, co-locate what changes together, file size limits, tests-as-specs, platform adapters named by target not framework, browser testability, structured logging, no silent catches, typed network errors, spec-per-feature, TESTING-POLICY.md mandatory. |
| `testing-discipline.md` | Hard rules for when work is "done": typecheck clean, unit tests pass with real output shown, real-world verification (curl/Playwright/CLI), completion report includes actual command output. |

---

## 8. Voice Bridge

The voice bridge stack lets the CEO speak commands that are transcribed and routed to the relay as messages.

### Components

| Component | Port | Process | Purpose |
|---|---|---|---|
| whisper-server | 8766 | pm2: `whisper-server` | whisper.cpp HTTP inference server |
| voice-bridge-server | 3030 | pm2: `voice-bridge-server` | Bun HTTP/WebSocket server; accepts audio, calls whisper, routes to relay |
| voice-bridge-indicator | — | pm2: `voice-bridge-indicator` | macOS menu bar indicator (Python) |
| wake-word daemon | — | LaunchAgent | Listens for wake word; records and POSTs audio to voice-bridge-server |

### whisper-server setup

whisper.cpp is installed via the voice-bridge `nodejs-whisper` npm package — the binary lives at:
```
~/environment/projects/voice-bridge2/node_modules/nodejs-whisper/cpp/whisper.cpp/build/bin/whisper-server
```
Model: `ggml-medium.bin` in the same path.

pm2 launch command:
```bash
pm2 start \
  ~/environment/projects/voice-bridge2/node_modules/nodejs-whisper/cpp/whisper.cpp/build/bin/whisper-server \
  --name whisper-server \
  --interpreter none \
  -- --model ~/environment/projects/voice-bridge2/node_modules/nodejs-whisper/cpp/whisper.cpp/models/ggml-medium.bin \
     --host 127.0.0.1 --port 8766 --language auto --translate
```

### voice-bridge-server

```bash
pm2 start "bun run server/index.ts" \
  --name voice-bridge-server \
  --cwd ~/environment/projects/voice-bridge2
```

Audio pipeline: raw audio buffer → ffmpeg (convert to 16kHz mono WAV) → whisper-server `/inference` → text → relay `/send` (from: `ceo`, to: `command`).

### wake-word daemon

**LaunchAgent:** `~/Library/LaunchAgents/com.riseof.wake-word.plist`

- `RunAtLoad: true`, `KeepAlive: true` — starts on login and restarts on crash
- Calls `~/environment/projects/voice-bridge2/daemon/run_wake.sh`
- Python 3.14 required; uses `openwakeword` library
- PYTHONPATH: `~/environment/projects/voice-bridge2/daemon/.venv/lib/python3.14/site-packages`

**`run_wake.sh` behaviour:**
- Kills any existing `wake_word.py` instance and overlay helpers
- Runs `wake_word.py --target command --start-threshold 0.3 --stop-threshold 0.15`

**Python venv setup:**
```bash
cd ~/environment/projects/voice-bridge/daemon
python3.14 -m venv .venv
source .venv/bin/activate
pip install openwakeword pyaudio requests numpy
```

**Log files:**
- stdout: `/tmp/wake-word-launchd.log`
- stderr: `/tmp/wake-word-launchd-error.log`

**voice-bridge-indicator (menu bar):**
```bash
pm2 start ~/environment/projects/voice-bridge2/daemon/.venv/bin/python \
  --name voice-bridge-indicator \
  --interpreter none \
  --cwd ~/environment/projects/voice-bridge2 \
  -- -u daemon/menubar.py
```

### HTTPS certs for voice-bridge

The voice-bridge uses self-signed certs trusted by the iPhone. Generate with mkcert:
```bash
cd ~/environment/projects/voice-bridge2
mkcert -install
mkcert -cert-file certs/dev.pem -key-file certs/dev-key.pem 127.0.0.1 localhost 100.x.x.x
```
The Tailscale IP (`100.x.x.x`) must be included so the iPhone can reach the server. The OTA server also uses certs at `~/environment/projects/productivitesse/certs/`.

---

## 9. Environment Variables

| Variable | Where set | Purpose |
|---|---|---|
| `RELAY_AGENT_NAME` | `spawn-session.sh` | Agent's relay identity; read by all hooks, channel plugin, session-mirror |
| `RELAY_SESSION_ID` | `spawn-session.sh` | Per-launch session ID; associates channel plugin with relay session |
| `RELAY_PARENT_AGENT` | caller (optional) | Sub-agent parent registration for hierarchy tracking |
| `HUB_AGENT_NAME` | legacy alias | Same as RELAY_AGENT_NAME; poll-messages.sh accepts either |
| `HUB_URL` | optional | Relay base URL; defaults to `http://localhost:8767` |
| `RELAY_HTTP_URL` | optional | Same as HUB_URL; session-mirror.sh reads this |
| `RELAY_URL` | optional | Used by ota-server.ts and distill-ceo-message.sh |
| `LEAN_RELAY_PORT` | pm2 ecosystem.config.js | Port for lean relay (8767 HTTP, 8768 HTTPS) |
| `LEAN_RELAY_HTTPS` | pm2 ecosystem.config.js | `"true"` enables HTTPS mode |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `~/.claude/settings.json` | Enables TeamCreate/SendMessage/Task tools |
| `CAPACITOR_LIVE_RELOAD` | dev workflow | Enables Capacitor live reload; requires `CAP_DEV_URL` |
| `CAP_DEV_URL` | dev workflow | URL of the dev server for Capacitor live reload |
| `WHISPER_URL` | voice-bridge | Override whisper-server endpoint; defaults to `http://127.0.0.1:8766/inference` |
| `WHISPER_SKIP_CONVERT` | testing | `"1"` skips ffmpeg conversion (for tests with fake audio) |
| `PRODUCTIVITESSE_PATH` | optional | Override path for productivitesse project; used by relay for OTA notifications |

---

## 10. One-Time Setup Steps

### Dependencies

```bash
# Node via nvm (required version: v24.11.0)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
nvm install 24.11.0
nvm use 24.11.0

# Bun
curl -fsSL https://bun.sh/install | bash
# or: brew install oven-sh/bun/bun

# pm2 globally
npm install -g pm2

# Python 3.14 (voice-bridge requires 3.14 for CoreAudio access)
brew install python@3.14

# ffmpeg (audio conversion for whisper)
brew install ffmpeg

# mkcert (for local HTTPS certs)
brew install mkcert

# cmux (terminal multiplexer for Claude sessions)
# Download from: https://cmux.app or check the existing binary path
# /Applications/cmux.app/Contents/Resources/bin/cmux
# Add to PATH or symlink

# codex CLI (OpenAI, for adversarial review)
npm install -g @openai/codex   # or however the openai-codex-plugin-cc installs it
```

### Clone and build environment

```bash
git clone <repo-url> ~/environment
cd ~/environment
git submodule update --init --recursive   # pulls message-relay
```

### Build the relay

```bash
cd ~/environment/message-relay
npm install
npm run build    # tsc → dist/relay-lean.js etc.
mkdir -p logs
```

### Install voice-bridge dependencies

```bash
cd ~/environment/projects/voice-bridge2
bun install

# Python venv for wake-word daemon
cd daemon
python3.14 -m venv .venv
source .venv/bin/activate
pip install openwakeword pyaudio requests numpy
deactivate
```

### Build whisper.cpp model (inside nodejs-whisper)

```bash
cd ~/environment/projects/voice-bridge2
bun install    # installs nodejs-whisper which contains whisper.cpp
# The build binary will be at: node_modules/nodejs-whisper/cpp/whisper.cpp/build/bin/whisper-server
# The medium model must be downloaded:
cd node_modules/nodejs-whisper/cpp/whisper.cpp
bash models/download-ggml-model.sh medium
```

### Create required directories

```bash
mkdir -p ~/.claude/relay-channel
mkdir -p ~/environment/message-relay/logs
mkdir -p ~/environment/proposals
mkdir -p ~/environment/questions
mkdir -p ~/environment/answers
mkdir -p ~/environment/issues
mkdir -p ~/environment/message-relay/queues
chmod +x ~/environment/scripts/*.sh
chmod +x ~/environment/bin/hook-event.sh
chmod +x ~/environment/.claude/hooks/testing-gate/*.sh
chmod +x ~/environment/message-relay/scripts/*.sh
```

### Register pm2 processes

```bash
# Relay
cd ~/environment/message-relay
pm2 start ecosystem.config.js

# Whisper server
pm2 start \
  ~/environment/projects/voice-bridge2/node_modules/nodejs-whisper/cpp/whisper.cpp/build/bin/whisper-server \
  --name whisper-server \
  --interpreter none \
  -- --model ~/environment/projects/voice-bridge2/node_modules/nodejs-whisper/cpp/whisper.cpp/models/ggml-medium.bin \
     --host 127.0.0.1 --port 8766 --language auto --translate

# Voice bridge server
pm2 start "bun run server/index.ts" \
  --name voice-bridge-server \
  --cwd ~/environment/projects/voice-bridge2

# Voice bridge indicator
pm2 start ~/environment/projects/voice-bridge2/daemon/.venv/bin/python \
  --name voice-bridge-indicator \
  --interpreter none \
  --cwd ~/environment/projects/voice-bridge2 \
  -- -u daemon/menubar.py

# Save process list for LaunchAgent resurrection
pm2 save
```

### Install LaunchAgents

**`~/Library/LaunchAgents/com.riseof.pm2.plist`** — resurrects pm2 on login:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.riseof.pm2</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/riseof/.nvm/versions/node/v24.11.0/bin/node</string>
    <string>/Users/riseof/.nvm/versions/node/v24.11.0/bin/pm2</string>
    <string>resurrect</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>StandardOutPath</key><string>/tmp/pm2-launchagent.log</string>
  <key>StandardErrorPath</key><string>/tmp/pm2-launchagent-error.log</string>
</dict>
</plist>
```

**`~/Library/LaunchAgents/com.riseof.wake-word.plist`** — runs wake-word daemon (requires CoreAudio GUI session — cannot run in a plain ssh or launchd system context):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.riseof.wake-word</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/riseof/environment/projects/voice-bridge2/daemon/run_wake.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PYTHONPATH</key>
    <string>/Users/riseof/environment/projects/voice-bridge2/daemon/.venv/lib/python3.14/site-packages</string>
  </dict>
  <key>WorkingDirectory</key><string>/Users/riseof/environment/projects/voice-bridge2</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/wake-word-launchd.log</string>
  <key>StandardErrorPath</key><string>/tmp/wake-word-launchd-error.log</string>
  <key>ThrottleInterval</key><integer>5</integer>
</dict>
</plist>
```

Load them:
```bash
launchctl load ~/Library/LaunchAgents/com.riseof.pm2.plist
launchctl load ~/Library/LaunchAgents/com.riseof.wake-word.plist
```

### HTTPS certs for relay and voice-bridge

```bash
mkcert -install   # installs root CA, trusted by system and Safari/Chrome

# Relay HTTPS cert (port 8768)
cd ~/environment/message-relay
mkcert -cert-file certs/relay.pem -key-file certs/relay-key.pem 127.0.0.1 localhost

# Productivitesse OTA cert
cd ~/environment/projects/productivitesse
mkcert -cert-file certs/dev.pem -key-file certs/dev-key.pem \
  127.0.0.1 localhost <tailscale-ip>

# Voice bridge cert (for iPhone access via Tailscale)
cd ~/environment/projects/voice-bridge
mkcert -cert-file certs/dev.pem -key-file certs/dev-key.pem \
  127.0.0.1 localhost <tailscale-ip>
```

After installing the root CA via mkcert, the iPhone must also trust it. Export the mkcert root CA and install it on the iPhone via AirDrop or Apple Configurator.

### Productivitesse iOS setup

```bash
cd ~/environment/projects/productivitesse
npm install
npx cap sync ios    # generates ios/ Xcode project from capacitor.config.ts
# Open ios/App/App.xcworkspace in Xcode
# Set signing team and bundle ID
# Build App-Beta scheme for development
```

---

## 11. OTA / Capacitor (Productivitesse iOS)

### OTA server

**Script:** `~/environment/projects/productivitesse/scripts/ota-server.ts`
**Port:** 8769 (HTTPS)
**Purpose:** Serves IPA files from `/tmp/ota/` and notifies the relay when a new build appears.

The OTA server watches `/tmp/ota/` for new `.ipa` files. When one appears, it POSTs to `http://localhost:8767/send` with a message containing the download URL (`https://{tailscale-ip}:8769/...`). The CEO can then install directly from their iPhone via the manifest URL.

### Build and deploy flow

**Beta (App-Beta scheme, for development testing):**
```bash
npm run deploy:beta         # syncs web bundle, builds App-Beta, deploys to "myPhone" via xcrun devicectl
# or with TypeScript config:
npm run deploy:beta-ts
```

**Production (App scheme, CEO approval required):**
```bash
npm run deploy:prod-ts
```

**OTA (wireless install):**
1. Build IPA and copy to `/tmp/ota/`
2. Start OTA server: `bun run scripts/ota-server.ts`
3. Relay notifies CEO with download link
4. iPhone opens link, installs app wirelessly (requires mkcert root CA trusted on iPhone)

### Capacitor schemes

| Scheme | Purpose | `appId` suffix |
|---|---|---|
| `App` | Production | `com.productivitesse.app` |
| `App-Beta` | Development/testing | same, separate build |

Both schemes target the same Xcode project under `ios/App/App.xcworkspace`.

---

## 12. Relay Message Type Reference

Every `relay_send` call must set the correct `type`:

| type | When to use |
|---|---|
| `message` | General communication |
| `done` | Task complete, FYI, progress update |
| `status` | Status update (non-completion) |
| `waiting-for-input` | Agent is blocked, needs CEO decision |
| `escalate` | Crash, security issue, urgent blocker |
| `voice` | Voice/audio content |
| `permission-result` | Result of a permission approve/deny |

Sub-type prefixes used in message body:
- `[EXPLAIN]` — answer to "why did X happen"
- `[OPTIONS]` — two or three paths for CEO to choose
- `[BLOCKED]` — cannot continue without CEO input
- `[Q&A SIGNAL]` — CEO curiosity signal, researcher should be assigned
- `DONE —` — completion report (one sentence follows)
- `INTERRUPTED —` — tool interruption, agent is waiting

---

## 13. Verification After Setup

```bash
# 1. Relay is running
curl -s http://localhost:8767/health
# Expected: {"status":"ok",...}

# 2. Relay channels (should be empty initially)
curl -s http://localhost:8767/channels
# Expected: {"channels":[...]}

# 3. pm2 processes
pm2 list
# Expected: message-relay-lean, message-relay-lean-https, monitor-tier1, monitor-tier2,
#           whisper-server, voice-bridge-server, voice-bridge-indicator — all online

# 4. Whisper server
curl -s http://localhost:8766/health 2>/dev/null || echo "whisper-server HTTP health not available"
# whisper-server doesn't have a health endpoint; check pm2 status instead

# 5. Voice bridge server
curl -s http://localhost:3030/health
# Expected: some JSON or 200

# 6. Wake-word daemon
pgrep -fa wake_word.py
# Expected: PID listed

# 7. Spawn command session
~/environment/scripts/spawn-session.sh project-manager command ~/environment sonnet
# Expected: "=== Session 'command' launched ===" with workspace and relay confirmation

# 8. Verify channel registered (after command session starts)
curl -s http://localhost:8767/channels | python3 -m json.tool
# Expected: {"channels": ["command", ...]}
```

---

## 14. Directory Structure Overview

```
~/environment/
  CLAUDE.md                    # Source of truth for system-wide rules
  CONCEPTS.md                  # Canonical definitions of all system concepts
  FORMATS.md                   # Frontmatter schemas for all output file types
  BACKLOG.md                   # Work queue: Backlog / Active / Done / Learnings
  SESSIONS.md                  # Active session registry
  ISSUES.md                    # Bug and polish kanban
  PROBLEM-LOG.md               # Postmortem entries for production incidents
  SYSTEM-BOOTSTRAP.md          # This file
  .claude/
    CLAUDE-common-to-all-projects.md  # Shared rules for all projects
    agents/                    # Agent definition files (one per role)
    modules/                   # Module files loaded by CLAUDE.md
    hooks/
      testing-gate/            # on-code-edit.sh, on-bash.sh, stop-gate.sh
    worktrees/                 # Git worktrees go here (NOT project root)
  bin/
    hook-event.sh              # Fires hook events to relay
  scripts/
    spawn-session.sh           # Universal session launcher
    spawn-manager.sh           # Convenience wrapper
    spawn-team-lead.sh         # Convenience wrapper
    distill-ceo-message.sh     # CEO Q&A signal detector
    relay-ceo-message.sh       # CEO CLI → relay mirror
    session-mirror.sh          # Stop hook: mirror last turn to relay
    start-monitor.sh           # Start Tier 1 monitoring loop
    monitor-agents.sh          # Single pass of permission dialog scan
  proposals/                   # Proposal files (YYYY-MM-DD-slug.md)
  questions/                   # Q&A question files
  answers/                     # Q&A answer files
  issues/                      # Individual issue files
  message-relay/               # Git submodule
    src/                       # TypeScript source
    dist/                      # Built JS (tsc output)
    marketplace/               # Claude Code channel plugin marketplace
      relay-channel/           # Primary channel plugin
      channel-plugin/          # hub-channel variant
    ecosystem.config.js        # pm2 process definitions
    queues/                    # Persisted undelivered messages
  projects/
    productivitesse/           # iOS + Electron app (React Router v7 + Capacitor)
    knowledge-base/            # Chrome extension + Bun web app
    voice-bridge/              # Voice pipeline (wake word → whisper → relay)
  agency/                      # Research agency projects
  .worklog/                    # Agent worklogs (append-only)

~/.claude/
  settings.json                # Hooks, plugins, permissions, model
  agents/                      # Global agent definitions (symlinked or copied from environment)
  relay-channel/               # Port files: {agent-name}.port
  hub-cursor-{agent}           # Message cursor files for poll-messages.sh
  agent-flow/                  # AgentFlow plugin
  plugins/                     # Installed plugins cache
  teams/                       # TeamCreate team configs
  tasks/                       # Task definitions

~/Library/LaunchAgents/
  com.riseof.pm2.plist         # pm2 resurrect on login
  com.riseof.wake-word.plist   # Wake-word daemon
```

---

*Created by system-expert (matrix) — 2026-04-13*
