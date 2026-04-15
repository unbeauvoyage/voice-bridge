/**
 * listStore — Client state for the knowledge item list view.
 *
 * Holds UI-owned state only: selections (ephemeral), visible item count.
 * Does NOT hold server data (items, tags, collections) — that goes in React Query.
 *
 * Selection state (selectedId, selectedIds) is ephemeral and does NOT persist
 * across page reloads — that's expected behavior. Only visibleCount persists.
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

interface ListUiState {
  selectedId: string | null
  selectedIds: Set<string>
  visibleCount: number
  setSelectedId: (id: string | null) => void
  toggleSelect: (id: string) => void
  clearSelection: () => void
  setVisibleCount: (count: number) => void
}

export const useListStore = create<ListUiState>()(
  persist(
    immer((set) => ({
      selectedId: null,
      selectedIds: new Set<string>(),
      visibleCount: 30,
      setSelectedId: (id) => set((state) => { state.selectedId = id }),
      toggleSelect: (id) => set((state) => {
        if (state.selectedIds.has(id)) {
          state.selectedIds.delete(id)
        } else {
          state.selectedIds.add(id)
        }
      }),
      clearSelection: () => set((state) => { state.selectedIds.clear() }),
      setVisibleCount: (count) => set((state) => { state.visibleCount = count }),
    })),
    {
      name: 'list-ui',
      // Persist only visibleCount; selection is ephemeral and shouldn't survive reload
      partialize: (state) => ({ visibleCount: state.visibleCount }),
    }
  )
)

// Per-field hooks
export const useSelectedId = () => useListStore((s) => s.selectedId)
export const useSelectedIds = () => useListStore((s) => s.selectedIds)
export const useVisibleCount = () => useListStore((s) => s.visibleCount)
