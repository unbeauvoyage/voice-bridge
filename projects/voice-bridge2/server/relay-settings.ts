/**
 * Settings loading concern for the relay poller.
 *
 * Extracted from relay-poller.ts — reads tts settings from daemon/settings.json
 * on each poll cycle and wires up startRelayPoller for server startup.
 *
 * validateTtsWordLimit is a pure function; startRelayPoller is the production
 * entrypoint called from server/index.ts.
 */

import { readFileSync } from 'node:fs'
import { createRelayPoller, type RelayPoller } from './relay-poller.ts'

/**
 * Validates a tts_word_limit value from the settings file.
 *
 * Accepts only positive finite integers in the range 1–500. Any value outside
 * this range (negative, zero, NaN, Infinity, float, or above the cap) falls
 * back to the default of 50.
 *
 * The upper cap (500) prevents a pathologically large value from letting an
 * arbitrarily long message trigger TTS. The lower bound (1) ensures the limit
 * is always a usable positive count.
 */
export function validateTtsWordLimit(v: number, defaultValue = 50): number {
  if (Number.isFinite(v) && Number.isInteger(v) && v >= 1 && v <= 500) {
    return v
  }
  return defaultValue
}

/**
 * Reads tts settings from daemon/settings.json on each poll cycle and starts
 * a background poller. Called from server/index.ts on startup.
 *
 * Settings are re-read every poll cycle (no caching, no file watcher). The
 * file is small and reads are cheap at 3s intervals — this intentionally
 * matches the Python daemon's hot-reload approach (daemon/wake_word.py:192-203).
 * Toggling TTS in the UI via POST /settings now takes effect on the next cycle.
 */
export function startRelayPoller(opts: {
  relayBaseUrl: string
  overlayUrl: string
  settingsPath?: string
}): RelayPoller {
  const poller = createRelayPoller({
    relayBaseUrl: opts.relayBaseUrl,
    overlayUrl: opts.overlayUrl,
    getSettings: () => {
      if (opts.settingsPath === undefined) return { ttsEnabled: false, ttsWordLimit: 50 }
      try {
        const raw: string = readFileSync(opts.settingsPath, 'utf8')
        const parsed: unknown = JSON.parse(raw)
        if (parsed !== null && typeof parsed === 'object') {
          return {
            ttsEnabled: 'tts_enabled' in parsed && parsed.tts_enabled === true,
            ttsWordLimit:
              'tts_word_limit' in parsed && typeof parsed.tts_word_limit === 'number'
                ? validateTtsWordLimit(parsed.tts_word_limit)
                : 50
          }
        }
      } catch {
        // settings file absent or unreadable — use defaults
      }
      return { ttsEnabled: false, ttsWordLimit: 50 }
    }
  })
  poller.start()
  return poller
}
