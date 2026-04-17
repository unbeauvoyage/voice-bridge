import { ElectronAPI } from '@electron-toolkit/preload'

// ── IPC payload contracts (shared between preload, main, and renderer) ────────

type DaemonState = {
  target: string
  micState: 'on' | 'off'
  wakeState: 'idle' | 'listening' | 'recording' | 'processing'
  transcript: string
}

type StatusPayload = {
  target: string
  micState: 'on' | 'off'
}

type OverlayMode = 'success' | 'recording' | 'cancelled' | 'error' | 'message' | 'hidden'

type OverlayPayload = {
  mode: OverlayMode
  text?: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    __voiceBridge?: {
      getStatus(): Promise<StatusPayload>
      setTarget(target: string): Promise<void>
      getAgents(): Promise<string[]>
      onStateChange(cb: (state: DaemonState) => void): () => void
      hide(): void
      showOverlay(payload: OverlayPayload): Promise<void>
      toggleMic(): Promise<void>
    }
    __overlayBridge?: {
      onShow(cb: (payload: OverlayPayload) => void): () => void
    }
  }
}
