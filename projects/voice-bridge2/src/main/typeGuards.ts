/**
 * Runtime type guards for unknown inputs crossing the main-process trust
 * boundary: HTTP responses from the local voice-bridge server, and POST
 * bodies to the overlay HTTP listener.
 *
 * Pure — no Electron imports, no file I/O. Safe to unit test with bun:test.
 */

export type OverlayPayload = {
  mode: 'success' | 'recording' | 'cancelled' | 'error' | 'message' | 'hidden'
  text?: string
}

const OVERLAY_MODES: readonly string[] = [
  'success',
  'recording',
  'cancelled',
  'error',
  'message',
  'hidden'
] as const

// Narrows the daemon stdout state object to confirm it carries a boolean
// recording field. Used to drive the tray recording indicator without a cast.
export function isRecordingState(v: unknown): v is { recording: boolean } {
  if (typeof v !== 'object' || v === null) return false
  if (!('recording' in v)) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  return typeof obj['recording'] === 'boolean'
}

export function isMicResponse(v: unknown): v is { state: 'on' | 'off' } {
  if (typeof v !== 'object' || v === null) return false
  if (!('state' in v)) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  return obj['state'] === 'on' || obj['state'] === 'off'
}

export function isAgentsResponse(v: unknown): v is { agents: Array<{ name: string } | string> } {
  if (typeof v !== 'object' || v === null) return false
  if (!('agents' in v)) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  return Array.isArray(obj['agents'])
}

export function isOverlayPayload(v: unknown): v is OverlayPayload {
  if (typeof v !== 'object' || v === null) return false
  if (!('mode' in v)) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  const mode = obj['mode']
  if (typeof mode !== 'string') return false
  if (!OVERLAY_MODES.includes(mode)) return false
  if ('text' in v) {
    const text = obj['text']
    if (text !== undefined && typeof text !== 'string') return false
  }
  return true
}
