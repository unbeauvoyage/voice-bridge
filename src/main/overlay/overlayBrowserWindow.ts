/**
 * Factory for the overlay BrowserWindow.
 *
 * Kept separate from the overlayManager so index.ts stays under 200 lines
 * and so this factory can be read/reviewed independently.
 *
 * The function is not unit-testable (it calls Electron's BrowserWindow
 * constructor directly); it is tested implicitly through Playwright E2E.
 */

import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export function createOverlayBrowserWindow(mainDir: string): BrowserWindow {
  const bounds = { x: 18, y: 30, width: 420, height: 54 }
  return createOverlayWindow(mainDir, bounds)
}

/**
 * Factory for the message-toast BrowserWindow.
 *
 * Positioned at the right side of the screen; tall enough to stack several
 * toasts. This window is managed independently so that incoming message toasts
 * never reposition the recording-overlay window (they are separate windows).
 */
export function createToastBrowserWindow(mainDir: string, screenWidth: number): BrowserWindow {
  // 498 = 480px toast + 18px margin; 600px height fits ~7 stacked toasts.
  const bounds = { x: screenWidth - 498, y: 30, width: 498, height: 600 }
  return createOverlayWindow(mainDir, bounds)
}

function createOverlayWindow(
  mainDir: string,
  bounds: { x: number; y: number; width: number; height: number }
): BrowserWindow {
  const w = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(mainDir, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  w.setAlwaysOnTop(true, 'screen-saver')
  w.setIgnoreMouseEvents(true)
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const overlayFilePath = join(mainDir, '../renderer/overlay.html')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const devUrl = `${process.env['ELECTRON_RENDERER_URL']}/overlay.html`
    w.loadURL(devUrl).catch(() => {
      console.warn('[overlay] dev server unreachable, falling back to loadFile')
      w.loadFile(overlayFilePath).catch((e: Error) =>
        console.error('[overlay] loadFile fallback failed:', e.message)
      )
    })
  } else {
    w.loadFile(overlayFilePath)
  }

  return w
}
