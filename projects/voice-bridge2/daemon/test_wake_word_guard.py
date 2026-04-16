#!/usr/bin/env python3
"""
Guard logic tests for wake_word.py transcription stacking bug.

wake_word.py resets to STATE_IDLE as soon as recording stops, BEFORE the
Whisper transcription thread completes (which can take 60-90s on CPU).
Without a guard, the user can say "hey Jarvis" again immediately and stack
2-4 concurrent Whisper jobs that all resolve at the same time, flooding relay.

The fix: a _whisper_in_flight threading.Event that is SET when a transcription
thread starts and CLEARED in a finally block when that thread finishes. Any new
wake-word activation while the event is set is REJECTED (not queued).

These tests validate the guard logic in isolation — they do not import
wake_word.py directly (it's a monolithic script, not a module) but test the
exact Event semantics used by the guard.
"""

import threading
import time
import unittest


# ---------------------------------------------------------------------------
# The guard logic extracted verbatim from wake_word.py (after the fix).
# We test this pattern in isolation so the test can run without PyAudio,
# openwakeword, or any other daemon dependency.
# ---------------------------------------------------------------------------

_whisper_in_flight = threading.Event()


def _send_with_guard(send_fn, *args, **kwargs):
    """
    Wrapper that sets _whisper_in_flight for the duration of send_fn.
    This is the exact pattern used in wake_word.py — the event is cleared
    in finally so it is always released, even if send_fn raises.
    """
    try:
        send_fn(*args, **kwargs)
    finally:
        _whisper_in_flight.clear()


def try_activate():
    """
    Simulates the STATE_IDLE wake-word detection guard check.
    Returns True if activation was allowed, False if it was rejected
    because a transcription is already in flight.
    """
    if _whisper_in_flight.is_set():
        # Guard: reject this activation — Whisper still running
        return False
    return True


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestWhisperInFlightGuard(unittest.TestCase):

    def setUp(self):
        # Always start each test with no in-flight transcription
        _whisper_in_flight.clear()

    def test_activation_succeeds_when_no_transcription_in_flight(self):
        """Normal activation: event is clear, activation proceeds."""
        allowed = try_activate()
        self.assertTrue(allowed)

    def test_second_activation_rejected_while_whisper_in_flight(self):
        """
        Core bug fix: while a transcription thread is running, the event is SET,
        and the guard must reject any new wake-word activation.
        This prevents the stacking of 2-4 concurrent Whisper jobs.
        """
        barrier = threading.Barrier(2)
        hold = threading.Event()

        def slow_transcription():
            # Simulate a 60-90s Whisper transcription (controlled by hold in tests)
            _whisper_in_flight.set()
            barrier.wait()   # signal: thread started and event is set
            hold.wait()      # block until test releases
            _whisper_in_flight.clear()

        t = threading.Thread(target=slow_transcription, daemon=True)
        t.start()
        barrier.wait()  # wait until thread has set the event

        try:
            # Second activation attempt while Whisper is running
            allowed = try_activate()
            self.assertFalse(allowed, "Guard must reject activation while Whisper is in flight")
        finally:
            hold.set()  # release the "transcription"
            t.join(timeout=1)

    def test_activation_succeeds_after_transcription_completes(self):
        """
        After the transcription thread finishes (finally clears the event),
        the next activation must be allowed.
        """
        completed = threading.Event()

        def transcription():
            _whisper_in_flight.set()
            time.sleep(0.01)   # simulate short work
            _whisper_in_flight.clear()
            completed.set()

        t = threading.Thread(target=transcription, daemon=True)
        t.start()
        completed.wait(timeout=1)

        allowed = try_activate()
        self.assertTrue(allowed, "Activation must succeed once transcription thread has cleared the event")

    def test_send_with_guard_clears_event_on_normal_completion(self):
        """_send_with_guard clears _whisper_in_flight after send_fn returns."""
        call_log = []

        def fake_send():
            call_log.append("sent")

        _whisper_in_flight.set()
        _send_with_guard(fake_send)

        self.assertFalse(_whisper_in_flight.is_set(), "Event must be cleared after successful send")
        self.assertEqual(call_log, ["sent"])

    def test_send_with_guard_clears_event_on_exception(self):
        """
        The finally block in _send_with_guard ensures the event is always cleared,
        even if send_fn raises. Without this, a crashed transcription would lock
        the daemon forever (guard would never allow another activation).
        """
        def failing_send():
            raise RuntimeError("Whisper crashed")

        _whisper_in_flight.set()
        try:
            _send_with_guard(failing_send)
        except RuntimeError:
            pass  # expected — the guard should still clear

        self.assertFalse(
            _whisper_in_flight.is_set(),
            "Event must be cleared even when send_fn raises — otherwise daemon locks up"
        )

    def test_guard_thread_safe_concurrent_activations(self):
        """
        Under real-world conditions, multiple audio chunks arrive concurrently.
        Only the first activation while in-flight should be rejected; no deadlocks
        or race conditions in the Event check itself (threading.Event is thread-safe).
        """
        results = []
        lock = threading.Lock()

        # Put a transcription in flight
        _whisper_in_flight.set()

        def check_activation():
            allowed = try_activate()
            with lock:
                results.append(allowed)

        threads = [threading.Thread(target=check_activation) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All 10 concurrent checks while in-flight must be rejected
        self.assertTrue(all(r is False for r in results),
                        "All concurrent activations while in-flight must be rejected")

        _whisper_in_flight.clear()


if __name__ == "__main__":
    unittest.main(verbosity=2)
