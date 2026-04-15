import { create } from 'zustand';
import type { KnowledgeItemPreview, TagsResponse } from '../api.ts';

// Use API type directly
export type TagData = TagsResponse;

interface ListState {
  // Item list
  allItems: KnowledgeItemPreview[];
  tagData: TagData;
  tagStatusMap: Record<string, string>;
  loading: boolean;
  selectedId: string | null;

  // Filters
  searchText: string;
  semanticMode: boolean;
  activeTagFilters: string[];
  activeDays: number;
  showStarredOnly: boolean;
  filterStudyLater: boolean;
  showArchivedOnly: boolean;
  queueFilter: 'processing' | 'error' | null;
  typeFilter: 'all' | 'youtube' | 'article' | 'pdf';
  unreadOnly: boolean;

  // Sorting
  sortOption: 'newest' | 'oldest' | 'recently-read' | 'highest-rated' | 'most-starred' | 'title-az' | 'title-za';

  // Filter presets
  filterPresets: any[];
  showPresetsDropdown: boolean;
  presetNameInput: string;
  showPresetSaveInput: boolean;

  // Batch selection
  selectedIds: Set<string>;
  deleteToast: string | null;
  batchCollectionPickerOpen: boolean;

  // UI state
  flashIds: Set<string>;
  visibleCount: number;
  detailCacheVersion: number;

  // Actions
  setAllItems: (items: KnowledgeItemPreview[]) => void;
  setTagData: (data: TagData) => void;
  setTagStatusMap: (map: Record<string, string>) => void;
  setLoading: (loading: boolean) => void;
  setSelectedId: (id: string | null) => void;
  setSearchText: (text: string) => void;
  setSemanticMode: (mode: boolean) => void;
  setActiveTagFilters: (filters: string[]) => void;
  setActiveDays: (days: number) => void;
  setShowStarredOnly: (show: boolean) => void;
  setFilterStudyLater: (filter: boolean) => void;
  setShowArchivedOnly: (show: boolean) => void;
  setQueueFilter: (filter: 'processing' | 'error' | null) => void;
  setTypeFilter: (filter: 'all' | 'youtube' | 'article' | 'pdf') => void;
  setUnreadOnly: (only: boolean) => void;
  setSortOption: (option: 'newest' | 'oldest' | 'recently-read' | 'highest-rated' | 'most-starred' | 'title-az' | 'title-za') => void;
  setFilterPresets: (presets: any[]) => void;
  setShowPresetsDropdown: (show: boolean) => void;
  setPresetNameInput: (input: string) => void;
  setShowPresetSaveInput: (show: boolean) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setDeleteToast: (toast: string | null) => void;
  setBatchCollectionPickerOpen: (open: boolean) => void;
  setFlashIds: (ids: Set<string>) => void;
  setVisibleCount: (count: number) => void;
  setDetailCacheVersion: (version: number) => void;
}

export const useListStore = create<ListState>((set) => ({
  // Initial state
  allItems: [],
  tagData: { approved: [], pending: [] as { tag: string; itemId: string; itemTitle: string }[], rejected: [] },
  tagStatusMap: {},
  loading: true,
  selectedId: null,
  searchText: '',
  semanticMode: false,
  activeTagFilters: [],
  activeDays: 0,
  showStarredOnly: false,
  filterStudyLater: false,
  showArchivedOnly: false,
  queueFilter: null,
  typeFilter: 'all',
  unreadOnly: false,
  sortOption: 'newest',
  filterPresets: [],
  showPresetsDropdown: false,
  presetNameInput: '',
  showPresetSaveInput: false,
  selectedIds: new Set(),
  deleteToast: null,
  batchCollectionPickerOpen: false,
  flashIds: new Set(),
  visibleCount: 30,
  detailCacheVersion: 0,

  // Action handlers
  setAllItems: (items) => set({ allItems: items }),
  setTagData: (data) => set({ tagData: data }),
  setTagStatusMap: (map) => set({ tagStatusMap: map }),
  setLoading: (loading) => set({ loading }),
  setSelectedId: (id) => set({ selectedId: id }),
  setSearchText: (text) => set({ searchText: text }),
  setSemanticMode: (mode) => set({ semanticMode: mode }),
  setActiveTagFilters: (filters) => set({ activeTagFilters: filters }),
  setActiveDays: (days) => set({ activeDays: days }),
  setShowStarredOnly: (show) => set({ showStarredOnly: show }),
  setFilterStudyLater: (filter) => set({ filterStudyLater: filter }),
  setShowArchivedOnly: (show) => set({ showArchivedOnly: show }),
  setQueueFilter: (filter) => set({ queueFilter: filter }),
  setTypeFilter: (filter) => set({ typeFilter: filter }),
  setUnreadOnly: (only) => set({ unreadOnly: only }),
  setSortOption: (option) => set({ sortOption: option }),
  setFilterPresets: (presets) => set({ filterPresets: presets }),
  setShowPresetsDropdown: (show) => set({ showPresetsDropdown: show }),
  setPresetNameInput: (input) => set({ presetNameInput: input }),
  setShowPresetSaveInput: (show) => set({ showPresetSaveInput: show }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setDeleteToast: (toast) => set({ deleteToast: toast }),
  setBatchCollectionPickerOpen: (open) => set({ batchCollectionPickerOpen: open }),
  setFlashIds: (ids) => set({ flashIds: ids }),
  setVisibleCount: (count) => set({ visibleCount: count }),
  setDetailCacheVersion: (version) => set({ detailCacheVersion: version }),
}));
