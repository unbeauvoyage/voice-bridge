/**
 * filterStore — List filter state: type, unread, archived, starred, study-later, tag filters, date filters.
 *
 * Client-owned filter UI state. Does NOT hold filtered results — React Query handles that.
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

export type TypeFilter = 'all' | 'youtube' | 'article' | 'pdf'
export type SortOption = 'newest' | 'oldest' | 'recently-read' | 'highest-rated' | 'most-starred' | 'title-az' | 'title-za'

interface FilterState {
  typeFilter: TypeFilter
  unreadOnly: boolean
  showStarredOnly: boolean
  showArchivedOnly: boolean
  filterStudyLater: boolean
  activeTagFilters: string[]
  activeDays: number
  sortOption: SortOption
  queueFilter: 'processing' | 'error' | null

  setTypeFilter: (type: TypeFilter) => void
  setUnreadOnly: (v: boolean) => void
  setShowStarredOnly: (v: boolean) => void
  setShowArchivedOnly: (v: boolean) => void
  setFilterStudyLater: (v: boolean) => void
  setActiveTagFilters: (tags: string[]) => void
  toggleTagFilter: (tag: string) => void
  setActiveDays: (days: number) => void
  setSortOption: (option: SortOption) => void
  setQueueFilter: (filter: 'processing' | 'error' | null) => void
}

export const useFilterStore = create<FilterState>()(
  persist(
    immer((set) => ({
      typeFilter: 'all',
      unreadOnly: false,
      showStarredOnly: false,
      showArchivedOnly: false,
      filterStudyLater: false,
      activeTagFilters: [],
      activeDays: 0,
      sortOption: 'newest',
      queueFilter: null,

      setTypeFilter: (type) => set((s) => { s.typeFilter = type }),
      setUnreadOnly: (v) => set((s) => { s.unreadOnly = v }),
      setShowStarredOnly: (v) => set((s) => { s.showStarredOnly = v }),
      setShowArchivedOnly: (v) => set((s) => { s.showArchivedOnly = v }),
      setFilterStudyLater: (v) => set((s) => { s.filterStudyLater = v }),
      setActiveTagFilters: (tags) => set((s) => { s.activeTagFilters = tags }),
      toggleTagFilter: (tag) => set((s) => {
        if (s.activeTagFilters.includes(tag)) {
          s.activeTagFilters = s.activeTagFilters.filter((t) => t !== tag)
        } else {
          s.activeTagFilters.push(tag)
        }
      }),
      setActiveDays: (days) => set((s) => { s.activeDays = days }),
      setSortOption: (option) => set((s) => { s.sortOption = option }),
      setQueueFilter: (filter) => set((s) => { s.queueFilter = filter }),
    })),
    { name: 'filter', partialize: (state) => ({ sortOption: state.sortOption }) }
  )
)

// Per-field hooks
export const useTypeFilter = (): TypeFilter => useFilterStore((s) => s.typeFilter)
export const useUnreadOnly = (): boolean => useFilterStore((s) => s.unreadOnly)
export const useShowStarredOnly = (): boolean => useFilterStore((s) => s.showStarredOnly)
export const useShowArchivedOnly = (): boolean => useFilterStore((s) => s.showArchivedOnly)
export const useFilterStudyLater = (): boolean => useFilterStore((s) => s.filterStudyLater)
export const useActiveTagFilters = (): string[] => useFilterStore((s) => s.activeTagFilters)
export const useActiveDays = (): number => useFilterStore((s) => s.activeDays)
export const useSortOption = (): SortOption => useFilterStore((s) => s.sortOption)
export const useQueueFilter = (): 'processing' | 'error' | null => useFilterStore((s) => s.queueFilter)
