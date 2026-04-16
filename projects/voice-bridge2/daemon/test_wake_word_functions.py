"""
Unit tests for standalone utility functions in daemon/wake_word.py.

These tests cover: play_sound, show_overlay, send_to_server, frames_to_wav.
All I/O is mocked — no real audio hardware, no real network calls.
"""
import io
import json
import struct
import wave
from unittest.mock import MagicMock, patch, call

import pytest

# Import the module under test.  Heavy imports (pyaudio, openwakeword, numpy,
# requests) are all at module level in wake_word.py so we patch the ones that
# would fail in CI before importing.
import sys, types

# Provide stub modules so wake_word.py can be imported without real packages.
for _mod in ("numpy", "openwakeword", "openwakeword.model"):
    if _mod not in sys.modules:
        sys.modules[_mod] = types.ModuleType(_mod)

# openwakeword.model needs a Model class attribute
sys.modules["openwakeword.model"].Model = MagicMock()

# pyaudio stub — needs paInt16 constant used at module level
_pa_stub = types.ModuleType("pyaudio")
_pa_stub.paInt16 = 8   # arbitrary non-zero int matching real pyaudio.paInt16
_pa_stub.PyAudio = MagicMock()
sys.modules.setdefault("pyaudio", _pa_stub)

# requests stub — real import happens at module level
_req_stub = types.ModuleType("requests")
_req_stub.post = MagicMock()
_req_stub.get = MagicMock()
sys.modules.setdefault("requests", _req_stub)

import importlib, pathlib, sys as _sys
_sys.path.insert(0, str(pathlib.Path(__file__).parent))
import wake_word


# ---------------------------------------------------------------------------
# play_sound
# ---------------------------------------------------------------------------

class TestPlaySound:
    """play_sound(name) plays allowed sounds via afplay; silently rejects others."""

    def test_allowed_sound_spawns_subprocess(self):
        """Each sound in _ALLOWED_SOUNDS must trigger subprocess.Popen."""
        with patch("wake_word.subprocess.Popen") as mock_popen:
            wake_word.play_sound("Tink")
        mock_popen.assert_called_once()
        cmd = mock_popen.call_args[0][0]
        assert "afplay" in cmd
        assert any("Tink.aiff" in part for part in cmd)

    def test_allowed_sound_passes_volume_flag(self):
        """afplay must be called with -v 3 so the sound is audible."""
        with patch("wake_word.subprocess.Popen") as mock_popen:
            wake_word.play_sound("Pop")
        cmd = mock_popen.call_args[0][0]
        assert "-v" in cmd and "3" in cmd

    def test_all_allowed_sounds_are_accepted(self):
        """Every sound in _ALLOWED_SOUNDS should trigger exactly one Popen call."""
        for sound in wake_word._ALLOWED_SOUNDS:
            with patch("wake_word.subprocess.Popen") as mock_popen:
                wake_word.play_sound(sound)
            assert mock_popen.called, f"Expected Popen for allowed sound {sound!r}"

    def test_unknown_sound_is_rejected_without_subprocess(self):
        """A sound not in the allowlist must never spawn a process — security boundary."""
        with patch("wake_word.subprocess.Popen") as mock_popen:
            wake_word.play_sound("rm -rf /")
        mock_popen.assert_not_called()

    def test_empty_string_is_rejected(self):
        """Empty string is not in the allowlist — no subprocess."""
        with patch("wake_word.subprocess.Popen") as mock_popen:
            wake_word.play_sound("")
        mock_popen.assert_not_called()

    def test_close_but_wrong_name_is_rejected(self):
        """A near-match ('tink' vs 'Tink') must be rejected — allowlist is case-sensitive."""
        with patch("wake_word.subprocess.Popen") as mock_popen:
            wake_word.play_sound("tink")   # lowercase — not in frozenset
        mock_popen.assert_not_called()


# ---------------------------------------------------------------------------
# show_overlay
# ---------------------------------------------------------------------------

class TestShowOverlay:
    """show_overlay(mode, text) POSTs JSON to ELECTRON_OVERLAY_URL; never raises."""

    def _capture_request(self, mock_urlopen):
        """Return the Request object passed to urlopen."""
        assert mock_urlopen.called
        return mock_urlopen.call_args[0][0]

    def test_posts_mode_and_text_as_json(self):
        """Payload must encode mode and text as a JSON object."""
        with patch("wake_word.urllib.request.urlopen") as mock_urlopen:
            wake_word.show_overlay("recording", "atlas")
        req = self._capture_request(mock_urlopen)
        payload = json.loads(req.data.decode())
        assert payload == {"mode": "recording", "text": "atlas"}

    def test_posts_to_correct_url(self):
        """Request must target ELECTRON_OVERLAY_URL."""
        with patch("wake_word.urllib.request.urlopen") as mock_urlopen:
            wake_word.show_overlay("hidden")
        req = self._capture_request(mock_urlopen)
        assert req.full_url == wake_word.ELECTRON_OVERLAY_URL

    def test_uses_post_method(self):
        with patch("wake_word.urllib.request.urlopen") as mock_urlopen:
            wake_word.show_overlay("success", "done")
        req = self._capture_request(mock_urlopen)
        assert req.method == "POST"

    def test_content_type_header_is_json(self):
        with patch("wake_word.urllib.request.urlopen") as mock_urlopen:
            wake_word.show_overlay("error")
        req = self._capture_request(mock_urlopen)
        assert req.get_header("Content-type") == "application/json"

    def test_text_defaults_to_empty_string(self):
        """When text is omitted, the JSON payload must still include text: ''."""
        with patch("wake_word.urllib.request.urlopen") as mock_urlopen:
            wake_word.show_overlay("cancelled")
        req = self._capture_request(mock_urlopen)
        payload = json.loads(req.data.decode())
        assert payload["text"] == ""

    def test_exception_is_swallowed_and_returns_none(self):
        """Overlay errors must never crash the wake-word daemon — network may be down."""
        with patch("wake_word.urllib.request.urlopen", side_effect=OSError("connection refused")):
            result = wake_word.show_overlay("recording", "command")
        # No exception propagated; function returns None
        assert result is None

    def test_any_exception_type_is_swallowed(self):
        """Even unexpected exceptions (e.g. RuntimeError) must be swallowed."""
        with patch("wake_word.urllib.request.urlopen", side_effect=RuntimeError("unexpected")):
            result = wake_word.show_overlay("error")
        assert result is None


# ---------------------------------------------------------------------------
# send_to_server
# ---------------------------------------------------------------------------

class TestSendToServer:
    """send_to_server posts WAV audio and drives show_overlay based on response."""

    _WAV = b"RIFF\x00\x00\x00\x00WAVEfmt "  # minimal fake WAV bytes

    def _make_ok_response(self, transcript="hello world", to="command", cancelled=False):
        resp = MagicMock()
        resp.ok = True
        resp.json.return_value = {"transcript": transcript, "to": to, "cancelled": cancelled}
        return resp

    def _make_error_response(self, status_code=500):
        resp = MagicMock()
        resp.ok = False
        resp.status_code = status_code
        resp.text = "internal server error"
        return resp

    def test_posts_to_transcribe_endpoint(self):
        """Audio must be POSTed to {server_url}/transcribe — not /transcribe/ or elsewhere."""
        with patch("wake_word.requests.post", return_value=self._make_ok_response()) as mock_post, \
             patch("wake_word.show_overlay"):
            wake_word.send_to_server(self._WAV, "http://localhost:3030", "command")
        mock_post.assert_called_once()
        url = mock_post.call_args[0][0]
        assert url == "http://localhost:3030/transcribe"

    def test_successful_response_calls_show_overlay_success(self):
        """On a successful transcription, overlay must show 'success'."""
        with patch("wake_word.requests.post", return_value=self._make_ok_response()), \
             patch("wake_word.show_overlay") as mock_overlay:
            wake_word.send_to_server(self._WAV, "http://localhost:3030", "command")
        # The first positional arg of show_overlay must be "success"
        assert mock_overlay.call_args[0][0] == "success"

    def test_cancelled_response_calls_show_overlay_cancelled(self):
        """When the server says cancelled=true, overlay must show 'cancelled'."""
        resp = self._make_ok_response(cancelled=True, transcript="cancel that")
        with patch("wake_word.requests.post", return_value=resp), \
             patch("wake_word.show_overlay") as mock_overlay:
            wake_word.send_to_server(self._WAV, "http://localhost:3030", "command")
        mock_overlay.assert_called_once_with("cancelled", "command")

    def test_cancelled_response_returns_early_without_success_overlay(self):
        """On cancelled, send_to_server must return early — no second overlay call."""
        resp = self._make_ok_response(cancelled=True)
        with patch("wake_word.requests.post", return_value=resp), \
             patch("wake_word.show_overlay") as mock_overlay:
            wake_word.send_to_server(self._WAV, "http://localhost:3030", "command")
        assert mock_overlay.call_count == 1  # only one overlay call, not two

    def test_http_error_response_calls_show_overlay_error(self):
        """A non-2xx HTTP response must trigger show_overlay('error', ...)."""
        with patch("wake_word.requests.post", return_value=self._make_error_response(500)), \
             patch("wake_word.show_overlay") as mock_overlay:
            wake_word.send_to_server(self._WAV, "http://localhost:3030", "command")
        assert mock_overlay.call_args[0][0] == "error"

    def test_exception_during_post_calls_show_overlay_error(self):
        """Network exceptions must not crash the caller — show_overlay('error') must be called."""
        with patch("wake_word.requests.post", side_effect=ConnectionError("refused")), \
             patch("wake_word.show_overlay") as mock_overlay:
            wake_word.send_to_server(self._WAV, "http://localhost:3030", "command")
        assert mock_overlay.call_args[0][0] == "error"

    def test_sends_audio_as_multipart_file(self):
        """Audio bytes must arrive in the 'files' argument, not the body."""
        with patch("wake_word.requests.post", return_value=self._make_ok_response()) as mock_post, \
             patch("wake_word.show_overlay"):
            wake_word.send_to_server(self._WAV, "http://localhost:3030", "atlas")
        kwargs = mock_post.call_args[1]
        assert "files" in kwargs
        assert "audio" in kwargs["files"]

    def test_sends_target_in_data_field(self):
        """The 'to' field (target) must be sent in the form data."""
        with patch("wake_word.requests.post", return_value=self._make_ok_response()) as mock_post, \
             patch("wake_word.show_overlay"):
            wake_word.send_to_server(self._WAV, "http://localhost:3030", "atlas")
        kwargs = mock_post.call_args[1]
        assert kwargs.get("data", {}).get("to") == "atlas"


# ---------------------------------------------------------------------------
# frames_to_wav
# ---------------------------------------------------------------------------

class TestFramesToWav:
    """frames_to_wav(frames, pa) converts raw PCM frames into valid WAV bytes."""

    def _make_pa(self, sample_size=2):
        """Return a mock PyAudio that reports the given sample size."""
        pa = MagicMock()
        pa.get_sample_size.return_value = sample_size
        return pa

    def _make_frames(self, n_frames=10, chunk=1280):
        """Return a list of silent (zero-filled) PCM frames."""
        return [b"\x00" * chunk * 2 for _ in range(n_frames)]  # *2 for 16-bit samples

    def test_returns_bytes(self):
        pa = self._make_pa()
        result = wake_word.frames_to_wav(self._make_frames(), pa)
        assert isinstance(result, bytes)

    def test_valid_riff_magic_bytes(self):
        """Output must begin with 'RIFF' — the canonical WAV container header."""
        pa = self._make_pa()
        result = wake_word.frames_to_wav(self._make_frames(), pa)
        assert result[:4] == b"RIFF"

    def test_valid_wave_format_marker(self):
        """Bytes 8-12 of a WAV file must be 'WAVE'."""
        pa = self._make_pa()
        result = wake_word.frames_to_wav(self._make_frames(), pa)
        assert result[8:12] == b"WAVE"

    def test_wav_is_parseable_by_wave_module(self):
        """The returned bytes must be a well-formed WAV file readable by Python's wave module."""
        pa = self._make_pa()
        result = wake_word.frames_to_wav(self._make_frames(), pa)
        buf = io.BytesIO(result)
        with wave.open(buf, "rb") as wf:
            assert wf.getnchannels() == wake_word.CHANNELS
            assert wf.getframerate() == wake_word.RATE

    def test_sample_width_matches_pa_sample_size(self):
        """WAV sampwidth must match what PyAudio.get_sample_size returns."""
        pa = self._make_pa(sample_size=2)
        result = wake_word.frames_to_wav(self._make_frames(), pa)
        buf = io.BytesIO(result)
        with wave.open(buf, "rb") as wf:
            assert wf.getsampwidth() == 2

    def test_frame_data_is_included_in_output(self):
        """Audio data from frames must be present in the WAV body — not silently dropped."""
        # Use a distinctive non-zero pattern so we can detect it in the output
        marker = b"\x01\x02" * 640
        pa = self._make_pa()
        result = wake_word.frames_to_wav([marker], pa)
        assert marker in result

    def test_empty_frames_produces_valid_wav(self):
        """Zero frames should still yield a valid (silent) WAV — not raise or return garbage."""
        pa = self._make_pa()
        result = wake_word.frames_to_wav([], pa)
        assert result[:4] == b"RIFF"

    def test_pa_get_sample_size_called_with_format(self):
        """pa.get_sample_size must be called with the FORMAT constant so sample width is correct."""
        pa = self._make_pa()
        wake_word.frames_to_wav(self._make_frames(), pa)
        pa.get_sample_size.assert_called_once_with(wake_word.FORMAT)

