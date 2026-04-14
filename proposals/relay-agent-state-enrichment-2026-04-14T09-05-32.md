---
id: relay-agent-state-enrichment
title: Relay /agents — Emit Real State Instead of Always 'unknown'
date: 2026-04-14T09:05:32
status: done
implemented: 2026-04-14
commits: [ac8b823, e9b17e8]
priority: high
summary: The relay's /agents endpoint always returns state 'unknown'. Real state (working/idle/stale/offline) should come from the relay using port files + JSONL activity timestamps — eliminating productivitesse's frontend JSONL derivation workaround.
---

## Problem

`GET /agents` currently returns `state: 'unknown'` for every agent. productivitesse compensates by parsing JSONL session files itself and deriving richer state client-side. This is a workaround for a relay limitation, not a legitimate frontend domain concern.

This violates the principle agreed with CEO (2026-04-14): the relay is the backend, productivitesse is the view layer. State derivation belongs in the backend, not in the UI.

## Proposed State Derivation Logic

The relay already has what it needs:

| State | Source | Condition |
|---|---|---|
| `offline` | port file | No `.port` file in `~/.claude/relay-channel/` |
| `disconnected` | port file | Port file exists, but TCP connect to port fails |
| `working` | JSONL | Port file exists + JSONL assistant event within last 30s |
| `idle` | JSONL | Port file exists + last JSONL event was 30s–5min ago |
| `stale` | JSONL | Port file exists + no JSONL event in >5min (or no JSONL file) |
| `unknown` | fallback | Port file exists, JSONL unreadable |

## Implementation Plan

### 1. Add JSONL activity tracker to relay-lean.ts

```typescript
// Track last JSONL event time per agent — in-memory, updated by jsonlWatcher
const agentLastActivity = new Map<string, number>() // agentName → ms timestamp

// Hook into jsonlWatcher events (already broadcast on dashboard WS)
// On jsonl_assistant_text or jsonl_tool_use event → update agentLastActivity
```

### 2. Add state derivation function

```typescript
function deriveAgentState(name: string, portExists: boolean): AgentState {
  if (!portExists) return 'offline'
  const lastActivity = agentLastActivity.get(name)
  const now = Date.now()
  if (!lastActivity) return 'stale'
  const age = now - lastActivity
  if (age < 30_000) return 'working'
  if (age < 300_000) return 'idle'
  return 'stale'
}
```

### 3. Update /agents handler

Replace `state: 'unknown'` with `state: deriveAgentState(name, true)` in the /agents route.

### 4. Update shared/domain/agent.ts (no type changes needed)

`AgentState` already has all 6 values — no type changes required. The relay now actually uses them.

### 5. productivitesse removes its JSONL derivation workaround

Once relay returns real state, productivitesse's `useAgents` hook (or wherever it reads JSONL for state) can be simplified to pass through the relay's state directly.

## Impact

| Project | Change |
|---|---|
| message-relay | +30 lines: activity tracker + deriveAgentState + /agents update |
| productivitesse | Remove JSONL state derivation code (simplification) |
| shared/domain | No changes — types already correct |
| voice-bridge2 | No changes — reads agent names only |
| knowledge-base | No changes |

## Disconnected State

`disconnected` (port file exists but TCP connect fails) requires an async probe. Options:
- (A) Skip disconnect detection — 'stale' is sufficient for UI purposes
- (B) Background health check per agent (probe every 60s, cache result)

Recommend (A) for this iteration — 'stale' accurately describes an agent that has a port file but no recent activity. 'disconnected' is a refinement for a later iteration.

## Test

```typescript
// relay.spec.ts — agent state enrichment
// 1. Start relay with no JSONL events → /agents returns state: 'stale' for registered agents
// 2. Emit a JSONL assistant_text event → /agents returns state: 'working' within 1s
// 3. Wait 35s (or mock time) → /agents returns state: 'idle'
// 4. Remove port file → /agents no longer lists agent
```
