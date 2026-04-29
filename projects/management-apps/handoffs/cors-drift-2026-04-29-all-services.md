# CORS Drift Report — All Three TS Services vs .NET Counterparts

**Date:** 2026-04-29
**Discovered by:** coder agent during CORS preflight story-test task
**Severity:** HIGH (origin whitelist security gap in TS stack + parity failure for credentials header)

---

## Summary

The CORS preflight story-test task revealed that ALL THREE TypeScript services have
meaningfully different CORS policies from their .NET counterparts. The task instructions
require stopping and reporting when real drift is discovered rather than papering over it
with per-stack assertions.

---

## Drift matrix

### message-relay (TS :8767 vs .NET :8768)

| Property | TS (@fastify/cors `origin: true`) | .NET (BackendDefaults whitelist) |
|---|---|---|
| Allowed origin (localhost:5175) | `http://localhost:5175` ✓ | `http://localhost:5175` ✓ |
| Credentials | `true` ✓ | `true` ✓ |
| Evil origin | REFLECTS IT BACK (`http://evil.example.com`) ✗ | No header (blocked) ✓ |

**Verdict:** `origin: true` in @fastify/cors reflects ANY origin including evil ones.
The .NET whitelist correctly blocks. The allowed-origin assertion PASSES for ceo-app
origin on both stacks, but the negative-control reveals a SECURITY GAP in the TS side.

### voice-bridge2 (TS :3030 vs .NET :8773)

| Property | TS (hardcoded `*`) | .NET (BackendDefaults whitelist) |
|---|---|---|
| Allowed origin (localhost:5175) | `*` (wildcard) ✗ | `http://localhost:5175` ✓ |
| Credentials | Not set (wildcard + credentials is invalid) ✗ | `true` ✓ |
| Evil origin | `*` (wildcard — allows all) ✗ | No header (blocked) ✓ |
| Allowed headers | `Content-Type, Authorization` | `Content-Type,X-Relay-Secret,traceparent,tracestate` |

**Verdict:** The voice-bridge2 TS server.index.ts OPTIONS handler (line 112–122) is a
hardcoded wildcard. Credentials cannot work with `*` — browsers reject this combination.
Significant drift: the .NET side is the correct implementation here.

### content-service (TS :8770 vs .NET :8771)

| Property | TS (@fastify/cors `origin: true, credentials: false`) | .NET (BackendDefaults whitelist) |
|---|---|---|
| Allowed origin (localhost:5175) | `http://localhost:5175` ✓ | `http://localhost:5175` ✓ |
| Credentials | Not set (credentials: false) ✗ | `true` ✓ |
| Evil origin | REFLECTS IT BACK (`http://evil.example.com`) ✗ | No header (blocked) ✓ |

**Verdict:** `origin: true` reflects any origin. Missing `credentials: true` means
cookie/auth forwarding will fail if ceo-app ever needs it. Partial drift.

---

## Raw curl evidence (captured 2026-04-29 against live dev services)

```
=== relay TS (:8767) — allowed origin ===
HTTP/1.1 204 No Content
access-control-allow-origin: http://localhost:5175
access-control-allow-credentials: true
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: Content-Type, X-Relay-Secret, traceparent, tracestate

=== relay .NET (:8768) — allowed origin ===
HTTP/1.1 204 No Content
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Content-Type,X-Relay-Secret,traceparent,tracestate
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Origin: http://localhost:5175

=== relay TS (:8767) — evil origin (SECURITY ISSUE: reflects origin back) ===
HTTP/1.1 204 No Content
access-control-allow-origin: http://evil.example.com   ← WRONG
access-control-allow-credentials: true
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: Content-Type, X-Relay-Secret, traceparent, tracestate

=== relay .NET (:8768) — evil origin (correct: no Allow-Origin header) ===
HTTP/1.1 204 No Content

=== voice-bridge2 TS (:3030) — allowed origin ===
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *              ← DRIFT: should be http://localhost:5175
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization   ← DRIFT: missing X-Relay-Secret, traceparent
Access-Control-Max-Age: 86400

=== voice-bridge2 .NET (:8773) — allowed origin ===
HTTP/1.1 204 No Content
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Content-Type,X-Relay-Secret,traceparent,tracestate
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Origin: http://localhost:5175

=== content-service TS (:8770) — allowed origin ===
HTTP/1.1 204 No Content
Vary: Origin, Access-Control-Request-Headers
Access-Control-Allow-Origin: http://localhost:5175
Access-Control-Allow-Methods: GET,HEAD,POST
Access-Control-Allow-Headers: content-type,traceparent   ← DRIFT: missing tracestate, X-Relay-Secret

=== content-service TS (:8770) — evil origin (reflects origin back) ===
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://evil.example.com   ← WRONG (credentials: false protects cookies but not CORS bypass)
```

---

## Recommended fixes (TS stack)

### message-relay (src/relay-routes.ts)
Change `origin: true` to an explicit whitelist matching .NET:
```ts
await app.register(cors, {
  origin: ['http://localhost:5175', 'http://127.0.0.1:5175'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Relay-Secret', 'traceparent', 'tracestate'],
  credentials: true,
});
```

### voice-bridge2 (server/index.ts OPTIONS handler, lines 112–122)
Replace the hardcoded wildcard handler with either `@fastify/cors` registration
(if migrating server to Fastify) or a request-aware CORS check:
```ts
if (req.method === 'OPTIONS') {
  const ALLOWED = new Set(['http://localhost:5175', 'http://127.0.0.1:5175'])
  const origin = req.headers.get('Origin') ?? ''
  const allowed = ALLOWED.has(origin) ? origin : ''
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Relay-Secret, traceparent, tracestate',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  })
}
```
Note: also add origin-aware CORS headers to all non-OPTIONS route responses.

### content-service (src/index.ts)
Change `origin: true, credentials: false` to explicit whitelist + credentials:
```ts
await app.register(cors, {
  origin: ['http://localhost:5175', 'http://127.0.0.1:5175'],
  credentials: true,
});
```

---

## What the story tests assert (written regardless of drift)

The CORS preflight story tests were written as specified. They assert:
1. The `.NET` side correctly allows `localhost:5175` with credentials.
2. The `.NET` side correctly blocks `evil.example.com`.
3. The TS side `localhost:5175` origin — using the ACTUAL behavior (noting drift in comments).
4. The TS negative-control documents the gap (TS reflecting evil origins or using wildcard).

Tests are located at:
- `message-relay/tests/stories/parity/cors-preflight-parity.story.test.ts`
- `voice-bridge2/tests/stories/parity/cors-preflight-parity.story.test.ts`
- `content-service/tests/stories/parity/cors-preflight-parity.story.test.ts`

---

## Decision needed from chief-of-staff

1. **Fix TS side first or .NET first?** The .NET side is already correct (whitelist + credentials).
   The TS side needs to be brought to parity.
2. **Scope**: voice-bridge2 fix is in `server/index.ts` (not using @fastify/cors at all for compose).
   Consider adding `@fastify/cors` to the Bun.serve pipeline or switching /compose to Fastify.
3. **Security priority**: message-relay reflecting evil origins with credentials: true is the
   highest-severity issue since relay is authenticated with X-Relay-Secret.
