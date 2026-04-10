# Microphone Privacy — Wake Word System
**Date:** 2026-04-03
**Asked by:** CEO
**Answered by:** Research agent
**Status:** answered

## Answer

The wake word system (OpenWakeWord + local Whisper + relay) processes all audio entirely on-device and LAN — no audio ever leaves your local network. OpenWakeWord holds a short rolling audio buffer in memory only; it does not persist audio to disk unless explicitly coded to do so. When the wake word triggers, a temporary audio file is typically written to disk for Whisper to transcribe, and whether that file is cleaned up depends on how the daemon is implemented — this is a real risk and should be verified. The relay server receives only transcribed text, never raw audio. The primary threat vectors are: temp files persisting on disk, the relay being bound to 0.0.0.0 exposing transcribed text on the LAN, and — critically — a misconfigured detection threshold capturing unintended audio, which already happened with the family conversation incident. Compared to Siri, Alexa, and Google Assistant (which all stream audio to cloud servers for processing), this system is far more private by architecture. Key improvements: auto-delete temp audio files, raise the wake word threshold to 0.5+, add a visible/audible mic-active indicator, and restrict the relay to localhost or add auth if LAN exposure is necessary.

---

## Detailed Analysis

### Data Flow

```
Microphone (continuous)
    → OpenWakeWord (local, in-memory rolling buffer, ~1-2s)
        → [wake word detected]
            → Audio recorded to temp file (e.g. /tmp/recording.wav)
                → Whisper server (localhost, transcribes to text)
                    → Text sent to relay server (localhost or LAN)
                        → Agents receive text only
```

No audio is ever sent to an external server. The only network hop is text over LAN/localhost.

### Storage

**OpenWakeWord:**
- Processes audio in a sliding window buffer held in RAM.
- Does NOT write audio to disk by default.
- Risk: if the detection threshold is too low, the wake word fires frequently, triggering more recordings than intended.

**Whisper server:**
- Receives an audio file (or audio bytes) to transcribe.
- Whether the input temp file is deleted after transcription depends on the daemon implementation.
- Whisper itself does not log or persist audio beyond the request lifetime — but the file passed to it may linger.
- Check: does `rm` or equivalent cleanup happen after each transcription call?

**Relay server:**
- Receives and forwards transcribed text only.
- No audio storage at the relay layer.

**Temp files:**
- This is the highest-risk storage vector. A `/tmp/recording.wav` that is not deleted remains on disk indefinitely and may capture unintended speech.
- Action: audit the daemon code for explicit cleanup; add `os.unlink()` or equivalent after every transcription, including error paths.

### Threat Model

| Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Temp audio files accumulate on disk | Medium | Medium — local attacker or process can read speech | Explicit cleanup after each transcription |
| Relay on 0.0.0.0 exposes transcribed text to LAN | Medium (if misconfigured) | Medium — anyone on LAN can read commands | Bind relay to 127.0.0.1 or add token auth |
| Low threshold triggers on ambient audio | High (already occurred) | High — continuous unintended recording | Raise threshold to 0.5–0.7 |
| Microphone permission scope too broad | Low | Low — OS-level, not application level | Review which processes have mic access |
| Physical access to machine | Low | High — all local data accessible | Full-disk encryption (FileVault) |

The system has no cloud surface area, so the threat model is strictly local: disk persistence, LAN exposure, and the threshold/accidental-recording problem.

### Comparison to Commercial Systems

| System | Audio processing | Audio stored? | Sent externally? |
|---|---|---|---|
| **This system** | Local (Mac) | Temp files only (risk) | No — text only on LAN |
| Amazon Alexa | Local wake word + cloud | Yes — Amazon retains by default | Yes — to Amazon servers |
| Apple Siri | Partial on-device | Yes — Apple retains unless opted out | Yes — to Apple servers |
| Google Assistant | Partial on-device | Yes — Google retains by default | Yes — to Google servers |
| OpenAI Voice | Cloud | Yes | Yes — to OpenAI servers |

This system's architecture is structurally more private than any commercial assistant. The practical risk is not cloud leakage — it's the threshold and temp file issues described above.

### Privacy Improvements

**High priority:**
1. **Raise wake word threshold to 0.5–0.7.** The default 0.15 is far too sensitive. The family conversation incident is direct evidence. Test with your actual wake phrase and ambient noise to find the right balance.
2. **Explicit temp file cleanup.** After every Whisper transcription call (success or error), delete the audio file. Wrap in try/finally if Python.
3. **Bind relay to 127.0.0.1.** Unless you specifically need LAN access from another device, the relay should not be reachable outside localhost.

**Medium priority:**
4. **Mic-active indicator.** A menubar icon, LED, or audible chime when recording starts/stops. This makes accidental captures immediately visible.
5. **Transcription audit log.** Log timestamp + transcript (not audio) of everything the system hears. This gives you accountability without storing audio — you'd have caught the family conversation incident sooner.
6. **LAN auth token.** If the relay must be on LAN (e.g., for phone access), add a simple bearer token to prevent other devices from injecting commands.

**Lower priority:**
7. **Encrypt temp files.** If you want defense-in-depth, write audio to an encrypted tmpfs or use macOS Secure Enclave for short-lived secrets. Probably overkill for a home system.

### The Family Conversation Incident

The wake word daemon was running at threshold 0.15 and picked up ambient conversation — recording a family discussion without intent. This is the canonical failure mode of always-on microphone systems and it happened here.

**Root cause:** Threshold 0.15 means OpenWakeWord fires when the model is only 15% confident it heard the wake phrase. Ambient speech with similar phonemes (especially names, common words) will trigger it repeatedly.

**What this means practically:** At 0.15, the system is not waiting for "Hey Jarvis" — it's recording whenever speech sounds vaguely like it. The audio was captured to a temp file and transcribed, which means the conversation text likely passed through Whisper and possibly the relay.

**Remediation:**
- Immediately raise threshold to 0.5 minimum; test at 0.6–0.7.
- Audit `/tmp` and any configured recording directories for audio files that should have been deleted.
- If the relay logged the erroneous transcriptions, clear those logs.
- Add the mic-active indicator so future misfires are immediately visible.

A threshold of 0.5 means the model must be 50% confident — combined with the full wake phrase requirement, false positives drop dramatically while true positives remain reliable in normal conditions.
