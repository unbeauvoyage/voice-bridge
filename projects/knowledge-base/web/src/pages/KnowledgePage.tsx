/**
 * KnowledgePage — composition shell for the main knowledge base view.
 *
 * This page is PURE COMPOSITION: it imports from feature public APIs,
 * receives all state + callbacks as props, and wires them together into
 * a layout. It does NOT call useState, useEffect, fetch, or useQuery.
 *
 * Phase 3 goal: move state + side effects from App into feature stores,
 * reducing the props surface here until KnowledgePage becomes a zero-prop
 * composition shell.
 *
 * Current state (Phase 2): App holds all state and passes it as props here.
 */

import React from 'react';
import type { KnowledgeItemPreview, KnowledgeItemDetail, TagStatsResponse, Collection, ReadingStatsResponse, FilterPreset, TagsResponse } from '../../api.ts';
import type { QueueLogEntry } from '../features/queue/index.ts';
import type { SortOption, TypeFilter } from '../stores/filterStore.ts';

type TagData = TagsResponse;
import type { EphemeralItem } from '../types.ts';

// Feature imports — always via public index.ts
import { ItemCard, KnowledgeSearchBar, KnowledgeListHeader } from '../features/knowledge-list/index.ts';
import { ReaderPane } from '../features/knowledge-reader/index.ts';
import { BulkAddModal, QuickCaptureModal, makeEphemeralItem } from '../features/knowledge-ingest/index.ts';
import { TagsPanel, TagCloudPanel } from '../features/tags/index.ts';
import { QueuePanel } from '../features/queue/index.ts';
import { CollectionsPanel } from '../features/collections/index.ts';
import { SettingsPanel } from '../features/settings/index.ts';
import { StatsPanel } from '../features/stats/index.ts';

// ── KnowledgePageProps ────────────────────────────────────────────────────────
//
// All state values + callbacks that the page needs to render.
// Phase 3: remove these by moving state into feature stores.

export interface KnowledgePageProps {
  // Items
  allItems: KnowledgeItemPreview[];
  filteredItems: KnowledgeItemPreview[];
  loading: boolean;
  visibleCount: number;
  selectedItem: KnowledgeItemDetail | KnowledgeItemPreview | EphemeralItem | null;
  selectedId: string | null;
  ephemeralItems: EphemeralItem[];
  flashIds: Set<string>;
  itemsInCollections: Set<string>;

  // Search
  searchText: string;
  searchQuery: string;
  searchHistory: string[];
  searchFocused: boolean;
  semanticMode: boolean;
  semanticLoading: boolean;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSearchTextChange: (text: string) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onSemanticModeChange: (on: boolean) => void;
  onSearchHistorySelect: (term: string) => void;
  onRemoveFromHistory: (term: string) => void;
  onClearHistory: () => void;

  // Tags / filters
  tagData: TagData;
  tagStatusMap: Record<string, string>;
  tagSuggestionsCount: number;
  activeTagFilters: string[];
  activeDays: number;
  showStarredOnly: boolean;
  filterStudyLater: boolean;
  showArchivedOnly: boolean;
  hasFilters: boolean;
  hasActiveFilters: boolean;
  sortOption: SortOption;
  typeFilter: TypeFilter;
  unreadOnly: boolean;
  onAddTagFilter: (tag: string) => void;
  onRemoveTagFilter: (tag: string) => void;
  onSetActiveDays: (days: number) => void;
  onSetShowStarredOnly: (v: boolean) => void;
  onSetFilterStudyLater: (v: boolean) => void;
  onSetShowArchivedOnly: (v: boolean) => void;
  onClearAll: () => void;
  onSortChange: (opt: SortOption) => void;
  onTypeFilterChange: (t: TypeFilter) => void;
  onSetUnreadOnly: (v: boolean) => void;

  // Filter presets
  filterPresets: FilterPreset[];
  showPresetsDropdown: boolean;
  showPresetSaveInput: boolean;
  presetNameInput: string;
  onTogglePresetsDropdown: () => void;
  onLoadPreset: (preset: FilterPreset) => void;
  onSavePreset: () => void;
  onDeletePreset: (id: string) => void;
  onSetPresetNameInput: (v: string) => void;
  onSetShowPresetSaveInput: (v: boolean) => void;

  // Item actions
  onSelectItem: (item: KnowledgeItemPreview | EphemeralItem) => void;
  onSetSelectedId: (id: string | null) => void;
  onStar: (id: string) => Promise<void>;
  onPin: (id: string) => Promise<void>;
  onShare: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onRate: (id: string, rating: number) => Promise<void>;
  onStudyLater: (id: string) => Promise<void>;
  onTagAction: (action: 'approve' | 'reject', tag: string, itemId: string, reason?: string) => Promise<void>;
  onItemReloaded: (item: KnowledgeItemDetail) => void;
  onEphemeralDismiss: (id: string) => void;
  listPaneRef: React.RefObject<HTMLDivElement | null>;
  sentinelRef: React.RefObject<HTMLDivElement | null>;

  // Batch selection
  selectedIds: Set<string>;
  selectionMode: boolean;
  batchCollectionPickerOpen: boolean;
  onBatchStar: () => Promise<void>;
  onBatchDelete: () => Promise<void>;
  onBatchExport: () => void;
  onBatchAddToCollection: (collectionId: string) => Promise<void>;
  onClearSelection: () => void;
  onSetBatchCollectionPickerOpen: (v: boolean) => void;

  // Queue
  queueLog: QueueLogEntry[];
  clearedIds: Set<string>;
  processingItems: KnowledgeItemPreview[];
  errorItems: KnowledgeItemPreview[];
  showQueuePanel: boolean;
  onRetryItem: (entry: QueueLogEntry) => Promise<void>;
  onClearCompleted: () => void;
  onToggleQueuePanel: () => void;
  onQueueNavigate: (id: string) => void;
  onAddToQueueLog: (id: string, url: string) => void;

  // Panels
  showTagsPanel: boolean;
  showTagCloud: boolean;
  tagStats: TagStatsResponse | null;
  showSettingsPanel: boolean;
  showStatsPanel: boolean;
  showBulkAdd: boolean;
  showQuickCapture: boolean;
  showCollectionsPanel: boolean;
  showShortcuts: boolean;
  onSetShowTagsPanel: (v: boolean) => void;
  onSetShowTagCloud: (v: boolean) => void;
  onLoadTagStats: () => void;
  onSetShowSettingsPanel: (v: boolean) => void;
  onSetShowStatsPanel: (v: boolean) => void;
  onSetShowBulkAdd: (v: boolean) => void;
  onSetShowQuickCapture: (v: boolean) => void;
  onSetShowCollectionsPanel: (v: boolean) => void;
  onSetShowShortcuts: (v: boolean) => void;
  onPreviewSaved: (result: Parameters<typeof makeEphemeralItem>[0]) => void;

  // Collections
  collections: Collection[];
  activeCollectionId: string | null;
  onSetActiveCollectionId: (id: string | null) => void;
  onCollectionCreate: (name: string, itemId?: string) => Promise<void>;
  onCollectionRename: (id: string, name: string) => Promise<void>;
  onCollectionDelete: (id: string) => Promise<void>;
  onCollectionToggle: (collectionId: string, itemId: string, inCollection: boolean) => Promise<void>;

  // Theme
  theme: 'dark' | 'light';
  onToggleTheme: () => void;

  // Reading stats
  readingStats: ReadingStatsResponse | null;
  domainStats: { domain: string; count: number; lastSaved: string }[];
  showStreakPopover: boolean;
  showSourcesPopover: boolean;
  showAllSources: boolean;
  onSetShowStreakPopover: (v: boolean) => void;
  onSetShowSourcesPopover: (v: boolean) => void;
  onSetShowAllSources: (v: boolean) => void;

  // Ollama
  ollamaOk: boolean | null;
  ollamaDismissed: boolean;
  onSetOllamaDismissed: (v: boolean) => void;

  // Toasts
  shareToast: boolean;
  deleteToast: string | null;

  // Delete toast from batch
  queueFilter: 'processing' | 'error' | null;
}

// ── KnowledgePage ─────────────────────────────────────────────────────────────

export function KnowledgePage(props: KnowledgePageProps): React.JSX.Element {
  const {
    allItems, filteredItems, loading, visibleCount, selectedItem, selectedId,
    ephemeralItems, flashIds, itemsInCollections,
    searchText, searchQuery, searchHistory, searchFocused,
    semanticMode, semanticLoading, searchInputRef,
    onSearchTextChange, onSearchFocus, onSearchBlur, onSemanticModeChange,
    onSearchHistorySelect, onRemoveFromHistory, onClearHistory,
    tagData, tagStatusMap, tagSuggestionsCount,
    activeTagFilters, activeDays, showStarredOnly, filterStudyLater,
    showArchivedOnly, hasFilters, hasActiveFilters, sortOption,
    typeFilter, unreadOnly,
    onAddTagFilter, onRemoveTagFilter, onSetActiveDays,
    onSetShowStarredOnly, onSetFilterStudyLater, onSetShowArchivedOnly,
    onClearAll, onSortChange, onTypeFilterChange, onSetUnreadOnly,
    filterPresets, showPresetsDropdown, showPresetSaveInput, presetNameInput,
    onTogglePresetsDropdown, onLoadPreset, onSavePreset, onDeletePreset,
    onSetPresetNameInput, onSetShowPresetSaveInput,
    onSelectItem, onSetSelectedId, onStar, onPin, onShare, onToggleSelect,
    onDelete, onArchive, onRate, onStudyLater, onTagAction, onItemReloaded,
    onEphemeralDismiss, listPaneRef, sentinelRef,
    selectedIds, selectionMode, batchCollectionPickerOpen,
    onBatchStar, onBatchDelete, onBatchExport, onBatchAddToCollection,
    onClearSelection, onSetBatchCollectionPickerOpen,
    queueLog, clearedIds, processingItems, errorItems,
    showQueuePanel, onRetryItem, onClearCompleted, onToggleQueuePanel,
    onQueueNavigate, onAddToQueueLog,
    showTagsPanel, showTagCloud, tagStats, showSettingsPanel, showStatsPanel,
    showBulkAdd, showQuickCapture, showCollectionsPanel, showShortcuts,
    onSetShowTagsPanel, onSetShowTagCloud, onLoadTagStats,
    onSetShowSettingsPanel, onSetShowStatsPanel, onSetShowBulkAdd,
    onSetShowQuickCapture, onSetShowCollectionsPanel, onSetShowShortcuts,
    onPreviewSaved,
    collections, activeCollectionId, onSetActiveCollectionId,
    onCollectionCreate, onCollectionRename, onCollectionDelete, onCollectionToggle,
    theme, onToggleTheme,
    readingStats, domainStats, showStreakPopover, showSourcesPopover, showAllSources,
    onSetShowStreakPopover, onSetShowSourcesPopover, onSetShowAllSources,
    ollamaOk, ollamaDismissed, onSetOllamaDismissed,
    shareToast, deleteToast, queueFilter,
  } = props;

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <h1>Knowledge Base</h1>

        <KnowledgeSearchBar
          searchText={searchText}
          searchHistory={searchHistory}
          searchFocused={searchFocused}
          semanticMode={semanticMode}
          semanticLoading={semanticLoading}
          searchInputRef={searchInputRef}
          onSearchTextChange={onSearchTextChange}
          onSearchFocus={onSearchFocus}
          onSearchBlur={onSearchBlur}
          onSemanticModeChange={onSemanticModeChange}
          onSearchHistorySelect={onSearchHistorySelect}
          onRemoveFromHistory={onRemoveFromHistory}
          onClearHistory={onClearHistory}
        />

        <KnowledgeListHeader
          searchText={searchText}
          activeTagFilters={activeTagFilters}
          activeDays={activeDays}
          showStarredOnly={showStarredOnly}
          filterStudyLater={filterStudyLater}
          showArchivedOnly={showArchivedOnly}
          hasFilters={hasFilters}
          hasActiveFilters={hasActiveFilters}
          sortOption={sortOption}
          typeFilter={typeFilter}
          unreadOnly={unreadOnly}
          onAddTagFilter={onAddTagFilter}
          onRemoveTagFilter={onRemoveTagFilter}
          onSetActiveDays={onSetActiveDays}
          onSetShowStarredOnly={onSetShowStarredOnly}
          onSetFilterStudyLater={onSetFilterStudyLater}
          onSetShowArchivedOnly={onSetShowArchivedOnly}
          onClearAll={onClearAll}
          onSortChange={onSortChange}
          onTypeFilterChange={onTypeFilterChange}
          onSetUnreadOnly={onSetUnreadOnly}
          filterPresets={filterPresets}
          showPresetsDropdown={showPresetsDropdown}
          showPresetSaveInput={showPresetSaveInput}
          presetNameInput={presetNameInput}
          onTogglePresetsDropdown={onTogglePresetsDropdown}
          onLoadPreset={onLoadPreset}
          onSavePreset={onSavePreset}
          onDeletePreset={onDeletePreset}
          onSetPresetNameInput={onSetPresetNameInput}
          onSetShowPresetSaveInput={onSetShowPresetSaveInput}
          tagSuggestionsCount={tagSuggestionsCount}
          tagPendingCount={tagData.pending.length}
          onSetShowTagsPanel={onSetShowTagsPanel}
          onSetShowBulkAdd={onSetShowBulkAdd}
          onSetShowTagCloud={onSetShowTagCloud}
          onLoadTagStats={onLoadTagStats}
          collections={collections}
          activeCollectionId={activeCollectionId}
          onSetShowCollectionsPanel={onSetShowCollectionsPanel}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onSetShowStatsPanel={onSetShowStatsPanel}
          onSetShowSettingsPanel={onSetShowSettingsPanel}
          onToggleQueuePanel={onToggleQueuePanel}
          processingItems={processingItems}
          errorItems={errorItems}
          onSetShowShortcuts={onSetShowShortcuts}
          showShortcuts={showShortcuts}
        />
      </header>

      {/* Ollama warning bar */}
      {ollamaOk === false && !ollamaDismissed && (
        <div className="ollama-warning">
          <span>&#x26A0;&#xFE0F; Ollama is not running — new items cannot be summarized. Start Ollama to resume processing.</span>
          <button className="ollama-warning-dismiss" onClick={() => onSetOllamaDismissed(true)}>Dismiss</button>
        </div>
      )}

      {/* Reading streak bar */}
      {readingStats && readingStats.totalRead > 0 && (
        <div className="reading-streak-bar">
          <span
            className="reading-streak-summary"
            onClick={() => onSetShowStreakPopover(!showStreakPopover)}
          >
            <span>📚 {readingStats.readToday}/{readingStats.dailyGoal} today</span>
            {readingStats.currentStreak > 0 && (
              <span>🔥 {readingStats.currentStreak} day streak</span>
            )}
          </span>
          <div
            className="reading-goal-bar"
            title={`Daily goal: ${readingStats.readToday} of ${readingStats.dailyGoal}`}
          >
            <div
              className={`reading-goal-bar-fill${readingStats.dailyProgress >= 1 ? ' goal-met' : ''}`}
              style={{ width: `${Math.min(readingStats.dailyProgress * 100, 100)}%` }}
            />
          </div>
          {showStreakPopover && (
            <div className="reading-streak-popover">
              <div className="reading-streak-popover-row">
                <span className="reading-streak-popover-label">Today</span>
                <span className="reading-streak-popover-val">{readingStats.readToday}</span>
              </div>
              <div className="reading-streak-popover-row">
                <span className="reading-streak-popover-label">This week</span>
                <span className="reading-streak-popover-val">{readingStats.readThisWeek}</span>
              </div>
              <div className="reading-streak-popover-row">
                <span className="reading-streak-popover-label">All time</span>
                <span className="reading-streak-popover-val">{readingStats.totalRead}</span>
              </div>
              <div className="reading-streak-popover-row">
                <span className="reading-streak-popover-label">Streak</span>
                <span className="reading-streak-popover-val">{readingStats.currentStreak} day{readingStats.currentStreak !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
          {domainStats.length > 0 && (
            <span className="reading-streak-sources-link" onClick={() => { onSetShowSourcesPopover(!showSourcesPopover); onSetShowAllSources(false); }}>
              Sources
            </span>
          )}
          {showSourcesPopover && domainStats.length > 0 && (
            <div className="reading-streak-popover sources-popover">
              {(showAllSources ? domainStats : domainStats.slice(0, 5)).map((d) => (
                <div key={d.domain} className="reading-streak-popover-row">
                  <span className="reading-streak-popover-label">{d.domain}</span>
                  <span className="reading-streak-popover-val">{d.count} item{d.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
              {!showAllSources && domainStats.length > 5 && (
                <button className="sources-see-all-btn" onClick={(e) => { e.stopPropagation(); onSetShowAllSources(true); }}>
                  See all ({domainStats.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className={`app-body${selectedItem ? ' reader-open' : ''}`}>
        {/* Item list */}
        <div className="item-list-pane" ref={listPaneRef} data-testid="item-list">
            <div className="item-list-header" data-testid="item-count">
              <span>
                {loading ? 'Loading…' : (() => {
                  const total = allItems.filter((it) => it.status === 'done').length;
                  const n = filteredItems.length;
                  const isFiltered = !!(searchText || activeTagFilters.length > 0 || activeDays > 0 || queueFilter || typeFilter !== 'all' || unreadOnly || showStarredOnly);
                  return isFiltered
                    ? `Showing ${n} of ${total}`
                    : `${n} item${n !== 1 ? 's' : ''}`;
                })()}
              </span>
              <select
                className="sort-select"
                value={sortOption}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'newest' || v === 'oldest' || v === 'recently-read' || v === 'highest-rated' || v === 'most-starred' || v === 'title-az' || v === 'title-za') {
                    onSortChange(v);
                  }
                }}
                title="Sort order"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="recently-read">Recently read</option>
                <option value="highest-rated">Highest rated</option>
                <option value="most-starred">Most starred</option>
                <option value="title-az">Title A→Z</option>
                <option value="title-za">Title Z→A</option>
              </select>
            </div>
            <div className="item-list-filters">
              <div className="type-filter-pills">
                {(['all', 'youtube', 'article', 'pdf'] as const).map((t) => (
                  <button
                    key={t}
                    className={`type-pill${typeFilter === t ? ' active' : ''}`}
                    onClick={() => onTypeFilterChange(t)}
                  >
                    {t === 'all' ? 'All' : t === 'youtube' ? 'YouTube' : t === 'article' ? 'Web' : 'PDF'}
                  </button>
                ))}
              </div>
              <button
                className={`unread-toggle${unreadOnly ? ' active' : ''}`}
                onClick={() => onSetUnreadOnly(!unreadOnly)}
                title="Show unread items only"
              >
                Unread
              </button>
            </div>
            {ephemeralItems.length > 0 && (
              <div className="ephemeral-section">
                <div className="ephemeral-section-header">
                  <span className="ephemeral-label">In memory</span>
                  <span className="ephemeral-sublabel">Not saved — dismiss to remove</span>
                </div>
                {ephemeralItems.map((epItem) => (
                  <div key={epItem.id} className="ephemeral-card-wrapper">
                    <ItemCard
                      item={epItem}
                      active={epItem.id === selectedId}
                      tagStatusMap={tagStatusMap}
                      selected={false}
                      selectionMode={false}
                      onSelect={() => onSelectItem(epItem)}
                      onTagClick={onAddTagFilter}
                      onStar={() => {}}
                      onPin={() => {}}
                      onShare={() => {}}
                      onToggleSelect={() => {}}
                    />
                    <button
                      className="ephemeral-read-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem(epItem);
                      }}
                      title="Open in reader"
                    >Read →</button>
                    <button
                      className="ephemeral-dismiss-btn"
                      title="Dismiss — remove from memory"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEphemeralDismiss(epItem.id);
                      }}
                    >&#x2715;</button>
                  </div>
                ))}
              </div>
            )}
            {loading ? (
              <>
                <div className="item-skeleton" />
                <div className="item-skeleton" />
                <div className="item-skeleton" />
              </>
            ) : filteredItems.length === 0 ? (
              <div className="list-empty" data-testid="empty-state">
                {allItems.filter((it) => it.status === 'done').length === 0
                  ? "No items yet — save some URLs!"
                  : searchQuery
                    ? `No items match '${searchQuery}' — try different keywords`
                    : activeDays > 0
                      ? "No items in this time range"
                      : typeFilter !== 'all'
                        ? `No ${typeFilter === 'youtube' ? 'YouTube' : typeFilter === 'pdf' ? 'PDF' : 'web'} items saved yet`
                        : unreadOnly
                          ? "No unread items"
                          : "No items match your filters"}
              </div>
            ) : (
              <>
                {filteredItems.slice(0, visibleCount).map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    active={item.id === selectedId}
                    tagStatusMap={tagStatusMap}
                    flash={flashIds.has(item.id)}
                    selected={selectedIds.has(item.id)}
                    selectionMode={selectionMode}
                    inCollections={itemsInCollections.has(item.id)}
                    onSelect={() => onSelectItem(item)}
                    onTagClick={onAddTagFilter}
                    onStar={onStar}
                    onPin={onPin}
                    onShare={onShare}
                    onToggleSelect={onToggleSelect}
                    onDelete={async () => { await onDelete(item.id); }}
                  />
                ))}
                {visibleCount < filteredItems.length && (
                  <div className="list-showing-count">Showing {Math.min(visibleCount, filteredItems.length)} of {filteredItems.length}</div>
                )}
                <div ref={sentinelRef} style={{ height: 1 }} />
              </>
            )}
            {selectionMode && (
              <div className="batch-action-bar">
                <span className="batch-count">{selectedIds.size} selected</span>
                <button className="batch-btn" title="Star all selected" onClick={onBatchStar}>&#x2605; Star all</button>
                <button className="batch-btn batch-btn-danger" title="Delete selected" onClick={onBatchDelete}>&#x1F5D1; Delete</button>
                <button className="batch-btn" title="Export selected" onClick={onBatchExport}>&#x2B07; Export</button>
                <div className="batch-collection-picker-wrapper">
                  <button className="batch-btn" title="Add to collection" onClick={() => onSetBatchCollectionPickerOpen(!batchCollectionPickerOpen)}>&#x1F4C1; Add to collection</button>
                  {batchCollectionPickerOpen && (
                    <div className="batch-collection-dropdown">
                      {collections.length === 0 && <div className="batch-collection-empty">No collections</div>}
                      {collections.map((col) => (
                        <button
                          key={col.id}
                          className="batch-collection-option"
                          onClick={() => onBatchAddToCollection(col.id)}
                        >
                          {col.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="batch-btn batch-btn-clear" title="Clear selection" onClick={onClearSelection}>&#x2716; Clear</button>
              </div>
            )}
          </div>

        {/* Reader */}
        <ReaderPane
          item={selectedItem}
          allItems={allItems}
          tagStatusMap={tagStatusMap}
          onTagAction={onTagAction}
          onSelectItem={(item) => onSelectItem(item)}
          onItemReloaded={onItemReloaded}
          onShare={onShare}
          onArchive={onArchive}
          onDelete={onDelete}
          onRate={onRate}
          onStudyLater={onStudyLater}
          collections={collections}
          onCollectionToggle={onCollectionToggle}
          onCollectionCreate={onCollectionCreate}
          onBack={() => onSetSelectedId(null)}
        />
      </div>

      {/* Tags panel */}
      {showTagsPanel && (
        <TagsPanel
          tagData={tagData}
          onApprove={async (tag) => { await onTagAction('approve', tag, ''); }}
          onReject={async (tag, itemId) => { await onTagAction('reject', tag, itemId); }}
          onClose={() => onSetShowTagsPanel(false)}
        />
      )}

      {/* Queue panel */}
      {showQueuePanel && (
        <QueuePanel
          log={queueLog.filter((e) => !clearedIds.has(e.id))}
          onClose={() => onToggleQueuePanel()}
          onRetry={onRetryItem}
          onClearCompleted={onClearCompleted}
          onNavigate={(id) => onQueueNavigate(id)}
        />
      )}

      {/* Settings panel */}
      {showSettingsPanel && (
        <SettingsPanel onClose={() => onSetShowSettingsPanel(false)} />
      )}

      {/* Stats panel */}
      {showStatsPanel && (
        <StatsPanel onClose={() => onSetShowStatsPanel(false)} />
      )}

      {/* Bulk Add modal */}
      {showBulkAdd && (
        <BulkAddModal onClose={() => onSetShowBulkAdd(false)} onQueued={onAddToQueueLog} />
      )}

      {/* Quick capture modal */}
      {showQuickCapture && (
        <QuickCaptureModal
          onClose={() => onSetShowQuickCapture(false)}
          onQueued={onAddToQueueLog}
          onPreviewSaved={onPreviewSaved}
        />
      )}

      {/* Tag Cloud panel */}
      {showTagCloud && tagStats && (
        <TagCloudPanel
          stats={tagStats}
          onTagClick={(tag) => { onAddTagFilter(tag); onSetShowTagCloud(false); }}
          onApprove={async (tag) => { await onTagAction('approve', tag, ''); await onLoadTagStats(); }}
          onReject={async (tag, itemId) => { await onTagAction('reject', tag, itemId); await onLoadTagStats(); }}
          onClose={() => onSetShowTagCloud(false)}
          onRefresh={onLoadTagStats}
        />
      )}

      {/* Collections panel */}
      {showCollectionsPanel && (
        <CollectionsPanel
          collections={collections}
          activeCollectionId={activeCollectionId}
          onSelect={(id) => onSetActiveCollectionId(id)}
          onCreate={(name) => onCollectionCreate(name)}
          onRename={onCollectionRename}
          onDelete={onCollectionDelete}
          onClose={() => onSetShowCollectionsPanel(false)}
        />
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div className="shortcuts-overlay" onClick={() => onSetShowShortcuts(false)}>
          <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-header">
              <span>Keyboard Shortcuts</span>
              <button className="shortcuts-close" onClick={() => onSetShowShortcuts(false)}>&times;</button>
            </div>
            <div className="shortcuts-body">
              {[
                ['j / ↓', 'Next item'],
                ['k / ↑', 'Previous item'],
                ['Enter', 'Open selected item'],
                ['/', 'Focus search'],
                ['Escape', 'Clear search / deselect'],
                ['r', 'Toggle read/unread'],
                ['f', 'Toggle fullscreen reader'],
                ['Ctrl+F', 'Search in transcript'],
                ['Ctrl+Shift+A', 'Open Bulk Add'],
                ['Ctrl+L', 'Quick capture URL'],
                ['?', 'Toggle this overlay'],
              ].map(([key, desc]) => (
                <div key={key} className="shortcut-row">
                  <kbd className="shortcut-key">{key}</kbd>
                  <span className="shortcut-desc">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Share toast */}
      {shareToast && (
        <div className="share-toast">Link copied!</div>
      )}

      {/* Delete toast */}
      {deleteToast && (
        <div className="share-toast">{deleteToast}</div>
      )}
    </>
  );
}
