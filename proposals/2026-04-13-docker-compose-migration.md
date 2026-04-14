---
type: proposal
title: Migrate Backend Services from pm2 to Docker Compose
summary: Replace pm2 with Docker Compose to fix silent service failures, fragile restarts, and no dependency ordering — relay migrates first, wake-word daemon stays native.
status: proposed
author: chief-of-staff
created: 2026-04-13T00:00:00
priority: high
project: environment
---

## Problem

pm2 is failing us in three documented ways:

1. **Silent deaths** — processes crash without surfacing to agents; pm2's autorestart fires with no back-off, masking the root cause in logs split across `out_file` and `error_file`.
2. **No dependency ordering** — `message-relay-lean` and `message-relay-lean-https` start simultaneously with no guarantee the underlying port is free or TLS certs are loaded. Agents that start before relay is healthy receive connection refusals.
3. **Agent restart is fragile** — agents cannot reliably restart a pm2 process via tool call; `pm2 restart <name>` requires the pm2 daemon to be healthy, which is circular when the daemon itself is degraded.

Current pm2-managed services (from `message-relay/ecosystem.config.js` and known ops):

| Service | Port(s) | Notes |
|---|---|---|
| message-relay-lean | 8767 | HTTP relay |
| message-relay-lean-https | 8768 | TLS relay |
| monitor-tier1 | — | 5s polling loop |
| monitor-tier2 | — | LLM monitor loop |
| whisper-server | 8766 | STT inference |
| voice-bridge-server | 3030 | Electron IPC bridge |
| heartbeat-daemon | — | 30-min agent ping |
| ota-server | — | App OTA updates |

---

## Options

### Option A — Docker Compose, incremental (relay first)

Migrate service by service, starting with relay (highest criticality). Each service gets a `Dockerfile` or image reference, a `healthcheck`, and `depends_on` wiring. Old pm2 entry stays live until the Docker service passes health checks, then pm2 entry is removed.

**Gains:** `depends_on` with `condition: service_healthy`, exponential back-off restart policy, `docker compose logs -f --tail 100` replaces split log files, agents restart services via Docker socket (`docker compose restart <svc>`), single `docker compose up -d` boots the whole stack.

**Tradeoffs:** Requires Docker Desktop or OrbStack running on macOS. Services that need host-network features (whisper GPU passthrough, audio) need `network_mode: host` or explicit port mapping. Initial Dockerfile authoring per service is ~1–2h each. Adds one more daemon to the startup chain.

**Exceptions:** `wake-word` Python daemon stays native — CoreAudio mic passthrough into Docker on macOS requires `--device` flag support that is unreliable on macOS hosts. Keep it native + a launchd plist for restart.

**Effort:** ~2–3 days total across 8 services. Relay alone is ~4h.

---

### Option B — Stay on pm2, patch the gaps

Add `pm2 monit`-based alerting, use `--exp-backoff-restart-delay` flag, write a watchdog script that agents can call to restart a named process.

**Gains:** No migration cost, no new infra dependency.

**Tradeoffs:** Does not fix dependency ordering. Silent failure problem is reduced but not eliminated. Watchdog script is custom glue that will drift. pm2 log split remains. Fundamentally: we are adding duct tape to a tool that was designed for Node apps, not a heterogeneous stack of Node + bash + Python.

**Effort:** ~4h to write watchdog + tweak config. Lower upfront, higher long-term maintenance.

---

### Option C — Migrate to launchd plists (macOS native)

Each service becomes a `.plist` in `~/Library/LaunchAgents/`. Native macOS, no extra daemon, restart on failure is built in.

**Gains:** Zero additional dependencies, native OS support, survives reboots cleanly.

**Tradeoffs:** No dependency ordering between services (launchd does not support `depends_on`). No unified log view (`log stream` per service is noisy). Agents cannot restart services programmatically without a helper binary or `launchctl` wrapping. Config format is XML (hostile to agent editing). Does not solve the core dependency ordering pain.

**Effort:** ~1 day. Lower effort, lower ceiling.

---

## Recommendation

**Option A.** The dependency ordering problem is the most dangerous failure mode — relay starting before its health is confirmed causes a cascade of agent connection failures that look like relay bugs. Docker Compose `depends_on` with health checks is the only option here that solves it structurally. Incremental migration means zero big-bang risk.

**Why now vs later:** The relay migration is self-contained and yields the highest-risk fix first. A single afternoon produces a working `docker-compose.yml` for relay with health checks, and pm2 keeps running the rest. We do not need to migrate all services on day one.

---

## Implementation Plan

1. **Week 1 — Relay** (4h): Write `docker-compose.yml` with `message-relay-lean` and `message-relay-lean-https`. Add `/health` endpoint healthcheck. Test with `docker compose up`, confirm agents connect. Remove pm2 entries for relay.
2. **Week 1 — Monitor daemons** (2h): Containerize `monitor-tier1` and `monitor-tier2` as lightweight bash containers. Add `depends_on: relay`.
3. **Week 2 — Whisper + voice-bridge** (4h): Whisper needs GPU/CPU image decision. voice-bridge-server runs in host network mode for Electron IPC.
4. **Week 2 — Heartbeat + OTA** (2h): Simple Node/bash containers, no special host access needed.
5. **Ongoing — Wake-word stays native**: Document launchd plist for wake-word daemon. Out of scope for this migration.

**Assign to:** chief-of-staff (architecture + relay service), voice-bridge team lead (whisper + voice-bridge-server service).

---

## Rollback

pm2 entries are not removed until the Docker service passes health checks in production. Rollback at any step = `pm2 start ecosystem.config.js --only <name>` and `docker compose stop <svc>`. No data migration required — all services are stateless or write to host-mounted paths.
