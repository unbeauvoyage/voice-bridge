# Channel Communication: Relay vs Direct

## Architecture Comparison

| Dimension | Relay (current: message-hub) | Direct (channel-to-channel) |
|-----------|------------------------------|------------------------------|
| **Delivery path** | Agent → HTTP POST /send → relay stores → relay POSTs /deliver → channel plugin → MCP push | Agent calls hub_reply with target's registered port → direct HTTP POST → channel plugin → MCP push |
| **Failure points** | Relay process crash, relay MCP disconnect, channel plugin disconnect, port staleness | Channel plugin disconnect, port staleness (fewer hops) |
| **Message persistence** | Relay stores queue on disk — survives crashes | No persistence — if target is down, message lost |
| **Registration** | Agent registers channel port with relay on startup | Agents need a way to discover each other's ports |
| **Relay as SPOF** | Yes — relay down = no delivery | No relay dependency |
| **Known problems** | Relay crashes break all delivery; stale port registrations; MCP reconnect on relay restart | Need peer discovery mechanism; no queue/retry |
| **Token cost** | Relay MCP tools consumed on every send | Same (still need a way to call hub_reply or equivalent) |
| **Complexity** | High — relay process + MCP server + HTTP server + disk persistence | Low — just channel plugin + port discovery |

## Problems Observed

- [x] **Channel plugin disconnects after session resume (agency sessions)** — Plugin spawns a new process on resume with a new random port. `registerWithHub()` is fire-and-forget with no retry. If registration fails, relay never learns the new port. Worse: the MCP stdio transport breaks on resume but the HTTP server stays alive, so health checks pass but notifications are silently dropped.
- [x] **Relay MCP tools lost when relay restarts** — Tools are served by the plugin process, not the relay. They survive relay restarts. The real issue is plugin process death on session resume — MCP tools vanish because Claude Code doesn't re-launch development channels on resume. Full session restart is currently required.
- [x] **Stale port registrations cause silent delivery failures** — Root cause: `/deliver` returns HTTP 200 even when `mcp.notification()` silently fails (broken MCP transport). Hub marks message "delivered" based on HTTP response, not actual MCP delivery. Old plugin processes respond to health checks correctly but can't push notifications. 60s cleanup interval leaves a window for message loss.
- [x] **`hub_reply` blocked when relay down** — Relay is SPOF for all messaging. Messages persist to disk (survive crashes), but delivery promises are lost. Permission relay Promises are destroyed. Agents have no communication path during relay downtime.

## Recommendation

**Phase 1 (immediate fix — high impact, low effort):** Fix the channel plugin's `/deliver` endpoint to await `mcp.notification()` and return HTTP 500 if the MCP transport is broken. Remove the `void` keyword. This single change prevents the relay from marking messages as "delivered" when they were actually dropped — the #1 cause of silent message loss.

**Phase 2 (direct delivery):** Add a file-based agent registry (`~/.agent-channels.json`) where each plugin writes its port + PID on startup. Agents read this file to discover peers and POST directly to `/deliver`. The relay becomes an optional fallback for offline targets (dead-letter queue), not the primary routing path. This eliminates the SPOF and reduces delivery hops from 2 to 1.

**Phase 3 (robustness):** Add PID-based liveness checks to the registry (sender verifies target PID is alive before trusting the port). Add a dead-letter file per target for retry when direct delivery fails. Keep voice/TTS endpoints as a separate lightweight service.
