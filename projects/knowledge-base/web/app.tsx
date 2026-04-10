import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { KnowledgeItem } from '../src/types.ts';

const SERVER = 'http://127.0.0.1:3737';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TagData {
  approved: string[];
  pending: { tag: string; itemId: string; itemTitle: string }[];
  rejected: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function computeRelated(current: KnowledgeItem, all: KnowledgeItem[]): KnowledgeItem[] {
  const tags = new Set(current.tags ?? []);
  if (!tags.size) return [];
  return all
    .filter((it) => it.id !== current.id && it.status === 'done')
    .map((it) => ({
      item: it,
      score: (it.tags ?? []).filter((t) => tags.has(t)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.item);
}

// ── TagsPanel ─────────────────────────────────────────────────────────────────

function TagsPanel({
  tagData,
  onApprove,
  onReject,
  onClose,
}: {
  tagData: TagData;
  onApprove: (tag: string) => Promise<void>;
  onReject: (tag: string, itemId: string) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="tags-panel" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tags-panel-inner">
        <div className="tags-panel-header">
          <h2>Tags to review ({tagData.pending.length})</h2>
          <button className="tags-panel-close" onClick={onClose}>&times;</button>
        </div>
        <div className="tags-panel-body">
          {tagData.pending.length === 0 ? (
            <p className="tags-panel-empty">No pending tags — all clear.</p>
          ) : (
            tagData.pending.map((p) => (
              <div className="tag-panel-row" key={`${p.tag}-${p.itemId}`}>
                <span className="tag-panel-name">{p.tag}</span>
                <span className="tag-panel-item" title={p.itemTitle}>{p.itemTitle || '—'}</span>
                <button className="tag-panel-approve" onClick={() => onApprove(p.tag)}>&#x2713;</button>
                <button className="tag-panel-reject" onClick={() => onReject(p.tag, p.itemId)}>&#x2717;</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── ItemCard (list item) ──────────────────────────────────────────────────────

function ItemCard({
  item,
  active,
  tagStatusMap,
  onSelect,
  onTagClick,
}: {
  item: KnowledgeItem;
  active: boolean;
  tagStatusMap: Record<string, string>;
  onSelect: () => void;
  onTagClick: (tag: string) => void;
}) {
  const approvedTags = (item.tags ?? []).filter((t) => (tagStatusMap[t] ?? 'pending') === 'approved');
  return (
    <div className={`item-card${active ? ' active' : ''}`} onClick={onSelect}>
      <div className="item-card-top">
        {item.readAt && <span className="item-read-dot" title="Read" />}
        <span className="item-card-title">{item.title || item.url}</span>
        <span className={`item-type-badge ${item.type === 'youtube' ? 'yt' : 'web'}`}>
          {item.type === 'youtube' ? 'YT' : 'WEB'}
        </span>
      </div>
      <div className="item-card-meta">{formatDate(item.dateAdded)}</div>
      {approvedTags.length > 0 && (
        <div className="item-card-tags">
          {approvedTags.map((t) => (
            <span
              key={t}
              className="item-card-tag"
              onClick={(e) => { e.stopPropagation(); onTagClick(t); }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ReaderPane ────────────────────────────────────────────────────────────────

function ReaderPane({
  item,
  allItems,
  tagStatusMap,
  onTagAction,
  onSelectItem,
}: {
  item: KnowledgeItem | null;
  allItems: KnowledgeItem[];
  tagStatusMap: Record<string, string>;
  onTagAction: (action: 'approve' | 'reject', tag: string, itemId: string) => Promise<void>;
  onSelectItem: (item: KnowledgeItem) => void;
}) {
  if (!item) {
    return <div className="reader-pane"><div className="reader-empty">Select an item to read.</div></div>;
  }

  const related = useMemo(() => computeRelated(item, allItems), [item, allItems]);
  const visibleTags = (item.tags ?? []).filter((t) => (tagStatusMap[t] ?? 'pending') !== 'rejected');

  return (
    <div className="reader-pane">
      <h1 className="reader-title">{item.title || item.url}</h1>
      <div className="reader-meta">
        <span>{formatDate(item.dateAdded)}</span>
        {item.author && <span>by {item.author}</span>}
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer">Open original &rarr;</a>
        )}
      </div>

      {/* TL;DR */}
      {Array.isArray(item.tldr) && item.tldr.length > 0 && (
        <div className="reader-tldr">
          <div className="reader-tldr-label">TL;DR</div>
          {item.tldr.map((line, i) => (
            <div key={i} className="reader-tldr-line">{line}</div>
          ))}
        </div>
      )}

      {/* Summary */}
      {item.summary && (
        <>
          <div className="reader-divider" />
          <div className="reader-section-label">Summary</div>
          <p className="reader-summary">{item.summary}</p>
        </>
      )}

      {/* Sections */}
      {Array.isArray(item.sections) && item.sections.length > 0 && (
        <>
          <div className="reader-divider" />
          <div className="reader-section-label">Key Points</div>
          {item.sections.map((sec, i) => (
            <div key={i} className="reader-section">
              <div className="reader-section-title">{sec.title}</div>
              <ul className="reader-section-points">
                {(sec.points ?? []).map((pt, j) => <li key={j}>{pt}</li>)}
              </ul>
            </div>
          ))}
        </>
      )}

      {/* Tags */}
      {visibleTags.length > 0 && (
        <>
          <div className="reader-divider" />
          <div className="reader-tags">
            {visibleTags.map((tag) => {
              const st = tagStatusMap[tag] ?? 'pending';
              if (st === 'approved') {
                return <span key={tag} className="reader-tag approved">{tag}</span>;
              }
              return (
                <span key={tag} className="reader-tag pending pending-actions">
                  {tag}
                  <button
                    className="reader-tag-approve"
                    title="Approve"
                    onClick={() => onTagAction('approve', tag, item.id)}
                  >&#x2713;</button>
                  <button
                    className="reader-tag-reject"
                    title="Reject"
                    onClick={() => onTagAction('reject', tag, item.id)}
                  >&#x2717;</button>
                </span>
              );
            })}
          </div>
        </>
      )}

      {/* Related */}
      {related.length > 0 && (
        <>
          <div className="reader-divider" />
          <div className="reader-section-label">Related</div>
          <div className="reader-related">
            {related.map((rel) => (
              <div key={rel.id} className="related-card" onClick={() => onSelectItem(rel)}>
                <div className="related-card-title">{rel.title || rel.url}</div>
                <div className="related-card-tags">
                  {(rel.tags ?? []).filter((t) => (item.tags ?? []).includes(t)).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Transcript */}
      {item.transcript && (
        <>
          <div className="reader-divider" />
          <details className="reader-transcript">
            <summary>Full transcript</summary>
            <pre>{item.transcript}</pre>
          </details>
        </>
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [allItems, setAllItems] = useState<KnowledgeItem[]>([]);
  const [tagData, setTagData] = useState<TagData>({ approved: [], pending: [], rejected: [] });
  const [tagStatusMap, setTagStatusMap] = useState<Record<string, string>>({});

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [activeDays, setActiveDays] = useState(0);
  const [showTagsPanel, setShowTagsPanel] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load everything on mount
  useEffect(() => {
    loadItems();
    loadTags();
  }, []);

  // Debounce search input
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setSearchQuery(searchText), 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchText]);

  async function loadItems() {
    try {
      const res = await fetch(`${SERVER}/items`);
      if (!res.ok) return;
      setAllItems(await res.json());
    } catch {}
  }

  async function loadTags() {
    try {
      const res = await fetch(`${SERVER}/tags`);
      if (!res.ok) return;
      const data: TagData = await res.json();
      setTagData(data);
      const map: Record<string, string> = {};
      for (const t of data.approved) map[t] = 'approved';
      for (const t of data.rejected) map[t] = 'rejected';
      for (const p of data.pending) map[p.tag] = 'pending';
      setTagStatusMap(map);
    } catch {}
  }

  // Mark item read + fetch full item with transcript
  async function selectItem(item: KnowledgeItem) {
    setSelectedId(item.id);
    // Mark read
    fetch(`${SERVER}/items/${encodeURIComponent(item.id)}/read`, { method: 'POST' }).then(() => {
      setAllItems((prev) =>
        prev.map((it) => it.id === item.id ? { ...it, readAt: new Date().toISOString() } : it)
      );
    }).catch(() => {});
    // Fetch full item (with transcript)
    try {
      const res = await fetch(`${SERVER}/items/${encodeURIComponent(item.id)}`);
      if (!res.ok) return;
      const full: KnowledgeItem = await res.json();
      setAllItems((prev) => prev.map((it) => it.id === full.id ? full : it));
    } catch {}
  }

  // Filtering
  const filteredItems = useMemo(() => {
    let items = allItems.filter((it) => it.status === 'done');

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((it) =>
        it.title?.toLowerCase().includes(q) ||
        it.summary?.toLowerCase().includes(q) ||
        it.transcript?.toLowerCase().includes(q)
      );
    }

    if (activeTagFilters.length) {
      items = items.filter((it) =>
        activeTagFilters.every((tag) => (it.tags ?? []).includes(tag))
      );
    }

    if (activeDays > 0) {
      const cutoff = Date.now() - activeDays * 24 * 60 * 60 * 1000;
      items = items.filter((it) => new Date(it.dateAdded).getTime() >= cutoff);
    }

    return items;
  }, [allItems, searchQuery, activeTagFilters, activeDays]);

  const selectedItem = useMemo(
    () => allItems.find((it) => it.id === selectedId) ?? null,
    [allItems, selectedId]
  );

  function addTagFilter(tag: string) {
    setActiveTagFilters((prev) => prev.includes(tag) ? prev : [...prev, tag]);
  }

  function removeTagFilter(tag: string) {
    setActiveTagFilters((prev) => prev.filter((t) => t !== tag));
  }

  function clearAll() {
    setSearchText('');
    setActiveTagFilters([]);
    setActiveDays(0);
  }

  const hasFilters = searchText || activeTagFilters.length > 0 || activeDays > 0;

  async function handleTagAction(action: 'approve' | 'reject', tag: string, itemId: string) {
    const endpoint = action === 'approve' ? '/tags/approve' : '/tags/reject';
    const body = action === 'reject' ? { tag, itemId } : { tag };
    await fetch(`${SERVER}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await loadTags();
  }

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <h1>Knowledge Base</h1>

        <div className="header-search">
          <span className="header-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            autoComplete="off"
          />
          {searchText && (
            <button className="header-clear-btn" onClick={() => setSearchText('')}>&times;</button>
          )}
        </div>

        {/* Active tag filter chips */}
        {activeTagFilters.length > 0 && (
          <div className="header-filters">
            {activeTagFilters.map((tag) => (
              <span key={tag} className="filter-chip">
                {tag}
                <button className="filter-chip-remove" onClick={() => removeTagFilter(tag)}>&times;</button>
              </span>
            ))}
          </div>
        )}

        {/* Date buttons */}
        <div className="header-filters">
          {[{ label: 'All', days: 0 }, { label: 'Today', days: 1 }, { label: '2d', days: 2 }, { label: '3d', days: 3 }, { label: '4d', days: 4 }].map(({ label, days }) => (
            <button
              key={days}
              className={`date-btn${activeDays === days ? ' active' : ''}`}
              onClick={() => setActiveDays(days)}
            >
              {label}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button className="header-clear-all" onClick={clearAll}>&#x2715; clear</button>
        )}

        <button
          className={`header-tags-btn${tagData.pending.length > 0 ? ' has-pending' : ''}`}
          onClick={() => setShowTagsPanel(true)}
        >
          {tagData.pending.length > 0 ? `⚑ ${tagData.pending.length} pending` : 'Tags'}
        </button>
      </header>

      {/* Body */}
      <div className="app-body">
        {/* Item list */}
        <div className="item-list-pane">
          <div className="item-list-header">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
          </div>
          {filteredItems.length === 0 ? (
            <div className="list-empty">No items match.</div>
          ) : (
            filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                active={item.id === selectedId}
                tagStatusMap={tagStatusMap}
                onSelect={() => selectItem(item)}
                onTagClick={addTagFilter}
              />
            ))
          )}
        </div>

        {/* Reader */}
        <ReaderPane
          item={selectedItem}
          allItems={allItems}
          tagStatusMap={tagStatusMap}
          onTagAction={handleTagAction}
          onSelectItem={(item) => selectItem(item)}
        />
      </div>

      {/* Tags panel */}
      {showTagsPanel && (
        <TagsPanel
          tagData={tagData}
          onApprove={async (tag) => { await handleTagAction('approve', tag, ''); }}
          onReject={async (tag, itemId) => { await handleTagAction('reject', tag, itemId); }}
          onClose={() => setShowTagsPanel(false)}
        />
      )}
    </>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
