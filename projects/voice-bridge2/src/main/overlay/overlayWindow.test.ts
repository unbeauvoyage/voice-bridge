import { describe, test, expect } from 'bun:test'
import { EventEmitter } from 'node:events'
import {
  overlayBoundsForMode,
  createOverlayManager,
  type OverlayWindowLike,
  type OverlayManagerConfig
} from './overlayWindow.ts'
import type { OverlayPayload } from '../typeGuards.ts'

describe('overlayBoundsForMode', () => {
  test('message mode is right-anchored with 480x80', () => {
    const b = overlayBoundsForMode('message', 1920)
    expect(b).toEqual({ x: 1920 - 480 - 18, y: 30, width: 480, height: 80 })
  })
  test('recording mode is left-anchored 420x54', () => {
    expect(overlayBoundsForMode('recording', 1920)).toEqual({
      x: 18,
      y: 30,
      width: 420,
      height: 54
    })
  })
  test('default mode (success/cancelled/error/hidden) is 360x52', () => {
    for (const mode of ['success', 'cancelled', 'error', 'hidden', 'unknown']) {
      expect(overlayBoundsForMode(mode, 1920)).toEqual({
        x: 18,
        y: 30,
        width: 360,
        height: 52
      })
    }
  })
})

type Call<T> = { name: string; args: T }

class FakeWebContents extends EventEmitter {
  sends: Array<{ channel: string; payload: unknown }> = []
  onceCalls: Array<{ event: string }> = []
  send(channel: string, payload: unknown): void {
    this.sends.push({ channel, payload })
  }
  once(event: string, listener: () => void): this {
    this.onceCalls.push({ event })
    super.once(event, listener)
    return this
  }
  triggerFinishLoad(): void {
    this.emit('did-finish-load')
  }
}

class FakeOverlayWindow implements OverlayWindowLike {
  webContents: FakeWebContents = new FakeWebContents()
  calls: Array<Call<unknown>> = []
  destroyed = false
  visible = false
  setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.calls.push({ name: 'setBounds', args: bounds })
  }
  show(): void {
    this.visible = true
    this.calls.push({ name: 'show', args: null })
  }
  isVisible(): boolean {
    return this.visible
  }
  isDestroyed(): boolean {
    return this.destroyed
  }
}

function makeHarness(): {
  cfg: OverlayManagerConfig
  windows: FakeOverlayWindow[]
  screenWidth: number
} {
  const windows: FakeOverlayWindow[] = []
  const cfg: OverlayManagerConfig = {
    getScreenWidth: () => 1920,
    createWindow: () => {
      const w = new FakeOverlayWindow()
      windows.push(w)
      return w
    }
  }
  return { cfg, windows, screenWidth: 1920 }
}

describe('createOverlayManager.show', () => {
  test('first show creates window and sends overlay-show on did-finish-load', () => {
    const h = makeHarness()
    const mgr = createOverlayManager(h.cfg)
    const payload: OverlayPayload = { mode: 'recording', text: 'hi' }
    mgr.show(payload)
    expect(h.windows).toHaveLength(1)
    const w = h.windows[0]
    if (!w) throw new Error('no window')
    expect(w.webContents.sends).toHaveLength(0) // not yet loaded
    w.webContents.triggerFinishLoad()
    expect(w.calls.some((c) => c.name === 'setBounds')).toBe(true)
    expect(w.visible).toBe(true)
    expect(w.webContents.sends).toEqual([{ channel: 'overlay-show', payload }])
  })

  test('second show reuses existing window and resends overlay-show', () => {
    const h = makeHarness()
    const mgr = createOverlayManager(h.cfg)
    mgr.show({ mode: 'recording' })
    const w = h.windows[0]
    if (!w) throw new Error('no window')
    w.webContents.triggerFinishLoad()
    w.webContents.sends.length = 0
    w.calls.length = 0

    mgr.show({ mode: 'message', text: 'hello' })
    expect(h.windows).toHaveLength(1) // no new window
    expect(w.calls.some((c) => c.name === 'setBounds')).toBe(true)
    expect(w.webContents.sends).toEqual([
      { channel: 'overlay-show', payload: { mode: 'message', text: 'hello' } }
    ])
  })

  test('second show skips .show() if already visible', () => {
    const h = makeHarness()
    const mgr = createOverlayManager(h.cfg)
    mgr.show({ mode: 'recording' })
    const w = h.windows[0]
    if (!w) throw new Error('no window')
    w.webContents.triggerFinishLoad()
    expect(w.visible).toBe(true)
    const showCountBefore = w.calls.filter((c) => c.name === 'show').length
    mgr.show({ mode: 'message' })
    const showCountAfter = w.calls.filter((c) => c.name === 'show').length
    expect(showCountAfter).toBe(showCountBefore)
  })

  test('second show calls .show() if window was hidden', () => {
    const h = makeHarness()
    const mgr = createOverlayManager(h.cfg)
    mgr.show({ mode: 'recording' })
    const w = h.windows[0]
    if (!w) throw new Error('no window')
    w.webContents.triggerFinishLoad()
    w.visible = false
    mgr.show({ mode: 'message' })
    expect(w.visible).toBe(true)
  })

  test('show after destroy creates fresh window', () => {
    const h = makeHarness()
    const mgr = createOverlayManager(h.cfg)
    mgr.show({ mode: 'recording' })
    const first = h.windows[0]
    if (!first) throw new Error('no window')
    first.webContents.triggerFinishLoad()
    first.destroyed = true

    mgr.show({ mode: 'message' })
    expect(h.windows).toHaveLength(2)
  })

  test('bounds match overlayBoundsForMode with injected screen width', () => {
    const h = makeHarness()
    h.cfg.getScreenWidth = () => 1440
    const mgr = createOverlayManager(h.cfg)
    mgr.show({ mode: 'message', text: 'x' })
    const w = h.windows[0]
    if (!w) throw new Error('no window')
    w.webContents.triggerFinishLoad()
    const setBoundsCall = w.calls.find((c) => c.name === 'setBounds')
    expect(setBoundsCall?.args).toEqual({ x: 1440 - 480 - 18, y: 30, width: 480, height: 80 })
  })
})
