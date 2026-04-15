/**
 * Overlay window manager — owns the single `overlayWin` lifecycle.
 *
 * `overlayBoundsForMode(mode, screenWidth)` is a pure function that
 * maps overlay mode + primary-display width to x/y/width/height
 * bounds. Injecting the screen width makes it testable without
 * spinning up Electron's `screen` module.
 *
 * `createOverlayManager({ getScreenWidth, createWindow }) → { show }`
 * is a controller-object holding the `overlayWin` reference.
 * `show(payload)` creates the window on first call, waits for
 * `did-finish-load`, then sets bounds + shows + sends the payload.
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

export type OverlayManager = {
  show: (payload: OverlayPayload) => void
}

export function overlayBoundsForMode(mode: string, screenWidth: number): OverlayBounds {
  if (mode === 'message') {
    return { x: screenWidth - 480 - 18, y: 30, width: 480, height: 80 }
  }
  if (mode === 'recording') {
    return { x: 18, y: 30, width: 420, height: 54 }
  }
  return { x: 18, y: 30, width: 360, height: 52 }
}

export function createOverlayManager(cfg: OverlayManagerConfig): OverlayManager {
  let overlayWin: OverlayWindowLike | null = null

  function show(payload: OverlayPayload): void {
    if (!overlayWin || overlayWin.isDestroyed()) {
      overlayWin = cfg.createWindow()
      const w = overlayWin
      w.webContents.once('did-finish-load', () => {
        w.setBounds(overlayBoundsForMode(payload.mode, cfg.getScreenWidth()))
        w.show()
        w.webContents.send('overlay-show', payload)
      })
      return
    }
    overlayWin.setBounds(overlayBoundsForMode(payload.mode, cfg.getScreenWidth()))
    if (!overlayWin.isVisible()) overlayWin.show()
    overlayWin.webContents.send('overlay-show', payload)
  }

  return { show }
}
