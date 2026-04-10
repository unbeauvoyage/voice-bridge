# Relay Crash Diagnosis — 57 Restarts in 9 Hours

**Date:** 2026-04-05T11:17:58
**Investigator:** command (meta-manager)

## Root Causes (3 distinct issues)

1. **@fastify/cors version mismatch (32 of 57 restarts):** `package.json` declares `@fastify/cors: ^11.2.0` which requires Fastify 5.x, but `fastify: ^4.29.1` is installed. On every startup, the plugin version check throws `FST_ERR_PLUGIN_VERSION_MISMATCH`, caught by the start() try-catch which calls `process.exit(1)`. **Source code no longer imports `@fastify/cors`** (manual CORS hooks at line 422 replaced it), but the package remains in `package.json` — a future `npm install` could re-trigger this if anything auto-loads plugins.

2. **ERR_STRING_TOO_LONG in loadUndelivered (1 restart):** A queue `.jsonl` file grew beyond Node's string size limit (~512MB). `readFileSync` in `persistence.ts:60` threw during startup's `loadUndelivered()` call. The hourly `pruneAllQueues()` keeps files bounded now, but `loadUndelivered` has no protection against oversized files.

3. **uncaughtException handler calls process.exit(1) (remaining ~24 restarts):** Any uncaught error triggers line 2106: `process.exit(1)`. Combined with `max_memory_restart: '200M'` in the pm2 config, memory spikes from large queue reads or concurrent ffmpeg spawns trigger OOM restarts.

## Non-Crash Issues Found

4. **Voice endpoint saves webm as .m4a:** The `/voice` handler (line 710) always saves audio as `{id}.m4a` regardless of actual content type. When iOS sends webm/opus audio, ffmpeg fails to decode a webm file with an `.m4a` extension (exit code 183 = format mismatch). The try-catch at line 748 catches this — it does NOT cause crashes — but voice transcription silently fails every time.

5. **No `audio/webm` content type parser:** The relay registers parsers for m4a, mp4, mpeg, wav, x-m4a, and octet-stream, but NOT `audio/webm` or `audio/ogg`. Voice-bridge sends `audio/webm;codecs=opus` — Fastify rejects the request before it reaches the handler with a 415 Unsupported Media Type.

6. **Voice-bridge sends to `/transcribe`, relay only has `/voice`:** `App.tsx:79` POSTs to `${serverUrl}/transcribe` with `multipart/form-data`, but the relay only has `POST /voice` expecting raw binary body. Even if the content type were accepted, the endpoint doesn't exist.

7. **17,358 "Failed to write to socket" errors** from cmux delivery attempts — noisy but non-fatal.

## Fixes Applied

1. **Downgrade `@fastify/cors` in package.json to `^9.0.1`** (Fastify 4 compatible) — prevents version mismatch crash if anything ever re-imports it.

2. **Add `audio/webm` and `audio/ogg` content type parsers** to the relay.

3. **Detect audio format from content-type header** and use correct file extension in `/voice` handler, so ffmpeg gets a properly-named input file.

4. **Remove `process.exit(1)` from uncaughtException handler** — log the error but let the process survive. pm2's `max_memory_restart` handles genuine OOM cases.

5. **Add streaming file read in `loadUndelivered`** with a file size check to prevent ERR_STRING_TOO_LONG.

## Files Changed

- `/Users/riseof/environment/message-relay/package.json` — cors version fix
- `/Users/riseof/environment/message-relay/src/index.ts` — audio parsers, voice handler format detection, uncaughtException fix
- `/Users/riseof/environment/message-relay/src/persistence.ts` — file size guard in loadUndelivered
