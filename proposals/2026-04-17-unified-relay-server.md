---
date: 2026-04-17
author: chief-of-staff
status: draft — awaiting CEO review
summary: Replace fragmented backend services with a single unified relay server backed by PostgreSQL, with row-level agent access control on KB data.
---

# Unified Relay Server — Design Proposal

## Problem

We currently have multiple backend services that agents must discover and learn separately:
- `message-relay` — port 8767, messaging + WebSocket dashboard
- `knowledge-base` server — separate port, HTTP API + embeddings
- `session-mirror` — separate process
- JSONL watcher — separate process
- (proposed) agent-state MCP server — another port

Every new agent starts with zero context and must re-learn this topology. Every bug requires knowing which server owns what. When we add the agent-state DB, it gets worse. This is the real cost — not ops complexity, but agent cognitive overhead per session.

## Proposal

**One server called `relay`.** Same name, same port 8767. Relay is already the heartbeat of the system — we grow it, not rename it.

### Route structure

```
relay (Bun/TypeScript, port 8767)

  Messaging (existing, unchanged paths)
  POST /send                    ← agent-to-agent messages
  GET  /inbox/:agent            ← poll for messages
  GET  /queue/:agent            ← queued messages for offline agents
  POST /register-channel        ← channel plugin registration

  Knowledge Base (absorb from kb server)
  GET  /kb/search?q=            ← semantic search (agent_visible=true filter applied automatically)
  GET  /kb/items/:id            ← single item (access check applied)
  POST /kb/items                ← ingest new item (user-facing only)
  PATCH /kb/items/:id/visibility ← toggle agent_visible flag

  Agent State (new, PostgreSQL-backed)
  GET  /state/tasks?status=     ← active/backlog tasks
  GET  /state/sessions          ← running sessions
  GET  /state/problems?limit=   ← recent problem log entries
  POST /state/tasks             ← create task
  PATCH /state/tasks/:id        ← update task status

  Meta
  GET  /info                    ← full architecture in ~1000 tokens (see below)
  GET  /health                  ← liveness check

  WebSocket
  ws://localhost:8767/ws        ← unified stream: relay events + JSONL activity + pg_notify pushes
```

### GET /info — agent orientation endpoint

Any agent can call this on startup and understand the full system:

```json
{
  "relay": {
    "version": "2.0.0",
    "description": "Unified backend — messaging, knowledge, agent state",
    "port": 8767
  },
  "endpoints": {
    "messaging": ["POST /send", "GET /inbox/:agent", "GET /queue/:agent"],
    "knowledge": ["GET /kb/search?q=", "GET /kb/items/:id"],
    "state": ["GET /state/tasks", "GET /state/sessions", "GET /state/problems"],
    "ws": "ws://localhost:8767/ws"
  },
  "agents": {
    "online": ["chief-of-staff", "knowledge-base", "myenglishbook"],
    "offline": ["voice-bridge"]
  },
  "ws_events": [
    "relay_message", "agent_online", "agent_offline",
    "task_updated", "session_discovered", "jsonl_assistant_text"
  ]
}
```

Agents replace reading `SESSIONS.md` + `BACKLOG.md` + relay docs with one HTTP call. ~1000 tokens max.

---

## Database Design

Two databases. One PostgreSQL instance, two logical databases (or schemas — implementation detail).

### agent_db — agents read/write freely

Replaces: `SESSIONS.md`, `BACKLOG.md`, `ISSUES.md`, `PROBLEM-LOG.md`, relay in-memory registry.

```sql
-- Sessions (replaces SESSIONS.md)
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL,  -- 'team-lead' | 'coder' | 'manager' | etc.
  status      TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'idle' | 'done'
  cwd         TEXT,
  model       TEXT,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  notes       TEXT
);

-- Tasks (replaces BACKLOG.md Active section + TaskCreate/TaskList)
CREATE TABLE tasks (
  id          SERIAL PRIMARY KEY,
  project     TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'completed'
  owner       TEXT,  -- session name
  blocked_by  INT[],  -- task IDs
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Problems (replaces PROBLEM-LOG.md)
CREATE TABLE problems (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  project     TEXT,
  what_broke  TEXT NOT NULL,
  root_cause  TEXT,
  systemic_fix TEXT,
  resolved    BOOLEAN DEFAULT false
);

-- Decisions (replaces passive-distillation files)
CREATE TABLE decisions (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  topic       TEXT NOT NULL,
  outcome     TEXT NOT NULL,
  made_by     TEXT  -- 'ceo' | agent name
);
```

### pg_notify triggers — push to agents

```sql
-- Fire on any task change
CREATE OR REPLACE FUNCTION notify_task_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('agent_events',
    json_build_object('table','tasks','op',TG_OP,'row',row_to_json(NEW))::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_change_trigger
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_change();
```

Relay holds a persistent `LISTEN agent_events` connection. When a task changes, the relay receives the notification and broadcasts it on `/ws` as a `task_updated` event. Agents subscribed to the WebSocket wake up immediately — no polling.

### kb_db — private by default, selectively agent-accessible

```sql
-- Add to existing KB items table
ALTER TABLE items ADD COLUMN agent_visible BOOLEAN NOT NULL DEFAULT false;

-- Relay enforces this automatically on all /kb/* agent endpoints:
-- SELECT * FROM items WHERE agent_visible = true AND ...
-- Users hit /kb/* with full access (no filter)
```

No duplication. No separate table. The relay is the enforcer — agents never query KB directly.

---

## Access Control Model

```
                         ┌─────────────────────────────┐
                         │          relay               │
                         │                              │
 Agent  ──/agent/kb/─────▶  WHERE agent_visible=true   │──▶ kb_db
                         │                              │
 User   ──/kb/───────────▶  no filter                  │──▶ kb_db
                         │                              │
 Agent  ──/state/────────▶  full access                │──▶ agent_db
                         │                              │
 Agent  ──/send──────────▶  relay routing               │──▶ agent_db
                         └─────────────────────────────┘
```

**Agents are treated as developers.** They have full access to `agent_db` (their work logs, tasks, sessions). They have filtered read access to `kb_db` — only items the user has explicitly marked. They cannot write to KB.

**For open-source packaging:**
- All server code ships in the repo (MIT or Apache)
- User data lives in `DATA_DIR` (configurable, defaults to `~/.relay/data/`)
- `docker-compose.yml` brings up postgres + relay, nothing else
- Friend clones repo, sets `DATA_DIR`, runs `docker compose up` — clean slate

---

## Migration Path (no breakage)

1. **Phase 1**: Add `/info` and `/state/*` endpoints to existing relay. No KB changes yet.
2. **Phase 2**: Add `agent_visible` column to KB. Add `/kb/*` passthrough routes to relay. KB server still runs.
3. **Phase 3**: Move KB server routes into relay. Deprecate standalone KB server.
4. **Phase 4**: Migrate SESSIONS.md/BACKLOG.md to agent_db. Update CLAUDE.md to point agents at `/state/*`.
5. **Phase 5**: Remove session-mirror and JSONL watcher as separate processes — absorb into relay.

Each phase is independently deployable. Relay stays on port 8767 throughout. No agent changes until Phase 4.

---

## RAG Considerations

RAG (vector embeddings + semantic search) is already in KB. The question is whether agents should use it.

**Current state**: KB has embeddings for all ingested items. `POST /kb/search?q=` does cosine similarity search.

**Recommendation**: agents should use semantic KB search (`/kb/search`) for *knowledge discovery* — finding relevant items they didn't know existed. They should use `/state/tasks` SQL queries for *structured state* — tasks, sessions, decisions. These are different access patterns and both are needed.

**What RAG is NOT good for**: reading agent state (tasks, backlogs). That's deterministic structured data — SQL is better. RAG is for "find me items relevant to this topic" not "give me all pending tasks."

---

## What This Solves

| Problem | Solution |
|---|---|
| Agents learn 4+ service URLs | One URL: `localhost:8767`, learn from `/info` |
| Agents read 500-line markdown files | Query `/state/tasks?status=active` — 3 rows |
| KB data all-or-nothing for agents | `agent_visible` flag, set per item |
| Task updates require relay messages | pg_notify pushes via WebSocket automatically |
| System hard to reproduce/share | `docker compose up` + `DATA_DIR` |

---

## Open Questions for CEO

1. **Phase priority**: start with Phase 1 (`/info` + `/state/*`) or Phase 2 (KB passthrough) first?
2. **KB access**: column flag (`agent_visible`) vs join table (`kb_grants(item_id, agent_name)`) — column is simpler, join table allows per-agent access. Start with column?
3. **Docker**: is Docker Compose the target deployment, or pm2 stays for now?
