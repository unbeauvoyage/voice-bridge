# Communication Mode: Relay

All inter-agent communication routes through the relay server (port 8767) via Claude Code Channels (MCP push).

## Session Types & Communication

### Interactive Sessions
Launched with the relay channel plugin:
```bash
# Standard sessions:
RELAY_AGENT_NAME={name} claude --dangerously-load-development-channels plugin:relay-channel@relay-plugins --resume $UUID --remote-control
# Meta-managers (command, consul):
RELAY_AGENT_NAME={name} claude --dangerously-load-development-channels plugin:relay-channel@relay-plugins --permission-mode bypassPermissions --resume $UUID --remote-control
```
- On first launch, approve the "local development" prompt (option 1)
- Messages arrive as `<channel source="relay" from="...">` tags via MCP push — no terminal injection
- Reply via `relay_reply` tool. Channel messages wake idle sessions — no Enter needed.

### Non-Interactive Sessions
- Wake with: `claude -p --resume "$UUID" "prompt"` in background
- Can send via: `mcp__message-relay__relay_send(to: "command", message: "...")`

### Opening a Session in a Workspace
```bash
WS=$(cmux new-workspace --cwd ~/environment/{project} \
  --command "RELAY_AGENT_NAME={name} claude --dangerously-load-development-channels plugin:relay-channel@relay-plugins --resume $UUID --remote-control" \
  2>/dev/null | sed 's/OK //')
cmux rename-workspace --workspace "$WS" "{name}"
# Approve "local development" prompt (channel not live yet — must use cmux):
cmux send --workspace "$WS" "1" && cmux send-key --workspace "$WS" Enter
```

## Messaging Architecture
Relay (port 8767) routes messages via Claude Code Channels (MCP push):
1. Agent calls `relay_send(to: "name", ...)` or `relay_reply`
2. Relay checks if target has a registered channel → HTTP POST → MCP notification → instant delivery
3. No channel: message queued on disk, delivered when agent re-registers

Relay endpoints: `POST /send`, `GET /status`, `GET /channels`, `POST /register-channel`, `GET /messages/:agent`

## Communication Fallback Chain

When an agent needs to send a message or reach another agent, try each level in order:

| Level | Method | When to use |
|-------|--------|-------------|
| 1 | `relay_send` / `relay_reply` (MCP tool) | Default — relay is up, target has channel |
| 2 | `relay_send` with `type: "queued"` | Relay is up but target has no channel (relay queues it) |
| 3 | `POST http://localhost:8767/send` directly | MCP tool unavailable, relay is up |
| 4 | Tell a manager via channel | Relay is down, but your own channel is alive |
| 5 | `cmux send` terminal injection | All messaging down — emergency only, log the reason |

**How to detect relay is down:** `curl -s http://localhost:8767/health` returns error or times out.
**How to detect target has no channel:** `GET /channels` — target name not listed.
**No channel plugin on your session?** You won't have `relay_reply` tool. Use `relay_send` via MCP or HTTP directly.

Agents should self-diagnose and step down the chain silently — don't wait, don't block.

## Channel Health Protocol

Channels are the primary communication mechanism. When they break, the system goes silent. Every agent and system component must enforce these rules:

### Detection
- **Relay health-check (automatic):** Relay pings registered channel ports every 60s. Dead channels are pruned and relay queues messages instead of dropping them.
- **Plugin heartbeat (automatic):** Channel plugin re-registers with relay every 30s. Survives relay restarts.
- **Any agent that fails to send a message:** Must immediately notify a manager (command or consul) via any working path (relay queue, cmux, direct HTTP).
- **Instant failure alerts:** When channel delivery fails, relay immediately notifies both command and consul. Deduped to once per agent per 5 minutes.

### Dead Channel Response
Agents **cannot** register their own channel mid-session — the channel plugin is a separate process started at session launch. If a channel is dead:
1. **Relay** prunes the dead registration and notifies managers (command/consul) automatically
2. **Managers** restart the affected agent session with the channel plugin loaded (`--dangerously-load-development-channels plugin:relay-channel@relay-plugins`)
3. The "local development" prompt must be approved (cmux send "1" + Enter)
4. Once restarted, the heartbeat re-registers within 30s

### Relay Down Response
If relay itself is down (`curl -s http://localhost:8767/health` fails):
1. **Any agent that discovers this** must alert managers immediately via cmux fallback
2. Relay runs under pm2 — it should auto-restart. If it doesn't, managers investigate (`pm2 logs message-relay`)
3. After relay comes back, all channel heartbeats re-register within 30s — no manual action needed

### Rule: Never Ignore a Dead Channel
If you detect that an agent's channel is dead or unregistered, you **must** act — either fix it or escalate. Silent failures are unacceptable. The system's reliability depends on every component reporting problems immediately.
