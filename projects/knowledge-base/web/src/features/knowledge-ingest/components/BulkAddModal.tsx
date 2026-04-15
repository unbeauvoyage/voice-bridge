import React, { useState, useEffect } from 'react';
import { api } from '../../../../api.ts';
import type { Feed } from '../../../../api.ts';

// ── BulkAddModal ──────────────────────────────────────────────────────────────

type BulkUrlResult = { url: string; status: 'queued' | 'exists' | 'error'; message?: string };

export function BulkAddModal({ onClose, onQueued }: { onClose: () => void; onQueued?: (id: string, url: string) => void }): React.JSX.Element {
  const [tab, setTab] = useState<'urls' | 'bookmarks' | 'feeds'>('urls');
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BulkUrlResult[] | null>(null);
  const [bookmarkFile, setBookmarkFile] = useState<File | null>(null);
  const [bookmarkResult, setBookmarkResult] = useState<{ total: number; queued: number; duplicates: number; skipped: number } | null>(null);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; description: string; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [feedUrl, setFeedUrl] = useState('');
  const [feedName, setFeedName] = useState('');
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);

  useEffect(() => {
    if (tab === 'feeds') {
      api.listFeeds().then(setFeeds).catch(() => {});
    }
  }, [tab]);

  async function handleAddFeed(): Promise<void> {
    const url = feedUrl.trim();
    if (!url) return;
    setFeedLoading(true);
    setFeedError(null);
    try {
      await api.addFeed(url, feedName.trim() || undefined);
      setFeedUrl('');
      setFeedName('');
      const updated = await api.listFeeds();
      setFeeds(updated);
    } catch {
      setFeedError('Failed to add feed (URL may already exist)');
    }
    setFeedLoading(false);
  }

  async function handleDeleteFeed(id: string): Promise<void> {
    await api.deleteFeed(id).catch(() => {});
    setFeeds((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleRefreshAll(): Promise<void> {
    setFeedLoading(true);
    for (const feed of feeds) {
      await api.checkFeed(feed.id).catch(() => {});
    }
    const updated = await api.listFeeds().catch(() => feeds);
    setFeeds(updated);
    setFeedLoading(false);
  }

  function parseUrls(raw: string): { valid: string[]; invalid: string[] } {
    const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const line of lines) {
      if (/^https?:\/\//i.test(line)) valid.push(line);
      else invalid.push(line);
    }
    return { valid, invalid };
  }

  const { valid, invalid } = parseUrls(text);

  async function handleQueue(): Promise<void> {
    if (!valid.length) return;
    setProcessing(true);
    const out: BulkUrlResult[] = [];
    for (const url of valid) {
      try {
        const res = await api.processUrl(url);
        if (res.status === 'exists') {
          out.push({ url, status: 'exists', message: 'Already saved' });
        } else {
          out.push({ url, status: 'queued' });
          onQueued?.(res.id, url);
        }
      } catch {
        out.push({ url, status: 'error', message: 'Failed' });
      }
    }
    setResults(out);
    setProcessing(false);
  }

  async function handleBookmarkImport(): Promise<void> {
    if (!bookmarkFile) return;
    setProcessing(true);
    setBookmarkError(null);
    try {
      const result = await api.importBookmarks(bookmarkFile);
      setBookmarkResult(result);
    } catch {
      setBookmarkError('Import failed');
    }
    setProcessing(false);
  }

  async function handlePreview(): Promise<void> {
    if (valid.length !== 1) return;
    const url = valid[0] ?? '';
    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    try {
      const data = await api.previewUrl(url);
      setPreview(data);
    } catch {
      setPreviewError('Could not fetch preview');
    }
    setPreviewLoading(false);
  }

  async function handleSavePreview(): Promise<void> {
    if (!preview) return;
    setProcessing(true);
    try {
      const res = await api.processUrl(preview.url);
      if (res.status === 'exists') {
        setResults([{ url: preview.url, status: 'exists', message: 'Already saved' }]);
      } else {
        setResults([{ url: preview.url, status: 'queued' }]);
        onQueued?.(res.id, preview.url);
      }
    } catch {
      setResults([{ url: preview.url, status: 'error', message: 'Failed' }]);
    }
    setProcessing(false);
    setPreview(null);
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel">
        <div className="modal-header">
          <span>Add URLs</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-tabs">
          <button className={`modal-tab${tab === 'urls' ? ' modal-tab-active' : ''}`} onClick={() => setTab('urls')}>Paste URLs</button>
          <button className={`modal-tab${tab === 'bookmarks' ? ' modal-tab-active' : ''}`} onClick={() => setTab('bookmarks')}>Import Bookmarks</button>
          <button className={`modal-tab${tab === 'feeds' ? ' modal-tab-active' : ''}`} onClick={() => setTab('feeds')}>RSS Feeds</button>
        </div>
        <div className="modal-body">
          {tab === 'urls' ? (
            results ? (
              <div className="bulk-results">
                {results.map((r) => (
                  <div key={r.url} className={`bulk-result-row bulk-result-${r.status}`}>
                    <span className="bulk-result-url" title={r.url}>{r.url}</span>
                    <span className="bulk-result-status">
                      {r.status === 'queued' ? 'Queued' : r.message ?? r.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="modal-label">Paste URLs — one per line:</div>
                <textarea
                  className="modal-textarea"
                  rows={8}
                  placeholder="https://youtube.com/watch?v=...&#10;https://example.com/article"
                  value={text}
                  onChange={(e) => { setText(e.target.value); setPreview(null); setPreviewError(null); }}
                  autoFocus
                />
                {invalid.length > 0 && (
                  <div className="modal-invalid">
                    {invalid.map((u) => <div key={u} className="modal-invalid-url">{u}</div>)}
                  </div>
                )}
                {valid.length === 1 && !preview && (
                  <div className="preview-row">
                    <button
                      className="preview-btn"
                      onClick={handlePreview}
                      disabled={previewLoading}
                    >
                      {previewLoading ? 'Loading preview…' : 'Preview'}
                    </button>
                    {previewError && <span className="preview-error">{previewError}</span>}
                  </div>
                )}
                {preview && (
                  <div className="url-preview-card">
                    <div className="url-preview-header">
                      <img
                        className="url-preview-favicon"
                        src={`https://www.google.com/s2/favicons?domain=${new URL(preview.url).hostname}&sz=16`}
                        alt=""
                        width={16}
                        height={16}
                      />
                      <span className="url-preview-domain">{new URL(preview.url).hostname}</span>
                    </div>
                    <div className="url-preview-title">{preview.title || preview.url}</div>
                    {preview.description && (
                      <div className="url-preview-desc">{preview.description}</div>
                    )}
                    <button className="modal-submit url-preview-save" onClick={handleSavePreview} disabled={processing}>
                      {processing ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </>
            )
          ) : tab === 'bookmarks' ? (
            bookmarkResult ? (
              <div className="bookmark-import-result">
                {bookmarkResult.queued} queued &middot; {bookmarkResult.duplicates} already saved{bookmarkResult.skipped > 0 ? ` · ${bookmarkResult.skipped} skipped (non-http)` : ''}
              </div>
            ) : (
              <>
                <div className="modal-label">Select an export file to import:<br /><span className="modal-sublabel">Supports: Chrome/Firefox bookmarks (.html), Pocket export (.html), Instapaper (.csv)</span></div>
                <input
                  type="file"
                  accept=".html,.csv"
                  className="modal-file-input"
                  onChange={(e) => setBookmarkFile(e.target.files?.[0] ?? null)}
                />
                {bookmarkError && <div className="modal-invalid">{bookmarkError}</div>}
              </>
            )
          ) : tab === 'feeds' ? (
            <div className="feeds-panel">
              <div className="feeds-add-row">
                <input
                  className="feeds-url-input"
                  type="url"
                  placeholder="https://example.com/feed.xml"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddFeed(); }}
                />
                <input
                  className="feeds-name-input"
                  type="text"
                  placeholder="Name (optional)"
                  value={feedName}
                  onChange={(e) => setFeedName(e.target.value)}
                />
                <button
                  className="modal-submit feeds-add-btn"
                  onClick={handleAddFeed}
                  disabled={!feedUrl.trim() || feedLoading}
                >
                  Add
                </button>
              </div>
              {feedError && <div className="modal-invalid">{feedError}</div>}
              {feeds.length === 0 ? (
                <div className="feeds-empty">No feeds subscribed yet.</div>
              ) : (
                <div className="feeds-list">
                  {feeds.map((feed) => (
                    <div key={feed.id} className="feed-row">
                      <div className="feed-row-info">
                        <span className="feed-row-name">{feed.name || feed.url}</span>
                        <span className="feed-row-meta">
                          {feed.itemCount} items
                          {feed.lastChecked ? ` · checked ${new Date(feed.lastChecked).toLocaleDateString()}` : ''}
                        </span>
                      </div>
                      <button
                        className="feed-row-delete"
                        title="Remove feed"
                        onClick={() => handleDeleteFeed(feed.id)}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
        <div className="modal-footer">
          {tab === 'urls' ? (
            results ? (
              <button className="modal-submit" onClick={onClose}>Close</button>
            ) : (
              <button
                className="modal-submit"
                onClick={handleQueue}
                disabled={!valid.length || processing}
              >
                {processing ? 'Processing…' : `Queue ${valid.length > 0 ? valid.length : ''} URL${valid.length !== 1 ? 's' : ''}`}
              </button>
            )
          ) : tab === 'bookmarks' ? (
            bookmarkResult ? (
              <button className="modal-submit" onClick={onClose}>Close</button>
            ) : (
              <button
                className="modal-submit"
                onClick={handleBookmarkImport}
                disabled={!bookmarkFile || processing}
              >
                {processing ? 'Importing…' : 'Import'}
              </button>
            )
          ) : tab === 'feeds' ? (
            <div className="feeds-footer">
              <button
                className="modal-submit"
                onClick={handleRefreshAll}
                disabled={feedLoading || feeds.length === 0}
              >
                {feedLoading ? 'Refreshing…' : 'Refresh All Feeds'}
              </button>
              <button className="modal-submit" style={{ marginLeft: 8 }} onClick={onClose}>Close</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
