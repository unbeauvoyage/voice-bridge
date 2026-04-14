import { useState, useEffect } from 'react'
import { type DaemonState, isStatusResponse, SERVER } from '../../../shared/types'

type UseWakeStateResult = {
  state: DaemonState
  setState: React.Dispatch<React.SetStateAction<DaemonState>>
}

const DEFAULT_STATE: DaemonState = {
  target: 'command',
  micState: 'on',
  wakeState: 'idle',
  transcript: '',
}

export function useWakeState(): UseWakeStateResult {
  const [state, setState] = useState<DaemonState>(DEFAULT_STATE)

  // Subscribe to IPC state changes from main process (wake word events)
  useEffect(() => {
    if (!window.__voiceBridge) return
    const unsub = window.__voiceBridge.onStateChange((s) => setState((prev) => ({ ...prev, ...s })))
    return unsub
  }, [])

  // Poll status every 3s as fallback when IPC not available
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER}/status`)
        if (res.ok) {
          const data: unknown = await res.json()
          if (isStatusResponse(data)) {
            setState((s) => ({ ...s, target: data.target, micState: data.micState }))
          }
        }
      } catch {
        /* ignore */
      }
    }, 3000)
    return (): void => clearInterval(id)
  }, [])

  return { state, setState }
}
