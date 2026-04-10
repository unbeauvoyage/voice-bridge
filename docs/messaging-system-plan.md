# Messaging System — Full Plan

## Context
We need inter-agent communication for a multi-agent Claude Code system running in cmux.
This plan covers the local solution first, then cloud migration.

## Problems Being Solved

| # | Problem | Root cause |
|---|---------|-----------|
| 1 | Agent message looks like CEO typed it | cmux send injects into terminal input — indistinguishable from human |
| 2 | CEO mid-typing + agent injects = garbled | cmux send interleaves with existing input buffer |
| 3 | COMMAND busy generating = "Failed to write to socket" | cmux send fails when target is mid-response |
| 4 | Two agents send simultaneously = garbled | No serialization of cmux send calls |
| 5 | Mac sleeps → surface refs change | Hardcoded workspace:N / surface:N become invalid |
| 6 | Messages lost on restart | No persistence layer |
| 7 | No way to know if agent is blocked | Agents can't signal "waiting for input" |

## Solution: Message Hub

A Python server (port 8765) acts as message router. It replaces the current voice relay server.

### How Each Problem Is Solved

| # | Solution |
|---|----------|
| 1 | Hub adds `[FROM:agent-name]` prefix. Receiving agent distinguishes from human input. |
| 2 | Hub checks target is idle (clean `❯` prompt) before injecting. Never injects while someone is typing. |
| 3 | Hub retries with 2s backoff until target is idle. Messages queue, never lost. |
| 4 | Hub serializes all deliveries — one cmux send at a time, never concurrent. |
| 5 | Hub discovers agents dynamically via `cmux list-workspaces` on each delivery attempt. |
| 6 | All messages persisted to JSON lines files before delivery. Replayed on restart. |
| 7 | Agents send `type: "waiting-for-input"` message. Hub triggers `cmux notify` + sound for CEO. |

### Architecture

```
                    ┌──────────────┐
                    │  iOS Shortcut │
                    │  (voice)      │
                    └──────┬───────┘
                           │ POST /send {from:"ceo", to:"command", body:"..."}
                           ▼
┌──────────────────────────────────────────────────────┐
│                 MESSAGE HUB (Python)                  │
│                    Port 8765                           │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ HTTP API     │  │ Delivery     │  │ Agent       │ │
│  │              │  │ Worker       │  │ Discovery   │ │
│  │ POST /send   │  │              │  │             │ │
│  │ GET /status  │  │ 1. Read queue│  │ cmux list-  │ │
│  │ GET /health  │  │ 2. Check idle│  │ workspaces  │ │
│  │ POST /message│  │ 3. cmux send │  │ → name:ref  │ │
│  │ (legacy)     │  │ 4. Retry/ack │  │ mapping     │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                │                  │        │
│         ▼                ▼                  ▼        │
│  ┌───────────────────────────────────────────────┐   │
│  │  Persistence Layer                             │   │
│  │  ~/environment/message-hub/queues/             │   │
│  │    command.jsonl                                │   │
│  │    bicycles.jsonl                               │   │
│  │    cars.jsonl                                   │   │
│  │    ...                                          │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────┘
                           │ cmux send (serialized, idle-checked)
              ┌────────────┼────────────┐
              │            │            │
          ┌───┴───┐   ┌───┴───┐   ┌───┴───┐
          │COMMAND│   │bicycles│   │ cars  │
          │       │   │       │   │       │
          └───────┘   └───────┘   └───────┘
              +
        cmux notify (CEO sidebar alerts)
        afplay sound (urgent messages)
```

### API Endpoints

```
POST /send
  Body: {"from": "bicycles", "to": "command", "type": "done", "body": "Found 5 bikes"}
  Returns: {"id": "uuid", "status": "queued"}

POST /message
  Body: {"message": "text"}  (or form-encoded)
  Legacy voice relay compat. Maps to /send with from=ceo, to=command.

GET /status
  Returns: {
    "agents": {
      "command": {"workspace": "workspace:25", "surface": "surface:35", "state": "idle", "pending": 0},
      "bicycles": {"workspace": "workspace:14", "surface": "surface:20", "state": "busy", "pending": 2}
    },
    "queue_depth": 3,
    "total_delivered": 147
  }

GET /messages/{agent}
  Returns: pending messages for that agent (backup if cmux send fails repeatedly)

GET /health
  Returns: "OK"
```

### Smart Delivery Logic

```python
async def deliver(message):
    while True:
        # 1. Discover target
        target = discover_agent(message.to)  # cmux list-workspaces + list-pane-surfaces
        if not target:
            log(f"Agent {message.to} not found, retrying...")
            await sleep(5)
            continue

        # 2. Check if idle
        pane = capture_pane(target)  # cmux capture-pane --lines 3
        if not is_idle(pane):  # look for clean ❯ prompt
            await sleep(2)
            continue

        # 3. Deliver (serialized — one at a time)
        async with delivery_lock:
            formatted = f"[FROM:{message.from}] {message.body}"
            cmux_send(target, formatted)
            cmux_send_key(target, "Enter")

        # 4. Mark delivered
        message.delivered = True
        persist(message)

        # 5. CEO alerts
        if message.to == "command":
            cmux_notify(title=f"From: {message.from}", body=message.body)
        if message.type == "escalate":
            play_sound()

        break
```

### Agent Helper Script

`~/environment/bin/hub-send`:
```bash
#!/bin/bash
# Usage: hub-send <target> "<message>" [--type done|message|escalate|waiting-for-input]
TO="$1"; BODY="$2"; TYPE="${3:---type message}"
TYPE_VAL=$(echo "$TYPE" | sed 's/--type //')
SELF=$(basename "$(pwd)" | sed 's/\/$//') # infer agent name from cwd
curl -s -X POST http://localhost:8765/send \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"$SELF\",\"to\":\"$TO\",\"type\":\"$TYPE_VAL\",\"body\":\"$BODY\"}"
```

Agents call: `hub-send command "DONE — found 5 cheap bikes" --type done`

### Message Format (Injected into Terminal)

```
[FROM:bicycles] DONE — found 5 cheap bikes in Nara
```

Receiving agent sees this as user input but knows it's from another agent due to the `[FROM:x]` prefix.

### Message Types

| Type | Meaning | Delivery | CEO alert |
|------|---------|----------|-----------|
| `message` | General communication | Normal (wait for idle) | cmux notify |
| `done` | Agent finished a task | Normal | cmux notify |
| `waiting-for-input` | Agent is blocked | High priority (skip to front of queue) | cmux notify + sound |
| `escalate` | Needs CEO decision | Urgent | cmux notify + sound + flash |
| `status` | Status update | Low (deliver when convenient) | No alert |

### Persistence Format

`~/environment/message-hub/queues/command.jsonl`:
```json
{"id":"a1b2c3","from":"bicycles","to":"command","type":"done","body":"Found 5 bikes","ts":"2026-03-29T16:00:00Z","delivered":true,"delivered_at":"2026-03-29T16:00:02Z"}
{"id":"d4e5f6","from":"cars","to":"command","type":"message","body":"Need guidance on auction strategy","ts":"2026-03-29T16:01:00Z","delivered":false}
```

### Files Created

```
~/environment/
  message-hub/
    server.py           # Main hub server (replaces voice-relay/server.py)
    discovery.py         # Agent discovery via cmux
    delivery.py          # Smart delivery worker
    persistence.py       # JSON lines read/write
    queues/              # Per-agent message queues
      command.jsonl
      bicycles.jsonl
      ...
  bin/
    hub-send             # Agent helper script
  voice-relay/
    (deprecated — absorbed into message-hub)
```

### Startup

```bash
# Start the hub (replaces voice relay)
cd ~/environment/message-hub && python3 server.py

# Or via launcher
bash ~/environment/message-hub/start.sh
```

### Migration from Voice Relay

1. Hub absorbs all voice relay functionality (POST /message endpoint stays)
2. iOS Shortcut URL stays the same (same port, same endpoint)
3. Watcher.sh is no longer needed — hub handles delivery directly
4. voice-relay/ folder becomes deprecated

---

## Phase 2: Cloud Migration (Future)

### Stack
- **Backend:** Node.js (Fastify) + TypeScript
- **Message broker:** Redis + BullMQ
- **Database:** PostgreSQL (agent state, message history, worklogs)
- **Real-time:** WebSocket (Socket.io) for dashboard
- **Deployment:** Docker + docker-compose

### Changes from Phase 1
| Phase 1 (Local) | Phase 2 (Cloud) |
|-----------------|-----------------|
| Python server | Node.js (Fastify) |
| JSON lines files | Redis queues + PostgreSQL |
| cmux discovery | Agent registry in DB |
| cmux send | cmux bridge per node (local agent) |
| Single Mac | Multiple nodes (Mac/VPS) via Tailscale |
| No auth | API keys per agent/user |
| No dashboard integration | WebSocket → React dashboard |

### Multi-Node Architecture
```
┌─────────────────────────────────┐
│  Central Server (EC2/VPS)        │
│  Fastify + Redis + PostgreSQL    │
│  Dashboard (React)               │
└───────────┬─────────────────────┘
            │ Tailscale / HTTPS
   ┌────────┼────────┐
   │        │        │
┌──┴──┐  ┌──┴──┐  ┌──┴──┐
│Node1│  │Node2│  │Node3│
│Mac  │  │VPS  │  │VPS  │
│cmux │  │cmux │  │cmux │
│bridge│  │bridge│  │bridge│
│agent│  │agent│  │agent│
└─────┘  └─────┘  └─────┘
```

Each node runs a lightweight bridge agent that:
- Connects to central server via WebSocket
- Receives messages from central server
- Delivers locally via cmux send
- Reports agent status back to central

### Reproducibility
```bash
git clone {repo}
cd environment
docker-compose up              # Central server + Redis + Postgres
./scripts/node-setup.sh        # On each Mac/VPS: installs cmux, registers node
```

---

## Implementation Order

### Phase 1 Tasks (Local — build now)
1. Create `~/environment/message-hub/` structure
2. Build server.py with /send, /status, /health, /message endpoints
3. Build discovery.py — dynamic agent lookup via cmux
4. Build delivery.py — idle checking + serialized cmux send + retry
5. Build persistence.py — JSON lines read/write
6. Create `~/environment/bin/hub-send` helper script
7. Migrate iOS Shortcut from voice-relay to message-hub (same URL)
8. Test: phone → hub → COMMAND delivery
9. Test: agent → hub → agent delivery
10. Test: agent → hub → COMMAND with CEO typing (no collision)
11. Deprecate voice-relay/ and watcher.sh
12. Update CLAUDE.md with messaging instructions for all agents

### Phase 2 Tasks (Cloud — future)
1. Scaffold Node.js (Fastify) project
2. Set up Redis + BullMQ
3. Port message hub logic to TypeScript
4. Add WebSocket for dashboard
5. Build node bridge agent
6. Deploy central server
7. Connect nodes via Tailscale
8. Dashboard integration
