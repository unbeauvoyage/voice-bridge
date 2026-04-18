/**
 * Integration tests for whisper-server health indicator in the tray icon.
 *
 * Mirrors the relay connectivity indicator pattern (tray-relay-state.spec.ts).
 * Three states:
 *   'connected'    — whisper health check returned 2xx
 *   'disconnected' — fetch threw (ECONNREFUSED, timeout, network error)
 *   'error'        — whisper returned a non-2xx status (e.g. 500)
 *
 * Tests exercise `checkWhisperHealth` (pure async fn, injected fetch) and
 * `setWhisperState` on the TrayController (added to tray.ts).
 */

import { describe, test, expect } from 'bun:test'
import { checkWhisperHealth, type WhisperState } from '../../src/main/whisperHealth.ts'
import { attachTrayBehavior, type TrayDeps, type TrayLike } from '../../src/main/tray.ts'
import { EventEmitter } from 'node:events'

// ── Helpers ────────────────────────────────────────────────────────────────────

type IconToken = string

class FakeTrayWithImage extends EventEmitter implements TrayLike<IconToken> {
  popUps: unknown[] = []
  images: IconToken[] = []
  popUpContextMenu(menu: unknown): void {
    this.popUps.push(menu)
  }
  setImage(icon: IconToken): void {
    this.images.push(icon)
  }
}

function makeTrayDeps(overrides: Partial<TrayDeps<IconToken>> = {}): TrayDeps<IconToken> {
  return {
    buildMenu: () => ({}),
    showMainWindow: () => undefined,
    hideMainWindow: () => undefined,
    isMainWindowVisible: () => false,
    normalIcon: 'normal-icon',
    recordingIcon: 'recording-icon',
    relayDisconnectedIcon: 'relay-disconnected-icon',
    relayErrorIcon: 'relay-error-icon',
    whisperDisconnectedIcon: 'whisper-disconnected-icon',
    whisperErrorIcon: 'whisper-error-icon',
    ...overrides
  }
}

function fetchThatThrows(): typeof fetch {
  return async () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:8766')
    Object.assign(err, { code: 'ECONNREFUSED' })
    throw err
  }
}

function fetchWithStatus(status: number): typeof fetch {
  return async () => new Response(null, { status })
}

// ── 1. Whisper server unreachable ─────────────────────────────────────────────

describe('whisper-server unreachable → tray shows whisper-disconnected state', () => {
  test('checkWhisperHealth returns "disconnected" when fetch throws', async () => {
    const state = await checkWhisperHealth('http://localhost:8766', fetchThatThrows())
    expect(state).toBe<WhisperState>('disconnected')
  })

  test('setWhisperState("disconnected") swaps tray icon to whisper-disconnected icon', () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())
    ctrl.setWhisperState('disconnected')
    expect(tray.images).toContain('whisper-disconnected-icon')
  })

  test('full path: unreachable whisper → whisper-disconnected icon in tray', async () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())

    const state = await checkWhisperHealth('http://localhost:8766', fetchThatThrows())
    ctrl.setWhisperState(state)

    expect(tray.images[tray.images.length - 1]).toBe('whisper-disconnected-icon')
  })
})

// ── 2. Whisper server returns 200 ─────────────────────────────────────────────

describe('whisper-server returns 200 → tray shows whisper-connected state', () => {
  test('checkWhisperHealth returns "connected" when whisper responds 200', async () => {
    const state = await checkWhisperHealth('http://localhost:8766', fetchWithStatus(200))
    expect(state).toBe<WhisperState>('connected')
  })

  test('setWhisperState("connected") reverts tray icon to normal icon', () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())
    ctrl.setWhisperState('disconnected')
    ctrl.setWhisperState('connected')
    expect(tray.images[tray.images.length - 1]).toBe('normal-icon')
  })

  test('full path: disconnected → connected → icon cycles correctly', async () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())

    const disconnected = await checkWhisperHealth('http://localhost:8766', fetchThatThrows())
    ctrl.setWhisperState(disconnected)
    expect(tray.images[tray.images.length - 1]).toBe('whisper-disconnected-icon')

    const connected = await checkWhisperHealth('http://localhost:8766', fetchWithStatus(200))
    ctrl.setWhisperState(connected)
    expect(tray.images[tray.images.length - 1]).toBe('normal-icon')
  })
})

// ── 3. Whisper health check 500 ────────────────────────────────────────────────

describe('whisper health check 500 → tray shows whisper-error state', () => {
  test('checkWhisperHealth returns "error" when whisper responds 500', async () => {
    const state = await checkWhisperHealth('http://localhost:8766', fetchWithStatus(500))
    expect(state).toBe<WhisperState>('error')
  })

  test('checkWhisperHealth returns "error" for any non-2xx status', async () => {
    const states = await Promise.all([
      checkWhisperHealth('http://localhost:8766', fetchWithStatus(503)),
      checkWhisperHealth('http://localhost:8766', fetchWithStatus(404))
    ])
    expect(states).toEqual(['error', 'error'])
  })

  test('setWhisperState("error") swaps tray icon to whisper-error icon', () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())
    ctrl.setWhisperState('error')
    expect(tray.images).toContain('whisper-error-icon')
  })

  test('full path: whisper 500 → error icon in tray', async () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())

    const state = await checkWhisperHealth('http://localhost:8766', fetchWithStatus(500))
    ctrl.setWhisperState(state)

    expect(tray.images[tray.images.length - 1]).toBe('whisper-error-icon')
  })
})
