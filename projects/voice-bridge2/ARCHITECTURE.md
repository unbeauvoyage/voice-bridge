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
  ├── HTTP → Overlay server (localhost:47890, recording/success/error states)
  └── reads ← daemon/settings.json (thresholds, hot-reloaded every 5s)
```

## Mic Pause Protocol

TTS playback must suppress wake word detection to prevent feedback loops.

```
/tmp/wake-word-pause.d/          ← directory-based, per-owner tokens
  ├── manual                     ← user's mic-off (POST /mic {state: "off"})
  └── tts-{uuid}                 ← Bun TTS cycle (one per playback)

Detection suppressed when directory exists AND contains ≥1 file.
Each owner only removes its own token — no stomping.
```

## TTS Pipeline

Single path, owned entirely by the Bun relay-poller:

```
Agent reply in relay queue
  → relay-poller.ts pollOnce() (GET /queue/ceo, every 3s)
  → summarizeForTts() (Ollama llama3.2, localhost:11434)
      Short messages (≤ word limit): pass through unchanged
      Long messages: summarized to ~8-11 words
      Ollama offline: fallback to first sentence, max 120 chars
  → playTts() (server/tts.ts)
      edge-tts --voice en-US-JennyNeural → /tmp/vb2-tts-{uuid}.mp3
      afplay with 60s timeout + kill
      Per-owner pause guard (tts-{uuid} token in PAUSE_DIR)
      Temp mp3 cleaned up in finally block
```

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `server/index.ts` | 280 | Bun HTTP server wiring (routes, context injection) |
| `server/routes/transcribe.ts` | 410 | Audio upload → whisper → relay delivery |
| `server/routes/dedup.ts` | 184 | Audio hash dedup + hallucination filter |
| `server/relay-poller.ts` | 377 | Relay queue polling + overlay delivery + TTS dispatch |
| `server/tts.ts` | 222 | Ollama summarization + edge-tts → afplay with timeout+kill |
| `server/relay.ts` | 93 | Relay HTTP client (Result types) |
| `src/main/index.ts` | 152 | Electron app lifecycle wiring |
| `daemon/wake_word.py` | 375 | Wake word state machine + audio recording |
