/**
 * KnowledgeSearchBar — Search input, history, semantic toggle
 *
 * Extracted from KnowledgePage to reduce inline header complexity.
 */
import React from 'react';

export interface KnowledgeSearchBarProps {
  searchText: string;
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
}

export function KnowledgeSearchBar(props: KnowledgeSearchBarProps): React.JSX.Element {
  const {
    searchText, searchHistory, searchFocused, semanticMode, semanticLoading,
    searchInputRef, onSearchTextChange, onSearchFocus, onSearchBlur,
    onSemanticModeChange, onSearchHistorySelect, onRemoveFromHistory, onClearHistory,
  } = props;

  return (
    <div className="header-search" style={{ position: 'relative' }}>
      <span className="header-search-icon">⌕</span>
      <input
        ref={searchInputRef}
        data-testid="search-input"
        type="text"
        placeholder="Search… or #tag"
        value={searchText}
        onChange={(e) => onSearchTextChange(e.target.value)}
        autoComplete="off"
        onFocus={onSearchFocus}
        onBlur={onSearchBlur}
      />
      {searchText && (
        <button className="header-clear-btn" onClick={() => onSearchTextChange('')}>&times;</button>
      )}
      <label className="semantic-toggle">
        <input type="checkbox" checked={semanticMode} onChange={(e) => onSemanticModeChange(e.target.checked)} />
        <span>{semanticLoading ? '...' : 'Semantic'}</span>
      </label>
      {searchFocused && !searchText && searchHistory.length > 0 && (
        <div className="search-history-dropdown">
          {searchHistory.map((term) => (
            <div
              key={term}
              className="search-history-row"
              onMouseDown={(e) => { e.preventDefault(); onSearchHistorySelect(term); }}
            >
              <span className="search-history-icon">&#x1F551;</span>
              <span className="search-history-term">{term}</span>
              <button
                className="search-history-remove"
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onRemoveFromHistory(term); }}
                title="Remove"
              >&times;</button>
            </div>
          ))}
          <div className="search-history-clear">
            <button onMouseDown={(e) => { e.preventDefault(); onClearHistory(); }}>Clear history</button>
          </div>
        </div>
      )}
    </div>
  );
}
