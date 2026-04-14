---
type: proposal
title: Backend Testing Strategy — DB, HTTP, Contracts
summary: Use bun test with in-memory SQLite, real HTTP servers on random ports, and Zod schema assertions to cover the three backend layers Playwright cannot reach; prioritized by bug frequency.
status: proposed
date: 2026-04-12T00:00:00
author: chief-of-staff
priority: high
project: environment
---

# Backend Testing Strategy — DB, HTTP, Contracts

## Problem

Playwright covers UI/E2E well. It cannot cover:
- SQLite schema correctness and CRUD behavior (knowledge-base)
- HTTP endpoint correctness — status codes, response shape, error handling (relay-lean.ts)
- Wire format contracts — relay message schema, JSONL event types, permission hook payloads
- Cross-service round trips that start the relay, send a message, and verify delivery

We have already seen two concrete bugs in this gap: a 415 regression on a relay endpoint (wrong Content-Type handling), and a port binding issue. Neither would have been caught by Playwright.

## Guiding Principles

- Use `bun test` natively — no Jest, no Vitest, no extra test runner
- Test against real servers, real databases — mocks defeat the purpose at this layer
- Zod schemas are the contract definition, not hand-written assertions
- Tests must be fast enough to run on every commit

---

## Option A — Recommended: bun test, real servers, Zod contracts

Four layers, each with a concrete pattern.

### Layer 1 — HTTP Endpoints (relay-lean.ts)

**Pattern:** Start the real Fastify server on a random OS-assigned port before each test suite. Hit it with `fetch`. Assert status codes, response shapes, and Content-Type headers. Tear down after.

```ts
// src/__tests__/http/relay.test.ts
import { describe, beforeAll, afterAll, it, expect } from "bun:test";
import { startRelay } from "../../relay-lean";

let server: { close: () => void };
let baseUrl: string;

beforeAll(async () => {
  server = await startRelay({ port: 0 }); // port 0 = OS-assigned
  baseUrl = `http://localhost:${server.port}`;
});
afterAll(() => server.close());

describe("GET /health", () => {
  it("returns 200 with ok body", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe("POST /send", () => {
  it("accepts valid message and returns 200", async () => {
    const res = await fetch(`${baseUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "test", to: "test", body: "hello", type: "message" }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 415 when Content-Type is wrong", async () => {
    const res = await fetch(`${baseUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    });
    expect(res.status).toBe(415);
  });
});
```

**Why real server not mocks:** The 415 regression and port binding bug would not have been caught by mocks. Mocks do not exercise Fastify config, middleware ordering, or plugin registration — exactly where real bugs hide.

File location: `message-relay/src/__tests__/http/*.test.ts`

### Layer 2 — Database (knowledge-base SQLite)

**Pattern:** Each test creates an in-memory SQLite database (`":memory:"`), runs migrations, then exercises schema correctness, CRUD operations, constraints, and query results.

```ts
// projects/knowledge-base/src/__tests__/db/knowledge.test.ts
import { describe, beforeEach, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../../db";

let db: Database;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
});

describe("knowledge table", () => {
  it("inserts and retrieves an entry", () => {
    db.run("INSERT INTO knowledge (url, title, summary) VALUES (?, ?, ?)",
      ["https://example.com", "Test", "A test entry"]);
    const row = db.query("SELECT * FROM knowledge WHERE url = ?")
      .get("https://example.com");
    expect(row.title).toBe("Test");
  });

  it("enforces unique url constraint", () => {
    db.run("INSERT INTO knowledge (url, title) VALUES (?, ?)", ["https://x.com", "X"]);
    expect(() =>
      db.run("INSERT INTO knowledge (url, title) VALUES (?, ?)", ["https://x.com", "X2"])
    ).toThrow();
  });
});
```

**Why in-memory:** No disk I/O, no cleanup between tests, each test starts from a known state. Migration correctness is verified on every run.

File location: `projects/knowledge-base/src/__tests__/db/*.test.ts`

### Layer 3 — API Contracts (Zod schema assertions)

**Pattern:** Define the wire format as a Zod schema once. Tests assert that real messages produced by the system parse cleanly. If a field is renamed or its type changes, `schema.parse()` throws and the test fails.

```ts
// message-relay/src/__tests__/contracts/relay-message.test.ts
import { describe, it, expect } from "bun:test";
import { z } from "zod";

const RelayMessageSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.string(),
  body: z.unknown(),
  ts: z.number(),
});

const JsonlEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assistant"), text: z.string() }),
  z.object({ type: z.literal("tool_use"), name: z.string(), input: z.unknown() }),
  z.object({ type: z.literal("tool_result"), tool_use_id: z.string() }),
]);

describe("relay message contract", () => {
  it("accepts a well-formed message", () => {
    const msg = { from: "agent", to: "ceo", type: "message", body: "hello", ts: Date.now() };
    expect(() => RelayMessageSchema.parse(msg)).not.toThrow();
  });

  it("rejects a message missing required fields", () => {
    const bad = { from: "agent", body: "hello" };
    expect(() => RelayMessageSchema.parse(bad)).toThrow();
  });
});
```

**Why Zod not hand-rolled assertions:** Zod is already used in the codebase. Schema drift (a field renamed, a type widened) causes a loud parse failure at test time rather than a silent runtime bug.

File location: `message-relay/src/__tests__/contracts/*.test.ts`

### Layer 4 — Cross-Service Integration (when needed)

**Pattern:** Start relay, connect a WebSocket client, send a message via POST /send, assert the WS subscriber receives the message with the correct shape.

Use only for round-trip behaviors that no lower layer can verify: message delivery, subscription mechanics, WS close/reconnect.

File location: `message-relay/src/__tests__/integration/*.test.ts`

---

## Option B — Minimal: contracts only via type-level tests

Skip running servers; use `tsd` or TypeScript `satisfies` assertions to verify that types match expected shapes at compile time. Cheaper to set up.

**Tradeoff:** Type tests catch interface drift but miss runtime behavior — wrong status codes, missing headers, port binding failures. The 415 bug and port binding bug we already hit would not be caught. This is the "we want some coverage without the infrastructure" option.

Recommended only if team capacity is very constrained.

## Option C — Full integration test suite per service

Invest in a full integration test harness per service: Docker Compose or process manager to spin up all services, network-level assertions across service boundaries.

**Tradeoff:** Highest coverage, highest maintenance cost. Overkill for the current scale of this system. Deferred until the system grows beyond 3–4 services communicating in non-trivial ways.

---

## Recommendation

**Option A.** Start with Layer 1 (HTTP endpoints) because that is where the two known bugs already lived. Add Layer 2 (database) next because knowledge-base has zero test coverage on its SQLite layer. Layer 3 (contracts) prevents the silent schema drift class of bugs. Layer 4 is opt-in when round-trip behavior needs verification.

## Recommended File Structure

```
message-relay/
  src/
    __tests__/
      http/
        relay.test.ts          # all HTTP endpoints
      contracts/
        relay-message.test.ts  # relay {from,to,type,body,ts} schema
        jsonl-events.test.ts   # JSONL session event types
        permission-hook.test.ts
      integration/
        message-delivery.test.ts  # round-trip: POST /send → WS receive

projects/knowledge-base/
  src/
    __tests__/
      db/
        knowledge.test.ts      # CRUD, constraints, schema correctness
        migrations.test.ts     # migration idempotency
      contracts/
        api-shapes.test.ts     # server response shapes vs Zod schemas
```

## Priority Order

1. **HTTP endpoints** — two real bugs already in this layer; highest return on investment
2. **Database layer** — knowledge-base SQLite is currently untested
3. **Contracts** — prevents silent schema drift as the system evolves
4. **Cross-service integration** — last; most expensive to maintain, fewest bugs in this category today

## What NOT to Do

- No Jest — we use `bun test`
- No Vitest — redundant
- No mocked HTTP servers — defeats the purpose; mocks do not catch config errors, middleware bugs, or port binding issues
- No unit tests for React render logic — Playwright already covers this layer

## Who Does This

Coder assigned to message-relay handles Layers 1 and 3. Coder assigned to knowledge-base handles Layer 2. Layer 4 is written alongside any feature that adds cross-service behavior.

## Effort

- Layer 1: small — Fastify already supports `port: 0`; one test file per endpoint group
- Layer 2: small — `bun:sqlite` has native `:memory:` support; migrations likely already exist
- Layer 3: small — Zod schemas may already exist; tests are 10–15 lines each
- Layer 4: medium — requires both services to start cleanly in a test context
