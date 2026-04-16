#!/usr/bin/env python3
"""
Wake word listener for voice-bridge.
Two-word state machine:
  - IDLE: listens for "hey jarvis" → starts recording
  - RECORDING: listens for "alexa" → stops recording, trims end, sends to server
  - Fallback: hard timeout stops recording if user forgets to say "alexa"

Usage:
    python daemon/wake_word.py [--target command] [--server http://localhost:3030]
"""

import argparse
import io
import json as _json
import json
import urllib.request
import os
import subprocess
import sys
import datetime
import time
import wave
import threading
from pathlib import Path

# Ensure venv packages are available regardless of how this script is launched (e.g. pm2)
_VENV = Path(__file__).parent / ".venv" / "lib" / "python3.14" / "site-packages"
if _VENV.exists() and str(_VENV) not in sys.path:
    sys.path.insert(0, str(_VENV))

import numpy as np
import pyaudio
import requests
from openwakeword.model import Model

def play_sound(name: str):
    """Play a macOS system sound non-blocking via osascript (works from background processes)."""
    script = f'set volume alert volume 100\ndo shell script "afplay -v 3 /System/Library/Sounds/{name}.aiff"'
    subprocess.Popen(["osascript", "-e", script], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


# Pause directory — detection is suppressed when this directory exists AND contains
# at least one file (per-owner token). Each owner writes its own token:
#   manual mic-off → /tmp/wake-word-pause.d/manual
#   each TTS cycle → /tmp/wake-word-pause.d/tts-{uuid}
# This replaces the old single-file /tmp/wake-word-pause which caused stomping bugs:
# TTS release() deleted the file even if the user had manually silenced the mic.
PAUSE_DIR = Path("/tmp/wake-word-pause.d")

# Audio settings (OpenWakeWord expects 16kHz mono)
RATE = 16000
CHANNELS = 1
CHUNK = 1280  # 80ms frames at 16kHz
FORMAT = pyaudio.paInt16

# Recording settings
MAX_RECORD_SECONDS = 300  # 5 min safety cap — only "alexa" should stop recording
COOLDOWN_SECONDS = 2      # minimum gap between activations
START_THRESHOLD = 0.4     # confidence for "hey jarvis"
STOP_THRESHOLD = 0.25     # confidence for "alexa"
TRIM_SECONDS = 1.5        # trim this much from end to remove "alexa" + detection lag
MIN_RECORD_BEFORE_STOP = 4.0  # seconds to ignore stop word after recording starts


ELECTRON_OVERLAY_URL = "http://localhost:47890/overlay"


def show_overlay(mode, text=""):
    """Send overlay command to Electron overlay server. Never raises."""
    try:
        payload = json.dumps({"mode": mode, "text": text}).encode()
        req = urllib.request.Request(
            ELECTRON_OVERLAY_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=1)
    except Exception:
        pass  # never crash wake_word on overlay failure


def send_to_server(wav_bytes, server_url, target):
    """POST recorded audio to voice-bridge /transcribe endpoint."""
    delivered_to = target
    success = False
    try:
        res = requests.post(
            f"{server_url}/transcribe",
            files={"audio": ("recording.wav", wav_bytes, "audio/wav")},
            data={"to": target},
            timeout=30,
        )
        if res.ok:
            data = res.json()
            if data.get("cancelled"):
                print(f"  [cancelled] transcript discarded (cancel word detected): {data.get('transcript', '')[:60]!r}")
                show_overlay("cancelled", target)
                return
            delivered_to = data.get("to", target)
            print(f"  → {delivered_to}: {data.get('transcript', '?')}")
            success = True
        else:
            print(f"  [error] server returned {res.status_code}: {res.text[:200]}")
    except Exception as e:
        print(f"  [error] send failed: {e}")

    mode = "success" if success else "error"
    show_overlay(mode, f"{delivered_to}: {''}" if success else "Send failed")


def frames_to_wav(frames, pa):
    """Convert list of audio frames to WAV bytes."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(pa.get_sample_size(FORMAT))
        wf.setframerate(RATE)
        wf.writeframes(b"".join(frames))
    return buf.getvalue()


def main():
    # --- Single-instance lockfile guard ---
    import fcntl
    _LOCK_FILE = "/tmp/wake-word.lock"
    _lock_fd = open(_LOCK_FILE, "w")
    try:
        fcntl.flock(_lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("[wake-word] another instance is already running — exiting")
        sys.exit(0)
    # lock held for process lifetime
    # --- end lockfile guard ---

    parser = argparse.ArgumentParser(description="Wake word listener for voice-bridge")
    parser.add_argument("--target", default="command", help="Agent name to send transcripts to")
    parser.add_argument("--server", default="http://127.0.0.1:3030", help="Voice-bridge server URL")
    parser.add_argument("--start-model", default="hey_jarvis_v0.1", help="Wake word model for START")
    parser.add_argument("--stop-model", default="alexa_v0.1", help="Wake word model for STOP")
    parser.add_argument("--start-threshold", type=float, default=START_THRESHOLD)
    parser.add_argument("--stop-threshold", type=float, default=STOP_THRESHOLD)
    parser.add_argument("--max-record", type=float, default=MAX_RECORD_SECONDS)
    parser.add_argument("--trim", type=float, default=TRIM_SECONDS, help="Seconds to trim from end (remove stop word)")
    parser.add_argument("--device", type=int, default=None, help="PyAudio input device index (default: system default)")
    args = parser.parse_args()

    print(f"[wake-word] Loading models: START={args.start_model}, STOP={args.stop_model}")
    model = Model(
        wakeword_models=[args.start_model, args.stop_model],
        inference_framework="onnx",
    )
    model_names = list(model.models.keys())
    print(f"[wake-word] Loaded models: {model_names}")

    # Figure out which model key matches start vs stop
    start_key = None
    stop_key = None
    for name in model_names:
        if "jarvis" in name.lower():
            start_key = name
        elif "alexa" in name.lower():
            stop_key = name
    if not start_key or not stop_key:
        print(f"[wake-word] ERROR: could not identify start/stop models from {model_names}")
        sys.exit(1)

    print(f"[wake-word] START key: {start_key}, STOP key: {stop_key}")

    pa = pyaudio.PyAudio()
    if args.device is not None:
        device_info = pa.get_device_info_by_index(args.device)
        device_index = args.device
    else:
        device_info = pa.get_default_input_device_info()
        device_index = device_info['index']
    print(f"[wake-word] Audio device: [{device_index}] {device_info['name']}")
    capture_chunk = CHUNK
    stream = pa.open(
        format=FORMAT, channels=CHANNELS, rate=RATE,
        input=True, frames_per_buffer=CHUNK,
        input_device_index=device_index,
    )

    # Live settings — reloaded every 5 seconds from settings.json
    import json as _settings_json
    _SETTINGS_PATH = str(Path(__file__).parent / "settings.json")
    _settings = {
        "toast_duration": 15,
        "tts_enabled": True,
        "tts_word_limit": 8,
        "stop_threshold": args.stop_threshold,
        "start_threshold": args.start_threshold,
    }

    def _reload_settings():
        """Reload settings from file every 5 seconds."""
        while True:
            try:
                with open(_SETTINGS_PATH) as f:
                    loaded = _settings_json.load(f)
                _settings.update(loaded)
            except Exception:
                pass
            time.sleep(5)

    threading.Thread(target=_reload_settings, daemon=True).start()

    print(f"[wake-word] Target: {args.target} | Server: {args.server}")
    print(f"[wake-word] Say '{args.start_model}' to start, '{args.stop_model}' to stop")
    print(f"[wake-word] Hard timeout: {args.max_record}s | Trim: {args.trim}s")
    print(f"[wake-word] Live settings: {_SETTINGS_PATH}")
    print()

    def start_recording_overlay():
        # Read current sticky target for display
        last_target_file = str(Path(__file__).parent.parent / "tmp" / "last-target.txt")
        try:
            with open(last_target_file) as _f:
                current_target = _f.read().strip() or args.target
        except Exception:
            current_target = args.target
        show_overlay("recording", current_target)

    def hide_recording_overlay():
        show_overlay("hidden")

    def relay_message_watcher(server_url):
        """Poll relay for new messages to 'command' and show overlay toasts."""
        relay_base = "http://localhost:8767"
        seen_ids = set()

        import queue as _queue
        _speech_queue = _queue.Queue()

        def _speech_worker():
            while True:
                text = _speech_queue.get()
                if text is None:
                    break
                # Wait if recording is in progress
                while _is_recording.is_set():
                    time.sleep(0.3)
                try:
                    subprocess.run(["/Users/riseof/environment/bin/speak", text],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception as e:
                    print(f"  [tts] speak failed: {e}")
                _speech_queue.task_done()

        _speech_thread = threading.Thread(target=_speech_worker, daemon=True)
        _speech_thread.start()

        def summarize_for_audio(from_agent, body, word_limit=8):
            """Use Ollama llama3.2 to summarize message to one short spoken sentence."""
            try:
                prompt = (
                    f"Summarize the following message in {word_limit} to {word_limit + 3} words. "
                    f"No agent name. Just the key fact.\n\n"
                    f"Message: {body}\n\nSummary:"
                )
                payload = json.dumps({
                    "model": "llama3.2:latest",
                    "prompt": prompt,
                    "stream": False,
                    "options": {"num_predict": word_limit * 3, "temperature": 0.3}
                }).encode()
                req = urllib.request.Request(
                    "http://localhost:11434/api/generate",
                    data=payload,
                    headers={"Content-Type": "application/json"}
                )
                resp = json.loads(urllib.request.urlopen(req, timeout=8).read())
                summary = resp.get("response", "").strip()
                if summary.lower().startswith("summary:"):
                    summary = summary[8:].strip()
                return summary if summary else body[:80]
            except Exception as e:
                print(f"  [tts] ollama failed: {e}, using truncation fallback")
                import re
                first = re.split(r'[.!?\n]', body)[0].strip()
                return first[:120]

        def speak_summary(text):
            print(f"  [tts] queuing: {text[:60]}")
            _speech_queue.put(text)

        while True:
            try:
                res = requests.get(f"{relay_base}/history/ceo", timeout=3)
                if res.ok:
                    data = res.json()
                    messages = data if isinstance(data, list) else data.get("messages", [])
                    print(f"[watcher] polled, got {len(messages)} messages")
                    for msg in messages:
                        # Skip messages FROM ceo — only show messages sent TO the CEO
                        from_agent = msg.get("from", "")
                        if from_agent == "ceo":
                            continue
                        msg_id = msg.get("id") or msg.get("_id")
                        if msg_id and msg_id not in seen_ids:
                            seen_ids.add(msg_id)
                            # Parse timestamp and log age before filtering
                            ts_str = msg.get("ts", "")
                            try:
                                if isinstance(ts_str, str):
                                    ts_dt = datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                                    ts_unix = ts_dt.timestamp()
                                else:
                                    ts_unix = float(ts_str) / 1000 if float(ts_str) > 1e10 else float(ts_str)
                            except Exception:
                                ts_unix = 0
                            age = time.time() - ts_unix
                            print(f"[watcher] NEW msg from={from_agent} age={age:.1f}s body={str(msg.get('body',''))[:30]!r}")
                            if age < 30:
                                body = str(msg.get("body", ""))

                                # Toast: write to queue immediately — no waiting
                                print(f"[watcher] QUEUING TOAST for msg_id={msg_id}")
                                try:
                                    entry = _json.dumps({"from": from_agent, "body": body, "ts": time.time()})
                                    with open("/tmp/vb-toast-queue.jsonl", "a") as f:
                                        f.write(entry + "\n")
                                    print(f"  [watcher] queued toast for {from_agent}")
                                except Exception as e:
                                    print(f"  [watcher] toast queue failed: {e}")

                                # TTS: fully independent — Ollama takes 1-3s, toast already done
                                if _settings.get("tts_enabled", True):
                                    wl = _settings.get("tts_word_limit", 8)
                                    threading.Thread(
                                        target=lambda fa=from_agent, b=body, wl=wl: speak_summary(summarize_for_audio(fa, b, wl)),
                                        daemon=True
                                    ).start()
            except Exception:
                pass
            time.sleep(2)

    import threading as _threading
    _is_recording = _threading.Event()  # set when recording, clear when idle
    _whisper_in_flight = _threading.Event()  # set while send_to_server thread is running

    def _send_with_guard(wav_bytes, server_url, target):
        """
        Thin wrapper around send_to_server that holds _whisper_in_flight for the
        duration of the call (including Whisper inference, which takes 60-90s on CPU).
        The finally block guarantees the flag is cleared even if send_to_server raises,
        preventing the daemon from locking up permanently.
        """
        try:
            send_to_server(wav_bytes, server_url, target)
        finally:
            _whisper_in_flight.clear()

    watcher_thread = threading.Thread(
        target=relay_message_watcher,
        args=(args.server,),
        daemon=True,
    )
    watcher_thread.start()

    # Menu bar icon — owned by Electron; these are no-ops
    def start_menubar_icon(state="listening"):
        pass

    def stop_menubar_icon():
        pass

    def set_menubar_state(state):
        pass

    # State machine
    STATE_IDLE = "idle"
    STATE_RECORDING = "recording"
    state = STATE_IDLE
    recorded_frames = []
    record_start_time = 0
    last_activation = 0

    try:
        while True:
            audio_data = stream.read(capture_chunk, exception_on_overflow=False)
            audio_array = np.frombuffer(audio_data, dtype=np.int16)

            # Skip detection when paused (mic off command or TTS playback in progress).
            # Pause is indicated by PAUSE_DIR existing AND containing at least one token file.
            # Using a directory prevents stomping: manual-off token and TTS tokens coexist.
            if PAUSE_DIR.exists() and any(PAUSE_DIR.iterdir()):
                if state == STATE_RECORDING:
                    # Mic was turned off mid-recording — abort and hide overlay
                    print("[wake-word] mic paused mid-recording — discarding")
                    hide_recording_overlay()
                    state = STATE_IDLE
                    recorded_frames = []
                    model.reset()
                continue

            predictions = model.predict(audio_array)

            # DEBUG: print audio level + predictions every 50 chunks (~4s)
            if not hasattr(model, '_dbg_count'):
                model._dbg_count = 0
            model._dbg_count += 1
            if model._dbg_count % 50 == 0:
                level = int(np.abs(audio_array).mean())
                print(f"[debug] audio_level={level} len={len(audio_array)} predictions: {predictions}")

            if state == STATE_IDLE:
                # Listen for start word
                start_score = predictions.get(start_key, 0)
                if start_score > 0.1:
                    print(f"[wake-word] score: {start_score:.3f} (threshold: {_settings['start_threshold']})")
                if start_score > _settings["start_threshold"]:
                    now = time.time()
                    if now - last_activation < COOLDOWN_SECONDS:
                        continue
                    last_activation = now

                    # Guard: reject activation if a Whisper transcription is already running.
                    # Without this, the user can stack 2-4 concurrent Whisper jobs during the
                    # 60-90s CPU transcription window, flooding the relay when they all complete.
                    if _whisper_in_flight.is_set():
                        print("[wake-word] Whisper still in flight — ignoring activation")
                        play_sound("Purr")  # subtle "busy" feedback so CEO knows activation was skipped
                        model.reset()
                        continue

                    print(f"[wake-word] '{start_key}' detected (score={start_score:.2f}) — RECORDING")
                    play_sound("Tink")
                    start_recording_overlay()
                    set_menubar_state("recording")
                    _is_recording.set()
                    state = STATE_RECORDING
                    recorded_frames = []
                    record_start_time = time.time()
                    # Reset model predictions to avoid lingering scores
                    model.reset()

            elif state == STATE_RECORDING:
                # Accumulate audio
                recorded_frames.append(audio_data)

                # Check for stop word — ignored for first MIN_RECORD_BEFORE_STOP seconds
                elapsed = time.time() - record_start_time
                stop_score = predictions.get(stop_key, 0)
                if stop_score > 0.2 and elapsed >= MIN_RECORD_BEFORE_STOP:
                    print(f"  [stop-score] {stop_score:.3f} (threshold={_settings['stop_threshold']})")
                if stop_score > _settings["stop_threshold"] and elapsed >= MIN_RECORD_BEFORE_STOP:
                    print(f"[wake-word] '{stop_key}' detected (score={stop_score:.2f}) — stopping after {elapsed:.1f}s")
                    play_sound("Pop")
                    hide_recording_overlay()

                    # Trim the last N seconds to remove the "alexa" utterance
                    trim_chunks = int(RATE / CHUNK * args.trim)
                    if trim_chunks > 0 and len(recorded_frames) > trim_chunks:
                        recorded_frames = recorded_frames[:-trim_chunks]

                    duration = len(recorded_frames) * CHUNK / RATE
                    print(f"  [record] {duration:.1f}s captured (trimmed {args.trim}s)")

                    wav_bytes = frames_to_wav(recorded_frames, pa)
                    _whisper_in_flight.set()
                    threading.Thread(
                        target=_send_with_guard,
                        args=(wav_bytes, args.server, args.target),
                        daemon=True,
                    ).start()

                    set_menubar_state("listening")
                    _is_recording.clear()
                    state = STATE_IDLE
                    recorded_frames = []
                    model.reset()
                    continue

                # Hard timeout fallback
                if elapsed >= args.max_record:
                    print(f"[wake-word] Hard timeout ({args.max_record}s) — sending what we have")
                    play_sound("Pop")
                    hide_recording_overlay()

                    duration = len(recorded_frames) * CHUNK / RATE
                    print(f"  [record] {duration:.1f}s captured")

                    wav_bytes = frames_to_wav(recorded_frames, pa)
                    _whisper_in_flight.set()
                    threading.Thread(
                        target=_send_with_guard,
                        args=(wav_bytes, args.server, args.target),
                        daemon=True,
                    ).start()

                    set_menubar_state("listening")
                    _is_recording.clear()
                    state = STATE_IDLE
                    recorded_frames = []
                    model.reset()

    except KeyboardInterrupt:
        print("\n[wake-word] Stopped.")
    finally:
        hide_recording_overlay()
        stop_menubar_icon()
        stream.stop_stream()
        stream.close()
        pa.terminate()


if __name__ == "__main__":
    main()
