# voice-bridge2

CEO-input bridge. Named "voice-bridge" historically, but its actual job is to bridge **CEO input — any modality (text, audio, image, future video) —** into the message shape the relay expects, then call relay `/send`. **One-way: nothing comes back to the CEO from this service.** The CEO sees agent responses through Claude Code's JSONL files → relay tail → WebSocket → ceo-app feed. (See `~/environment/proposals/2026-04-28-compose-architecture.md` for the full architectural decision and decision log.)

## Role
You are the **team-lead** for voice-bridge2. Spawn coders for implementation; stay available for coordination. Report to chief-of-staff via relay (`relay_reply to: "chief-of-staff"`).

## Stack
- Server: Bun. Entry: `server/index.ts` (imports `server/otel.ts` first).
- UI: Electron + electron-vite (`src/`). Web renderer at `src/renderer/`.
- Wake-word: Python daemon (`daemon/wake_word.py`). Target: `chief-of-staff`.
- OTel: `server/otel.ts` — SimpleSpanProcessor + PeriodicExportingMetricReader → Aspire dashboard port 18890. Env vars injected by AppHost.

## Endpoints
- **`POST /compose`** — primary endpoint for any CEO message. Multimodal envelope `{ to, text?, audio?, attachments?[] }`. Orchestrates whisper-server (transcription) + content-service (attachment upload) + relay `/send` (final delivery). All-or-nothing transactional: any sub-step failure → 4xx/5xx with error stage; never a partial send.
- `POST /transcribe` — legacy, pending removal. Same direction as /compose but voice-only and auto-delivers to relay. Stays alive until ceo-app cuts over to /compose; deletion is a separate iteration.
- `GET /health` — AppHost liveness check (must keep returning 200).
- Wake-word + Electron mic UI — separate concerns; remain as today.

## OpenAPI
- Hand-rolled spec at `docs/openapi.yaml`. Add to it whenever an endpoint changes.
- ceo-app generates its client from this spec via hey-api. **No hand-rolled Zod alongside.** OpenAPI is the contract; types and react-query hooks are derived.

## Branch policy (voice-bridge2-specific exception)
`main` is the canonical CEO branch for voice-bridge2 today. PRs target `main` (PR #2 was the established precedent).

`origin/dev` exists as a divergent legacy archive — it carries the full pre-management-apps lineage of voice-bridge v1 + v2 development and shares **no common ancestor** with `origin/main`. Treat it as a read-only artifact:
- Do not delete origin/dev.
- Do not retarget PRs to origin/dev.
- Do not force-push origin/dev (no `dev := main` rewrite without explicit CEO authorization).

The standard agency `dev`-branch convention from `~/environment/projects/management-apps/CLAUDE.md` is **deferred** for voice-bridge2 until the legacy lineage is properly handled (likely path: rename origin/dev → origin/legacy-history-archive, then create new dev from main — but that's a CEO-authorized op).

## Compose library shape (portability constraint)
`server/compose/` is a self-contained library — orchestrator + injected clients. The route handler is parse-and-respond only. This makes /compose liftable into the relay later (or portable to .NET) by copying the directory and swapping the relay client for an in-process call. See proposal § "Folder shape (portability constraint)".

## Active work
1. **`POST /compose`**: implementation in flight (chief-of-staff coordinating). Tracks proposal `2026-04-28-compose-architecture.md`.
2. **Hey Jarvis wake word**: not working — investigate `daemon/wake_word.py` + `server/routes/wakeWord.ts`.
3. **OTel**: `server/otel.ts` + `server/index.ts` restored (were lost in rebase). Verify Aspire shows `voice-bridge-server` traces.

## Key rules
- `server/index.ts` is the AppHost entry point — keep it runnable.
- `/health` endpoint must return 200 (AppHost health check).
- **Story tests only** (`tests/stories/`). No unit tests. No mocks.
- **No `unknown`/`any`/`as` casts.** OpenAPI is the contract; types follow.
- **No hand-rolled Zod** — OpenAPI is the source of truth; consumers (ceo-app) generate types via hey-api.
- Surgical changes — don't restructure route files.

## Naming caveat
The name will outgrow itself as more CEO-input modalities land. Rename when it stops fitting (e.g. `message-bridge`, `compose-service`); not a blocker until then.
