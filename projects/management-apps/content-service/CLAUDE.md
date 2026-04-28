# content-service

File-content store. Clipboard images, screenshots, future video frames. **Not a queue, not a relay, not a message store.**

## Role

ceo-app and voice-bridge POST binary content to content-service and get back content-hashed URLs. The URL is embedded in outbound messages so recipient agents can render attachments. content-service also serves the bytes back via `GET /files/:id`.

The relay does not proxy file bytes. content-service is called directly by upstream services (today: ceo-app for clipboard image upload; soon: voice-bridge inside `/compose`). This keeps the relay thin (transport only) and lets us swap the storage layer without touching transport.

See `~/environment/proposals/2026-04-28-compose-architecture.md` for the architectural decision.

## Stack

- Bun + Fastify + TypeScript
- `@fastify/multipart` for upload, `@fastify/cors` for browser access
- Storage: local filesystem `~/.claude/content/`, content-hash filenames (sha256)
- OTel via standard env vars (matches relay/voice-bridge pattern)

## Endpoints

- `POST /upload` — multipart `file` field. Returns `{ id, url, mime, bytes, sha256 }`. 25 MB max. Mimes: png/jpeg/webp/gif.
- `GET /files/:idWithExt` — returns bytes with Content-Type. `Cache-Control: immutable` (content-hashed).
- `GET /openapi.yaml` — hand-rolled OpenAPI 3.1 spec. Source of truth for hey-api codegen in ceo-app.
- `GET /health` — Aspire health check.
- `GET /version` — service identity.

## OpenAPI

- Hand-rolled at `docs/openapi.yaml`. Update whenever an endpoint changes.
- Served at runtime via `GET /openapi.yaml` so consumers can pull it.

## Env

- `PORT` (default 8770)
- `HOST` (default 127.0.0.1)
- `CONTENT_DIR` (overrides storage root for tests; default `~/.claude/content`)
- `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_PROTOCOL` — Aspire-injected.

## Rules

- No persistence beyond the filesystem. No DB.
- Content-hash IDs only — never random UUIDs (free dedup, immutable cache).
- No auth in v1 — localhost-trust under Aspire.
- Story tests only at `tests/stories/`.
- No `unknown`/`any`/`as` casts in TypeScript.
- No hand-rolled Zod alongside the OpenAPI spec — OpenAPI is the contract.
