import { create } from 'zustand';
import type { KnowledgeItemPreview } from '../api.ts';

interface SearchState {
  // Search input and results
  searchQuery: string;
  semanticResults: KnowledgeItemPreview[] | null;
  semanticLoading: boolean;
  ftsResults: KnowledgeItemPreview[] | null;

  // Search history
  searchHistory: string[];
  searchFocused: boolean;

  // Actions
  setSearchQuery: (query: string) => void;
  setSemanticResults: (results: KnowledgeItemPreview[] | null) => void;
  setSemanticLoading: (loading: boolean) => void;
  setFtsResults: (results: KnowledgeItemPreview[] | null) => void;
  setSearchHistory: (history: string[]) => void;
  setSearchFocused: (focused: boolean) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  // Initial state
  searchQuery: '',
  semanticResults: null,
  semanticLoading: false,
  ftsResults: null,
  searchHistory: [],
  searchFocused: false,

  // Action handlers
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSemanticResults: (results) => set({ semanticResults: results }),
  setSemanticLoading: (loading) => set({ semanticLoading: loading }),
  setFtsResults: (results) => set({ ftsResults: results }),
  setSearchHistory: (history) => set({ searchHistory: history }),
  setSearchFocused: (focused) => set({ searchFocused: focused }),
}));
