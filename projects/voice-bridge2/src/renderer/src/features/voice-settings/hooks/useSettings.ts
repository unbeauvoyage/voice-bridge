import { useState, useCallback, useRef } from 'react'
import { type Settings, isPartialSettings, DEFAULT_SETTINGS, SERVER } from '../../../shared/types'

type UseSettingsResult = {
  settings: Settings
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveSettings = useCallback((patch: Partial<Settings>): void => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      try {
        await fetch(`${SERVER}/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
      } catch {
        /* ignore */
      }
    }, 500)
  }, [])

  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]): void => {
      setSettings((s) => {
        const next = { ...s, [key]: value }
        saveSettings({ [key]: value })
        return next
      })
    },
    [saveSettings],
  )

  return { settings, updateSetting }
}

export function useLoadSettings(
  setSettings: React.Dispatch<React.SetStateAction<Settings>>,
): void {
  // Load initial settings from server — called once on mount via useEffect in consumer
  void (async () => {
    try {
      const res = await fetch(`${SERVER}/settings`)
      if (res.ok) {
        const data: unknown = await res.json()
        if (isPartialSettings(data)) {
          setSettings((s) => ({ ...s, ...data }))
        }
      }
    } catch {
      /* ignore */
    }
  })()
}
