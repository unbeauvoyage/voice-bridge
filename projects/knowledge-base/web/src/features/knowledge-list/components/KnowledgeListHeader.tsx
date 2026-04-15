/**
 * KnowledgeListHeader — Sort dropdown, presets, starred toggle, batch action buttons, filters
 *
 * Extracted from KnowledgePage to reduce inline header complexity.
 */
import React from 'react';
import type { Collection, FilterPreset, KnowledgeItemPreview } from '../../../../api.ts';
import type { SortOption, TypeFilter } from '../../../stores/filterStore.ts';
import { ExportButton } from '../../knowledge-reader/index.ts';

export interface KnowledgeListHeaderProps {
  // Search
  searchText: string;
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

  // Callbacks
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

  // Presets
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

  // Tags / stats
  tagSuggestionsCount: number;
  tagPendingCount: number;
  onSetShowTagsPanel: (v: boolean) => void;
  onSetShowBulkAdd: (v: boolean) => void;
  onSetShowTagCloud: (v: boolean) => void;
  onLoadTagStats: () => void;

  // Collections
  collections: Collection[];
  activeCollectionId: string | null;
  onSetShowCollectionsPanel: (v: boolean) => void;

  // Theme + panels
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSetShowStatsPanel: (v: boolean) => void;
  onSetShowSettingsPanel: (v: boolean) => void;
  onToggleQueuePanel: () => void;
  processingItems: KnowledgeItemPreview[];
  errorItems: KnowledgeItemPreview[];
  onSetShowShortcuts: (v: boolean) => void;
  showShortcuts: boolean;
}

export function KnowledgeListHeader(props: KnowledgeListHeaderProps): React.JSX.Element {
  const {
    searchText, activeTagFilters, activeDays, showStarredOnly, filterStudyLater,
    showArchivedOnly, hasFilters, hasActiveFilters, sortOption, typeFilter, unreadOnly,
    onAddTagFilter, onRemoveTagFilter, onSetActiveDays, onSetShowStarredOnly,
    onSetFilterStudyLater, onSetShowArchivedOnly, onClearAll, onSortChange,
    onTypeFilterChange, onSetUnreadOnly,
    filterPresets, showPresetsDropdown, showPresetSaveInput, presetNameInput,
    onTogglePresetsDropdown, onLoadPreset, onSavePreset, onDeletePreset,
    onSetPresetNameInput, onSetShowPresetSaveInput,
    tagSuggestionsCount, tagPendingCount, onSetShowTagsPanel, onSetShowBulkAdd,
    onSetShowTagCloud, onLoadTagStats,
    collections, activeCollectionId, onSetShowCollectionsPanel,
    theme, onToggleTheme, onSetShowStatsPanel, onSetShowSettingsPanel,
    onToggleQueuePanel, processingItems, errorItems, onSetShowShortcuts, showShortcuts,
  } = props;

  return (
    <>
      {/* Active tag filter chips */}
      {activeTagFilters.length > 0 && (
        <div className="header-filters">
          {activeTagFilters.map((tag) => (
            <span key={tag} className="filter-chip">
              {tag}
              <button className="filter-chip-remove" onClick={() => onRemoveTagFilter(tag)}>&times;</button>
            </span>
          ))}
        </div>
      )}

      {/* Date buttons */}
      <div className="header-filters" data-testid="date-filters">
        {[{ label: 'All', days: 0 }, { label: 'Today', days: 1 }, { label: '2d', days: 2 }, { label: '3d', days: 3 }, { label: '4d', days: 4 }].map(({ label, days }) => (
          <button
            key={days}
            data-testid={`date-btn-${days}`}
            className={`date-btn${activeDays === days ? ' active' : ''}`}
            onClick={() => onSetActiveDays(days)}
          >
            {label}
          </button>
        ))}
        <button
          className={`starred-filter-btn${showStarredOnly ? ' active' : ''}`}
          onClick={() => onSetShowStarredOnly(!showStarredOnly)}
          title="Show starred only"
        >
          &#x2605; Starred
        </button>
        <button
          className={`filter-chip${filterStudyLater ? ' active' : ''}`}
          onClick={() => onSetFilterStudyLater(!filterStudyLater)}
          title="Show Study Later only"
        >
          📚 Study Later
        </button>
        <button
          className={`archived-filter-btn${showArchivedOnly ? ' active' : ''}`}
          onClick={() => onSetShowArchivedOnly(!showArchivedOnly)}
          title="Show archived items"
        >
          &#x1F4E6; Archived
        </button>
      </div>

      {hasFilters && (
        <button className="header-clear-all" onClick={onClearAll}>&#x2715; clear</button>
      )}

      <button
        className={`header-tags-btn${tagPendingCount > 0 ? ' has-pending' : ''}`}
        onClick={() => onSetShowTagsPanel(true)}
      >
        {tagPendingCount > 0 ? `⚑ ${tagPendingCount} pending` : 'Tags'}
        {tagSuggestionsCount > 0 && <span className="header-tags-suggestions">{` (+ ${tagSuggestionsCount} suggestions)`}</span>}
      </button>

      <button
        className="header-bulk-btn"
        onClick={() => onSetShowBulkAdd(true)}
        title="Bulk add URLs"
      >
        + Bulk Add
      </button>

      <button
        className="header-tagcloud-btn"
        onClick={() => { onLoadTagStats(); onSetShowTagCloud(true); }}
        title="Tag browser"
      >
        Tags
      </button>

      <button
        className={`header-collections-btn${activeCollectionId ? ' active' : ''}`}
        onClick={() => onSetShowCollectionsPanel(true)}
        title="Collections"
      >
        &#x1F4C1;{activeCollectionId ? ` ${collections.find((c) => c.id === activeCollectionId)?.name ?? ''}` : ' Collections'}
      </button>

      {/* Presets button + dropdown */}
      <div className='presets-btn-wrap' style={{ position: 'relative' }}>
        <button
          className='header-presets-btn'
          onClick={() => {
            onTogglePresetsDropdown();
            onSetShowPresetSaveInput(false);
            onSetPresetNameInput('');
          }}
          title='Filter presets'
        >
          &#x1F516; Presets
        </button>
        {showPresetsDropdown && (
          <div className='presets-dropdown'>
            {filterPresets.length === 0 && !showPresetSaveInput && (
              <div className='presets-empty'>No saved presets yet</div>
            )}
            {filterPresets.map((preset) => (
              <div key={preset.id} className='presets-row'>
                <span className='presets-name'>{preset.name}</span>
                <button className='presets-load-btn' onClick={() => onLoadPreset(preset)}>
                  Load
                </button>
                <button
                  className='presets-delete-btn'
                  onClick={() => onDeletePreset(preset.id)}
                  title='Delete preset'
                >
                  &times;
                </button>
              </div>
            ))}
            {showPresetSaveInput ? (
              <div className='presets-save-row'>
                <input
                  className='presets-name-input'
                  type='text'
                  placeholder='Preset name...'
                  value={presetNameInput}
                  onChange={(e) => onSetPresetNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSavePreset();
                    if (e.key === 'Escape') onSetShowPresetSaveInput(false);
                  }}
                  autoFocus
                />
                <button
                  className='presets-save-confirm-btn'
                  onClick={onSavePreset}
                  disabled={!presetNameInput.trim()}
                >
                  Save
                </button>
                <button className='presets-save-cancel-btn' onClick={() => onSetShowPresetSaveInput(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              hasActiveFilters && (
                <div className='presets-save-trigger'>
                  <button className='presets-save-btn' onClick={() => onSetShowPresetSaveInput(true)}>
                    + Save current filters
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <ExportButton />

      <button className="header-theme-btn" onClick={onToggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <button className="header-stats-btn" onClick={() => onSetShowStatsPanel(true)} title="Stats">
        &#128202;
      </button>

      <button className="header-settings-btn" onClick={() => onSetShowSettingsPanel(true)} title="Settings">
        &#9881;
      </button>

      {/* Queue toggle button */}
      {(() => {
        const activeCount = processingItems.length;
        const errorCount = errorItems.length;
        const hasActive = activeCount > 0;
        const hasErrors = errorCount > 0;
        const btnClass = `queue-toggle-btn${hasErrors ? ' has-errors' : hasActive ? ' has-active' : ''}`;
        return (
          <button
            className={btnClass}
            onClick={onToggleQueuePanel}
            title="Processing queue"
          >
            {hasActive ? <span className="queue-item-icon spinning" style={{ fontSize: 11 }}>&#x27F3;</span> : '⚙'}
            {' '}Queue
            {(hasActive || hasErrors) && (
              <span className={`queue-badge-count${hasErrors ? ' error' : ''}`}>
                {hasErrors ? errorCount : activeCount}
              </span>
            )}
          </button>
        );
      })()}

      <button className="header-shortcuts-btn" onClick={() => onSetShowShortcuts(!showShortcuts)} title="Keyboard shortcuts">?</button>
    </>
  );
}
