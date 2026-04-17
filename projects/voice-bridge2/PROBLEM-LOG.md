---
summary: "Reliability postmortem log for voice-bridge2. Each entry documents an incident, root cause, fix applied, and systemic improvement."
---

# PROBLEM-LOG — voice-bridge2

Entries in reverse chronological order. Format: ISO 8601 timestamp + incident summary + root cause + fix + systemic improvement.

---

## 2026-04-18T01:51:00 — voice daemon silently discarding voice commands (timeout too short)

**Incident:** "Hey Jarvis" voice commands were being detected and recorded, but transcription results were silently dropped. The live log showed `[error] send failed: HTTPConnectionPool(host='127.0.0.1', port=3030): Read timed out. (read timeout=30)` for longer recordings.

**Root cause:** `send_to_server()` in `daemon/wake_word.py` called `requests.post(..., timeout=30)`. The whisper.cpp medium model on CPU takes 60-90 seconds to transcribe a 5-minute voice recording. Any recording longer than ~25 seconds was guaranteed to hit the 30s timeout before whisper finished inference, causing the command to be silently discarded.

**Secondary finding:** `/tmp/wake-word-pause.d/manual` was a stale token left from a previous "turn off mic" command, permanently suppressing wake-word detection. Cleared manually.

**Fix applied (commit 9d718d0):**
- `daemon/wake_word.py`: timeout raised from 30 to 150 seconds (2x worst-case whisper inference time)
- `daemon/test_wake_word_functions.py`: regression test added asserting `timeout >= 150` on every `requests.post` call

**Systemic improvement:** The 30s timeout was copied from generic API call patterns without accounting for whisper.cpp inference time on CPU (60-90s). Any timeout on a path that calls Whisper must be set to at minimum 150s. The regression test enforces this — if the timeout is ever lowered below 150s again, the test will fail before the commit lands.

---

## 2026-04-18T00:05:00 — ESLint/TypeScript debt swept and pre-commit hook added

**Incident:** voice-bridge2 accumulated ESLint style errors and TypeScript type errors across multiple files (server/, src/main/index.ts, src/renderer/, eslint.config.mjs) because the PostToolUse hook reported violations but never blocked the commit.

**Root cause:** The PostToolUse hook was wired to run `tsc` and `eslint` after every file edit, but it always exits 0. Agents observe the reported violations in output but receive no hard stop — so violations accumulate across sessions as each agent writes new code without first clearing the backlog. Generated API client files were also not excluded from lint, which inflated the count with unfixable noise.

**Fix applied (commits fde238d → 3ef737b → e4d7091):**
1. `eslint.config.mjs` updated to ignore all `*.gen.ts` generated files and tighten rule set.
2. `server/relay-poller.ts` refactored: explicit type narrowing replaces unsafe casts; `relay-poller.test.ts` updated to match.
3. `src/main/index.ts` — 2 explicit type assertions replaced with proper narrowing guards.
4. Husky `pre-commit` hook added (`.husky/pre-commit`) — runs `tsc --noEmit` then `lint-staged`; exits non-zero on any violation, blocking the commit at the Git layer.
5. `.lintstagedrc.json` added to voice-bridge2 — runs `eslint --fix` on staged `.ts/.tsx` files before the commit lands.

**Systemic improvement:** Pre-commit gate is now enforced at the Git layer, independent of agent behaviour. PostToolUse reporting-without-blocking is insufficient for AI agent workflows — agents do not treat reported-but-non-blocking output as a hard constraint. The pattern of "report only" hooks is flagged for removal across all projects; every project should have a husky pre-commit hook that runs `tsc + lint-staged` and exits non-zero on failure.
