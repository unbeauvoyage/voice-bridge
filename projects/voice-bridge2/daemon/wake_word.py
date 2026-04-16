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
import json
import urllib.request
import os
import subprocess
import sys
import time
import wave
import threading
from pathlib import Path
from typing import Any

# Ensure venv packages are available regardless of how this script is launched (e.g. pm2)
_VENV = Path(__file__).parent / ".venv" / "lib" / "python3.14" / "site-packages"
if _VENV.exists() and str(_VENV) not in sys.path:
    sys.path.insert(0, str(_VENV))

import numpy as np
import pyaudio  # type: ignore[import-untyped]
import requests
from openwakeword.model import Model  # type: ignore[import-untyped]

_ALLOWED_SOUNDS = frozenset({"Purr", "Tink", "Pop", "Ping", "Glass", "Blow", "Bottle", "Frog", "Funk", "Hero", "Morse", "Sosumi", "Submarine"})

def play_sound(name: str) -> None:
    """Play a macOS system sound non-blocking via osascript (works from background processes)."""
    if name not in _ALLOWED_SOUNDS:
        print(f"[wake-word] play_sound: rejected unknown sound {name!r}")
        return
    subprocess.Popen(["afplay", "-v", "3", f"/System/Library/Sounds/{name}.aiff"],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


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


def show_overlay(mode: str, text: str = "") -> None:
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


def send_to_server(wav_bytes: bytes, server_url: str, target: str) -> None:
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


def frames_to_wav(frames: list[bytes], pa: Any) -> bytes:
    """Convert list of audio frames to WAV bytes."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(pa.get_sample_size(FORMAT))
        wf.setframerate(RATE)
        wf.writeframes(b"".join(frames))
    return buf.getvalue()


def main() -> None:
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
    _SETTINGS_PATH = str(Path(__file__).parent / "settings.json")
    _settings: dict[str, Any] = {
        "toast_duration": 15,
        "tts_enabled": True,
        "tts_word_limit": 8,
        "stop_threshold": args.stop_threshold,
        "start_threshold": args.start_threshold,
    }

    def _reload_settings() -> None:
        """Reload settings from file every 5 seconds."""
        while True:
            try:
                with open(_SETTINGS_PATH) as f:
                    loaded = json.load(f)
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

    def start_recording_overlay() -> None:
        # Read current sticky target for display
        last_target_file = str(Path(__file__).parent.parent / "tmp" / "last-target.txt")
        try:
            with open(last_target_file) as _f:
                current_target = _f.read().strip() or args.target
        except Exception:
            current_target = args.target
        show_overlay("recording", current_target)

    def hide_recording_overlay() -> None:
        show_overlay("hidden")

    _is_recording = threading.Event()  # set when recording, clear when idle
    _whisper_in_flight = threading.Event()  # set while send_to_server thread is running

    def _send_with_guard(wav_bytes: bytes, server_url: str, target: str) -> None:
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

    # State machine
    STATE_IDLE = "idle"
    STATE_RECORDING = "recording"
    state = STATE_IDLE
    recorded_frames: list[bytes] = []
    # BUG FIX: these were typed as int (= 0) but time.time() returns float,
    # causing a mypy --strict assignment error. Initialized as float.
    record_start_time: float = 0.0
    last_activation: float = 0.0

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

                    _is_recording.clear()
                    state = STATE_IDLE
                    recorded_frames = []
                    model.reset()

    except KeyboardInterrupt:
        print("\n[wake-word] Stopped.")
    finally:
        hide_recording_overlay()
        stream.stop_stream()
        stream.close()
        pa.terminate()


if __name__ == "__main__":
    main()
