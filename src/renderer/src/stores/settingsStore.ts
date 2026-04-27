import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Settings, DEFAULT_SETTINGS } from '../shared/types'

interface SettingsState {
  settings: Settings
  setSettings: (settings: Settings) => void
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      setSettings: (settings) => set({ settings }),
      updateSetting: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, [key]: value }
        }))
    }),
    {
      name: 'voice-bridge-settings',
      partialize: (state) => ({ settings: state.settings })
    }
  )
)
