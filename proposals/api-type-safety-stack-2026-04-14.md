---
id: api-type-safety-stack
title: System-Wide API Type Safety Stack
date: 2026-04-14T07:28:28
revised: 2026-04-14T07:38:00
status: superseded
priority: highest
summary: SUPERSEDED — CEO decision 2026-04-14: use shared TypeScript types directly, not OpenAPI generation. See API Boundary Standard in code-standards.md. Original OpenAPI+Zod plan below for reference only.
---

## ⚠️ SUPERSEDED

CEO decision 2026-04-14: All 4 apps are one TypeScript system. Shared types (`~/environment/shared/types/`) are the API contract. No OpenAPI spec, no code generation pipeline, no Zod at internal boundaries.

**New standard:** `code-standards.md` → API Boundary Standard section.

**Action items from this discussion:**
1. Create `~/environment/shared/types/` package — relay.ts, knowledge.ts, domain.ts
2. Backend imports and returns shared types (enforced by compiler)
3. Frontend imports same types (no cast needed)
4. Zod used only at external boundaries (scraping, env vars, LLM responses, user file input)

Original plan preserved below for reference.

---

# System-Wide API Type Safety Stack

## Executive Summary

The system currently has two servers (message-relay on :8767, knowledge-base on :3737) consumed by two clients (productivitesse, voice-bridge2). Type safety exists only at compile time via hand-written TypeScript interfaces. Runtime validation is absent — an upstream API change silently breaks clients without any error surfacing until UI state corruption occurs.

This proposal establishes a single-source-of-truth OpenAPI spec per server, generates TypeScript types and Zod schemas from each spec, validates all API responses at runtime via a thin middleware layer in each client, and wires everything together with a typed factory pattern. The entire pipeline is driven by `bun run generate` and enforced in CI.

**Outcome:** Any server-side shape change immediately produces either (a) a TypeScript compile error on the server (Fastify/Bun route generics reject the mismatch) or (b) a Zod runtime error on the client (middleware catches and logs bad shapes before they propagate into React state).

---

## Stack Architecture

```
Server (message-relay / knowledge-base)
  └─ openapi.yaml             ← single source of truth, hand-authored initially
  └─ Fastify/Bun routes       ← validated against spec via JSON Schema (built-in)

Code generation (run locally + CI)
  └─ openapi-typescript       ← generates src/generated/api.d.ts (TypeScript types)
  └─ openapi-zod-client       ← generates src/generated/schemas.ts (Zod schemas)

Client (productivitesse / voice-bridge2)
  └─ src/lib/apiClient.ts     ← factory creates typed endpoint callers
  └─ src/lib/fetchMiddleware.ts ← validates every response with Zod schema
  └─ src/generated/           ← generated types + schemas (gitignored or committed)
  └─ Type guards              ← compile-time narrowing on Zod output (.parse() return)
```

---

## Tooling Decision

### OpenAPI Generator: `openapi-typescript` (v7)

| Tool | Output | Bun compat | Notes |
|---|---|---|---|
| `openapi-typescript` | Pure `.d.ts` types | Full — pure TS, no Node APIs | Best-in-class; used by Stripe, GitHub |
| `orval` | Types + React Query hooks | Requires Node, breaks on Bun | Over-generates; couples to React Query |
| `@openapitools/openapi-generator-cli` | Java-based, many templates | No (requires JVM) | Too heavy, wrong ecosystem |

`openapi-typescript` outputs a single `paths` interface keyed by route path + method. Zero-dependency at runtime (types only). Runs via `bunx openapi-typescript`.

### Zod Integration: `openapi-zod-client`

| Tool | Approach | Notes |
|---|---|---|
| `openapi-zod-client` | Generates Zod schemas from OpenAPI spec | Direct spec → schemas; no manual sync |
| `zod-openapi` | Generates OpenAPI from Zod | Inverts ownership — spec becomes secondary |
| Manual schema sync | Hand-write Zod alongside types | Maintenance burden; drift inevitable |

`openapi-zod-client` reads the same `openapi.yaml` and emits a `schemas.ts` file with one named `z.object(...)` per schema component. Runs via `bunx openapi-zod-client`. Both tools invoked in a single `bun run generate`.

**Zod version:** message-relay uses `zod@^4.3.6`. All generated schemas target Zod v4.

### Runtime validation placement

Validation runs **on the client side only**, inside a custom fetch wrapper. Servers use Fastify's built-in JSON Schema validation (request body) and Bun's native route handler typing (knowledge-base). This avoids double-validation overhead.

---

## Rollout Plan

### message-relay (Week 1)

message-relay already has `src/types/api.ts` with 20+ hand-written interfaces. The migration converts that to an authoritative OpenAPI spec.

**Steps:**
1. Create `/Users/riseof/environment/message-relay/openapi.yaml` (bootstrap from `src/types/api.ts`)
2. Add Fastify JSON Schema validation to each POST route's `schema` option
3. Add `bun run generate` script — produces `src/generated/api.d.ts` + `src/generated/schemas.ts`
4. Convert `src/types/api.ts` to a re-export shim pointing at generated types

**Covered endpoints (20):** `/send`, `/channels`, `/status`, `/agents`, `/history/:agent`, `/queue/:agent`, `/messages/ceo`, `/ceo-active`, `/hook/permission/*`, `/logs`, `/attachments`, `/git/*`, `/proposals`, `/questions`, `/answers`, `/agents/hierarchy`

### productivitesse relay client (Week 1, parallel)

Adds `src/lib/apiMiddleware.ts`, `src/lib/createRelayClient.ts`, factory singleton, relay guards. Replaces `parseJsonAs<T>()` unsafe casts in `src/features/mobile/api.ts` with validated fetch calls.

### voice-bridge2 relay client (Week 1, 1 day)

Smallest migration — `server/relay.ts` has one `POST /send` call. Same middleware pattern, 1 day effort.

### knowledge-base (Week 2)

Largest spec (~60 endpoints). Server uses `Bun.serve()` — requires adding a `parseBody()` validation helper since there's no built-in JSON Schema validation. `web/api.ts`'s `request<T>()` gains a Zod schema key parameter.

### productivitesse knowledge-base client (Week 2)

productivitesse does not currently call knowledge-base directly. Factory is pre-built and ready for when the integration is added.

---

## Factory Pattern

```typescript
// src/lib/createRelayClient.ts
import { z } from 'zod';
import { relaySchemas } from '../generated/relay-schemas.ts';
import { validatedFetch } from './apiMiddleware.ts';

type RelayClientConfig = {
  baseUrl: string;
  timeoutMs?: number;
};

export function createRelayClient(config: RelayClientConfig) {
  const { baseUrl, timeoutMs = 5_000 } = config;

  function get<T>(path: string, schema: z.ZodSchema<T>): Promise<T> {
    return validatedFetch(`${baseUrl}${path}`, schema, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  function post<TBody, TResponse>(
    path: string,
    body: TBody,
    schema: z.ZodSchema<TResponse>,
  ): Promise<TResponse> {
    return validatedFetch(`${baseUrl}${path}`, schema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  return {
    getAgents:  () => get('/agents',   relaySchemas.AgentsResponse),
    getStatus:  () => get('/status',   relaySchemas.StatusResponse),
    getChannels:() => get('/channels', relaySchemas.ChannelsResponse),
    getHistory: (agent: string) => get(`/history/${encodeURIComponent(agent)}`, relaySchemas.HistoryResponse),
    send: (body: z.infer<typeof relaySchemas.SendRequestBody>) =>
      post('/send', body, relaySchemas.SendResponse),
    getPermissionsPending: () =>
      get('/hook/permission/pending', z.array(relaySchemas.PermissionRecord)),
  } as const;
}

// Singleton — productivitesse/voice-bridge2
// src/lib/relayClient.ts
export const relayClient = createRelayClient({ baseUrl: getRelayUrl() });
```

```typescript
// src/lib/apiMiddleware.ts
import { z, ZodSchema, ZodError } from 'zod';

export class ApiValidationError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly issues: ZodError['issues'],
  ) {
    super(`API shape mismatch at ${endpoint}`);
  }
}

export async function validatedFetch<T>(
  url: string,
  schema: ZodSchema<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const raw: unknown = await res.json();
  const result = schema.safeParse(raw);
  if (!result.success) {
    console.warn('[api-middleware] shape mismatch', url, result.error.issues);
    throw new ApiValidationError(url, result.error.issues);
  }
  return result.data;
}
```

**Type guard layer** — used only for discriminated union members (not needed for simple shapes since Zod `.parse()` already narrows):

```typescript
// src/lib/relayGuards.ts
import type { components } from '../generated/api.d.ts';
type SendResponse = components['schemas']['SendResponse'];

export const isSendDelivered = (r: SendResponse): r is components['schemas']['SendResponseDelivered'] =>
  r.status === 'delivered';
export const isSendQueued = (r: SendResponse): r is components['schemas']['SendResponseQueued'] =>
  r.status === 'queued';
```

---

## Code Generation Pipeline

### Scripts per project

**message-relay `package.json`:**
```json
"generate": "bunx openapi-typescript openapi.yaml -o src/generated/api.d.ts && bunx openapi-zod-client openapi.yaml -o src/generated/schemas.ts",
"generate:check": "bun run generate && git diff --exit-code src/generated/"
```

**knowledge-base `package.json`:** same pattern.

**productivitesse `package.json`:**
```json
"generate:relay": "bunx openapi-typescript ../../message-relay/openapi.yaml -o src/generated/relay-api.d.ts && bunx openapi-zod-client ../../message-relay/openapi.yaml -o src/generated/relay-schemas.ts",
"generate:kb":    "bunx openapi-typescript ../knowledge-base/openapi.yaml -o src/generated/kb-api.d.ts && bunx openapi-zod-client ../knowledge-base/openapi.yaml -o src/generated/kb-schemas.ts",
"generate": "bun run generate:relay && bun run generate:kb"
```

**voice-bridge2 `package.json`:** only `generate:relay` (does not consume knowledge-base).

### Commit policy for generated files

Generated `src/generated/` files are **committed to source control** (Option A over a shared npm package). This avoids workspace monorepo infrastructure while keeping generated files always present after `git clone`. Add to `.gitattributes`:
```
src/generated/ linguist-generated=true
```

### CI enforcement

Server CI: `bun run generate:check` — regenerates and fails if committed files diverged from spec.
Client CI: `bun run generate` runs before `bun run typecheck` — generated types always fresh before compiler runs.

### Workflow after migration (spec-first)

1. Edit `openapi.yaml` first
2. Run `bun run generate`
3. Implement the route — compiler enforces response shape via Fastify generics
4. CI prevents shipping without regenerating

---

## Migration Order

| Week | Project | Effort | Why |
|---|---|---|---|
| 1 | message-relay server | 2 days | Smallest spec, already typed in `api.ts`, Fastify has built-in validation |
| 1 | productivitesse relay client | 2 days | Highest value — many hooks use relay, unsafe casts cause silent UI bugs |
| 1 | voice-bridge2 relay client | 1 day | Trivial — one `POST /send` call |
| 2 | knowledge-base server | 3 days | 60 endpoints, needs `parseBody()` helper, Bun.serve has no built-in schema validation |
| 2 | productivitesse kb client | 0 days | Not currently called — factory ready when needed |

---

## Open Questions

1. **knowledge-base spec bootstrap:** 60 endpoints is significant hand-writing effort. Should a coder auto-generate a draft YAML from `web/api.ts` TypeScript interfaces to reduce burden?

2. **HistoryResponse and QueueResponse** use `Record<string, unknown>[]` in `api.ts`. Should we model full `Message` shape in the spec now, or mark as `array of object` and tighten in a follow-up?

3. **Multipart endpoints** (`POST /attachments`, `POST /import/bookmarks`): `openapi-zod-client` has partial support for binary uploads. These endpoints validate responses but NOT request bodies — document as explicit exceptions in the spec.

4. **relay URL is dynamic** in productivitesse (user-configurable). `createRelayClient` should accept a URL-getter function rather than a static string to handle URL changes without re-instantiation:
   ```typescript
   type RelayClientConfig = { getBaseUrl: () => string; timeoutMs?: number };
   ```

5. **voice-bridge2 tsconfig scope:** Confirm `src/generated/` is within `tsconfig.web.json` include globs before generating types for the renderer process.
