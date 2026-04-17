# Server-Side Cookie Cutter

**Status:** Active, mandatory for all new server code
**Scope:** All TypeScript/Node/Bun HTTP servers in `~/environment/` (voice-bridge, message-relay, knowledge-base server, any new backend)
**Authority:** Chief of Staff owns this module. Patterns extracted from voice-bridge full refactor (2026-04-16).

Mirrors `data-architecture.md` for the server side. Every rule must be enforceable by compiler, linter, or test.

---

## Guiding Principle

**The route handler is a pure function. The server index is a wiring file. Never mix them.**

Handlers contain logic. The server index constructs context and mounts routes. Nothing else belongs in either.

---

## Mandatory Stack

```
Runtime         Bun (bun serve) or Node fetch-compatible
Language        TypeScript strict — same flags as data-architecture.md
Validation      Zod at every network boundary (body, params, query, external responses)
Result types    Discriminated union: {ok: true; data} | {ok: false; error: string}
File I/O        atomicWriteFile for any persistent write
Tests           bun test — one *.test.ts per handler, colocated
E2E             Playwright — *.pw.ts suffix (excluded from bun test glob)
Linter          ESLint strict + no-floating-promises + boundaries
```

---

## Folder Structure

```
server/
  index.ts              ← wiring only: construct ctx, mount routes, start Bun.serve
  routes/
    transcribe.ts        ← one file per route group
    messages.ts
    settings.ts
    mic.ts
    agents.ts
    wakeWord.ts
    health.ts
  lib/
    atomicWrite.ts       ← shared I/O helpers
    parseBody.ts         ← Zod body parser helper
    result.ts            ← Result<T> type + helpers
    trustBoundary.ts     ← type guards for external data shapes
  types.ts               ← server-wide types, context interfaces
  *.test.ts              ← colocated with the file under test
```

Route files that grow beyond ~150 lines should be split by sub-resource, not by HTTP method.

---

## Pattern 1 — Route-per-Handler with DI Context

Every route is a pure function. All dependencies come in via a typed context object.

```ts
// types.ts
export interface TranscribeContext {
  readonly dedup: DedupStore;
  readonly writeFile: (path: string, data: Buffer) => Promise<void>;
  readonly runWhisper: (audioPath: string) => Promise<WhisperResult>;
}

// routes/transcribe.ts
export const handleTranscribe = async (
  req: Request,
  ctx: TranscribeContext,
): Promise<Response> => {
  const body = await parseJsonBody(req, TranscribeBodySchema);
  if (!body.ok) return body.response;
  // ... pure logic using ctx
};

// index.ts (wiring only)
const ctx: TranscribeContext = {
  dedup: createDedupStore(),
  writeFile: fs.writeFile,
  runWhisper: spawnWhisper,
};
Bun.serve({ fetch: (req) => router(req, ctx) });
```

**Why:** Unit tests inject fakes via ctx — no mocks, no patching, no global state. Handlers are testable in isolation with `await handleTranscribe(req, fakeCtx)`.

---

## Pattern 2 — Zod Boundary Validation

All external input is validated at the boundary before any logic runs.

```ts
// lib/parseBody.ts
export const parseJsonBody = async <T>(
  req: Request,
  schema: z.ZodSchema<T>,
): Promise<{ok: true; data: T} | {ok: false; response: Response}> => {
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return { ok: false, response: badRequest('invalid JSON') }; }
  const result = schema.strict().safeParse(raw);
  if (!result.success) return { ok: false, response: badRequest(result.error.message) };
  return { ok: true, data: result.data };
};

// In a handler:
const body = await parseJsonBody(req, z.object({
  agent: z.string().max(128),
  message: z.string().max(10_000),
}));
if (!body.ok) return body.response;
// body.data is fully typed and validated
```

**Rules:**
- `.strict()` on all schemas — reject unknown keys
- Cap all string lengths (agent names: 128, message bodies: 10k, file paths: 512)
- Validate MIME types and file sizes on uploads
- Never access `req.body` raw without a Zod parse

---

## Pattern 3 — Discriminated Result Types

No boolean returns, no null-on-failure, no thrown errors for expected failure cases.

```ts
// lib/result.ts
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export type DeliveryResult = Result<{ messageId: string }>;

// Usage
const result = await deliverToAgent(agent, message);
if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
return Response.json({ id: result.data.messageId });
```

Multi-variant discriminated unions for complex state:

```ts
type DedupEntry =
  | { state: 'inProgress'; waiters: Array<(r: TranscribeResult) => void> }
  | { state: 'resolved'; result: TranscribeResult }
  | { state: 'cancelled' };
```

**Rules:**
- `Result<T>` for any operation that can fail (I/O, external calls, validation)
- Never return `void` from a function that performs I/O — return `Result<void>`
- Never `console.error` and return `undefined` — propagate the error up

---

## Pattern 4 — Atomic File Writes

Any persistent write uses rename-based atomicity.

```ts
// lib/atomicWrite.ts
export const atomicWriteFile = async (
  targetPath: string,
  data: string | Buffer,
  deps = { writeFile: fs.writeFile, rename: fs.rename, unlink: fs.unlink },
): Promise<Result<void>> => {
  const tmpPath = `${targetPath}.tmp.${crypto.randomUUID()}`;
  try {
    await deps.writeFile(tmpPath, data);
    await deps.rename(tmpPath, targetPath);
    return { ok: true, data: undefined };
  } catch (e) {
    await deps.unlink(tmpPath).catch(() => {});
    return { ok: false, error: String(e) };
  }
};
```

**Rules:**
- Every settings/config/queue write goes through atomicWriteFile
- Temp file name includes UUID — no collisions under concurrent calls
- Orphan cleanup on rename failure — never leave .tmp files

---

## Pattern 5 — Trust Boundaries (External Data Guards)

Never narrow an external value's type without a runtime check.

```ts
// lib/trustBoundary.ts
const RelayResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['delivered', 'queued', 'failed']),
});

export const isRelayResponse = (raw: unknown): raw is RelayResponse =>
  RelayResponseSchema.safeParse(raw).success;

// In handler:
const raw = await fetch(relayUrl).then(r => r.json());
if (!isRelayResponse(raw)) return { ok: false, error: 'unexpected relay response shape' };
// raw is now RelayResponse
```

Apply trust boundaries to:
- Relay HTTP responses
- Whisper/LLM output
- File contents read from disk (settings.json, queue files)
- Subprocess stdout
- Any `JSON.parse()` call

---

## Pattern 6 — Error Surfacing

Never silently succeed on failure. Status codes have meaning.

| Condition | Status | Body |
|---|---|---|
| External dependency failed (relay, subprocess) | 502 | `{error: "...", transcript?: "..."}` |
| Internal logic failure | 500 | `{error: "..."}` |
| Concurrent duplicate request | 409 | `{error: "duplicate", dedup: true}` |
| Input validation failed | 400 | `{error: "...", field?: "..."}` |
| Resource not found | 404 | `{error: "not found"}` |

**Critical:** When TTS/transcription fails, still return the transcript in the error body so the UI can display what was heard.

---

## Pattern 7 — Test Organization

**Context factory (mandatory when a route has more than 2 tests):** Define a `makeCtx(overrides?)` helper at the top of each test file. Individual tests declare only what they care about — the factory provides sensible stubs for everything else.

```ts
// routes/transcribe.test.ts — colocated with the handler
import { handleTranscribe } from './transcribe';

function makeCtx(overrides: Partial<TranscribeContext> = {}): TranscribeContext {
  return {
    dedup: createDedupStore(),
    writeFile: async () => {},
    runWhisper: async () => ({ text: 'hello', confidence: 0.9 }),
    fetchFn: async () => new Response('{}', { status: 200 }),
    ...overrides,
  };
}

test('returns 400 when body is missing agent field', async () => {
  const req = new Request('http://x/transcribe', {
    method: 'POST',
    body: JSON.stringify({ message: 'hi' }), // no agent
  });
  const res = await handleTranscribe(req, makeCtx());
  expect(res.status).toBe(400);
});

test('returns 502 when relay is down', async () => {
  const req = makeValidRequest();
  const res = await handleTranscribe(req, makeCtx({
    fetchFn: async () => new Response('', { status: 503 }),
  }));
  expect(res.status).toBe(502);
});
```

**Disk-touching tests:** Use `beforeEach`/`afterEach` with temp paths injected as optional args. Never reference production state paths in tests.

**Rules:**
- One `*.test.ts` per route/module, colocated (not a separate `__tests__/` dir)
- Playwright E2E uses `*.pw.ts` — excluded from `bun test` glob
- `bun test server/` for fast iteration on server logic
- All state injected via ctx — no module-level mutable globals in handlers
- No `mock.module()` — context injection makes it unnecessary
- Test Bun.serve HTTP directly via `fetch(server.url + '/route')` for integration tests

---

## Pattern 8 — Config Management

**`server/config.ts`** — one file, all constants, no env reads:

```ts
/** Base port the server listens on. Override with PORT env var. */
export const SERVER_PORT = 3456;

/** Relay base URL. Override with RELAY_URL env var. */
export const RELAY_BASE_URL = 'http://localhost:8767';

/** Max audio upload size in bytes. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
```

**Rules:**
- Zero `process.env` in `config.ts` — constants only
- Every constant has a JSDoc explaining its purpose and which env var overrides it
- Env-var overrides happen ONLY in `index.ts`: `process.env.PORT ?? SERVER_PORT`
- No hardcoded IPs or secrets in config — use localhost defaults with env var overrides

---

## Pattern 9 — CORS Handling

**OPTIONS preflight** is handled once in `index.ts` before any route dispatch. Not per-route.

```ts
// index.ts
if (req.method === 'OPTIONS') {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
```

**CORS headers on every response** including errors. Declare a local `const CORS_HEADERS` in each route file:

```ts
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
```

(Validation.ts may export its own for use in error responses — acceptable.)

---

## Pattern 10 — Request Body Size Layering

Two-layer defense: server backstop + route-level cap with standard error shape.

```ts
// index.ts — hard backstop (prevents chunked streaming attacks)
Bun.serve({ maxRequestBodySize: 11 * 1024 * 1024, fetch: ... });

// routes/transcribe.ts — route-level cap (returns standard 413 shape before server kills the connection)
if (body.byteLength > MAX_AUDIO_BYTES) {
  return new Response(JSON.stringify({ error: 'Request body too large' }), {
    status: 413,
    headers: CORS_HEADERS,
  });
}
```

The gap (10 MiB route cap vs 11 MiB server cap) lets the route return the standard error JSON. Without it, oversized requests get a bare Bun rejection with no body.

---

## Binary Rules

### Structure
1. Server index (`index.ts`) contains ONLY: context construction, route mounting, server start. No business logic.
2. Route handlers are pure functions — no module-level state, no singletons inside handlers
3. One route file per resource/feature. Files > 150 lines → split

### Validation
4. Every POST/PUT body goes through `parseJsonBody` with a Zod schema
5. Every GET query param is validated before use
6. All string inputs have `.max()` caps
7. Every `JSON.parse()` is wrapped in a try/catch and validated with Zod

### I/O
8. Every file write uses `atomicWriteFile`
9. Every external HTTP response is validated with a trust boundary guard before use
10. Every subprocess spawn is wrapped in a Result — never assume success

### Errors
11. No `console.error` + return undefined — propagate as Result
12. No swallowing errors into boolean returns
13. 502 for external failures, 500 for internal, 400 for validation, 409 for conflicts

### Tests
14. TDD — failing test first
15. One test file per handler, colocated
16. `*.pw.ts` suffix for Playwright — excluded from `bun test`
17. Zero module-level mutable state in handlers — ctx injection only

---

## Forbidden Patterns

| Pattern | Why |
|---|---|
| `express`/`fastify`/`koa` decorator-style route chaining | Bun.serve with pure handlers is simpler and faster |
| Global mutable state in route handlers | Breaks testability; use ctx injection |
| `try { ... } catch { return undefined }` | Silent failure — use Result |
| `as unknown as T` casts on external data | Use Zod parse |
| Boolean return from I/O functions | Use Result\<void\> |
| Shared temp file names across calls | UUID per call, no collision |
| `JSON.parse` without Zod validation | Trust boundary violation |
| Mixed handler + wiring in index.ts | Index is wiring only |

---

## Applying to Existing Servers

| Project | State |
|---|---|
| voice-bridge2 | ✅ Reference implementation — read `projects/voice-bridge2/server/` when a pattern is unclear |
| voice-bridge | ✅ Full compliance (2026-04-17) — route extraction into 10 `server/routes/` files, Zod `.strict()` on all POST inputs, P3 Result delivery, P4 atomicWriteFile, P5 relay response validation, P6 status codes. 52 unit tests + 14 Playwright E2E. Wiring-only `index.ts`. Commits: 801f03f (extraction), 8f0df8e (P3-P6). |
| message-relay | ✅ Route extraction complete (2026-04-17) — health, channels, status, permissions, send, telemetry all in `src/routes/`. Zod on all POST bodies. 391 pass. |
| knowledge-base server | ✅ Route extraction complete (2026-04-17) — 8 route files, Zod on all inputs, 56 pass. server.ts is wiring-only. |
