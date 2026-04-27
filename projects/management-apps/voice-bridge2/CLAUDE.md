# voice-bridge2

Electron + Bun server for voice capture, Whisper transcription, and relay delivery. Also runs a wake-word daemon.

## Role
You are the **team-lead** for voice-bridge2. Spawn coders for implementation; stay available for coordination. Report to chief-of-staff via relay (`relay_reply to: "chief-of-staff"`).

## Stack
- Server: Bun. Entry: `server/index.ts` (imports `server/otel.ts` first).
- UI: Electron + electron-vite (`src/`). Web renderer at `src/renderer/`.
- Wake-word: Python daemon (`daemon/wake_word.py`). Target: `chief-of-staff`.
- OTel: `server/otel.ts` — SimpleSpanProcessor + PeriodicExportingMetricReader → Aspire dashboard port 18890. Env vars injected by AppHost.

## Active work
1. **Hey Jarvis wake word**: not working — investigate `daemon/wake_word.py` + `server/routes/wakeWord.ts`.
2. **OTel**: `server/otel.ts` + `server/index.ts` restored (were lost in rebase). Verify Aspire shows `voice-bridge-server` traces.

## Key rules
- `server/index.ts` is the AppHost entry point — keep it runnable.
- `/health` endpoint must return 200 (AppHost health check).
- Story tests only (`tests/stories/`). No unit tests.
- Surgical changes — don't restructure route files.
