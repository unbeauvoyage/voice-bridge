---
id: docker-compose-migration
title: Docker Compose Migration — Backend Services
date: 2026-04-14T19:04:10
status: proposed
priority: high
summary: Replace pm2 with Docker Compose for message-relay and knowledge-base. Gives single-command startup, depends_on health checks, automatic restart with back-off, per-service logs, and agent-controllable restarts via Docker socket. Wake-word Python daemon stays native (macOS audio device passthrough).
---

## Problem

Current pm2 setup works but has four reliability gaps:

1. **Silent failure** — pm2 restarts services but doesn't alert agents or CEO when restarts spike (message-relay has 51 restarts today)
2. **No dependency ordering** — pm2 starts all services simultaneously; relay can start before its dependencies are healthy
3. **Agent restarts are fragile** — agents cannot reliably restart pm2 processes; the pm2 binary path and permissions vary
4. **No structured log aggregation** — pm2 logs go to `~/.pm2/logs/*.log` in mixed format; no easy per-service filtering

## Proposed Stack

Docker Compose with:
- `restart: unless-stopped` on all services
- `depends_on:` with `condition: service_healthy` where applicable
- Named volumes for persistent data (relay queues, knowledge DB)
- Docker socket exposed to relay only (so relay can restart its own container)

## Services

| Service | Current | Proposed | Exception |
|---|---|---|---|
| message-relay-lean | pm2 (port 8767) | Docker container | None |
| message-relay-https | pm2 (port 8768) | Nginx sidecar + relay | None |
| knowledge-base | ? | Docker container | None |
| voice-bridge daemon | native | **stays native** | macOS audio passthrough |
| productivitesse dev server | manual | out of scope | Dev tool |

## Docker Compose Layout

```yaml
# ~/environment/system/docker-compose.yml
version: '3.9'

services:
  relay:
    build: ./message-relay
    restart: unless-stopped
    ports:
      - "127.0.0.1:8767:8767"
    volumes:
      - relay-queues:/app/queues
      - ~/.claude/relay-channel:/relay-channel:ro
      - ~/.claude/projects:/projects:ro
    environment:
      - PORT=8767
      - HOST=0.0.0.0
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8767/health"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s

  relay-https:
    build: ./message-relay
    restart: unless-stopped
    ports:
      - "0.0.0.0:8768:8768"
    volumes:
      - relay-queues:/app/queues
      - ~/.claude/relay-channel:/relay-channel:ro
    environment:
      - PORT=8768
      - HOST=0.0.0.0
      - HTTPS=true
    depends_on:
      relay:
        condition: service_healthy

  knowledge-base:
    build: ./projects/knowledge-base
    restart: unless-stopped
    ports:
      - "127.0.0.1:3737:3737"
    volumes:
      - kb-data:/app/knowledge

volumes:
  relay-queues:
  kb-data:
```

## Migration Plan

### Phase 1 — Relay (Week 1)
1. Add `Dockerfile` to message-relay (Bun base image)
2. Verify relay starts and passes health check in container
3. Test port mapping, volume mounts (queue files, port files)
4. Blue/green: run Docker relay on 8769 alongside pm2 relay on 8767
5. Switch traffic: update port configs to 8769, verify all agents work
6. Stop pm2 relay, update docker-compose to use 8767
7. Add `docker compose up relay` to login items

### Phase 2 — Knowledge Base (Week 2)
1. Add `Dockerfile` to knowledge-base
2. Verify DB file persistence with named volume
3. Same blue/green pattern on port 3738 → 3737

### Phase 3 — Cleanup (Week 3)
1. Remove pm2 entries for relay and knowledge-base
2. Write `scripts/start-system.sh` that does `docker compose up -d`
3. Update CLAUDE.md to reference Docker Compose for service management

## Agent Restart Interface

Agents can restart relay via Docker socket:
```bash
docker restart environment-relay-1
```

This replaces fragile pm2 commands. The relay container exposes the Docker socket to itself only — no other container gets socket access.

## Caveats

1. **Port file mounts** — relay reads `~/.claude/relay-channel/*.port` to discover agents. These are host paths. Must be bind-mounted read-only.
2. **JSONL session files** — relay's JSONL watcher reads `~/.claude/projects/`. Must be bind-mounted read-only.
3. **Shared domain types** — at build time the Docker context must include `shared/domain/`. Either monorepo layout or copy step in Dockerfile.
4. **macOS audio** — wake-word daemon cannot run in Docker on macOS. Stays as native process, no change.
5. **Network isolation** — containers on default bridge can't reach host agents by `localhost`. The relay container must use `host.docker.internal` to reach agent channel plugins on the host. Set in environment: `AGENT_BASE_URL=http://host.docker.internal`.

## Risks

| Risk | Mitigation |
|---|---|
| Port file paths break in container | Bind mount `~/.claude/relay-channel` read-only |
| JSONL watcher can't read session files | Bind mount `~/.claude/projects` read-only |
| host.docker.internal not available | Docker Desktop on macOS always provides this |
| Volume data loss | Named volumes survive container rebuilds; back up relay-queues before migration |

## Decision Needed

1. Approve Phase 1 only (relay first) or all phases together?
2. Monorepo first, or wire Docker context to copy `shared/domain/` at build time?
3. Start Docker Compose services at macOS login via `launchd` plist or Docker Desktop startup?
