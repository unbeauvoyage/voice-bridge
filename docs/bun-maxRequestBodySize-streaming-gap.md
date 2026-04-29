---
title: Bun upstream issue — maxRequestBodySize not enforced on chunked/streamed request bodies
bun_version: 1.3.3
platform: darwin arm64 (macOS)
severity: security-adjacent (DoS surface)
status: ready-to-file
created: 2026-04-16
---

# Bug: `Bun.serve({ maxRequestBodySize })` does not enforce the cap on Transfer-Encoding: chunked / streamed request bodies

## Summary

`Bun.serve({ maxRequestBodySize: N })` correctly rejects requests whose
`Content-Length` header exceeds `N` (HTTP 413 emitted by the parser before
any handler runs). However, when the client sends the body with
`Transfer-Encoding: chunked` (or any streamed body without a trusted
`Content-Length`), Bun does **not** enforce the cap: the full body is
buffered and the handler receives a `Request` whose `req.body` streams
arbitrarily many bytes. A hostile client can therefore exhaust server
memory despite the configured limit.

## Environment

- Bun 1.3.3
- macOS 15.4 (Darwin 25.4.0), arm64

## Minimal repro

```ts
// server.ts
Bun.serve({
  port: 3939,
  maxRequestBodySize: 1 * 1024 * 1024, // 1 MiB cap
  async fetch(req) {
    const buf = await req.arrayBuffer()
    return new Response(`read ${buf.byteLength} bytes`)
  }
})
```

Client — honest `Content-Length` (enforced correctly):

```bash
# rejected with 413 before handler runs ✅
dd if=/dev/zero bs=1M count=5 2>/dev/null \
  | curl -s -o /dev/null -w '%{http_code}\n' \
    -H 'Content-Type: application/octet-stream' \
    --data-binary @- http://localhost:3939/
# → 413
```

Client — chunked (NOT enforced ❌):

```bash
# handler reads all 5 MiB despite 1 MiB cap
dd if=/dev/zero bs=1M count=5 2>/dev/null \
  | curl -s -w '%{http_code}\n' \
    -H 'Content-Type: application/octet-stream' \
    -H 'Transfer-Encoding: chunked' \
    --data-binary @- http://localhost:3939/
# → 200, body: "read 5242880 bytes"
```

## Expected

Both clients should produce HTTP 413, or the handler should see a body
stream that aborts past the configured cap.

## Actual

Chunked client proceeds; `req.arrayBuffer()` / `req.body.getReader()`
return the full oversize payload.

## Impact

Any route that accepts client-controlled bodies and relies on
`maxRequestBodySize` for DoS protection is exposed to memory exhaustion
via chunked uploads. Discovered in production voice-bridge2 transcribe
route during a security review. Workaround: manual byte accounting over
`req.body.getReader()` with a running total, early-reject past the cap,
and fire-and-forget `reader.cancel()` (see
`server/routes/transcribe.ts` in voice-bridge2).

## Suggested fix

Apply the `maxRequestBodySize` cap at the chunked decoder layer: track
decoded body bytes seen and terminate the request with 413 once the cap
is crossed, mirroring the Content-Length path.

## Why we are filing

We implemented the workaround and shipped. Filing so future Bun users
do not assume `maxRequestBodySize` is a sufficient DoS backstop.
