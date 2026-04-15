import { create } from 'zustand';
import type { Collection, TagStatsResponse, ReadingStatsResponse } from '../api.ts';

export interface QueueLogEntry {
  id: string;
  url: string;
  submittedAt: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  title?: string;
  error?: string;
}

interface DataState {
  // Queue and processing
  queueLog: QueueLogEntry[];
  clearedIds: Set<string>;

  // Statistics
  tagStats: TagStatsResponse | null;
  readingStats: ReadingStatsResponse | null;
  domainStats: { domain: string; count: number; lastSaved: string }[];
  tagSuggestionsCount: number;

  // Collections
  collections: Collection[];
  itemsInCollections: Set<string>;

  // Ollama status
  ollamaOk: boolean | null;

  // Ephemeral items (in-memory previews) - typed in app.tsx to avoid circular imports
  ephemeralItems: unknown[];

  // Actions
  setQueueLog: (log: QueueLogEntry[]) => void;
  setClearedIds: (ids: Set<string>) => void;
  setTagStats: (stats: TagStatsResponse | null) => void;
  setReadingStats: (stats: ReadingStatsResponse | null) => void;
  setDomainStats: (stats: { domain: string; count: number; lastSaved: string }[]) => void;
  setTagSuggestionsCount: (count: number) => void;
  setCollections: (collections: Collection[]) => void;
  setItemsInCollections: (ids: Set<string>) => void;
  setOllamaOk: (ok: boolean | null) => void;
  setEphemeralItems: (items: unknown[]) => void;
}

export const useDataStore = create<DataState>((set) => ({
  // Initial state
  queueLog: [],
  clearedIds: new Set(),
  tagStats: null,
  readingStats: null,
  domainStats: [],
  tagSuggestionsCount: 0,
  collections: [],
  itemsInCollections: new Set(),
  ollamaOk: null,
  ephemeralItems: [],

  // Action handlers
  setQueueLog: (log) => set({ queueLog: log }),
  setClearedIds: (ids) => set({ clearedIds: ids }),
  setTagStats: (stats) => set({ tagStats: stats }),
  setReadingStats: (stats) => set({ readingStats: stats }),
  setDomainStats: (stats) => set({ domainStats: stats }),
  setTagSuggestionsCount: (count) => set({ tagSuggestionsCount: count }),
  setCollections: (collections) => set({ collections }),
  setItemsInCollections: (ids) => set({ itemsInCollections: ids }),
  setOllamaOk: (ok) => set({ ollamaOk: ok }),
  setEphemeralItems: (items) => set({ ephemeralItems: items }),
}));
