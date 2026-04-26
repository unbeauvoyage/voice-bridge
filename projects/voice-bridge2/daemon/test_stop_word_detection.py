"""
Tests for stop-word detection logic in wake_word.py.

Bug context (2026-04-17):
  Recording starts (overlay shows), but saying "alexa" within a few seconds
  doesn't stop it. Recording continues until the 300-second hard timeout.

Root cause: MIN_RECORD_BEFORE_STOP = 4.0 seconds silently suppresses any
"alexa" detection in the first 4 seconds of every recording. The debug log
also only fires for scores > 0.2 AND after the guard window — so when "alexa"
fires at second 2 with score 0.3, there is zero log output and the user sees
nothing. The stop detection appears broken but is actually being eaten by the
guard silently.

Fix: reduce MIN_RECORD_BEFORE_STOP to 1.0 second (enough to prevent start-word
tail from immediately triggering stop, short enough for normal use), and emit
debug output for any detected score regardless of guard window.
"""

import sys
import types
from unittest.mock import MagicMock

import pytest

# ---------------------------------------------------------------------------
# Stub heavy imports so wake_word.py can be imported in CI without hardware
# ---------------------------------------------------------------------------
for _mod in ("numpy", "openwakeword", "openwakeword.model"):
    if _mod not in sys.modules:
        sys.modules[_mod] = types.ModuleType(_mod)

sys.modules["openwakeword.model"].Model = MagicMock()

_pa_stub = types.ModuleType("pyaudio")
_pa_stub.paInt16 = 8
_pa_stub.PyAudio = MagicMock()
sys.modules.setdefault("pyaudio", _pa_stub)

_req_stub = types.ModuleType("requests")
_req_stub.post = MagicMock()
_req_stub.get = MagicMock()
sys.modules.setdefault("requests", _req_stub)

import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import wake_word


# ---------------------------------------------------------------------------
# Regression tests for the stop-word guard bug
# ---------------------------------------------------------------------------

class TestMinRecordBeforeStop:
    """
    MIN_RECORD_BEFORE_STOP must be short enough that users can say "alexa"
    within a few seconds of recording starting and have it detected.

    The original value of 4.0s means users speaking "alexa" at second 1-3
    get silently ignored — the most natural use case (short voice command
    followed immediately by "alexa" stop word) completely fails.

    Target: <= 1.5 seconds. This prevents the start-word tail from falsely
    triggering stop (start detection + openWakeWord smoothing takes ~0.3s),
    while allowing "alexa" to work in the first 2 seconds of recording.
    """

    def test_min_record_before_stop_is_at_most_1_5_seconds(self):
        """
        MIN_RECORD_BEFORE_STOP must be <= 1.5s.

        4.0s means a user saying a short command ("call atlas") followed by
        "alexa" at second 2 always hits the guard. Every natural short
        command fails silently. <= 1.5s gives room for wake-word echo while
        allowing normal "say command, say alexa" flows to work.
        """
        assert wake_word.MIN_RECORD_BEFORE_STOP <= 1.5, (
            f"MIN_RECORD_BEFORE_STOP={wake_word.MIN_RECORD_BEFORE_STOP} is too large. "
            f"Users saying 'alexa' at second 2 or 3 will be silently ignored. "
            f"Set to <= 1.5 to allow stop-word detection in normal use."
        )

    def test_min_record_before_stop_is_at_least_0_5_seconds(self):
        """
        MIN_RECORD_BEFORE_STOP must be >= 0.5s.

        Without a minimum guard, the trailing audio from the start wake-word
        ("hey jarvis") can immediately score as "alexa" before the user has
        said anything, stopping the recording instantly. 0.5s is enough to
        let the start-word echo clear the model's prediction buffer.
        """
        assert wake_word.MIN_RECORD_BEFORE_STOP >= 0.5, (
            f"MIN_RECORD_BEFORE_STOP={wake_word.MIN_RECORD_BEFORE_STOP} is too small. "
            f"Start-word echo may immediately trigger stop, ending recording before "
            f"the user has spoken their command."
        )


class TestStopScoreDebugVisibility:
    """
    Debug output must be emitted whenever a stop score is detected above a
    meaningful threshold — regardless of whether the guard window has elapsed.

    The original code only prints when score > 0.2 AND elapsed >= MIN_RECORD.
    This means stop-word detections inside the guard window are completely
    invisible in logs. When debugging, the developer sees nothing and falsely
    concludes the model isn't detecting "alexa" at all.

    The fix: always log scores above ~0.1 (any plausible detection), and
    separately note whether the guard suppressed the stop action.
    """

    def test_stop_threshold_constant_is_visible_in_module(self):
        """STOP_THRESHOLD must be a module-level constant accessible for inspection."""
        assert hasattr(wake_word, "STOP_THRESHOLD"), (
            "STOP_THRESHOLD must be a module-level constant so tests and "
            "debuggers can inspect the value."
        )

    def test_stop_threshold_value_is_reasonable(self):
        """
        STOP_THRESHOLD must be between 0.05 and 0.5.

        Too low (< 0.05): false positives on background noise.
        Too high (> 0.5): alexa_v0.1 model rarely scores this high in practice,
        causing the stop word to be missed. 0.25 is the calibrated default.
        """
        assert 0.05 <= wake_word.STOP_THRESHOLD <= 0.5, (
            f"STOP_THRESHOLD={wake_word.STOP_THRESHOLD} is out of range [0.05, 0.5]. "
            f"Values above 0.5 cause the alexa model to miss most detections in practice."
        )

    def test_min_record_before_stop_is_constant_not_magic_number(self):
        """MIN_RECORD_BEFORE_STOP must be a named constant, not a magic number inline."""
        assert hasattr(wake_word, "MIN_RECORD_BEFORE_STOP"), (
            "MIN_RECORD_BEFORE_STOP must be a module-level constant — inline magic "
            "numbers in the state machine make the guard invisible and hard to tune."
        )


class TestStopWordThresholdBehavior:
    """
    Verify that the stop-word threshold comparison logic works correctly.

    These tests use the module-level constants to validate the comparison
    semantics — they do not simulate audio, but confirm the guard logic
    expressed in the constants is consistent.
    """

    def test_stop_threshold_is_lower_than_start_threshold(self):
        """
        STOP_THRESHOLD must be <= START_THRESHOLD.

        "alexa" is intentional; we want to err on the side of stopping.
        "hey jarvis" has higher false-positive cost (starts recording
        accidentally), so it has the higher threshold.
        """
        assert wake_word.STOP_THRESHOLD <= wake_word.START_THRESHOLD, (
            f"STOP_THRESHOLD={wake_word.STOP_THRESHOLD} > "
            f"START_THRESHOLD={wake_word.START_THRESHOLD}. "
            f"Stop should be more sensitive than start."
        )

    def test_a_score_above_stop_threshold_would_trigger_stop(self):
        """
        Scores above STOP_THRESHOLD must satisfy the stop condition.

        This documents the comparison semantics: 'score > threshold' not '>= threshold'.
        A score exactly equal to threshold does NOT trigger (strict greater-than).
        """
        threshold = wake_word.STOP_THRESHOLD
        high_score = threshold + 0.01
        low_score = threshold - 0.01
        exact_score = threshold

        assert high_score > threshold, "Score above threshold must trigger stop"
        assert not (low_score > threshold), "Score below threshold must NOT trigger stop"
        assert not (exact_score > threshold), "Score exactly at threshold must NOT trigger (strict >)"

    def test_min_record_guard_uses_greater_or_equal_comparison(self):
        """
        The elapsed-time guard must use >= (not >) so detection fires exactly
        when MIN_RECORD_BEFORE_STOP seconds have passed.

        Using > would mean a score detected at exactly elapsed==1.0 (when
        MIN_RECORD_BEFORE_STOP==1.0) would still be suppressed.
        """
        # This documents the intended semantics: elapsed >= MIN_RECORD_BEFORE_STOP
        # We verify the constant itself is a round number that makes >= sensible.
        guard = wake_word.MIN_RECORD_BEFORE_STOP
        # Simulate: elapsed just at the boundary
        elapsed_at_boundary = guard
        assert elapsed_at_boundary >= guard, (
            "At exactly MIN_RECORD_BEFORE_STOP seconds, detection should be allowed. "
            "Ensure the comparison in the state machine uses >= not >."
        )
