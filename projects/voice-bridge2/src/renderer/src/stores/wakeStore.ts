import { create } from 'zustand'
import { DaemonState, WakeState, MicState } from '../shared/types'

interface WakeStateStore {
  wakeState: WakeState
  micState: MicState
  target: string
  transcript: string
  setWakeState: (state: WakeState) => void
  setMicState: (state: MicState) => void
  setTarget: (target: string) => void
  setTranscript: (transcript: string) => void
  setDaemonState: (state: DaemonState) => void
}

export const useWakeStore = create<WakeStateStore>((set) => ({
  wakeState: 'idle',
  micState: 'on',
  target: 'command',
  transcript: '',
  setWakeState: (state) => set({ wakeState: state }),
  setMicState: (state) => set({ micState: state }),
  setTarget: (target) => set({ target }),
  setTranscript: (transcript) => set({ transcript }),
  setDaemonState: (state) =>
    set({
      target: state.target,
      micState: state.micState,
      wakeState: state.wakeState,
      transcript: state.transcript
    })
}))
