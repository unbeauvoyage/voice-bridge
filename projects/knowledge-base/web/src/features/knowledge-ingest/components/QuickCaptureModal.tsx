import React, { useState, useEffect, useRef } from 'react';
import { api, type QuickPreviewResult } from '../../../../api.ts';
import { ArticleChat, type ChatMessage } from '../../article-chat/index.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DuplicateHint =
  | { type: 'done'; id: string; title: string }
  | { type: 'processing' }
  | null;

// ── QuickCaptureModal ─────────────────────────────────────────────────────────

export function QuickCaptureModal({ onClose, onQueued, onPreviewSaved }: { onClose: () => void; onQueued?: (id: string, url: string) => void; onPreviewSaved?: (result: QuickPreviewResult) => void }): React.JSX.Element {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'queued' | 'error'>('idle');
  const [duplicate, setDuplicate] = useState<DuplicateHint>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [previewResult, setPreviewResult] = useState<QuickPreviewResult | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value;
    setUrl(val);
    setStatus('idle');
    setDuplicate(null);
    setPreviewStatus('idle');
    setPreviewResult(null);
    setChatMessages([]);
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    const trimmed = val.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
    checkTimerRef.current = setTimeout(async () => {
      try {
        const result = await api.checkUrl(trimmed);
        if (!result.exists) { setDuplicate(null); return; }
        const isActive = result.status === 'queued' || result.status === 'processing';
        setDuplicate(isActive ? { type: 'processing' } : { type: 'done', id: result.id, title: result.title });
      } catch {
        // non-fatal — don't block saving if check fails
      }
    }, 400);
  }

  async function handleResummarize(id: string): Promise<void> {
    try {
      await fetch(`/items/${encodeURIComponent(id)}/resummarize`, { method: 'POST' });
    } catch { /* non-fatal */ }
    onClose();
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
    setStatus('loading');
    try {
      const res = await api.processUrl(trimmed);
      onQueued?.(res.id, trimmed);
      setStatus('queued');
      setTimeout(() => onClose(), 800);
    } catch {
      setStatus('error');
    }
  }

  async function handleQuickSummary(): Promise<void> {
    const trimmed = url.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
    setPreviewStatus('loading');
    setPreviewResult(null);
    try {
      const result = await api.previewQuick(trimmed);
      setPreviewResult(result);
      setPreviewStatus('done');
      // Auto-close and promote to ephemeral item
      onPreviewSaved?.(result);
      onClose();
    } catch {
      setPreviewStatus('error');
    }
  }

  function handleDismissPreview(): void {
    if (previewResult) onPreviewSaved?.(previewResult);
    onClose();
  }

  const busy = status === 'loading' || status === 'queued';
  const previewBusy = previewStatus === 'loading';
  const urlValid = /^https?:\/\//i.test(url.trim());

  return (
    <div className="quick-capture-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="quick-capture-panel">
        <form onSubmit={handleSubmit} className="quick-capture-form">
          <input
            ref={inputRef}
            className="quick-capture-input"
            type="url"
            placeholder="https://..."
            value={url}
            onChange={handleUrlChange}
            disabled={busy}
          />
          <button
            type="submit"
            className="quick-capture-btn"
            disabled={busy}
          >
            {status === 'loading' ? 'Saving…' : status === 'queued' ? 'Queued!' : 'Save'}
          </button>
        </form>
        <div className="quick-capture-actions">
          <button
            type="button"
            className="quick-capture-preview-btn"
            disabled={busy || previewBusy || !urlValid}
            onClick={handleQuickSummary}
          >
            {previewBusy ? 'Summarizing…' : 'Quick Summary'}
          </button>
        </div>
        {status === 'error' && <div className="quick-capture-error">Failed — check URL</div>}
        {previewStatus === 'error' && <div className="quick-capture-error">Summary failed — check URL or Ollama</div>}
        {duplicate?.type === 'processing' && (
          <div className="quick-capture-duplicate">Currently being processed…</div>
        )}
        {duplicate?.type === 'done' && (
          <div className="quick-capture-duplicate">
            Already saved: <span className="quick-capture-dup-title">{duplicate.title || url}</span>
            <button className="quick-capture-resummarize-btn" onClick={() => handleResummarize(duplicate.id)}>
              Save again
            </button>
          </div>
        )}
        {previewStatus === 'done' && previewResult && (
          <div className="quick-preview-result reader-pane">
            <div className="quick-preview-banner">
              <span className="quick-preview-banner-label">Preview — not saved</span>
              <div className="quick-preview-banner-actions">
                <button className="quick-capture-dismiss-btn" onClick={handleDismissPreview}>
                  Dismiss
                </button>
              </div>
            </div>
            <h1 className="reader-title">{previewResult.title}</h1>
            {previewResult.tldr.length > 0 && (
              <>
                <div className="reader-section-label">TL;DR</div>
                <ul className="reader-tldr">
                  {previewResult.tldr.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </>
            )}
            {previewResult.summary && (
              <>
                <div className="reader-section-label">Summary</div>
                <div className="reader-summary">{previewResult.summary}</div>
              </>
            )}
            {previewResult.tags.length > 0 && (
              <div className="reader-tags">
                {previewResult.tags.map((t) => <span key={t} className="reader-tag">{t}</span>)}
              </div>
            )}
            <div className="reader-divider" />
            <ArticleChat
              content={previewResult.content}
              messages={chatMessages}
              onMessages={setChatMessages}
            />
          </div>
        )}
      </div>
    </div>
  );
}
