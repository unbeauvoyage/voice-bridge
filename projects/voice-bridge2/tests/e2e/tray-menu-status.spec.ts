/**
 * Tests for relay + whisper connectivity status items in the tray context menu.
 *
 * The tray context menu shows disabled text items so users can diagnose
 * connection issues without reading icon colours:
 *   "Relay: Connected" / "Relay: Offline" / "Relay: Error"
 *   "Whisper: Connected" / "Whisper: Offline" / "Whisper: Error"
 *
 * The menu is rebuilt on every right-click via deps.buildMenu(). State is
 * threaded via MenuStatus passed to buildMenuTemplate(). TrayController
 * exposes getMenuStatus() so the buildMenu closure captures current state.
 */

import { describe, test, expect } from 'bun:test'
import {
  buildMenuTemplate,
  attachTrayBehavior,
  type TrayDeps,
  type TrayLike,
  type MenuTemplate
} from '../../src/main/tray.ts'
import { EventEmitter } from 'node:events'

// ── Helpers ────────────────────────────────────────────────────────────────────

class FakeTray extends EventEmitter implements TrayLike {
  popUps: unknown[] = []
  popUpContextMenu(menu: unknown): void {
    this.popUps.push(menu)
  }
}

function makeDeps(overrides: Partial<TrayDeps> = {}): TrayDeps {
  return {
    buildMenu: () => ({}),
    showMainWindow: () => undefined,
    hideMainWindow: () => undefined,
    isMainWindowVisible: () => false,
    ...overrides
  }
}

function noop(): void {
  /* stub */
}

const BASE_CALLBACKS = {
  onSettings: noop,
  onRestartDaemon: noop,
  onStopDaemon: noop,
  onQuit: noop
}

/** Extract all disabled label strings from a MenuTemplate. */
function disabledLabels(template: MenuTemplate): string[] {
  return template
    .filter((item): item is Extract<MenuTemplate[number], { label: string; enabled: false }> => {
      return 'label' in item && 'enabled' in item && item.enabled === false
    })
    .map((item) => item.label)
}

// ── 1. Relay disconnected ─────────────────────────────────────────────────────

describe('relay disconnected → menu item shows "Relay: Offline"', () => {
  test('buildMenuTemplate with relay disconnected includes "Relay: Offline"', () => {
    const template = buildMenuTemplate(BASE_CALLBACKS, { relay: 'disconnected' })
    expect(disabledLabels(template)).toContain('Relay: Offline')
  })

  test('TrayController.setRelayState updates getMenuStatus relay field', () => {
    const tray = new FakeTray()
    const ctrl = attachTrayBehavior(tray, makeDeps())
    ctrl.setRelayState('disconnected')
    expect(ctrl.getMenuStatus().relay).toBe('disconnected')
  })

  test('menu rebuilt via getMenuStatus shows Relay: Offline after setRelayState', () => {
    const tray = new FakeTray()
    const ctrl = attachTrayBehavior(tray, makeDeps())
    ctrl.setRelayState('disconnected')
    const template = buildMenuTemplate(BASE_CALLBACKS, ctrl.getMenuStatus())
    expect(disabledLabels(template)).toContain('Relay: Offline')
  })
})

// ── 2. Whisper error ──────────────────────────────────────────────────────────

describe('whisper error → menu item shows "Whisper: Error"', () => {
  test('buildMenuTemplate with whisper error includes "Whisper: Error"', () => {
    const template = buildMenuTemplate(BASE_CALLBACKS, { whisper: 'error' })
    expect(disabledLabels(template)).toContain('Whisper: Error')
  })

  test('TrayController.setWhisperState updates getMenuStatus whisper field', () => {
    const tray = new FakeTray()
    const ctrl = attachTrayBehavior(tray, makeDeps())
    ctrl.setWhisperState('error')
    expect(ctrl.getMenuStatus().whisper).toBe('error')
  })

  test('menu rebuilt via getMenuStatus shows Whisper: Error after setWhisperState', () => {
    const tray = new FakeTray()
    const ctrl = attachTrayBehavior(tray, makeDeps())
    ctrl.setWhisperState('error')
    const template = buildMenuTemplate(BASE_CALLBACKS, ctrl.getMenuStatus())
    expect(disabledLabels(template)).toContain('Whisper: Error')
  })
})

// ── 3. Both connected ─────────────────────────────────────────────────────────

describe('both connected → menu items show connected state', () => {
  test('buildMenuTemplate with both connected includes "Relay: Connected"', () => {
    const template = buildMenuTemplate(BASE_CALLBACKS, { relay: 'connected', whisper: 'connected' })
    expect(disabledLabels(template)).toContain('Relay: Connected')
  })

  test('buildMenuTemplate with both connected includes "Whisper: Connected"', () => {
    const template = buildMenuTemplate(BASE_CALLBACKS, { relay: 'connected', whisper: 'connected' })
    expect(disabledLabels(template)).toContain('Whisper: Connected')
  })

  test('default status (no status arg) shows both Connected', () => {
    const template = buildMenuTemplate(BASE_CALLBACKS)
    const labels = disabledLabels(template)
    expect(labels).toContain('Relay: Connected')
    expect(labels).toContain('Whisper: Connected')
  })

  test('getMenuStatus defaults to connected for both before any setState call', () => {
    const tray = new FakeTray()
    const ctrl = attachTrayBehavior(tray, makeDeps())
    const status = ctrl.getMenuStatus()
    expect(status.relay).toBe('connected')
    expect(status.whisper).toBe('connected')
  })
})
