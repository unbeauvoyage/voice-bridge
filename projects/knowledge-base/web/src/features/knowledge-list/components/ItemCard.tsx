import React, { useRef } from 'react';
import type { KnowledgeItemPreview } from '../../../../api.ts';

// ── Date helpers (duplicated from app.tsx — also used in ReaderPane) ──────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function ageClass(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days < 7) return 'age-fresh';
  if (days < 30) return 'age-recent';
  if (days < 90) return 'age-old';
  return 'age-stale';
}

// ── ItemCard (list item) ──────────────────────────────────────────────────────

export function ItemCard({
  item,
  active,
  tagStatusMap,
  flash,
  selected,
  selectionMode,
  onSelect,
  onTagClick,
  onStar,
  onPin,
  onShare,
  onToggleSelect,
  onDelete,
}: {
  item: KnowledgeItemPreview;
  active: boolean;
  tagStatusMap: Record<string, string>;
  flash?: boolean;
  selected?: boolean;
  selectionMode?: boolean;
  onSelect: () => void;
  onTagClick: (tag: string) => void;
  onStar: (id: string) => void;
  onPin: (id: string) => void;
  onShare: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDelete?: () => void;
  inCollections?: boolean;
}): React.JSX.Element {
  const approvedTags = (item.tags ?? []).filter((t: string) => (tagStatusMap[t] ?? 'pending') === 'approved');
  const isRead = !!item.readAt;
  const isStarred = !!item.starred;
  const readingProgress = parseInt(localStorage.getItem('kb_scroll_progress_' + item.id) ?? '0', 10);
  const isArchived = !!item.archived;
  const isPinned = !!item.pinned;
  const contentDate = item.publishedAt ?? item.createdAt;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePointerDown(): void {
    longPressTimer.current = setTimeout(() => {
      onToggleSelect(item.id);
    }, 500);
  }

  function handlePointerUp(): void {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleClick(e: React.MouseEvent): void {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onToggleSelect(item.id);
      return;
    }
    if (selectionMode) {
      onToggleSelect(item.id);
      return;
    }
    onSelect();
  }

  return (
    <div
      className={`item-card${active ? ' active' : ''}${isRead ? ' read' : ''}${flash ? ' flash-done' : ''}${isStarred ? ' starred' : ''}${selected ? ' batch-selected' : ''}${isArchived ? ' archived' : ''}${isPinned ? ' pinned' : ''}`}
      data-id={item.id}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="item-card-content">
        <div className="item-card-body">
          <div className="item-card-top">
            {(selectionMode || selected) && (
              <input
                type="checkbox"
                className="item-checkbox"
                checked={!!selected}
                onChange={() => onToggleSelect(item.id)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <span className={`item-type-badge ${item.type === 'youtube' ? 'yt' : 'article'}`}>
              {item.type === 'youtube' ? '▶' : item.url.toLowerCase().endsWith('.pdf') ? '📄' : '🌐'}
            </span>
            <span className="item-card-title">{item.title || item.url}</span>
            {!isRead && <span className="item-unread-dot" title="Unread" />}
            <button
              className="share-btn"
              title="Copy link"
              onClick={(e) => { e.stopPropagation(); onShare(item.id); }}
            >
              &#x1F517;
            </button>
            <button
              className={`star-btn${isStarred ? ' starred' : ''}`}
              title={isStarred ? 'Unstar' : 'Star'}
              onClick={(e) => { e.stopPropagation(); onStar(item.id); }}
            >
              {isStarred ? '★' : '☆'}
            </button>
            <button
              className={`pin-btn${isPinned ? ' pinned' : ''}`}
              title={isPinned ? 'Unpin' : 'Pin to top'}
              onClick={(e) => { e.stopPropagation(); onPin(item.id); }}
            >
              &#x1F4CC;
            </button>
            {isPinned && <span className="pin-badge" title="Pinned">&#x1F4CC;</span>}
            {item.studyLater && <span className="item-study-badge" title="Study later">📚</span>}
            {onDelete && (
              <button
                className="item-card-delete-btn"
                title="Delete article"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                🗑
              </button>
            )}
          </div>
          <div className="item-card-meta">
            <span
              className={`item-age ${ageClass(contentDate)}`}
              title={formatDate(contentDate)}
            >
              {timeAgo(contentDate)}
            </span>
            {approvedTags.length > 0 && (
              <span
                className="item-card-tag"
                onClick={(e) => { e.stopPropagation(); onTagClick(approvedTags[0] ?? ''); }}
              >
                {approvedTags[0] ?? ''}
              </span>
            )}
            {item.feedName && (
              <span className="feed-badge" title={`From feed: ${item.feedName}`}>
                {item.feedName}
              </span>
            )}
            {item.rating && (
              <span className="item-card-rating" title={`${item.rating} stars`}>
                {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
              </span>
            )}
          </div>
          {item.snippet && (
            <p className="item-snippet" dangerouslySetInnerHTML={{ __html: item.snippet }} />
          )}
        </div>
        {item.imageUrl && (
          <img className="item-thumb" src={item.imageUrl} alt="" />
        )}
      </div>
      {readingProgress > 5 && readingProgress < 95 && (
        <div className="item-card-progress" style={{ width: `${readingProgress}%` }} />
      )}
    </div>
  );
}
