/**
 * Integration tests for relay connectivity indicator in the tray icon.
 *
 * When the relay is unreachable (ECONNREFUSED / timeout) or returns a non-200
 * status on its health endpoint, the tray icon must reflect this — distinct
 * from the normal idle/connected state.
 *
 * Three states are modelled:
 *   'connected'    — relay health check returned 2xx
 *   'disconnected' — fetch threw (ECONNREFUSED, timeout, network error)
 *   'error'        — relay returned a non-2xx status (e.g. 500)
 *
 * Tests exercise `checkRelayHealth` (pure async fn, injected fetch) and
 * `setRelayState` on the TrayController (added to tray.ts). The wiring
 * between them is done by `startRelayHealthPoller` (src/main/relayHealth.ts).
 */

import { describe, test, expect } from 'bun:test'
import { checkRelayHealth, type RelayState } from '../../src/main/relayHealth.ts'
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
    relayDisconnectedIcon: 'disconnected-icon',
    relayErrorIcon: 'error-icon',
    ...overrides
  }
}

/** Build a fake fetch that throws ECONNREFUSED. */
function fetchThatThrows(): typeof fetch {
  return async () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:8767')
    Object.assign(err, { code: 'ECONNREFUSED' })
    throw err
  }
}

/** Build a fake fetch that returns the given HTTP status. */
function fetchWithStatus(status: number): typeof fetch {
  return async () => new Response(null, { status })
}

// ── 1. Relay unreachable on startup ──────────────────────────────────────────

describe('relay unreachable on startup → tray icon shows disconnected state', () => {
  test('checkRelayHealth returns "disconnected" when fetch throws', async () => {
    const state = await checkRelayHealth('http://localhost:8767', fetchThatThrows())
    expect(state).toBe<RelayState>('disconnected')
  })

  test('setRelayState("disconnected") swaps tray icon to relay-disconnected icon', () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())
    ctrl.setRelayState('disconnected')
    expect(tray.images).toContain('disconnected-icon')
  })

  test('full path: unreachable relay → disconnected icon appears in tray', async () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())

    const state = await checkRelayHealth('http://localhost:8767', fetchThatThrows())
    ctrl.setRelayState(state)

    expect(tray.images[tray.images.length - 1]).toBe('disconnected-icon')
  })
})

// ── 2. Relay comes back online ────────────────────────────────────────────────

describe('relay comes back online → tray icon updates to connected state', () => {
  test('checkRelayHealth returns "connected" when relay responds 200', async () => {
    const state = await checkRelayHealth('http://localhost:8767', fetchWithStatus(200))
    expect(state).toBe<RelayState>('connected')
  })

  test('setRelayState("connected") swaps tray icon back to normal icon', () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())
    // Simulate: was disconnected, now connected
    ctrl.setRelayState('disconnected')
    ctrl.setRelayState('connected')
    expect(tray.images[tray.images.length - 1]).toBe('normal-icon')
  })

  test('full path: disconnected → connected → icon cycles correctly', async () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())

    const disconnected = await checkRelayHealth('http://localhost:8767', fetchThatThrows())
    ctrl.setRelayState(disconnected)
    expect(tray.images[tray.images.length - 1]).toBe('disconnected-icon')

    const connected = await checkRelayHealth('http://localhost:8767', fetchWithStatus(200))
    ctrl.setRelayState(connected)
    expect(tray.images[tray.images.length - 1]).toBe('normal-icon')
  })
})

// ── 3. Relay health check 500 → error state ───────────────────────────────────

describe('relay health check 500 → tray icon shows error state', () => {
  test('checkRelayHealth returns "error" when relay responds 500', async () => {
    const state = await checkRelayHealth('http://localhost:8767', fetchWithStatus(500))
    expect(state).toBe<RelayState>('error')
  })

  test('checkRelayHealth returns "error" for any non-2xx status', async () => {
    const states = await Promise.all([
      checkRelayHealth('http://localhost:8767', fetchWithStatus(503)),
      checkRelayHealth('http://localhost:8767', fetchWithStatus(404)),
      checkRelayHealth('http://localhost:8767', fetchWithStatus(401))
    ])
    expect(states).toEqual(['error', 'error', 'error'])
  })

  test('setRelayState("error") swaps tray icon to relay-error icon', () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())
    ctrl.setRelayState('error')
    expect(tray.images).toContain('error-icon')
  })

  test('full path: relay 500 → error icon appears in tray', async () => {
    const tray = new FakeTrayWithImage()
    const ctrl = attachTrayBehavior(tray, makeTrayDeps())

    const state = await checkRelayHealth('http://localhost:8767', fetchWithStatus(500))
    ctrl.setRelayState(state)

    expect(tray.images[tray.images.length - 1]).toBe('error-icon')
  })
})
