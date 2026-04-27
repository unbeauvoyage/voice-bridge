/**
 * Overlay window manager — owns the single `overlayWin` lifecycle.
 *
 * `overlayBoundsForMode(mode, screenWidth)` is a pure function that
 * maps overlay mode + primary-display width to x/y/width/height
 * bounds. Injecting the screen width makes it testable without
 * spinning up Electron's `screen` module.
 *
 * `createOverlayManager({ getScreenWidth, createWindow }) → { show, prewarm }`
 * is a controller-object holding the `overlayWin` reference.
 * `prewarm()` creates the BrowserWindow eagerly at app startup so no
 * new window is created mid-recording (which disturbs existing overlay
 * windows on macOS via window-manager cascading).
 * `show(payload)` creates the window on first call if not pre-warmed,
 * waits for `did-finish-load`, then sets bounds + shows + sends the payload.
 * Subsequent calls reuse the existing window and re-issue the
 * bounds + send. After `isDestroyed()` returns true a fresh window
 * is created.
 *
 * `OverlayWindowLike` captures just the surface the manager uses
 * (setBounds, show, isVisible, isDestroyed, webContents.once/send)
 * so tests can pass EventEmitter-backed fakes without type
 * assertions. Real Electron BrowserWindow satisfies the shape.
 */

import type { OverlayPayload } from '../typeGuards'

export type OverlayBounds = { x: number; y: number; width: number; height: number }

export type OverlayWebContentsLike = {
  once: (event: 'did-finish-load', listener: () => void) => unknown
  send: (channel: string, payload: unknown) => void
}

export type OverlayWindowLike = {
  webContents: OverlayWebContentsLike
  setBounds: (bounds: OverlayBounds) => void
  show: () => void
  isVisible: () => boolean
  isDestroyed: () => boolean
}

export type OverlayManagerConfig = {
  getScreenWidth: () => number
  createWindow: () => OverlayWindowLike
}

export type ToastManagerConfig = {
  createWindow: () => OverlayWindowLike
}

export type OverlayManager = {
  show: (payload: OverlayPayload) => void
  prewarm: () => void
}

export function overlayBoundsForMode(mode: string, screenWidth: number): OverlayBounds {
  // 'message' mode is handled by a dedicated toast window (see createToastBrowserWindow).
  // Recording stays left; status/cancelled/error stay left too.
  void screenWidth
  if (mode === 'recording') {
    return { x: 18, y: 30, width: 420, height: 54 }
  }
  return { x: 18, y: 30, width: 360, height: 52 }
}

export function createOverlayManager(cfg: OverlayManagerConfig): OverlayManager {
  let overlayWin: OverlayWindowLike | null = null
  let loaded = false

  function ensureWindow(): OverlayWindowLike {
    if (!overlayWin || overlayWin.isDestroyed()) {
      overlayWin = cfg.createWindow()
      loaded = false
      overlayWin.webContents.once('did-finish-load', () => {
        loaded = true
      })
    }
    return overlayWin
  }

  function prewarm(): void {
    ensureWindow()
  }

  function show(payload: OverlayPayload): void {
    const w = ensureWindow()
    if (!loaded) {
      w.webContents.once('did-finish-load', () => {
        w.setBounds(overlayBoundsForMode(payload.mode, cfg.getScreenWidth()))
        w.show()
        w.webContents.send('overlay-show', payload)
      })
      return
    }
    w.setBounds(overlayBoundsForMode(payload.mode, cfg.getScreenWidth()))
    if (!w.isVisible()) w.show()
    w.webContents.send('overlay-show', payload)
  }

  return { show, prewarm }
}

/**
 * Toast-only manager — sends overlay-show events to a dedicated toast window
 * WITHOUT calling setBounds. The toast window's position is fixed at creation
 * time by the factory (createToastBrowserWindow), so it never needs to move.
 */
export function createToastManager(cfg: ToastManagerConfig): OverlayManager {
  let toastWin: OverlayWindowLike | null = null
  let loaded = false

  function ensureWindow(): OverlayWindowLike {
    if (!toastWin || toastWin.isDestroyed()) {
      toastWin = cfg.createWindow()
      loaded = false
      toastWin.webContents.once('did-finish-load', () => {
        loaded = true
      })
    }
    return toastWin
  }

  function prewarm(): void {
    ensureWindow()
  }

  function show(payload: OverlayPayload): void {
    const w = ensureWindow()
    if (!loaded) {
      w.webContents.once('did-finish-load', () => {
        w.show()
        w.webContents.send('overlay-show', payload)
      })
      return
    }
    if (!w.isVisible()) w.show()
    w.webContents.send('overlay-show', payload)
  }

  return { show, prewarm }
}
