import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { KnowledgeItemPreview, KnowledgeItemDetail, Collection, SummaryVersion, Highlight } from '../../../../api.ts';
import { api } from '../../../../api.ts';
import { ArticleChat, type ChatMessage } from '../../article-chat/index.ts';
import { isKnowledgeItemDetail, isEphemeralItem, type EphemeralItem } from '../../../types.ts';
import { formatDate, timeAgo, ageClass } from '../../../shared/utils/dates.ts';
import { slugify } from '../../../shared/utils/strings.ts';
import { readingStats } from '../../../shared/utils/text.ts';
import { buildTranscriptHtml, countMatches, TRANSCRIPT_COLLAPSE_LIMIT, TRANSCRIPT_PREVIEW_LENGTH } from '../domain/transcript.ts';
import { computeRelated } from '../domain/related.ts';

// ── ReaderPane ────────────────────────────────────────────────────────────────

export function ReaderPane({
  item,
  allItems,
  tagStatusMap,
  onTagAction,
  onSelectItem,
  onItemReloaded,
  onShare,
  onArchive,
  onDelete,
  onRate,
  onStudyLater,
  collections,
  onCollectionToggle,
  onCollectionCreate,
  onBack,
}: {
  item: KnowledgeItemDetail | KnowledgeItemPreview | EphemeralItem | null;
  allItems: KnowledgeItemPreview[];
  tagStatusMap: Record<string, string>;
  onTagAction: (action: 'approve' | 'reject', tag: string, itemId: string, reason?: string) => Promise<void>;
  onSelectItem: (item: KnowledgeItemPreview) => void;
  onItemReloaded: (item: KnowledgeItemDetail) => void;
  onShare: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onRate: (id: string, rating: number) => Promise<void>;
  onStudyLater: (id: string) => Promise<void>;
  collections: Collection[];
  onCollectionToggle: (collectionId: string, itemId: string, inCollection: boolean) => Promise<void>;
  onCollectionCreate: (name: string, itemId: string) => Promise<void>;
  onBack: () => void;
}): React.JSX.Element {
  const isEphemeral = isEphemeralItem(item);
  const related = useMemo(() => (item && !isEphemeralItem(item) ? computeRelated(item, allItems) : []), [item, allItems]);
  const visibleTags = (item?.tags ?? []).filter((t: string) => (tagStatusMap[t] ?? 'pending') !== 'rejected');
  const paneRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const [itemCopied, setItemCopied] = useState(false);
  const [resummarizing, setResummarizing] = useState(false);
  const [resummarizeToast, setResummarizeToast] = useState(false);
  const [notes, setNotes] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const noteDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [transcriptSearchQuery, setTranscriptSearchQuery] = useState('');
  const [transcriptMatchIdx, setTranscriptMatchIdx] = useState(0);
  const [transcriptSearchOpen, setTranscriptSearchOpen] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const transcriptSearchRef = useRef<HTMLInputElement>(null);
  const transcriptBodyRef = useRef<HTMLDivElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<SummaryVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightTooltip, setHighlightTooltip] = useState<{ x: number; y: number; section: string } | null>(null);
  const [summaryQuality, setSummaryQuality] = useState<number | undefined>(undefined);
  const [summaryQualityHover, setSummaryQualityHover] = useState<number | undefined>(undefined);
  const [summaryQualityReason, setSummaryQualityReason] = useState('');
  const sqReasonDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSelectionRef = useRef<string>('');
  const [tldrCopied, setTldrCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [rejectingTag, setRejectingTag] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [shareDropdownOpen, setShareDropdownOpen] = useState(false);
  const [markdownCopied, setMarkdownCopied] = useState(false);
  const shareDropdownRef = useRef<HTMLDivElement>(null);
  const scrollSaveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [discussMessages, setDiscussMessages] = useState<ChatMessage[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Load highlights when item changes
  useEffect(() => {
    if (!item || isEphemeral) return;
    api.getHighlights(item.id).then(setHighlights).catch(() => {});
  }, [item?.id, isEphemeral]);

  // Reset delete confirmation when item changes
  useEffect(() => { setDeleteConfirm(false); }, [item?.id]);

  // Sync notes and rating when item changes
  useEffect(() => {
    setNotes(item?.notes ?? '');
    setHistoryOpen(false);
    setHistoryVersions([]);
    setHighlights([]);
    setHighlightTooltip(null);
    setDiscussMessages([]);
    setSummaryQuality(undefined);
    setSummaryQualityReason('');
    if (item?.id) {
      api.getSummaryQuality(item.id).then((sq) => {
        if (sq.rating != null) setSummaryQuality(sq.rating);
        setSummaryQualityReason(sq.reason ?? '');
      }).catch(() => {});
    }
  }, [item?.id]);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    function onScroll(): void {
      if (!pane) return;
      const { scrollTop, scrollHeight, clientHeight } = pane;
      const max = scrollHeight - clientHeight;
      setScrollProgress(max > 0 ? scrollTop / max : 0);
      setShowBackToTop(scrollTop > 200);
      if (item?.id) {
        if (scrollSaveDebounce.current) clearTimeout(scrollSaveDebounce.current);
        scrollSaveDebounce.current = setTimeout(() => {
          const progress = max > 0 ? Math.min(100, Math.round((scrollTop / max) * 100)) : 0;
          localStorage.setItem('kb_scroll_' + item.id, scrollTop.toString());
          localStorage.setItem('kb_scroll_progress_' + item.id, progress.toString());
        }, 500);
      }
    }
    pane.addEventListener('scroll', onScroll, { passive: true });
    return () => pane.removeEventListener('scroll', onScroll);
  }, [item]);

  // Restore scroll position when item changes (or reset if no saved position)
  useEffect(() => {
    setScrollProgress(0);
    setShowBackToTop(false);
    if (!item?.id) return;
    const saved = parseInt(localStorage.getItem('kb_scroll_' + item.id) ?? '0', 10);
    if (saved > 0) {
      setTimeout(() => {
        if (paneRef.current) paneRef.current.scrollTop = saved;
      }, 50);
    } else if (paneRef.current) {
      paneRef.current.scrollTop = 0;
    }
  }, [item?.id]);

  // Reset transcript search when item changes
  useEffect(() => {
    setTranscriptSearchQuery('');
    setTranscriptMatchIdx(0);
    setTranscriptSearchOpen(false);
    setTranscriptExpanded(false);
  }, [item?.id]);

  // Ctrl+F to open transcript search when reader pane is focused
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'f' && (e.ctrlKey || e.metaKey) && paneRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        setTranscriptSearchOpen(true);
        setTimeout(() => transcriptSearchRef.current?.focus(), 0);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Escape to exit fullscreen
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
      if (e.key === 'f' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setIsFullscreen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // Close share dropdown on outside click
  useEffect(() => {
    if (!shareDropdownOpen) return;
    function onClickOutside(e: MouseEvent): void {
      if (shareDropdownRef.current && e.target instanceof Node && !shareDropdownRef.current.contains(e.target)) {
        setShareDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [shareDropdownOpen]);

  async function copyToClipboard(text: string, setFn: (v: boolean) => void): Promise<void> {
    await navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 1500);
  }

  function buildMarkdownText(): string {
    if (!item) return '';
    const approvedTags = (item.tags ?? []).filter((t: string) => (tagStatusMap[t] ?? 'pending') === 'approved');
    const tldrLines = Array.isArray(item.tldr) ? item.tldr.map((l: string) => `- ${l}`).join('\n') : '';
    const sectionsText =
      Array.isArray(item.sections) && item.sections.length > 0
        ? item.sections
            .map((sec) => {
              const pts = (sec.points ?? []).map((p) => `- ${p}`).join('\n');
              return `### ${sec.title}\n${pts}`;
            })
            .join('\n\n')
        : '';
    const dateStr = item.publishedAt ?? item.createdAt ?? '';
    const parts = [
      `# ${item.title ?? item.url}`,
      `URL: ${item.url}`,
      `Date: ${dateStr}`,
      `Tags: ${approvedTags.join(', ')}`,
      '',
      tldrLines ? `## TL;DR\n${tldrLines}` : '',
      '',
      item.summary ? `## Summary\n${item.summary}` : '',
      '',
      sectionsText ? `## Key Points\n${sectionsText}` : '',
    ];
    return parts
      .filter((l, i, arr) => !(l === '' && (i === 0 || arr[i - 1] === '')))
      .join('\n')
      .trim();
  }

  async function handleResummarize(): Promise<void> {
    if (!item || resummarizing) return;
    setResummarizing(true);
    try {
      await api.resummarize(item.id);
      const poll = async (): Promise<void> => {
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const status = await api.getStatus(item.id);
          if (status.status === 'done' || status.status === 'error') {
            const updated = await api.getItem(item.id);
            onItemReloaded(updated);
            setNotes(updated.notes ?? '');
            setResummarizeToast(true);
            setTimeout(() => setResummarizeToast(false), 2500);
            return;
          }
        }
      };
      poll().catch(() => {}).finally(() => setResummarizing(false));
    } catch {
      setResummarizing(false);
    }
  }

  async function handleOpenHistory(): Promise<void> {
    if (!item) return;
    setHistoryOpen((prev) => !prev);
    if (!historyOpen) {
      setHistoryLoading(true);
      try {
        const versions = await api.getSummaryHistory(item.id);
        setHistoryVersions(versions);
      } catch {
        setHistoryVersions([]);
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  async function handleRestoreVersion(historyId: number): Promise<void> {
    if (!item) return;
    try {
      await api.restoreSummaryVersion(item.id, historyId);
      const updated = await api.getItem(item.id);
      onItemReloaded(updated);
      setHistoryOpen(false);
      setResummarizeToast(true);
      setTimeout(() => setResummarizeToast(false), 2500);
    } catch {}
  }

  function handleNotesChange(value: string): void {
    setNotes(value);
    setNoteSaved(false);
    if (noteDebounce.current) clearTimeout(noteDebounce.current);
    noteDebounce.current = setTimeout(() => doSaveNote(value), 2000);
  }

  async function doSaveNote(value: string): Promise<void> {
    if (!item) return;
    try {
      await api.saveNote(item.id, value);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch {}
  }

  function handleSectionMouseUp(section: string) {
    return (e: React.MouseEvent) => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!text || !item) {
        setHighlightTooltip(null);
        return;
      }
      pendingSelectionRef.current = text;
      setHighlightTooltip({ x: e.clientX, y: e.clientY - 40, section });
    };
  }

  async function handleSaveHighlight(): Promise<void> {
    if (!item || !highlightTooltip) return;
    const text = pendingSelectionRef.current;
    if (!text) return;
    try {
      const { id } = await api.saveHighlight(item.id, text, highlightTooltip.section);
      const newH: Highlight = { id, item_id: item.id, text, section: highlightTooltip.section, created_at: new Date().toISOString() };
      setHighlights((prev) => [...prev, newH]);
    } catch {}
    window.getSelection()?.removeAllRanges();
    setHighlightTooltip(null);
    pendingSelectionRef.current = '';
  }

  async function handleDeleteHighlight(id: string): Promise<void> {
    try {
      await api.deleteHighlight(id);
      setHighlights((prev) => prev.filter((h) => h.id !== id));
    } catch {}
  }

  function renderWithHighlights(text: string, section: string): React.ReactNode {
    const sectionHighlights = highlights.filter((h) => h.section === section);
    if (sectionHighlights.length === 0) return text;
    const ranges: { start: number; end: number; h: Highlight }[] = [];
    for (const h of sectionHighlights) {
      const idx = text.indexOf(h.text);
      if (idx === -1) continue;
      ranges.push({ start: idx, end: idx + h.text.length, h });
    }
    ranges.sort((a, b) => a.start - b.start);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const { start, end, h } of ranges) {
      if (start < cursor) continue;
      if (start > cursor) nodes.push(text.slice(cursor, start));
      nodes.push(
        <mark
          key={h.id}
          className="user-highlight"
          data-hid={h.id}
          title="Click to remove highlight"
          onClick={() => handleDeleteHighlight(h.id)}
        >
          {text.slice(start, end)}
        </mark>
      );
      cursor = end;
    }
    if (cursor < text.length) nodes.push(text.slice(cursor));
    return <>{nodes}</>;
  }

  function copyTranscript(): void {
    const itemTranscript = isKnowledgeItemDetail(item) ? item.transcript
      : isEphemeralItem(item) ? item.transcript : undefined;
    if (!itemTranscript) return;
    navigator.clipboard.writeText(itemTranscript).then(() => {
      setTranscriptCopied(true);
      setTimeout(() => setTranscriptCopied(false), 2000);
    }).catch(() => {});
  }

  function copyItem(): void {
    if (!item) return;
    const tags = (item.tags ?? []).join(', ');
    const tldr = Array.isArray(item.tldr) ? item.tldr.map((l) => `- ${l}`).join('\n') : '';
    const summary = item.summary ?? '';
    const text = [
      `# ${item.title ?? item.url}`,
      item.url,
      tags ? `**Tags:** ${tags}` : '',
      '',
      tldr ? '**TL;DR:**\n' + tldr : '',
      '',
      summary,
    ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n').trim();
    navigator.clipboard.writeText(text).then(() => {
      setItemCopied(true);
      setTimeout(() => setItemCopied(false), 2000);
    }).catch(() => {});
  }

  if (!item) {
    return (
      <div className="reader-pane">
        <div className="reader-empty reader-empty-placeholder">
          <span className="reader-empty-arrow">&#8592;</span>
          Select an item to read
        </div>
      </div>
    );
  }

  const approvedVisibleTags = visibleTags.filter((t: string) => (tagStatusMap[t] ?? 'pending') === 'approved');
  const stats = readingStats(item.summary ?? (isKnowledgeItemDetail(item) ? item.transcript : undefined) ?? (isEphemeralItem(item) ? item.transcript : undefined) ?? '');

  return (
    <div className={`reader-pane${isFullscreen ? ' reader-fullscreen' : ''}`} ref={paneRef} onClick={() => { if (highlightTooltip) setHighlightTooltip(null); if (deleteConfirm) setDeleteConfirm(false); }}>
      {/* Progress bar */}
      <div className="reader-progress-bar" style={{ width: `${scrollProgress * 100}%` }} />

      {/* Sticky header */}
      <div className="reader-sticky-header">
        <div className="reader-title-row">
          <button className="reader-back-btn" onClick={onBack} title="Back to list">&#8592;</button>
          <h1 className="reader-title">{item.title || item.url}</h1>
          {isEphemeral && <span className="ephemeral-reader-badge">In memory</span>}
          {!isEphemeral && (
            <div className="reader-share-wrapper" ref={shareDropdownRef}>
              <button
                className={`reader-share-btn${shareDropdownOpen ? ' active' : ''}`}
                title="Share / Export"
                onClick={() => setShareDropdownOpen((v) => !v)}
              >
                &#x2B06;
              </button>
              {shareDropdownOpen && (
                <div className="reader-share-dropdown">
                  <button className="reader-share-dropdown-item" onClick={() => { onShare(item.id); setShareDropdownOpen(false); }}>
                    &#x1F517; Copy link
                  </button>
                  <button
                    className="reader-share-dropdown-item"
                    onClick={() => { window.location.href = `/items/${encodeURIComponent(item.id)}/export/markdown`; setShareDropdownOpen(false); }}
                  >
                    &#x2B07; Download Markdown
                  </button>
                  <button
                    className="reader-share-dropdown-item"
                    onClick={() => { copyToClipboard(buildMarkdownText(), setMarkdownCopied).catch(() => {}); setShareDropdownOpen(false); }}
                  >
                    {markdownCopied ? '✓ Copied' : '📋 Copy as Markdown'}
                  </button>
                </div>
              )}
            </div>
          )}
          {!isEphemeral && (
            <button
              className={`reader-resummarize-btn${resummarizing ? ' spinning' : ''}`}
              title={isKnowledgeItemDetail(item) && item.transcript ? 'Save again' : 'No transcript'}
              disabled={resummarizing || !(isKnowledgeItemDetail(item) && item.transcript)}
              onClick={handleResummarize}
            >
              {resummarizing ? '⟳' : '↻'}
            </button>
          )}
          {!isEphemeral && (
            <div className="reader-history-wrapper">
              <button
                className={`reader-history-btn${historyOpen ? ' active' : ''}`}
                title="Summary history"
                onClick={handleOpenHistory}
              >
                &#x1F550;
              </button>
              {historyOpen && (
                <div className="reader-history-dropdown">
                  {historyLoading && <div className="reader-history-loading">Loading...</div>}
                  {!historyLoading && historyVersions.length === 0 && (
                    <div className="reader-history-empty">No previous versions</div>
                  )}
                  {!historyLoading && historyVersions.map((v) => (
                    <div key={v.id} className="reader-history-row" style={{cursor:'pointer'}} onClick={() => handleRestoreVersion(v.id)}>
                      <div className="reader-history-date">{new Date(v.createdAt + 'Z').toLocaleString()}</div>
                      <div className="reader-history-preview">{v.summary.slice(0, 100)}{v.summary.length > 100 ? '…' : ''}</div>
                      <button className="reader-history-restore-btn" onClick={(e) => { e.stopPropagation(); handleRestoreVersion(v.id); }}>Restore</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {!isEphemeral && (
            <button
              className={`reader-study-btn${item.studyLater ? ' active' : ''}`}
              title={item.studyLater ? 'Remove from Study Later' : 'Mark for Study Later'}
              onClick={() => onStudyLater(item.id)}
            >
              {item.studyLater ? '📚' : '📖'}
            </button>
          )}
          {!isEphemeral && (
            <button
              className={`reader-archive-btn${item.archived ? ' archived' : ''}`}
              title={item.archived ? 'Unarchive' : 'Archive'}
              onClick={() => onArchive(item.id)}
            >
              {item.archived ? '📤' : '📦'}
            </button>
          )}
          {!isEphemeral && (
            deleteConfirm ? (
              <span className="reader-delete-confirm" onClick={(e) => e.stopPropagation()}>
                Are you sure?{' '}
                <button
                  className="reader-delete-confirm-yes"
                  onClick={() => { setDeleteConfirm(false); onDelete(item.id).catch(() => {}); }}
                >Delete</button>
                {' '}
                <button
                  className="reader-delete-confirm-no"
                  onClick={() => setDeleteConfirm(false)}
                >Cancel</button>
              </span>
            ) : (
              <button
                className="reader-delete-btn"
                title="Delete article"
                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(true); }}
              >
                🗑 Delete
              </button>
            )
          )}
          <button
            className="reader-fullscreen-btn"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={() => setIsFullscreen((v) => !v)}
          >
            {isFullscreen ? '×' : '⛶'}
          </button>
        </div>
        {stats && (
          <span className="reading-stats">~{stats.wordCount.toLocaleString()} words · {stats.minutes} min read</span>
        )}
        {resummarizeToast && <div className="reader-toast">Summary updated</div>}
        {approvedVisibleTags.length > 0 && (
          <div className="reader-sticky-tags">
            {approvedVisibleTags.map((tag: string) => (
              <span key={tag} className="reader-tag approved pending-actions">
                {tag}
                <button
                  className="reader-tag-reject"
                  title="Reject this tag"
                  onClick={() => {
                    if (rejectingTag === tag) {
                      setRejectingTag(null);
                      setRejectReason('');
                    } else {
                      setRejectingTag(tag);
                      setRejectReason('');
                    }
                  }}
                >{rejectingTag === tag ? '\u00D7' : '\u2717'}</button>
              </span>
            ))}
          </div>
        )}
        {rejectingTag && (tagStatusMap[rejectingTag] ?? 'pending') === 'approved' && (
          <div className="reader-tag-reason-row">
            <input
              className="reader-tag-reason-input"
              type="text"
              placeholder={`Why reject "${rejectingTag}"? (optional)`}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onTagAction('reject', rejectingTag, item.id, rejectReason).then(() => {
                    setRejectingTag(null);
                    setRejectReason('');
                  });
                } else if (e.key === 'Escape') {
                  setRejectingTag(null);
                  setRejectReason('');
                }
              }}
              autoFocus
            />
            <button
              className="reader-tag-reason-submit"
              onClick={() => {
                onTagAction('reject', rejectingTag, item.id, rejectReason).then(() => {
                  setRejectingTag(null);
                  setRejectReason('');
                });
              }}
            >Reject</button>
          </div>
        )}
      </div>

      {/* Hero image — hidden for YouTube items since the embed shows the video */}
      {item.imageUrl && item.type !== 'youtube' && (
        <img className="reader-hero-img" src={item.imageUrl} alt="" />
      )}

      {/* YouTube two-column layout: video + key ideas */}
      {item.type === 'youtube' && item.url && (() => {
        const m = item.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
        return m ? (
          <div className="reader-youtube-layout">
            <div className="reader-youtube-layout-video">
              <div className="reader-youtube-embed" style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${m[1]}`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
            {Array.isArray(item.tldr) && item.tldr.length > 0 && (
              <div className="reader-youtube-layout-tldr">
                <div className="reader-tldr-label">Key Ideas</div>
                {item.tldr.map((line, i) => (
                  <div key={i} className="reader-tldr-line">{line}</div>
                ))}
              </div>
            )}
          </div>
        ) : null;
      })()}

      {/* Meta */}
      <div className="reader-meta">
        {item.publishedAt && (
          <span>
            <span className="item-meta-label">Published:</span>{' '}
            {formatDate(item.publishedAt)}{' '}
            <span className={`item-age ${ageClass(item.publishedAt)}`} title={formatDate(item.publishedAt)}>
              ({timeAgo(item.publishedAt)})
            </span>
          </span>
        )}
        <span><span className="item-meta-label">Saved:</span> {formatDate(item.createdAt)}</span>
        {item.author && <span>by {item.author}</span>}
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer">Open original &rarr;</a>
        )}
      </div>

      {/* Highlight tooltip */}
      {highlightTooltip && (
        <button
          className="highlight-tooltip"
          style={{ left: highlightTooltip.x, top: highlightTooltip.y }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleSaveHighlight}
        >
          Highlight
        </button>
      )}

      {/* TL;DR — non-YouTube items only (YouTube items show TLDR in the two-column layout above) */}
      {item.type !== 'youtube' && Array.isArray(item.tldr) && item.tldr.length > 0 && (
        <div className="reader-tldr" onMouseUp={handleSectionMouseUp('tldr')}>
          <div className="reader-tldr-header">
            <div className="reader-tldr-label">TL;DR</div>
            <button
              className="reader-inline-copy-btn"
              onClick={(e) => { e.stopPropagation(); copyToClipboard((item.tldr ?? []).map((l: string) => `- ${l}`).join('\n'), setTldrCopied).catch(() => {}); }}
            >
              {tldrCopied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          {item.tldr.map((line, i) => (
            <div key={i} className="reader-tldr-line">{renderWithHighlights(line, 'tldr')}</div>
          ))}
        </div>
      )}

      {/* Summary */}
      {item.summary && (
        <>
          <div className="reader-divider" />
          <div className="reader-section-header">
            <div className="reader-section-label">Summary</div>
            <button
              className="reader-inline-copy-btn"
              onClick={() => copyToClipboard(item.summary ?? '', setSummaryCopied).catch(() => {})}
            >
              {summaryCopied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="reader-summary" onMouseUp={handleSectionMouseUp('summary')}>{renderWithHighlights(item.summary, 'summary')}</p>
        </>
      )}

      {/* Sections */}
      {Array.isArray(item.sections) && item.sections.length > 0 && (
        <>
          <div className="reader-divider" />
          <div className="reader-section-label">Key Points</div>
          {item.sections.map((sec, i) => {
            const anchor = slugify(sec.title);
            return (
              <div key={i} className="reader-section" id={anchor}>
                <div className="reader-section-title">
                  {sec.title}
                  <a href={`#${anchor}`} className="reader-anchor" aria-label="Section link">§</a>
                </div>
                <ul className="reader-section-points">
                  {(sec.points ?? []).map((pt, j) => <li key={j}>{pt}</li>)}
                </ul>
              </div>
            );
          })}
        </>
      )}

      {/* Tags (pending ones with action buttons) */}
      {visibleTags.some((t: string) => (tagStatusMap[t] ?? 'pending') === 'pending') && (
        <>
          <div className="reader-divider" />
          <div className="reader-tags">
            {visibleTags.map((tag: string) => {
              const st = tagStatusMap[tag] ?? 'pending';
              if (st === 'approved') return null;
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
                    onClick={() => {
                      if (rejectingTag === tag) {
                        setRejectingTag(null);
                        setRejectReason('');
                      } else {
                        setRejectingTag(tag);
                        setRejectReason('');
                      }
                    }}
                  >{rejectingTag === tag ? '\u00D7' : '\u2717'}</button>
                </span>
              );
            })}
          </div>
          {rejectingTag && (tagStatusMap[rejectingTag] ?? 'pending') === 'pending' && (
            <div className="reader-tag-reason-row">
              <input
                className="reader-tag-reason-input"
                type="text"
                placeholder={`Why reject "${rejectingTag}"? (optional)`}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onTagAction('reject', rejectingTag, item.id, rejectReason).then(() => {
                      setRejectingTag(null);
                      setRejectReason('');
                    });
                  } else if (e.key === 'Escape') {
                    setRejectingTag(null);
                    setRejectReason('');
                  }
                }}
                autoFocus
              />
              <button
                className="reader-tag-reason-submit"
                onClick={() => {
                  onTagAction('reject', rejectingTag, item.id, rejectReason).then(() => {
                    setRejectingTag(null);
                    setRejectReason('');
                  });
                }}
              >Reject</button>
            </div>
          )}
        </>
      )}

      {/* Discuss */}
      <div className="reader-divider" />
      <ArticleChat
        {...(!isEphemeral ? { itemId: item.id } : {})}
        content={isEphemeralItem(item)
          ? item.transcript
          : ((isKnowledgeItemDetail(item) ? item.transcript : undefined) ?? item.summary ?? '')}
        messages={discussMessages}
        onMessages={setDiscussMessages}
      />

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
                  {(rel.tags ?? []).filter((t: string) => (item.tags ?? []).includes(t)).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Notes */}
      {!isEphemeral && (
        <>
          <div className="reader-divider" />
          <div className="reader-notes-section">
            <div className="reader-section-label">My Notes</div>
            <textarea
              className="reader-notes-textarea"
              placeholder="Click to add notes..."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
            />
            <div className="reader-notes-footer">
              {noteSaved && <span className="reader-notes-saved">Saved</span>}
              <button
                className="reader-notes-save-btn"
                onClick={() => doSaveNote(notes)}
              >
                Save Note
              </button>
            </div>
          </div>
        </>
      )}

            {/* Highlights */}
      {!isEphemeral && highlights.length > 0 && (
        <>
          <div className="reader-divider" />
          <div className="reader-highlights-section">
            <div className="reader-section-label">Highlights</div>
            {highlights.map((h) => (
              <div key={h.id} className="reader-highlight-row">
                <span className="reader-highlight-text">{h.text}</span>
                <button
                  className="reader-highlight-delete"
                  title="Remove highlight"
                  onClick={() => handleDeleteHighlight(h.id)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Summary quality + model info */}
      {!isEphemeral && item.summary && (
        <>
          <div className="reader-divider" />
          <div className="reader-summary-quality-section">
            {isKnowledgeItemDetail(item) && item.summaryModel && (
              <div className="reader-summary-model">Model: {item.summaryModel}</div>
            )}
            <div className="reader-summary-quality-row">
              <span className="reader-rating-label">Summary quality</span>
              <div className="reader-stars">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = (summaryQualityHover ?? summaryQuality ?? 0) >= star;
                  return (
                    <button
                      key={star}
                      className={`reader-star-btn${filled ? ' filled' : ''}`}
                      onMouseEnter={() => setSummaryQualityHover(star)}
                      onMouseLeave={() => setSummaryQualityHover(undefined)}
                      onClick={async () => {
                        setSummaryQuality(star);
                        await api.saveSummaryQuality(item.id, star, summaryQualityReason);
                      }}
                      title={`${star} star${star !== 1 ? 's' : ''}`}
                    >
                      {filled ? '★' : '☆'}
                    </button>
                  );
                })}
              </div>
            </div>
            {summaryQuality && (
              <input
                type="text"
                className="reader-summary-quality-reason"
                placeholder="Reason for this rating..."
                value={summaryQualityReason}
                onChange={(e) => {
                  setSummaryQualityReason(e.target.value);
                  if (sqReasonDebounce.current) clearTimeout(sqReasonDebounce.current);
                  sqReasonDebounce.current = setTimeout(() => {
                    api.saveSummaryQuality(item.id, summaryQuality, e.target.value).catch(() => {});
                  }, 800);
                }}
              />
            )}
          </div>
        </>
      )}

      {/* Transcript */}
      {(isKnowledgeItemDetail(item) && item.transcript) && (() => {
        const rawTranscript = item.transcript;
        const matchCount = countMatches(rawTranscript, transcriptSearchQuery);
        const isLong = rawTranscript.length > TRANSCRIPT_COLLAPSE_LIMIT;
        const displayText = isLong && !transcriptExpanded
          ? rawTranscript.slice(0, TRANSCRIPT_PREVIEW_LENGTH)
          : rawTranscript;
        const html = buildTranscriptHtml(displayText, transcriptSearchQuery, transcriptMatchIdx);
        return (
          <>
            <div className="reader-divider" />
            <details className="reader-transcript">
              <summary>
                Full transcript
                <button
                  className="transcript-copy-btn"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyTranscript(); }}
                >
                  {transcriptCopied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  className="transcript-copy-btn"
                  title="Search in transcript (Ctrl+F)"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTranscriptSearchOpen((v) => !v);
                    setTimeout(() => transcriptSearchRef.current?.focus(), 0);
                  }}
                >
                  {transcriptSearchOpen ? 'Close search' : 'Search'}
                </button>
              </summary>
              {transcriptSearchOpen && (
                <div className="transcript-search-bar">
                  <input
                    ref={transcriptSearchRef}
                    className="transcript-search-input"
                    placeholder="Search transcript…"
                    value={transcriptSearchQuery}
                    onChange={(e) => {
                      setTranscriptSearchQuery(e.target.value);
                      setTranscriptMatchIdx(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setTranscriptSearchOpen(false); setTranscriptSearchQuery(''); }
                      if (e.key === 'Enter' || e.key === 'F3') {
                        e.preventDefault();
                        const next = e.shiftKey
                          ? (transcriptMatchIdx - 1 + matchCount) % Math.max(matchCount, 1)
                          : (transcriptMatchIdx + 1) % Math.max(matchCount, 1);
                        setTranscriptMatchIdx(next);
                        setTimeout(() => {
                          const el = transcriptBodyRef.current?.querySelectorAll<HTMLElement>('.transcript-highlight.active')[0];
                          el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }, 0);
                      }
                    }}
                  />
                  {transcriptSearchQuery && (
                    <span className="transcript-search-count">
                      {matchCount === 0 ? 'No matches' : `${transcriptMatchIdx + 1} of ${matchCount}`}
                    </span>
                  )}
                  <button
                    className="transcript-search-nav"
                    title="Previous match"
                    onClick={() => {
                      const prev = (transcriptMatchIdx - 1 + matchCount) % Math.max(matchCount, 1);
                      setTranscriptMatchIdx(prev);
                      setTimeout(() => {
                        const el = transcriptBodyRef.current?.querySelectorAll<HTMLElement>('.transcript-highlight.active')[0];
                        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                      }, 0);
                    }}
                  >&#8593;</button>
                  <button
                    className="transcript-search-nav"
                    title="Next match"
                    onClick={() => {
                      const next = (transcriptMatchIdx + 1) % Math.max(matchCount, 1);
                      setTranscriptMatchIdx(next);
                      setTimeout(() => {
                        const el = transcriptBodyRef.current?.querySelectorAll<HTMLElement>('.transcript-highlight.active')[0];
                        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                      }, 0);
                    }}
                  >&#8595;</button>
                  <button
                    className="transcript-search-close"
                    title="Close search"
                    onClick={() => { setTranscriptSearchOpen(false); setTranscriptSearchQuery(''); }}
                  >&times;</button>
                </div>
              )}
              <div ref={transcriptBodyRef} className="transcript-body" dangerouslySetInnerHTML={{ __html: html }} />
              {isLong && (
                <button
                  className="transcript-collapse-btn"
                  onClick={() => setTranscriptExpanded((v) => !v)}
                >
                  {transcriptExpanded ? 'Collapse ↑' : 'Show full transcript ↓'}
                </button>
              )}
            </details>
          </>
        );
      })()}

      {/* Back to top */}
      {showBackToTop && (
        <button
          className="reader-back-to-top"
          onClick={() => paneRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑ Top
        </button>
      )}
    </div>
  );
}
