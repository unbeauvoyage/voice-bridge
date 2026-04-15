/// <reference types="vite/client" />

import type { OverlayPayload, WakeState, MicState } from './shared/types'

declare global {
  interface Window {
    __voiceBridge?: {
      hide(): void
      setTarget(target: string): Promise<void>
      onStateChange(
        cb: (s: { wakeState?: WakeState; micState?: MicState; transcript?: string }) => void
      ): () => void
    }
    __overlayBridge?: {
      onShow(cb: (payload: OverlayPayload) => void): () => void
    }
  }
}
