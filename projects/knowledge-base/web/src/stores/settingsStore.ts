/**
 * settingsStore — User settings state: theme persistence, notifications, presets.
 *
 * Client-owned UI preferences. Does NOT mirror server data directly — but
 * syncs mutations to the server via API calls.
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

interface SettingsState {
  notificationsOn: boolean
  presetNameInput: string
  setNotificationsOn: (v: boolean) => void
  setPresetNameInput: (input: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    immer((set) => ({
      notificationsOn: false,
      presetNameInput: '',
      setNotificationsOn: (v) => set((s) => { s.notificationsOn = v }),
      setPresetNameInput: (input) => set((s) => { s.presetNameInput = input }),
    })),
    { name: 'settings' }
  )
)

// Per-field hooks
export const useNotificationsOn = () => useSettingsStore((s) => s.notificationsOn)
export const usePresetNameInput = () => useSettingsStore((s) => s.presetNameInput)
