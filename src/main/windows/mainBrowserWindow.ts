/**
 * Factory for the main settings BrowserWindow.
 *
 * Kept separate from the mainWindowManager so index.ts stays under 200 lines
 * and so this factory can be read/reviewed independently.
 *
 * The function is not unit-testable (it calls Electron's BrowserWindow
 * constructor directly); it is tested implicitly through Playwright E2E.
 */

import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export function createMainBrowserWindow(mainDir: string): BrowserWindow {
  const w = new BrowserWindow({
    width: 400,
    height: 340,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(mainDir, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  w.setAlwaysOnTop(true, 'pop-up-menu')
  w.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true, visibleOnFullScreen: true })

  w.on('show', () => console.log('[win] show event, visible:', w.isVisible()))
  w.on('hide', () => {
    console.log('[win] hide event')
  })
  w.on('blur', () => console.log('[win] blur fired'))
  w.on('focus', () => console.log('[win] focus event'))

  w.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })
  w.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer] did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`)
  })
  w.webContents.on('did-finish-load', () => {
    console.log('[renderer] did-finish-load')
    w.webContents
      .executeJavaScript(
        `
      document.body.style.background = 'rgba(20,20,28,0.95)';
      console.log('[diag] root:', document.getElementById('root')?.innerHTML?.length);
    `
      )
      .catch(() => {})
  })

  const settingsFilePath = join(mainDir, '../renderer/index.html')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    w.webContents.openDevTools({ mode: 'detach' })
    // loadURL can fail if the Vite dev server has crashed or restarted.
    // Fall back to the built file so the settings panel still appears.
    w.loadURL(process.env['ELECTRON_RENDERER_URL']).catch(() => {
      console.warn('[main-win] dev server unreachable, falling back to loadFile')
      w.loadFile(settingsFilePath).catch((e: Error) =>
        console.error('[main-win] loadFile fallback failed:', e.message)
      )
    })
  } else {
    w.loadFile(settingsFilePath)
  }

  return w
}
