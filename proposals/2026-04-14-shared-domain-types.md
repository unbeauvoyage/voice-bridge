---
type: proposal
title: Shared Domain Types — single source of truth across all services
summary: Define Agent, Message, and relay wire types once in shared/domain/ and import everywhere, preventing the class of runtime cast bugs that crashed voice-bridge in April 2026.
status: proposed
authors: [productivitesse, chief-of-staff, knowledge-base]
created: 2026-04-14T09:03:49
priority: high
project: environment
---

## Problem

Four services — message-relay, productivitesse, voice-bridge, knowledge-base — each define overlapping types independently. There is no enforcement that a `Message` in voice-bridge matches a `Message` in productivitesse. TypeScript compiles each service in isolation, so cross-service casts silently succeed and crash at runtime.

Concrete incident: in April 2026, voice-bridge called `/agents` which returns `{name, state, hasChannel}[]` but cast the result as `string[]`. TypeScript did not catch it. The service crashed at runtime.

## Agreed Solution

A `shared/domain/` directory at `~/environment/shared/domain/` with a `@env/domain` path alias wired into all four tsconfigs. Authoritative types live there. Services import, not redefine.

### `shared/domain/relay.ts` — owned by productivitesse + chief-of-staff

```typescript
export type AgentName = string & { readonly __brand: 'AgentName' };
export type MessageId = string & { readonly __brand: 'MessageId' };

export type AgentState =
  | 'unknown'       // relay wire default — agent registered, state not tracked
  | 'idle'          // JSONL-derived: session open, no active turn
  | 'working'       // JSONL-derived: assistant turn in progress
  | 'stale'         // JSONL-derived: last event >10s ago, may have crashed
  | 'disconnected'  // channel gone
  | 'offline';      // no port file / never registered
// 'waiting' added when productivitesse tracks waiting-for-input state from JSONL

export interface Agent {
  name:         AgentName;
  state:        AgentState;
  hasChannel:   boolean;
  currentTask?: string;
  // color: stays in productivitesse src/domain/types/agent.ts — UI-only
}

export type MessageType =
  | 'message'
  | 'done'
  | 'waiting-for-input'
  | 'escalate'
  | 'status'
  | 'voice'             // relay-internal
  | 'permission-result'; // relay-internal

export interface Message {
  id:        MessageId;
  from:      AgentName;
  to:        AgentName;
  type:      MessageType;
  body:      string;
  ts:        string;    // ISO 8601 — convert to number only at sort/display time
  delivered?: boolean;
}
```

### `shared/domain/knowledge.ts` — owned by knowledge-base

```typescript
// Full types to be exported from knowledge-base's src/types.ts
export type { KnowledgeItem, KnowledgeItemPreview, KnowledgeItemDetail, KnowledgeSection, Feed }
```

## What Stays Local

These types are explicitly excluded from `shared/domain/`:

| Type | Location | Reason |
|---|---|---|
| `AgentStatus` (`'active' \| 'idle' \| 'working' \| 'done' \| 'offline' \| 'stale' \| 'disconnected'`) | `productivitesse/src/domain/statusOf.ts` | JSONL-derived display state, distinct from wire `AgentState` |
| `color` on Agent | `productivitesse/src/domain/types/agent.ts` | UI-only, no other service needs it |
| `Tab` | `productivitesse/src/domain/types/tab.ts` | productivitesse UI concept only |
| knowledge-base internal types | knowledge-base local | Not consumed by other services |

## Migration Plan

1. **chief-of-staff** writes `shared/domain/relay.ts` with the agreed schema above
2. **knowledge-base** exports their canonical types from `shared/domain/knowledge.ts`
3. **productivitesse** updates `src/domain/types/agent.ts` and `src/domain/types/message.ts` to re-export from `@env/domain` or import directly — local extensions (color, display state) stay in place
4. **voice-bridge** updates all relay type consumers to import `Agent`, `Message`, `AgentState` from `@env/domain`
5. Each service's local `src/domain/` retains service-specific types that extend shared ones — shared types are the floor, not the ceiling

## Rationale

The voice-bridge crash was a compile-time-catchable bug that slipped through because types were not shared. With `@env/domain` imported by all consumers, a breaking change to `Agent` or `Message` produces a compile error across all four services simultaneously — the bug cannot ship.

Branded types (`AgentName`, `MessageId`) add a second layer: accidental string-to-branded-type assignments are caught at the assignment site, not at the runtime call site.
