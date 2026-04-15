import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import type { KnowledgeItemPreview, KnowledgeItemDetail } from './api.ts';
import { api, BASE, type TagsResponse, type TagStatsResponse, type ReadingStatsResponse, type Collection, type Feed, type StatsSummary, type FilterPreset } from './api.ts';
import { itemToQueueEntry, type QueueLogEntry } from './src/features/queue/index.ts';
import { makeEphemeralItem } from './src/features/knowledge-ingest/domain/ephemeral.ts';
import type { EphemeralItem } from './src/types.ts';
import { KnowledgePage, IngestPage } from './src/pages/index.ts';
import { queryClient } from './src/data/queryClient.ts';
import { useFilterStore, useTypeFilter, useUnreadOnly, useShowStarredOnly, useFilterStudyLater, useShowArchivedOnly, useActiveTagFilters, useActiveDays, useSortOption, useQueueFilter } from './src/stores/filterStore.ts';
import { useUiStore, useShowTagsPanel, useShowSettingsPanel, useShowQueuePanel, useShowCollectionsPanel, useShowStatsPanel, useShowTagCloud, useShowPresetsDropdown, useShowPresetSaveInput, useShowAllSources, useShowStreakPopover, useShowSourcesPopover, useShowQuickCapture, useShowBulkAdd, useShowShortcuts, useBatchCollectionPickerOpen, useDeleteToast, useShareToast, useTheme, useOllamaDismissed } from './src/stores/uiStore.ts';
import { useSearchStore, useSearchText, useSearchQuery, useSearchHistory, useSearchFocused } from './src/stores/searchStore.ts';
import { useListStore, useSelectedId, useSelectedIds, useVisibleCount } from './src/stores/listStore.ts';
import { useSettingsStore, useNotificationsOn, usePresetNameInput } from './src/stores/settingsStore.ts';
import { useItemsQuery } from './src/data/apiClient/useItemsQuery.ts';
import { useCollectionsQuery } from './src/data/apiClient/useCollectionsQuery.ts';
import { useItemsInCollectionQuery } from './src/data/apiClient/useItemsInCollectionQuery.ts';
import { useItemDetailQuery, ITEM_DETAIL_QUERY_KEY } from './src/data/apiClient/useItemDetailQuery.ts';
import { useQueryClient } from '@tanstack/react-query';
import { useQueueLogQuery } from './src/data/apiClient/useQueueLogQuery.ts';
import { useReadingStatsQuery } from './src/data/apiClient/useReadingStatsQuery.ts';
import { useDomainStatsQuery } from './src/data/apiClient/useDomainStatsQuery.ts';
import { useOllamaStatusQuery } from './src/data/apiClient/useOllamaStatusQuery.ts';
import { useTagsQuery } from './src/data/apiClient/useTagsQuery.ts';
import { useTagStatsQuery } from './src/data/apiClient/useTagStatsQuery.ts';
import { useTagSuggestionsQuery } from './src/data/apiClient/useTagSuggestionsQuery.ts';
import { useFilterPresetsQuery } from './src/data/apiClient/useFilterPresetsQuery.ts';
import { useToggleStarMutation } from './src/data/apiClient/useToggleStarMutation.ts';
import { useTogglePinMutation, useArchiveItemMutation, useDeleteItemMutation, useRateItemMutation, useMarkReadMutation, useMarkUnreadMutation, useToggleStudyLaterMutation } from './src/data/apiClient/useItemMutations.ts';
import { useApproveTagMutation, useRejectTagMutation } from './src/data/apiClient/useTagMutations.ts';
import { useRetryItemMutation } from './src/data/apiClient/useQueueMutations.ts';
import { useCreateCollectionMutation, useAddItemToCollectionMutation, useRemoveItemFromCollectionMutation, useBatchAddToCollectionMutation, useRenameCollectionMutation, useDeleteCollectionMutation } from './src/data/apiClient/useCollectionMutations.ts';
import { useBatchDeleteMutation } from './src/data/apiClient/useBatchDeleteMutation.ts';
import { useSaveFilterPresetMutation, useDeleteFilterPresetMutation } from './src/data/apiClient/useFilterPresetMutations.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

type TagData = TagsResponse;

// ── Type guards ───────────────────────────────────────────────────────────────

/** Type predicate: narrows unknown to Record<string, unknown> after a runtime check. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ── ErrorBoundary ─────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <span className="error-boundary-msg">
            {this.props.label ?? 'Component'} error: {this.state.error.message}
          </span>
          <button
            className="error-boundary-retry"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────

const SEARCH_HISTORY_KEY = 'kb-search-history';
const MAX_HISTORY = 10;

function loadSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveSearchHistory(history: string[]): void {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function AppShell(): React.JSX.Element {
  // React Query client for imperative cache patches (ReaderPane reloads).
  const queryClient = useQueryClient();

  // React Query hooks for server data — consumed directly, no useState duplication
  const { data: items = [], isLoading } = useItemsQuery();
  const { data: tagData = { approved: [], pending: [], rejected: [] } } = useTagsQuery();
  const { data: tagStats = null } = useTagStatsQuery();
  const { data: tagSuggestions = [] } = useTagSuggestionsQuery();
  const { data: filterPresets = [] } = useFilterPresetsQuery();
  const { data: queueLog = [] } = useQueueLogQuery();
  const { data: readingStats = null } = useReadingStatsQuery();
  const { data: domainStats = [] } = useDomainStatsQuery();
  const { data: ollamaStatus = null } = useOllamaStatusQuery();
  const { data: collections = [] } = useCollectionsQuery();

  // Derived from hook data, not state
  const tagSuggestionsCount = tagSuggestions.length;
  const ollamaOk = ollamaStatus?.ok ?? null;

  // Mutations for server operations with cache invalidation
  const starMutation = useToggleStarMutation();
  const pinMutation = useTogglePinMutation();
  const archiveMutation = useArchiveItemMutation();
  const deleteMutation = useDeleteItemMutation();
  const rateMutation = useRateItemMutation();
  const markReadMutation = useMarkReadMutation();
  const markUnreadMutation = useMarkUnreadMutation();
  const studyLaterMutation = useToggleStudyLaterMutation();
  const approveTagMutation = useApproveTagMutation();
  const rejectTagMutation = useRejectTagMutation();
  const retryItemMutation = useRetryItemMutation();
  const createCollectionMutation = useCreateCollectionMutation();
  const addToCollectionMutation = useAddItemToCollectionMutation();
  const removeFromCollectionMutation = useRemoveItemFromCollectionMutation();
  const batchAddToCollectionMutation = useBatchAddToCollectionMutation();
  const renameCollectionMutation = useRenameCollectionMutation();
  const deleteCollectionMutation = useDeleteCollectionMutation();
  const savePresetMutation = useSaveFilterPresetMutation();
  const deletePresetMutation = useDeleteFilterPresetMutation();
  const batchDeleteMutation = useBatchDeleteMutation();

  // True local UI state (not server data)
  const [tagStatusMap, setTagStatusMap] = useState<Record<string, string>>({});
  const [semanticMode, setSemanticMode] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [semanticResults, setSemanticResults] = useState<KnowledgeItemPreview[] | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [ftsResults, setFtsResults] = useState<KnowledgeItemPreview[] | null>(null);
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  // Items in the ACTIVE collection — fetched from the server when activeCollectionId
  // is non-null. Before Pass 1 this was a union across ALL collections, so selecting
  // a specific collection did not actually filter the list. React Query handles
  // invalidation on collection mutations.
  const { data: itemsInCollections } = useItemsInCollectionQuery(activeCollectionId);
  const [ephemeralItems, setEphemeralItems] = useState<EphemeralItem[]>([]);
  const prevItemsRef = useRef<KnowledgeItemPreview[]>([]);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listPaneRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Store selectors - Filter state
  const typeFilter = useTypeFilter();
  const unreadOnly = useUnreadOnly();
  const showStarredOnly = useShowStarredOnly();
  const filterStudyLater = useFilterStudyLater();
  const showArchivedOnly = useShowArchivedOnly();
  const activeTagFilters = useActiveTagFilters();
  const activeDays = useActiveDays();
  const sortOption = useSortOption();
  const queueFilter = useQueueFilter();
  const setTypeFilter = useFilterStore((s) => s.setTypeFilter);
  const setUnreadOnly = useFilterStore((s) => s.setUnreadOnly);
  const setShowStarredOnly = useFilterStore((s) => s.setShowStarredOnly);
  const setFilterStudyLater = useFilterStore((s) => s.setFilterStudyLater);
  const setShowArchivedOnly = useFilterStore((s) => s.setShowArchivedOnly);
  const setActiveTagFilters = useFilterStore((s) => s.setActiveTagFilters);
  const toggleTagFilter = useFilterStore((s) => s.toggleTagFilter);
  const setActiveDays = useFilterStore((s) => s.setActiveDays);
  const setSortOption = useFilterStore((s) => s.setSortOption);
  const setQueueFilter = useFilterStore((s) => s.setQueueFilter);

  // Store selectors - UI state
  const showTagsPanel = useShowTagsPanel();
  const showSettingsPanel = useShowSettingsPanel();
  const showQueuePanel = useShowQueuePanel();
  const showCollectionsPanel = useShowCollectionsPanel();
  const showStatsPanel = useShowStatsPanel();
  const showTagCloud = useShowTagCloud();
  const showPresetsDropdown = useShowPresetsDropdown();
  const showPresetSaveInput = useShowPresetSaveInput();
  const showAllSources = useShowAllSources();
  const showStreakPopover = useShowStreakPopover();
  const showSourcesPopover = useShowSourcesPopover();
  const showQuickCapture = useShowQuickCapture();
  const showBulkAdd = useShowBulkAdd();
  const showShortcuts = useShowShortcuts();
  const batchCollectionPickerOpen = useBatchCollectionPickerOpen();
  const deleteToast = useDeleteToast();
  const shareToast = useShareToast();
  const theme = useTheme();
  const ollamaDismissed = useOllamaDismissed();
  const { setShowTagsPanel, setShowSettingsPanel, setShowQueuePanel, setShowCollectionsPanel, setShowStatsPanel, setShowTagCloud, setShowPresetsDropdown, setShowPresetSaveInput, setShowAllSources, setShowStreakPopover, setShowSourcesPopover, setShowQuickCapture, setShowBulkAdd, setShowShortcuts, setBatchCollectionPickerOpen, setDeleteToast, setShareToast, setTheme, toggleTheme: toggleThemeStore, setOllamaDismissed } = useUiStore();

  // Store selectors - Search state
  const searchText = useSearchText();
  const searchQuery = useSearchQuery();
  const searchHistory = useSearchHistory();
  const searchFocused = useSearchFocused();
  const { setSearchText, setSearchQuery, addToSearchHistory, setSearchHistory: setSearchHistoryStore, setSearchFocused } = useSearchStore();

  // Store selectors - List state
  const selectedId = useSelectedId();
  const selectedIds = useSelectedIds();
  const visibleCount = useVisibleCount();
  const { setSelectedId, toggleSelect, clearSelection, setVisibleCount } = useListStore();

  // Item-detail query — skipped for null/ephemeral IDs. The detail query replaces
  // the old local detailCache ref; React Query owns the cache and invalidation.
  const isEphemeralSelection = selectedId?.startsWith('preview-') ?? false;
  const detailQueryId = selectedId && !isEphemeralSelection ? selectedId : null;
  const { data: selectedItemDetail } = useItemDetailQuery(detailQueryId);

  // Store selectors - Settings state
  const notificationsOn = useNotificationsOn();
  const presetNameInput = usePresetNameInput();
  const { setNotificationsOn, setPresetNameInput } = useSettingsStore();

  // Load theme from settings on mount
  useEffect(() => {
    api.getSettings().then((s) => {
      const t = s['theme'] ?? 'dark';
      const resolved: 'dark' | 'light' = t === 'light' ? 'light' : 'dark';
      setTheme(resolved);
      document.body.classList.toggle('theme-light', resolved === 'light');
      document.body.classList.toggle('theme-dark', resolved === 'dark');
      setNotificationsOn((s['notifications_enabled'] ?? '0') === '1');
    }).catch(() => {});
  }, [setTheme, setNotificationsOn]);

  function toggleTheme(): void {
    const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    toggleThemeStore();
    document.body.classList.toggle('theme-light', next === 'light');
    document.body.classList.toggle('theme-dark', next === 'dark');
    api.updateSetting('theme', next).catch(() => {});
  }

  // Manage ollamaDismissed when Ollama status changes
  useEffect(() => {
    if (ollamaOk === true) {
      setOllamaDismissed(false);
    }
  }, [ollamaOk]);

  // Sort options
  type SortOption = 'newest' | 'oldest' | 'recently-read' | 'highest-rated' | 'most-starred' | 'title-az' | 'title-za';
  const SORT_OPTIONS: readonly SortOption[] = ['newest', 'oldest', 'recently-read', 'highest-rated', 'most-starred', 'title-az', 'title-za'];

  function handleSortChange(opt: SortOption): void {
    setSortOption(opt);
  }

  const selectionMode = selectedIds.size > 0;

  async function handleBatchStar(): Promise<void> {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => starMutation.mutate(id));
  }

  async function handleBatchDelete(): Promise<void> {
    const ids = Array.from(selectedIds);
    if (!window.confirm(`Delete ${ids.length} item${ids.length !== 1 ? 's' : ''}?`)) return;
    batchDeleteMutation.mutate(ids);
    clearSelection();
    setDeleteToast(`Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
    setTimeout(() => setDeleteToast(null), 2500);
  }

  function handleBatchExport(): void {
    const ids = Array.from(selectedIds);
    window.open(`${BASE}/export/json?ids=${ids.join(',')}`, '_blank');
  }

  async function handleBatchAddToCollection(collectionId: string): Promise<void> {
    const ids = Array.from(selectedIds);
    const col = collections.find((c) => c.id === collectionId);
    setBatchCollectionPickerOpen(false);
    batchAddToCollectionMutation.mutate({ collectionId, ids });
    setDeleteToast(`Added ${ids.length} item${ids.length !== 1 ? 's' : ''} to ${col?.name ?? 'collection'}`);
    setTimeout(() => setDeleteToast(null), 2500);
  }

  // Handle an item-updated SSE event: refresh that item and sync UI state
  const handleItemUpdate = useCallback((data: { id: string; status: string; title?: string }) => {
    // Reload the full items list to get fresh data
    loadItems();
    // Also refresh the queue log so queued/processing items appear immediately
    refreshQueueLog();
  }, []);

  // Load everything on mount; use SSE for live updates with 5s polling fallback
  useEffect(() => {
    loadItems();
    loadTags();
    refreshQueueLog();
    // React Query manages tag suggestions
    // Respect ?item= URL param on load
    const urlParam = new URLSearchParams(window.location.search).get('item');
    if (urlParam) {
      setSelectedId(urlParam);
    }

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let sseConnected = false;

    const es = new EventSource('http://127.0.0.1:3737/events');

    // If SSE doesn't connect within 5 seconds, fall back to polling
    const fallbackTimer = setTimeout(() => {
      if (!sseConnected) {
        pollInterval = setInterval(loadItems, 5000);
      }
    }, 5000);

    es.addEventListener('item-updated', (e: MessageEvent) => {
      sseConnected = true;
      try {
        const parsed: unknown = JSON.parse(e.data);
        if (isRecord(parsed)) {
          const id = typeof parsed.id === 'string' ? parsed.id : '';
          const status = typeof parsed.status === 'string' ? parsed.status : '';
          const title = typeof parsed.title === 'string' ? parsed.title : undefined;
          if (id && status) handleItemUpdate({ id, status, ...(title !== undefined ? { title } : {}) });
        }
      } catch {}
    });

    es.addEventListener('open', () => {
      sseConnected = true;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    });

    es.addEventListener('error', () => {
      if (!sseConnected && !pollInterval) {
        pollInterval = setInterval(loadItems, 5000);
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      es.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Debounce search input
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      // #tag shortcut: treat as tag filter
      if (searchText.startsWith('#')) {
        const tag = searchText.slice(1).trim();
        if (tag) {
          if (!activeTagFilters.includes(tag)) {
            setActiveTagFilters([...activeTagFilters, tag]);
          }
          setSearchText('');
          setSearchQuery('');
        }
        return;
      }
      setSearchQuery(searchText);
      // Save non-empty queries to history
      if (searchText.trim()) {
        addToSearchHistory(searchText.trim());
      }
    }, 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchText]);

  // Semantic search: fetch when mode is on and query changes
  useEffect(() => {
    if (!semanticMode || !searchQuery) {
      setSemanticResults(null);
      return;
    }
    setSemanticLoading(true);
    api.semanticSearch(searchQuery)
      .then((results) => { setSemanticResults(results); })
      .catch(() => { setSemanticResults([]); })
      .finally(() => setSemanticLoading(false));
  }, [semanticMode, searchQuery]);

  // FTS search: fetch snippets from server when query changes (non-semantic)
  useEffect(() => {
    if (semanticMode || !searchQuery) {
      setFtsResults(null);
      return;
    }
    api.searchItems(searchQuery)
      .then((results) => { setFtsResults(results); })
      .catch(() => { setFtsResults(null); });
  }, [semanticMode, searchQuery]);

  async function loadItems(): Promise<void> {
    try {
      const items = await api.getItems();
      // Detect transitions to 'done' for green flash
      const prev = prevItemsRef.current;
      const newlyDone = items
        .filter((it) => it.status === 'done')
        .filter((it) => {
          const old = prev.find((p) => p.id === it.id);
          return old && old.status !== 'done';
        })
        .map((it) => it.id);
      if (newlyDone.length > 0) {
        const next = new Set([...flashIds, ...newlyDone]);
        setFlashIds(next);
        setTimeout(() => {
          const cleared = new Set(flashIds);
          newlyDone.forEach((id) => cleared.delete(id));
          setFlashIds(cleared);
        }, 1500);
        // Browser notifications for newly done items
        if (notificationsOn && 'Notification' in window && Notification.permission === 'granted') {
          for (const id of newlyDone) {
            const it = items.find((x) => x.id === id);
            if (it?.title) {
              new Notification('✓ Knowledge Base', { body: it.title, icon: '/favicon.ico' });
            }
          }
        }
      }
      prevItemsRef.current = items;
      // React Query now manages items - this function can be deleted in future refactor
      // Sync queue log statuses from server items
      syncQueueLogFromItems(items);
    } catch {} finally {
      // React Query manages loading state
    }
  }

  function refreshQueueLog(): void {
    // React Query manages queue log - this can be replaced with queryClient.invalidateQueries()
    api.getRecentItems(20, true)
      .catch(() => {});
  }

  function syncQueueLogFromItems(items: KnowledgeItemPreview[]): void {
    // With server-sourced queue log, a fresh fetch is the canonical sync
    refreshQueueLog();
  }

  function addToQueueLog(_id: string, _url: string): void {
    // After submit, server has the item — just refresh from server
    refreshQueueLog();
  }

  function handleRetryItem(entry: QueueLogEntry): Promise<void> {
    retryItemMutation.mutate(entry.id);
    return Promise.resolve();
  }

  function clearCompletedFromLog(): void {
    // Hide done items from UI via clearedIds; items remain in DB
    const next = new Set(clearedIds);
    queueLog.filter((e) => e.status === 'done').forEach((e) => next.add(e.id));
    setClearedIds(next);
  }

  async function loadTags(): Promise<void> {
    // React Query manages tagData - this can be removed in future refactor
    try {
      const data = await api.getTags();
      const map: Record<string, string> = {};
      for (const t of data.approved) map[t] = 'approved';
      for (const t of data.rejected) map[t] = 'rejected';
      for (const p of data.pending) map[p.tag] = 'pending';
      setTagStatusMap(map);
    } catch {}
  }

  /** Refresh tag-stats and tag-suggestions caches. */
  function loadTagStats(): void {
    queryClient.invalidateQueries({ queryKey: ['tag-stats'] });
    queryClient.invalidateQueries({ queryKey: ['tag-suggestions'] });
  }

  // Select an item: set the selection and mark read. Full-detail fetch is
  // owned by useItemDetailQuery, which re-runs automatically when selectedId
  // changes, so no manual cache bookkeeping is needed here.
  function selectItem(item: KnowledgeItemPreview | EphemeralItem): void {
    setSelectedId(item.id);
    if (!('_ephemeral' in item) || item._ephemeral !== true) {
      markReadMutation.mutate(item.id);
    }
  }

  // Queue counts
  const processingItems = useMemo(
    () => items.filter((it) => it.status === 'processing' || it.status === 'queued'),
    [items]
  );
  const errorItems = useMemo(
    () => items.filter((it) => it.status === 'error'),
    [items]
  );

  // Filtering
  const filteredItems = useMemo(() => {
    // Queue filter overrides everything
    if (queueFilter === 'processing') return [...processingItems, ...errorItems];
    if (queueFilter === 'error') return errorItems;

    // Semantic mode: use server results directly
    if (semanticMode && searchQuery && semanticResults !== null) {
      return semanticResults;
    }

    // FTS mode: use server results with snippets when available
    if (!semanticMode && searchQuery && ftsResults !== null) {
      return ftsResults;
    }

    let filtered = items.filter((it) => it.status === 'done');

    // Archived filter: show archived OR non-archived, not both
    if (showArchivedOnly) {
      filtered = filtered.filter((it) => !!it.archived);
    } else {
      filtered = filtered.filter((it) => !it.archived);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((it) =>
        it.title?.toLowerCase().includes(q) ||
        it.summary?.toLowerCase().includes(q)
      );
    }

    if (activeTagFilters.length) {
      filtered = filtered.filter((it) =>
        activeTagFilters.every((tag) => (it.tags ?? []).includes(tag))
      );
    }

    if (activeDays > 0) {
      const cutoff = Date.now() - activeDays * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((it) => new Date(it.createdAt).getTime() >= cutoff);
    }

    if (showStarredOnly) {
      filtered = filtered.filter((it) => !!it.starred);
    }

    if (filterStudyLater) {
      filtered = filtered.filter((it) => !!it.studyLater);
    }

    if (activeCollectionId) {
      filtered = filtered.filter((it) => itemsInCollections.has(it.id));
    }

    if (typeFilter !== 'all') {
      if (typeFilter === 'pdf') {
        filtered = filtered.filter((it) => it.url.toLowerCase().endsWith('.pdf'));
      } else {
        filtered = filtered.filter((it) => it.type === typeFilter);
      }
    }

    if (unreadOnly) {
      filtered = filtered.filter((it) => !it.readAt);
    }

    // Apply sort (pinned items always float to top)
    filtered = [...filtered].sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (bPinned !== aPinned) return bPinned - aPinned;
      if (sortOption === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortOption === 'title-az') return (a.title ?? a.url).localeCompare(b.title ?? b.url);
      if (sortOption === 'title-za') return (b.title ?? b.url).localeCompare(a.title ?? a.url);
      if (sortOption === 'recently-read') {
        if (a.readAt && b.readAt) return new Date(b.readAt).getTime() - new Date(a.readAt).getTime();
        if (a.readAt) return -1;
        if (b.readAt) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortOption === 'highest-rated') {
        const aRating = a.rating ?? 0;
        const bRating = b.rating ?? 0;
        if (bRating !== aRating) return bRating - aRating;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortOption === 'most-starred') {
        const aStarred = a.starred ? 1 : 0;
        const bStarred = b.starred ? 1 : 0;
        if (bStarred !== aStarred) return bStarred - aStarred;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [items, searchQuery, activeTagFilters, activeDays, queueFilter, processingItems, errorItems, semanticMode, semanticResults, ftsResults, showStarredOnly, filterStudyLater, showArchivedOnly, sortOption, activeCollectionId, itemsInCollections, typeFilter, unreadOnly]);

  // Reset visible window when filters change
  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, activeTagFilters, activeDays, queueFilter, showStarredOnly, filterStudyLater, showArchivedOnly, sortOption, activeCollectionId, typeFilter, unreadOnly]);

  // Infinite scroll: load more when sentinel enters view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) setVisibleCount(visibleCount + 20); },
      { root: listPaneRef.current }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [visibleCount, filteredItems, setVisibleCount]);

  // Use React Query item-detail if available, otherwise fall back to the preview
  // shape from the items list. Ephemeral items are looked up from local state.
  const selectedItem = useMemo((): KnowledgeItemDetail | KnowledgeItemPreview | EphemeralItem | null => {
    if (!selectedId) return null;
    if (selectedId.startsWith('preview-')) {
      return ephemeralItems.find((it) => it.id === selectedId) ?? null;
    }
    return selectedItemDetail ?? items.find((it) => it.id === selectedId) ?? null;
  }, [items, selectedId, ephemeralItems, selectedItemDetail]);

  const filteredItemsRef = useRef(filteredItems);
  const selectedIdRef = useRef(selectedId);
  filteredItemsRef.current = filteredItems;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      // Ctrl+Shift+A / Cmd+Shift+A — open Bulk Add
      if (e.key === 'A' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowBulkAdd(true);
        return;
      }
      // Ctrl+L / Cmd+L — quick capture
      if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowQuickCapture(true);
        return;
      }
      if (e.key === '/') {
        if (!inInput) { e.preventDefault(); searchInputRef.current?.focus(); }
        return;
      }
      if (e.key === 'Escape') {
        if (inInput) { e.target.blur(); setSearchText(''); }
        else { setSearchText(''); setSelectedId(null); }
        return;
      }
      if (e.key === '?') {
        if (!inInput) setShowShortcuts(!showShortcuts);
        return;
      }
      if (inInput) return;
      const items = filteredItemsRef.current;
      const curId = selectedIdRef.current;
      const curIdx = items.findIndex((it) => it.id === curId);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = items[curIdx < items.length - 1 ? curIdx + 1 : 0];
        if (next) {
          setSelectedId(next.id);
          listPaneRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[curIdx <= 0 ? items.length - 1 : curIdx - 1];
        if (prev) {
          setSelectedId(prev.id);
          listPaneRef.current?.querySelector<HTMLElement>(`[data-id="${prev.id}"]`)?.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      if (e.key === 'Enter') {
        const cur = items.find((it) => it.id === curId);
        if (cur) selectItem(cur);
        return;
      }
      if (e.key === 'r') {
        const cur = items.find((it) => it.id === curId);
        if (!cur) return;
        if (cur.readAt) {
          markUnreadMutation.mutate(cur.id);
        } else {
          markReadMutation.mutate(cur.id);
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [items, markReadMutation, markUnreadMutation]);

  function addTagFilter(tag: string): void {
    if (!activeTagFilters.includes(tag)) {
      setActiveTagFilters([...activeTagFilters, tag]);
    }
  }

  function removeTagFilter(tag: string): void {
    setActiveTagFilters(activeTagFilters.filter((t) => t !== tag));
  }

  function clearAll(): void {
    setSearchText('');
    setActiveTagFilters([]);
    setActiveDays(0);
    setShowStarredOnly(false);
    setFilterStudyLater(false);
    setShowArchivedOnly(false);
    setActiveCollectionId(null);
  }

  function shareItem(id: string): void {
    const url = `http://127.0.0.1:3737/?item=${encodeURIComponent(id)}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }).catch(() => {});
  }

  function removeFromHistory(term: string): void {
    const next = searchHistory.filter((s) => s !== term);
    setSearchHistoryStore(next);
  }

  function clearHistory(): void {
    setSearchHistoryStore([]);
  }

  const hasFilters = searchText || activeTagFilters.length > 0 || activeDays > 0 || showStarredOnly || filterStudyLater || showArchivedOnly || !!activeCollectionId;

  async function handleStar(id: string): Promise<void> {
    starMutation.mutate(id);
  }

  async function handlePin(id: string): Promise<void> {
    pinMutation.mutate(id);
  }

  async function handleArchive(id: string): Promise<void> {
    archiveMutation.mutate(id);
  }

  async function handleStudyLater(id: string): Promise<void> {
    studyLaterMutation.mutate(id);
  }

  async function handleDelete(id: string): Promise<void> {
    deleteMutation.mutate(id);
    setSelectedId(null);
  }

  async function handleRate(id: string, rating: number): Promise<void> {
    rateMutation.mutate({ id, rating });
  }

  async function handleTagAction(action: 'approve' | 'reject', tag: string, itemId: string, reason?: string): Promise<void> {
    if (action === 'approve') {
      approveTagMutation.mutate(tag);
    } else {
      rejectTagMutation.mutate({ tag, itemId, reason: reason ?? '' });
    }
  }

  async function handleCollectionCreate(name: string, itemId?: string): Promise<void> {
    try {
      const result = await createCollectionMutation.mutateAsync(name);
      if (itemId) await addToCollectionMutation.mutateAsync({ collectionId: result.id, itemId });
    } catch {}
  }

  async function handleCollectionToggle(collectionId: string, itemId: string, inCollection: boolean): Promise<void> {
    if (inCollection) {
      removeFromCollectionMutation.mutate({ collectionId, itemId });
    } else {
      addToCollectionMutation.mutate({ collectionId, itemId });
    }
  }

  async function handleCollectionRename(id: string, name: string): Promise<void> {
    renameCollectionMutation.mutate({ id, name });
  }

  async function handleCollectionDelete(id: string): Promise<void> {
    deleteCollectionMutation.mutate(id);
    if (activeCollectionId === id) setActiveCollectionId(null);
  }

  async function handleLoadPreset(preset: FilterPreset): Promise<void> {
    setSearchText(preset.searchQuery ?? '');
    setActiveTagFilters(preset.tagFilter ?? []);
    setActiveDays(preset.dateFilter ? parseInt(preset.dateFilter, 10) || 0 : 0);
    setSemanticMode(preset.semanticMode);
    setShowStarredOnly(preset.showStarredOnly);
    setShowPresetsDropdown(false);
  }

  async function handleSavePreset(): Promise<void> {
    const name = presetNameInput.trim();
    if (!name) return;
    const presetFilters: Parameters<typeof api.saveFilterPreset>[1] = {};
    if (searchText) presetFilters.searchQuery = searchText;
    if (activeTagFilters.length > 0) presetFilters.tagFilter = activeTagFilters;
    if (activeDays > 0) presetFilters.dateFilter = String(activeDays);
    if (semanticMode) presetFilters.semanticMode = semanticMode;
    if (showStarredOnly) presetFilters.showStarredOnly = showStarredOnly;
    savePresetMutation.mutate({ name, filters: presetFilters });
    setPresetNameInput('');
    setShowPresetSaveInput(false);
  }

  async function handleDeletePreset(id: string): Promise<void> {
    deletePresetMutation.mutate(id);
  }

  const hasActiveFilters = !!(searchText || activeTagFilters.length > 0 || activeDays > 0 || showStarredOnly);

  // ── Router shell ─────────────────────────────────────────────────────────────
  // BrowserRouter wraps the app. "/" renders the full KnowledgePage shell (all
  // existing state is wired here). "/ingest" renders the self-contained
  // IngestPage. "/item/:id" is declared for future use by KnowledgeReaderPage.
  const knowledgePageElement = (
    <KnowledgePage
      // Items
      allItems={items}
      filteredItems={filteredItems}
      loading={isLoading}
      visibleCount={visibleCount}
      selectedItem={selectedItem}
      selectedId={selectedId}
      ephemeralItems={ephemeralItems}
      flashIds={flashIds}
      itemsInCollections={itemsInCollections}

      // Search
      searchText={searchText}
      searchQuery={searchQuery}
      searchHistory={searchHistory}
      searchFocused={searchFocused}
      semanticMode={semanticMode}
      semanticLoading={semanticLoading}
      searchInputRef={searchInputRef}
      onSearchTextChange={setSearchText}
      onSearchFocus={() => setSearchFocused(true)}
      onSearchBlur={() => setTimeout(() => setSearchFocused(false), 150)}
      onSemanticModeChange={setSemanticMode}
      onSearchHistorySelect={setSearchText}
      onRemoveFromHistory={removeFromHistory}
      onClearHistory={clearHistory}

      // Tags / filters
      tagData={tagData}
      tagStatusMap={tagStatusMap}
      tagSuggestionsCount={tagSuggestionsCount}
      activeTagFilters={activeTagFilters}
      activeDays={activeDays}
      showStarredOnly={showStarredOnly}
      filterStudyLater={filterStudyLater}
      showArchivedOnly={showArchivedOnly}
      hasFilters={!!hasFilters}
      hasActiveFilters={hasActiveFilters}
      sortOption={sortOption}
      typeFilter={typeFilter}
      unreadOnly={unreadOnly}
      onAddTagFilter={addTagFilter}
      onRemoveTagFilter={removeTagFilter}
      onSetActiveDays={setActiveDays}
      onSetShowStarredOnly={setShowStarredOnly}
      onSetFilterStudyLater={setFilterStudyLater}
      onSetShowArchivedOnly={setShowArchivedOnly}
      onClearAll={clearAll}
      onSortChange={handleSortChange}
      onTypeFilterChange={setTypeFilter}
      onSetUnreadOnly={setUnreadOnly}

      // Filter presets
      filterPresets={filterPresets}
      showPresetsDropdown={showPresetsDropdown}
      showPresetSaveInput={showPresetSaveInput}
      presetNameInput={presetNameInput}
      onTogglePresetsDropdown={() => setShowPresetsDropdown(!showPresetsDropdown)}
      onLoadPreset={handleLoadPreset}
      onSavePreset={handleSavePreset}
      onDeletePreset={handleDeletePreset}
      onSetPresetNameInput={setPresetNameInput}
      onSetShowPresetSaveInput={setShowPresetSaveInput}

      // Item actions
      onSelectItem={selectItem}
      onSetSelectedId={setSelectedId}
      onStar={handleStar}
      onPin={handlePin}
      onShare={shareItem}
      onToggleSelect={toggleSelect}
      onDelete={handleDelete}
      onArchive={handleArchive}
      onRate={handleRate}
      onStudyLater={handleStudyLater}
      onTagAction={handleTagAction}
      onItemReloaded={(item) => { queryClient.setQueryData(ITEM_DETAIL_QUERY_KEY(item.id), item); }}
      onEphemeralDismiss={(id) => {
        setEphemeralItems((prev) => prev.filter((i) => i.id !== id));
        if (selectedId === id) setSelectedId(null);
      }}
      listPaneRef={listPaneRef}
      sentinelRef={sentinelRef}

      // Batch selection
      selectedIds={selectedIds}
      selectionMode={selectionMode}
      batchCollectionPickerOpen={batchCollectionPickerOpen}
      onBatchStar={handleBatchStar}
      onBatchDelete={handleBatchDelete}
      onBatchExport={handleBatchExport}
      onBatchAddToCollection={handleBatchAddToCollection}
      onClearSelection={clearSelection}
      onSetBatchCollectionPickerOpen={setBatchCollectionPickerOpen}

      // Queue
      queueLog={queueLog}
      clearedIds={clearedIds}
      processingItems={processingItems}
      errorItems={errorItems}
      showQueuePanel={showQueuePanel}
      onRetryItem={handleRetryItem}
      onClearCompleted={clearCompletedFromLog}
      onToggleQueuePanel={() => setShowQueuePanel(!showQueuePanel)}
      onQueueNavigate={(id) => {
        const item = items.find((it) => it.id === id);
        if (item) { selectItem(item); setShowQueuePanel(false); }
      }}
      onAddToQueueLog={addToQueueLog}

      // Panels
      showTagsPanel={showTagsPanel}
      showTagCloud={showTagCloud}
      tagStats={tagStats}
      showSettingsPanel={showSettingsPanel}
      showStatsPanel={showStatsPanel}
      showBulkAdd={showBulkAdd}
      showQuickCapture={showQuickCapture}
      showCollectionsPanel={showCollectionsPanel}
      showShortcuts={showShortcuts}
      onSetShowTagsPanel={setShowTagsPanel}
      onSetShowTagCloud={setShowTagCloud}
      onLoadTagStats={loadTagStats}
      onSetShowSettingsPanel={setShowSettingsPanel}
      onSetShowStatsPanel={setShowStatsPanel}
      onSetShowBulkAdd={setShowBulkAdd}
      onSetShowQuickCapture={setShowQuickCapture}
      onSetShowCollectionsPanel={setShowCollectionsPanel}
      onSetShowShortcuts={setShowShortcuts}
      onPreviewSaved={(result) => {
        const epItem = makeEphemeralItem(result);
        setEphemeralItems((prev) => {
          const deduped = prev.filter((p) => p.url !== result.url);
          return [epItem, ...deduped].slice(0, 10);
        });
        setSelectedId(epItem.id);
      }}

      // Collections
      collections={collections}
      activeCollectionId={activeCollectionId}
      onSetActiveCollectionId={setActiveCollectionId}
      onCollectionCreate={handleCollectionCreate}
      onCollectionRename={handleCollectionRename}
      onCollectionDelete={handleCollectionDelete}
      onCollectionToggle={handleCollectionToggle}

      // Theme
      theme={theme}
      onToggleTheme={toggleTheme}

      // Reading stats
      readingStats={readingStats}
      domainStats={domainStats}
      showStreakPopover={showStreakPopover}
      showSourcesPopover={showSourcesPopover}
      showAllSources={showAllSources}
      onSetShowStreakPopover={setShowStreakPopover}
      onSetShowSourcesPopover={setShowSourcesPopover}
      onSetShowAllSources={setShowAllSources}

      // Ollama
      ollamaOk={ollamaOk}
      ollamaDismissed={ollamaDismissed}
      onSetOllamaDismissed={setOllamaDismissed}

      // Toasts
      shareToast={shareToast}
      deleteToast={deleteToast}
      queueFilter={queueFilter}
    />
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={knowledgePageElement} />
        <Route path="/item/:id" element={knowledgePageElement} />
        <Route path="/ingest" element={<IngestPage onQueued={(_id, _url) => { void loadItems(); }} />} />
      </Routes>
    </BrowserRouter>
  );
}

function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}

declare global {
  interface Window { __kb_root?: ReturnType<typeof createRoot> }
}
if (!window.__kb_root) {
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Missing #root element — check index.html');
  window.__kb_root = createRoot(rootEl);
}
window.__kb_root.render(<App />);
