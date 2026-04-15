import React, { useEffect } from 'react';
import type { QuickPreviewResult } from '../../../../api.ts';

export function PreviewsPanel({
  previews,
  onDelete,
  onSaveToKb,
  onClose,
}: {
  previews: QuickPreviewResult[];
  onDelete: (url: string) => void;
  onSaveToKb: (url: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="tags-panel" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tags-panel-inner">
        <div className="tags-panel-header">
          <h2>Saved Previews ({previews.length})</h2>
          <button className="tags-panel-close" onClick={onClose}>&times;</button>
        </div>
        <div className="tags-panel-body">
          {previews.length === 0 ? (
            <p className="tags-panel-empty">No saved previews. Use "Quick Summary" in the capture modal (Ctrl+L), then Dismiss to save here.</p>
          ) : (
            previews.map((p) => (
              <div key={p.url} className="preview-entry">
                <div className="preview-entry-title">
                  <a href={p.url} target="_blank" rel="noreferrer">{p.title || p.url}</a>
                </div>
                {p.tldr.length > 0 && (
                  <ul className="preview-entry-tldr">
                    {p.tldr.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                )}
                {p.tags.length > 0 && (
                  <div className="preview-entry-tags">
                    {p.tags.map((t) => <span key={t} className="quick-preview-tag">{t}</span>)}
                  </div>
                )}
                <div className="preview-entry-actions">
                  <button className="preview-save-btn" onClick={() => onSaveToKb(p.url)}>Save to KB</button>
                  <button className="preview-delete-btn" onClick={() => onDelete(p.url)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
