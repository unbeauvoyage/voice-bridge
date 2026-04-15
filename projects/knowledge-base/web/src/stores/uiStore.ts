/**
 * uiStore — Global UI state: panels, toasts, theme, modals.
 *
 * Client-owned state only. Does not mirror server data.
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

interface UiState {
  // Panels
  showTagsPanel: boolean
  showSettingsPanel: boolean
  showQueuePanel: boolean
  showCollectionsPanel: boolean
  showStatsPanel: boolean
  showTagCloud: boolean
  showPresetsDropdown: boolean
  showPresetSaveInput: boolean
  showAllSources: boolean
  showStreakPopover: boolean
  showSourcesPopover: boolean
  showQuickCapture: boolean
  showBulkAdd: boolean
  showShortcuts: boolean

  // Modals
  batchCollectionPickerOpen: boolean

  // Toasts
  deleteToast: string | null
  shareToast: boolean

  // Theme
  theme: 'dark' | 'light'

  // Settings
  ollamaDismissed: boolean

  // Actions
  setShowTagsPanel: (v: boolean) => void
  setShowSettingsPanel: (v: boolean) => void
  setShowQueuePanel: (v: boolean) => void
  setShowCollectionsPanel: (v: boolean) => void
  setShowStatsPanel: (v: boolean) => void
  setShowTagCloud: (v: boolean) => void
  setShowPresetsDropdown: (v: boolean) => void
  setShowPresetSaveInput: (v: boolean) => void
  setShowAllSources: (v: boolean) => void
  setShowStreakPopover: (v: boolean) => void
  setShowSourcesPopover: (v: boolean) => void
  setShowQuickCapture: (v: boolean) => void
  setShowBulkAdd: (v: boolean) => void
  setShowShortcuts: (v: boolean) => void
  setBatchCollectionPickerOpen: (v: boolean) => void
  setDeleteToast: (msg: string | null) => void
  setShareToast: (v: boolean) => void
  setTheme: (t: 'dark' | 'light') => void
  toggleTheme: () => void
  setOllamaDismissed: (v: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    immer((set) => ({
      showTagsPanel: false,
      showSettingsPanel: false,
      showQueuePanel: false,
      showCollectionsPanel: false,
      showStatsPanel: false,
      showTagCloud: false,
      showPresetsDropdown: false,
      showPresetSaveInput: false,
      showAllSources: false,
      showStreakPopover: false,
      showSourcesPopover: false,
      showQuickCapture: false,
      showBulkAdd: false,
      showShortcuts: false,
      batchCollectionPickerOpen: false,
      deleteToast: null,
      shareToast: false,
      theme: 'dark',
      ollamaDismissed: false,

      setShowTagsPanel: (v) => set((s) => { s.showTagsPanel = v }),
      setShowSettingsPanel: (v) => set((s) => { s.showSettingsPanel = v }),
      setShowQueuePanel: (v) => set((s) => { s.showQueuePanel = v }),
      setShowCollectionsPanel: (v) => set((s) => { s.showCollectionsPanel = v }),
      setShowStatsPanel: (v) => set((s) => { s.showStatsPanel = v }),
      setShowTagCloud: (v) => set((s) => { s.showTagCloud = v }),
      setShowPresetsDropdown: (v) => set((s) => { s.showPresetsDropdown = v }),
      setShowPresetSaveInput: (v) => set((s) => { s.showPresetSaveInput = v }),
      setShowAllSources: (v) => set((s) => { s.showAllSources = v }),
      setShowStreakPopover: (v) => set((s) => { s.showStreakPopover = v }),
      setShowSourcesPopover: (v) => set((s) => { s.showSourcesPopover = v }),
      setShowQuickCapture: (v) => set((s) => { s.showQuickCapture = v }),
      setShowBulkAdd: (v) => set((s) => { s.showBulkAdd = v }),
      setShowShortcuts: (v) => set((s) => { s.showShortcuts = v }),
      setBatchCollectionPickerOpen: (v) => set((s) => { s.batchCollectionPickerOpen = v }),
      setDeleteToast: (msg) => set((s) => { s.deleteToast = msg }),
      setShareToast: (v) => set((s) => { s.shareToast = v }),
      setTheme: (t) => set((s) => { s.theme = t }),
      toggleTheme: () => set((s) => { s.theme = s.theme === 'dark' ? 'light' : 'dark' }),
      setOllamaDismissed: (v) => set((s) => { s.ollamaDismissed = v }),
    })),
    { name: 'ui' }
  )
)

// Per-field hooks
export const useShowTagsPanel = () => useUiStore((s) => s.showTagsPanel)
export const useShowSettingsPanel = () => useUiStore((s) => s.showSettingsPanel)
export const useShowQueuePanel = () => useUiStore((s) => s.showQueuePanel)
export const useShowCollectionsPanel = () => useUiStore((s) => s.showCollectionsPanel)
export const useShowStatsPanel = () => useUiStore((s) => s.showStatsPanel)
export const useShowTagCloud = () => useUiStore((s) => s.showTagCloud)
export const useShowPresetsDropdown = () => useUiStore((s) => s.showPresetsDropdown)
export const useShowPresetSaveInput = () => useUiStore((s) => s.showPresetSaveInput)
export const useShowAllSources = () => useUiStore((s) => s.showAllSources)
export const useShowStreakPopover = () => useUiStore((s) => s.showStreakPopover)
export const useShowSourcesPopover = () => useUiStore((s) => s.showSourcesPopover)
export const useShowQuickCapture = () => useUiStore((s) => s.showQuickCapture)
export const useShowBulkAdd = () => useUiStore((s) => s.showBulkAdd)
export const useShowShortcuts = () => useUiStore((s) => s.showShortcuts)
export const useBatchCollectionPickerOpen = () => useUiStore((s) => s.batchCollectionPickerOpen)
export const useDeleteToast = () => useUiStore((s) => s.deleteToast)
export const useShareToast = () => useUiStore((s) => s.shareToast)
export const useTheme = () => useUiStore((s) => s.theme)
export const useOllamaDismissed = () => useUiStore((s) => s.ollamaDismissed)
