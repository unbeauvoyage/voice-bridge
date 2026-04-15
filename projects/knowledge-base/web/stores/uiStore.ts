import { create } from 'zustand';

interface UIState {
  // Panel visibility
  showSettingsPanel: boolean;
  showTagsPanel: boolean;
  showBulkAdd: boolean;
  showTagCloud: boolean;
  showStatsPanel: boolean;
  showCollectionsPanel: boolean;
  showQueuePanel: boolean;
  showQuickCapture: boolean;
  showShortcuts: boolean;

  // Popovers
  showStreakPopover: boolean;
  showSourcesPopover: boolean;
  showAllSources: boolean;

  // Share toast
  shareToast: boolean;

  // Ollama banner
  ollamaDismissed: boolean;

  // Actions
  setShowSettingsPanel: (show: boolean) => void;
  setShowTagsPanel: (show: boolean) => void;
  setShowBulkAdd: (show: boolean) => void;
  setShowTagCloud: (show: boolean) => void;
  setShowStatsPanel: (show: boolean) => void;
  setShowCollectionsPanel: (show: boolean) => void;
  setShowQueuePanel: (show: boolean) => void;
  setShowQuickCapture: (show: boolean) => void;
  setShowShortcuts: (show: boolean) => void;
  setShowStreakPopover: (show: boolean) => void;
  setShowSourcesPopover: (show: boolean) => void;
  setShowAllSources: (show: boolean) => void;
  setShareToast: (show: boolean) => void;
  setOllamaDismissed: (dismissed: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  showSettingsPanel: false,
  showTagsPanel: false,
  showBulkAdd: false,
  showTagCloud: false,
  showStatsPanel: false,
  showCollectionsPanel: false,
  showQueuePanel: false,
  showQuickCapture: false,
  showShortcuts: false,
  showStreakPopover: false,
  showSourcesPopover: false,
  showAllSources: false,
  shareToast: false,
  ollamaDismissed: false,

  // Action handlers
  setShowSettingsPanel: (show) => set({ showSettingsPanel: show }),
  setShowTagsPanel: (show) => set({ showTagsPanel: show }),
  setShowBulkAdd: (show) => set({ showBulkAdd: show }),
  setShowTagCloud: (show) => set({ showTagCloud: show }),
  setShowStatsPanel: (show) => set({ showStatsPanel: show }),
  setShowCollectionsPanel: (show) => set({ showCollectionsPanel: show }),
  setShowQueuePanel: (show) => set({ showQueuePanel: show }),
  setShowQuickCapture: (show) => set({ showQuickCapture: show }),
  setShowShortcuts: (show) => set({ showShortcuts: show }),
  setShowStreakPopover: (show) => set({ showStreakPopover: show }),
  setShowSourcesPopover: (show) => set({ showSourcesPopover: show }),
  setShowAllSources: (show) => set({ showAllSources: show }),
  setShareToast: (show) => set({ shareToast: show }),
  setOllamaDismissed: (dismissed) => set({ ollamaDismissed: dismissed }),
}));
