import React, { useState, useEffect } from 'react';
import type { TagsResponse } from '../../../../api.ts';

type TagData = TagsResponse;

export function TagsPanel({
  tagData,
  onApprove,
  onReject,
  onClose,
}: {
  tagData: TagData;
  onApprove: (tag: string) => Promise<void>;
  onReject: (tag: string, itemId: string) => Promise<void>;
  onClose: () => void;
}): React.JSX.Element {
  const [focusedIdx, setFocusedIdx] = useState(0);
  const pending = tagData.pending;

  useEffect(() => {
    setFocusedIdx(0);
  }, [pending.length]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (!pending.length) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(i + 1, pending.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'a') {
        e.preventDefault();
        const p = pending[focusedIdx];
        if (p) onApprove(p.tag);
      } else if (e.key === 'r') {
        e.preventDefault();
        const p = pending[focusedIdx];
        if (p) onReject(p.tag, p.itemId);
      } else if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pending, focusedIdx, onApprove, onReject, onClose]);

  return (
    <div className="tags-panel" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tags-panel-inner">
        <div className="tags-panel-header">
          <h2>Tags to review ({pending.length})</h2>
          <button className="tags-panel-close" onClick={onClose}>&times;</button>
        </div>
        <div className="tags-panel-body">
          {pending.length === 0 ? (
            <p className="tags-panel-empty">No pending tags — all clear.</p>
          ) : (
            pending.map((p, i) => (
              <div
                className={`tag-panel-row${i === focusedIdx ? ' tag-panel-row-focused' : ''}`}
                key={`${p.tag}-${p.itemId}`}
                onClick={() => setFocusedIdx(i)}
              >
                <span className="tag-panel-name">{p.tag}</span>
                <span className="tag-panel-item" title={p.itemTitle}>{p.itemTitle || '—'}</span>
                <button className="tag-panel-approve" onClick={() => onApprove(p.tag)}>&#x2713;</button>
                <button className="tag-panel-reject" onClick={() => onReject(p.tag, p.itemId)}>&#x2717;</button>
              </div>
            ))
          )}
        </div>
        {pending.length > 0 && (
          <div className="tags-panel-kbd-hint">[A]pprove &middot; [R]eject &middot; [J/K] navigate</div>
        )}
      </div>
    </div>
  );
}
