# voice-bridge2 Architecture

## Processes

Three OS processes cooperate at runtime:

| Process | Runtime | Entry point | Role |
|---------|---------|-------------|------|
| Electron main | Node (Electron) | `src/main/index.ts` | Tray icon, settings window, overlay window, subprocess lifecycle |
| Bun HTTP server | Bun | `server/index.ts` | POST /transcribe, relay delivery, relay polling, TTS |
| Python daemon | Python 3.14 | `daemon/wake_word.py` | Wake word detection, audio recording, relay polling (legacy), TTS (legacy) |

Electron spawns the other two as child processes on app ready (lines 138-140 of index.ts).

## Data Flow: Voice → Agent

```
Microphone
  │
  ▼
wake_word.py (OpenWakeWord, 16kHz mono)
  │  "hey jarvis" detected → start recording
  │  "alexa" detected → stop recording, trim end
  ▼
POST /transcribe (Bun server, port 3030)
  │  1. Audio dedup (hash → Map with 30s TTL)
  │  2. ffmpeg convert → 16kHz mono WAV
  │  3. Whisper inference (local whisper.cpp, port 8766)
  │  4. Hallucination filter (known phrases + low RMS → cancel)
  │  5. LLM routing (llmRouter.ts → target agent name)
  │  6. Relay delivery (POST to message-relay, port 8767)
  │     Fallback: cmux delivery if relay is down
  ▼
message-relay (separate project, port 8767)
  │  Queues message for target agent
  ▼
Agent (Claude Code session) picks up message
```

## Data Flow: Agent → CEO

```
Agent sends reply to relay
  │  POST /send → queued for "ceo"
  │
  ├── Bun relay-poller (every 3s)
  │     GET /queue/ceo
  │     → POST to Electron overlay server (port 47890)
  │       → BrowserWindow toast notification
  │     → edge-tts → afplay (if tts_enabled, word count ≤ limit)
  │
  └── Python relay_message_watcher (every 2s)  ← LEGACY, see "Dual TTS" below
        GET /history/ceo
        → /tmp/vb-toast-queue.jsonl
        → Ollama summarize → edge-tts → afplay
```

## Process Communication

```
Electron main
  ├── spawns → Bun server (child_process, stdout/stderr piped)
  ├── spawns → Python daemon (child_process, stdout parsed as JSON for state)
  ├── HTTP ← Bun server (fetch localhost:3030 for /status, /mic, /agents)
  ├── HTTP → Overlay server (localhost:47890, receives toast POSTs from Bun poller)
  └── IPC ↔ Renderer (Electron ipcMain/ipcRenderer for settings UI)

Bun server
  ├── HTTP → Whisper server (localhost:8766, audio transcription)
  ├── HTTP → message-relay (localhost:8767, message delivery + queue polling)
  ├── HTTP → Overlay server (localhost:47890, toast notifications)
  └── reads ← daemon/settings.json (TTS config, hot-reloaded every poll cycle)

Python daemon
  ├── HTTP → Bun server (localhost:3030/transcribe, sends recorded audio)
  ├── HTTP → message-relay (localhost:8767/history/ceo, legacy polling)
  ├── HTTP → Ollama (localhost:11434, message summarization for TTS)
  ├── HTTP → Overlay server (localhost:47890, recording/success/error states)
  └── reads ← daemon/settings.json (thresholds, TTS config, hot-reloaded every 5s)
```

## Mic Pause Protocol

TTS playback must suppress wake word detection to prevent feedback loops.

```
/tmp/wake-word-pause.d/          ← directory-based, per-owner tokens
  ├── manual                     ← user's mic-off (POST /mic {state: "off"})
  ├── tts-{uuid}                 ← Bun TTS cycle (one per playback)
  └── tts-speak-{pid}            ← Python speak script

Detection suppressed when directory exists AND contains ≥1 file.
Each owner only removes its own token — no stomping.
```

## Dual TTS Problem (TODO: CEO decision pending)

Both the Bun relay-poller and Python relay_message_watcher poll the relay and speak responses. Every agent reply is spoken twice.

| | Bun relay-poller | Python watcher |
|---|---|---|
| Endpoint | GET /queue/ceo (dequeues) | GET /history/ceo (reads all) |
| TTS engine | edge-tts direct (argv spawn) | Ollama summarize → edge-tts via `speak` script |
| Hardening | timeout+kill, TTL eviction, per-owner pause guard, no shell | TTL eviction (just fixed), PAUSE_DIR (just fixed) |
| Summarization | None (raw text, word-limited) | Ollama llama3.2 (offline LLM) |

### Options

1. **Delete Python watcher, keep Bun only** — simplest, already hardened. Lose Ollama summarization.
2. **Delete Bun TTS, keep Python** — keep smart summarization. Need further hardening.
3. **Hybrid: add Ollama to Bun, delete Python watcher** — best of both. One system, one polling path. ~110 lines of Python deleted.

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `server/index.ts` | 274 | Bun HTTP server wiring (routes, context injection) |
| `server/routes/transcribe.ts` | 409 | Audio upload → whisper → relay delivery |
| `server/routes/dedup.ts` | 184 | Audio hash dedup + hallucination filter |
| `server/relay-poller.ts` | 355 | Relay queue polling + overlay delivery |
| `server/tts.ts` | 167 | edge-tts → afplay with timeout+kill |
| `server/relay.ts` | 93 | Relay HTTP client (Result types) |
| `src/main/index.ts` | 152 | Electron app lifecycle wiring |
| `daemon/wake_word.py` | ~490 | Wake word state machine + legacy watcher |
