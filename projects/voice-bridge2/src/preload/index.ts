import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// ── IPC payload contracts ─────────────────────────────────────────────────────

export type DaemonState = {
  target: string
  micState: 'on' | 'off'
  wakeState: 'idle' | 'listening' | 'recording' | 'processing'
  transcript: string
}

export type StatusPayload = {
  target: string
  micState: 'on' | 'off'
}

export type OverlayMode = 'success' | 'recording' | 'cancelled' | 'error' | 'message' | 'hidden'

export type OverlayPayload = {
  mode: OverlayMode
  text?: string
}

// ── Voice bridge ──────────────────────────────────────────────────────────────

const bridge = {
  async getStatus(): Promise<StatusPayload> {
    const result: unknown = await ipcRenderer.invoke('get-status')
    // ipcMain.handle('get-status') always returns StatusPayload — narrow for type safety
    if (typeof result === 'object' && result !== null && 'target' in result && 'micState' in result) {
      const obj: Record<string, unknown> = Object.fromEntries(Object.entries(result))
      if (typeof obj['target'] === 'string' && (obj['micState'] === 'on' || obj['micState'] === 'off')) {
        return { target: obj['target'], micState: obj['micState'] }
      }
    }
    return { target: 'command', micState: 'on' }
  },
  async setTarget(target: string): Promise<void> {
    await ipcRenderer.invoke('set-target', { target })
  },
  async getAgents(): Promise<string[]> {
    const result: unknown = await ipcRenderer.invoke('get-agents')
    return Array.isArray(result) ? result.filter((x): x is string => typeof x === 'string') : []
  },
  onStateChange(cb: (state: DaemonState) => void): () => void {
    const handler = (_event: IpcRendererEvent, state: DaemonState): void => cb(state)
    ipcRenderer.on('state-change', handler)
    return () => ipcRenderer.removeListener('state-change', handler)
  },
  hide(): void { ipcRenderer.send('hide-window') },
  async showOverlay(payload: OverlayPayload): Promise<void> {
    await ipcRenderer.invoke('show-overlay', payload)
  },
}

contextBridge.exposeInMainWorld('__voiceBridge', bridge)

// ── Overlay bridge ────────────────────────────────────────────────────────────

const overlayBridge = {
  onShow(cb: (payload: OverlayPayload) => void): () => void {
    const handler = (_event: IpcRendererEvent, payload: OverlayPayload): void => cb(payload)
    ipcRenderer.on('overlay-show', handler)
    return () => ipcRenderer.removeListener('overlay-show', handler)
  },
}

contextBridge.exposeInMainWorld('__overlayBridge', overlayBridge)
