/**
 * searchStore — Search UI state: query, history, focused state.
 *
 * Does NOT hold search results — those come from React Query hooks.
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'

interface SearchState {
  searchText: string
  searchQuery: string
  searchHistory: string[]
  searchFocused: boolean
  setSearchText: (text: string) => void
  setSearchQuery: (query: string) => void
  addToSearchHistory: (query: string) => void
  setSearchHistory: (history: string[]) => void
  setSearchFocused: (focused: boolean) => void
}

export const useSearchStore = create<SearchState>()(
  persist(
    immer((set) => ({
      searchText: '',
      searchQuery: '',
      searchHistory: [],
      searchFocused: false,
      setSearchText: (text) => set((s) => { s.searchText = text }),
      setSearchQuery: (query) => set((s) => { s.searchQuery = query }),
      addToSearchHistory: (query) => set((s) => {
        const maxHistory = 10
        const filtered = s.searchHistory.filter((h) => h !== query)
        s.searchHistory = [query, ...filtered].slice(0, maxHistory)
      }),
      setSearchHistory: (history) => set((s) => { s.searchHistory = history }),
      setSearchFocused: (focused) => set((s) => { s.searchFocused = focused }),
    })),
    { name: 'search-ui' }
  )
)

// Per-field hooks
export const useSearchText = () => useSearchStore((s) => s.searchText)
export const useSearchQuery = () => useSearchStore((s) => s.searchQuery)
export const useSearchHistory = () => useSearchStore((s) => s.searchHistory)
export const useSearchFocused = () => useSearchStore((s) => s.searchFocused)
