import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { KnowledgeItemPreview, KnowledgeItemDetail } from './api.ts';
import { api, BASE, toKnowledgeItemId, type KnowledgeItemId, type TagsResponse, type TagStatsResponse, type ReadingStatsResponse, type Collection, type Feed, type StatsSummary, type TagSuggestion, type SummaryVersion, type FilterPreset, type Highlight, type QuickPreviewResult, type KnowledgeSection, type SummaryQuality, type PromptVersion } from './api.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

type TagData = TagsResponse;

// ── Type guards ───────────────────────────────────────────────────────────────

/** Returns true when item has been fully fetched and includes the transcript field. */
function isKnowledgeItemDetail(item: KnowledgeItemPreview | KnowledgeItemDetail | EphemeralItem | null | undefined): item is KnowledgeItemDetail {
  return item != null && 'transcript' in item && !('_ephemeral' in item);
}

/** Returns true when item is an in-memory ephemeral preview (not saved to DB). */
function isEphemeralItem(item: KnowledgeItemPreview | KnowledgeItemDetail | EphemeralItem | null | undefined): item is EphemeralItem {
  return item != null && '_ephemeral' in item && item._ephemeral === true;
}

/** Type predicate: narrows unknown to Record<string, unknown> after a runtime check. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ── Ephemeral items (in-memory, not persisted) ────────────────────────────────

interface EphemeralItem {
  _ephemeral: true;
  id: KnowledgeItemId;
  url: string;
  type: 'youtube' | 'video' | 'article';
  title: string;
  createdAt: string;
  tags: string[];
  tldr: string[];
  summary: string;
  sections: KnowledgeSection[];
  transcript: string;
  status: 'done';
  starred: false;
  archived: false;
  pinned: false;
  studyLater: false;
  readAt?: never;
  notes?: never;
  rating?: never;
  imageUrl?: never;
  author?: never;
  publishedAt?: never;
  feedId?: never;
  feedName?: never;
  error?: never;
}

function makeEphemeralItem(result: QuickPreviewResult): EphemeralItem {
  return {
    _ephemeral: true,
    id: toKnowledgeItemId(`preview-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    url: result.url,
    type: result.type ?? 'article',
    title: result.title || result.url,
    createdAt: new Date().toISOString(),
    tags: result.tags,
    tldr: result.tldr,
    summary: result.summary,
    sections: result.sections ?? [],
    transcript: result.content,
    status: 'done',
    starred: false,
    archived: false,
    pinned: false,
    studyLater: false,
  };
}

// ── ErrorBoundary ─────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <span className="error-boundary-msg">
            {this.props.label ?? 'Component'} error: {this.state.error.message}
          </span>
          <button
            className="error-boundary-retry"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function computeRelated(current: KnowledgeItemPreview | KnowledgeItemDetail, all: KnowledgeItemPreview[]): KnowledgeItemPreview[] {
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

// ── SettingsPanel ─────────────────────────────────────────────────────────────

type SystemStatus = { whisper: boolean; ytdlp: boolean; pdftotext: boolean; ollama: boolean };

function SystemStatusRow({ label, ok, installCmd, docsUrl }: { label: string; ok: boolean; installCmd?: string; docsUrl?: string }) {
  const [copied, setCopied] = React.useState(false);
  function copyCmd() {
    if (!installCmd) return;
    navigator.clipboard.writeText(installCmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }
  return (
    <div className="sys-status-row">
      <span className="sys-status-icon">{ok ? '✅' : '❌'}</span>
      <span className="sys-status-label">{label}</span>
      {!ok && installCmd && (
        <span className="sys-status-install">
          <code className="sys-status-cmd">{installCmd}</code>
          <button className="sys-status-copy-btn" onClick={copyCmd} title="Copy">{copied ? 'Copied' : 'Copy'}</button>
        </span>
      )}
      {!ok && docsUrl && (
        <a className="sys-status-link" href={docsUrl} target="_blank" rel="noreferrer">Docs</a>
      )}
    </div>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [lang, setLang] = useState<string>('english');
  const [keepTerms, setKeepTerms] = useState<boolean>(true);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [testDataCount, setTestDataCount] = useState(0);
  const [devOpen, setDevOpen] = useState(false);
  const [clearStatus, setClearStatus] = useState<string | null>(null);
  const [dailyGoal, setDailyGoal] = useState(3);
  const [weeklyGoal, setWeeklyGoal] = useState(15);
  const [rebuildStatus, setRebuildStatus] = useState<string | null>(null);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [summaryPrompts, setSummaryPrompts] = useState<PromptVersion[]>([]);
  const [chatPrompts, setChatPrompts] = useState<PromptVersion[]>([]);
  const [summaryPromptsOpen, setSummaryPromptsOpen] = useState(false);
  const [chatPromptsOpen, setChatPromptsOpen] = useState(false);
  const [summaryPromptDraft, setSummaryPromptDraft] = useState('');
  const [chatPromptDraft, setChatPromptDraft] = useState('');
  const [summaryPromptSaveStatus, setSummaryPromptSaveStatus] = useState<string | null>(null);
  const [chatPromptSaveStatus, setChatPromptSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((s) => {
      setLang(s['summary_language'] ?? 'english');
      setKeepTerms((s['translate_terms'] ?? 'true') === 'true');
      setNotificationsEnabled((s['notifications_enabled'] ?? '0') === '1');
      setDailyGoal(parseInt(s['daily_reading_goal'] ?? s['daily_goal'] ?? '3', 10) || 3);
      setWeeklyGoal(parseInt(s['weekly_reading_goal'] ?? s['weekly_goal'] ?? '15', 10) || 15);
      setLoading(false);
    }).catch(() => setLoading(false));
    Promise.all([
      api.getSystemStatus(),
      api.getOllamaStatus(),
    ]).then(([sys, ollama]) => {
      setSysStatus({ ...sys, ollama: ollama.ok });
    }).catch(() => {});
    api.getTestDataCount().then(({ count }) => setTestDataCount(count)).catch(() => {});
  }, []);

  async function handleSave() {
    await api.updateSetting('summary_language', lang);
    await api.updateSetting('translate_terms', keepTerms ? 'true' : 'false');
    await api.updateSetting('notifications_enabled', notificationsEnabled ? '1' : '0');
    await api.updateSetting('daily_reading_goal', String(dailyGoal));
    await api.updateSetting('weekly_reading_goal', String(weeklyGoal));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleNotificationsToggle(checked: boolean) {
    if (checked && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    const granted = 'Notification' in window && Notification.permission === 'granted';
    setNotificationsEnabled(checked && granted);
  }

  async function handleClearTestData() {
    try {
      const { deleted } = await api.clearTestData();
      setClearStatus(`Deleted ${deleted} test item${deleted !== 1 ? 's' : ''}`);
      setTestDataCount(0);
      setTimeout(() => setClearStatus(null), 3000);
    } catch {
      setClearStatus('Failed to clear test data');
      setTimeout(() => setClearStatus(null), 3000);
    }
  }

  async function handleRebuildEmbeddings() {
    try {
      await api.rebuildEmbeddings();
      setRebuildStatus('Rebuild started');
      setTimeout(() => setRebuildStatus(null), 3000);
    } catch {
      setRebuildStatus('Failed to start rebuild');
      setTimeout(() => setRebuildStatus(null), 3000);
    }
  }

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-panel">
        <div className="settings-panel-header">
          <span>Settings</span>
          <button className="settings-panel-close" onClick={onClose}>&times;</button>
        </div>
        {loading ? (
          <div className="settings-panel-body"><span className="settings-loading">Loading...</span></div>
        ) : (
          <div className="settings-panel-body">
            <div className="settings-section">
              <div className="settings-section-label">Summarization Language</div>
              <label className="settings-radio-row">
                <input type="radio" name="lang" value="english" checked={lang === 'english'} onChange={() => setLang('english')} />
                <span>English (default)</span>
              </label>
              <label className="settings-radio-row">
                <input type="radio" name="lang" value="original" checked={lang === 'original'} onChange={() => setLang('original')} />
                <span>Original language</span>
              </label>
            </div>
            <div className="settings-section">
              <div className="settings-section-label">Keep original terms in summaries</div>
              <label className="settings-checkbox-row">
                <input type="checkbox" checked={keepTerms} onChange={(e) => setKeepTerms(e.target.checked)} disabled={lang !== 'english'} />
                <span className={lang !== 'english' ? 'settings-disabled' : ''}>
                  When source is non-English, include original terms in parentheses after English translation
                  <span className="settings-example">e.g. "agency fee (仲介手数料)"</span>
                </span>
              </label>
            </div>
            <div className="settings-section">
              <div className="settings-section-label">System</div>
              {sysStatus === null ? (
                <span className="settings-loading">Checking tools…</span>
              ) : (
                <>
                  <SystemStatusRow label="Ollama" ok={sysStatus.ollama} docsUrl="https://ollama.ai" {...(!sysStatus.ollama ? { installCmd: 'brew install ollama' } : {})} />
                  <SystemStatusRow label="yt-dlp" ok={sysStatus.ytdlp} installCmd="brew install yt-dlp" />
                  <SystemStatusRow label="Whisper" ok={sysStatus.whisper} installCmd="pip install openai-whisper" docsUrl="https://github.com/openai/whisper" />
                  <SystemStatusRow label="pdftotext" ok={sysStatus.pdftotext} installCmd="brew install poppler" />
                  <div className="sys-status-row" style={{ marginTop: 8 }}>
                    <button className="settings-btn" onClick={handleRebuildEmbeddings}>
                      Rebuild embeddings
                    </button>
                    {rebuildStatus && <span className="settings-developer-status">{rebuildStatus}</span>}
                  </div>
                </>
              )}
            </div>
            <div className="settings-section">
              <div className="settings-section-label">Reading Goals</div>
              <label className="settings-input-row">
                <span>Daily reading goal</span>
                <input
                  type="number"
                  className="settings-number-input"
                  min={1}
                  max={100}
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
                <span className="settings-input-unit">items / day</span>
              </label>
              <label className="settings-input-row">
                <span>Weekly reading goal</span>
                <input
                  type="number"
                  className="settings-number-input"
                  min={1}
                  max={500}
                  value={weeklyGoal}
                  onChange={(e) => setWeeklyGoal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
                <span className="settings-input-unit">items / week</span>
              </label>
            </div>
            <div className="settings-section">
              <div className="settings-section-label">Notifications</div>
              <label className="settings-checkbox-row">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => handleNotificationsToggle(e.target.checked)}
                  disabled={!('Notification' in window)}
                />
                <span className={!('Notification' in window) ? 'settings-disabled' : ''}>
                  Show browser notification when an item finishes processing
                  {!('Notification' in window) && <span className="settings-example"> (not supported in this browser)</span>}
                  {'Notification' in window && Notification.permission === 'denied' && <span className="settings-example"> (permission denied — check browser settings)</span>}
                </span>
              </label>
            </div>
            <div className="settings-section">
              <button
                className="settings-developer-toggle"
                onClick={() => {
                  const opening = !promptsOpen;
                  setPromptsOpen(opening);
                  if (opening) {
                    api.getSummaryPrompts().then((list) => {
                      setSummaryPrompts(list);
                      const active = list.find((p) => p.is_active);
                      if (active) setSummaryPromptDraft(active.prompt);
                    }).catch(() => {});
                    api.getChatPrompts().then((list) => {
                      setChatPrompts(list);
                      const active = list.find((p) => p.is_active);
                      if (active) setChatPromptDraft(active.prompt);
                    }).catch(() => {});
                  }
                }}
              >
                Prompt Versions {promptsOpen ? '\u25B2' : '\u25BC'}
              </button>
              {promptsOpen && (
                <div style={{ marginTop: 8 }}>
                  {/* Summary Prompts */}
                  <div style={{ marginBottom: 12 }}>
                    <div className="settings-section-label">Summary Prompt</div>
                    <textarea
                      value={summaryPromptDraft}
                      onChange={(e) => { setSummaryPromptDraft(e.target.value); setSummaryPromptSaveStatus(null); }}
                      style={{ width: '100%', minHeight: 120, maxHeight: 300, fontFamily: 'monospace', fontSize: 11, padding: 6, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg)', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <button
                        className="settings-save-btn"
                        onClick={() => {
                          if (!summaryPromptDraft.trim()) return;
                          setSummaryPromptSaveStatus('Saving...');
                          api.saveSummaryPrompt(summaryPromptDraft).then(() => {
                            setSummaryPromptSaveStatus('Saved');
                            api.getSummaryPrompts().then((list) => {
                              setSummaryPrompts(list);
                              const active = list.find((p) => p.is_active);
                              if (active) setSummaryPromptDraft(active.prompt);
                            });
                            setTimeout(() => setSummaryPromptSaveStatus(null), 2000);
                          }).catch(() => setSummaryPromptSaveStatus('Error'));
                        }}
                      >
                        Save
                      </button>
                      {summaryPromptSaveStatus && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{summaryPromptSaveStatus}</span>}
                    </div>
                    {/* History */}
                    {summaryPrompts.filter((p) => !p.is_active).length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          className="settings-developer-toggle"
                          onClick={() => setSummaryPromptsOpen((v) => !v)}
                          style={{ fontSize: 12 }}
                        >
                          History ({summaryPrompts.filter((p) => !p.is_active).length}) {summaryPromptsOpen ? '\u25B2' : '\u25BC'}
                        </button>
                        {summaryPromptsOpen && summaryPrompts.filter((p) => !p.is_active).map((p) => (
                          <details key={p.id} style={{ marginTop: 4 }}>
                            <summary style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>{p.created_at}</summary>
                            <pre style={{ margin: '4px 0 0', fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', background: 'var(--bg-card)', padding: 6, borderRadius: 4 }}>{p.prompt}</pre>
                          </details>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chat Prompts */}
                  <div>
                    <div className="settings-section-label">Chat Prompt</div>
                    <textarea
                      value={chatPromptDraft}
                      onChange={(e) => { setChatPromptDraft(e.target.value); setChatPromptSaveStatus(null); }}
                      style={{ width: '100%', minHeight: 120, maxHeight: 300, fontFamily: 'monospace', fontSize: 11, padding: 6, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg)', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <button
                        className="settings-save-btn"
                        onClick={() => {
                          if (!chatPromptDraft.trim()) return;
                          setChatPromptSaveStatus('Saving...');
                          api.saveChatPrompt(chatPromptDraft).then(() => {
                            setChatPromptSaveStatus('Saved');
                            api.getChatPrompts().then((list) => {
                              setChatPrompts(list);
                              const active = list.find((p) => p.is_active);
                              if (active) setChatPromptDraft(active.prompt);
                            });
                            setTimeout(() => setChatPromptSaveStatus(null), 2000);
                          }).catch(() => setChatPromptSaveStatus('Error'));
                        }}
                      >
                        Save
                      </button>
                      {chatPromptSaveStatus && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{chatPromptSaveStatus}</span>}
                    </div>
                    {/* History */}
                    {chatPrompts.filter((p) => !p.is_active).length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          className="settings-developer-toggle"
                          onClick={() => setChatPromptsOpen((v) => !v)}
                          style={{ fontSize: 12 }}
                        >
                          History ({chatPrompts.filter((p) => !p.is_active).length}) {chatPromptsOpen ? '\u25B2' : '\u25BC'}
                        </button>
                        {chatPromptsOpen && chatPrompts.filter((p) => !p.is_active).map((p) => (
                          <details key={p.id} style={{ marginTop: 4 }}>
                            <summary style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>{p.created_at}</summary>
                            <pre style={{ margin: '4px 0 0', fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', background: 'var(--bg-card)', padding: 6, borderRadius: 4 }}>{p.prompt}</pre>
                          </details>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="settings-footer">
              <span className="settings-note">Settings apply to new summaries only</span>
              <button className="settings-save-btn" onClick={handleSave}>
                {saved ? 'Saved \u2713' : 'Save'}
              </button>
            </div>
            {testDataCount > 0 && (
              <div className="settings-section settings-developer-section">
                <button className="settings-developer-toggle" onClick={() => setDevOpen((v) => !v)}>
                  Developer {devOpen ? '▲' : '▼'}
                </button>
                {devOpen && (
                  <div className="settings-developer-body">
                    <div className="settings-developer-row">
                      <button className="settings-clear-test-btn" onClick={handleClearTestData}>
                        Clear test data
                      </button>
                      <span className="settings-developer-count">{testDataCount} test item{testDataCount !== 1 ? 's' : ''}</span>
                      {clearStatus && <span className="settings-developer-status">{clearStatus}</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── BulkAddModal ──────────────────────────────────────────────────────────────

type BulkUrlResult = { url: string; status: 'queued' | 'exists' | 'error'; message?: string };

function BulkAddModal({ onClose, onQueued }: { onClose: () => void; onQueued?: (id: string, url: string) => void }) {
  const [tab, setTab] = useState<'urls' | 'bookmarks' | 'feeds'>('urls');
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BulkUrlResult[] | null>(null);
  const [invalidUrls, setInvalidUrls] = useState<string[]>([]);
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

  async function handleAddFeed() {
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

  async function handleDeleteFeed(id: string) {
    await api.deleteFeed(id).catch(() => {});
    setFeeds((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleRefreshAll() {
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

  async function handleQueue() {
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

  async function handleBookmarkImport() {
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

  async function handlePreview() {
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

  async function handleSavePreview() {
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

// ── StatsPanel ────────────────────────────────────────────────────────────────

function StatsPanel({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statError, setStatError] = useState<string | null>(null);

  useEffect(() => {
    api.getStatsSummary()
      .then((s) => { setStats(s); setLoading(false); })
      .catch(() => { setStatError('Failed to load stats'); setLoading(false); });
  }, []);

  const maxTagCount = stats && stats.topTags.length > 0 ? Math.max(...stats.topTags.map((t) => t.count), 1) : 1;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel stats-panel">
        <div className="modal-header">
          <span>Stats</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {loading && <div className="stats-loading">Loading&hellip;</div>}
          {statError && <div className="stats-error">{statError}</div>}
          {stats && (
            <>
              <div className="stats-grid">
                <div className="stats-card">
                  <div className="stats-card-value">{stats.totalItems}</div>
                  <div className="stats-card-label">Total items</div>
                </div>
                <div className="stats-card">
                  <div className="stats-card-value">{stats.totalRead}</div>
                  <div className="stats-card-label">Read</div>
                </div>
                <div className="stats-card">
                  <div className="stats-card-value">{stats.totalStarred}</div>
                  <div className="stats-card-label">Starred</div>
                </div>
                <div className="stats-card">
                  <div className="stats-card-value">{stats.totalPinned}</div>
                  <div className="stats-card-label">Pinned</div>
                </div>
                <div className="stats-card">
                  <div className="stats-card-value">{stats.totalNotes}</div>
                  <div className="stats-card-label">With notes</div>
                </div>
                <div className="stats-card">
                  <div className="stats-card-value">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}</div>
                  <div className="stats-card-label">Avg rating</div>
                </div>
                <div className="stats-card">
                  <div className="stats-card-value">{stats.savedThisWeek}</div>
                  <div className="stats-card-label">This week</div>
                </div>
                <div className="stats-card">
                  <div className="stats-card-value">{stats.savedThisMonth}</div>
                  <div className="stats-card-label">This month</div>
                </div>
              </div>

              <div className="stats-section-label">Content types</div>
              <div className="stats-type-row">
                {(Object.entries(stats.byType)).map(([type, count]) => (
                  <span key={type} className="stats-type-chip">
                    <span className="stats-type-name">{type}</span>
                    <span className="stats-type-count">{count}</span>
                  </span>
                ))}
              </div>

              {stats.avgReadingTime > 0 && (
                <div className="stats-meta-row">
                  Avg reading time: <strong>{stats.avgReadingTime} min</strong>
                </div>
              )}
              {stats.mostReadDomain && (
                <div className="stats-meta-row">
                  Most read domain: <strong>{stats.mostReadDomain}</strong>
                </div>
              )}

              {stats.topTags.length > 0 && (
                <>
                  <div className="stats-section-label">Top tags</div>
                  <div className="stats-tag-bars">
                    {stats.topTags.map(({ tag, count }) => (
                      <div key={tag} className="stats-tag-bar-row">
                        <span className="stats-tag-bar-label">{tag}</span>
                        <div className="stats-tag-bar-track">
                          <div
                            className="stats-tag-bar-fill"
                            style={{ width: `${Math.round((count / maxTagCount) * 100)}%` }}
                          />
                        </div>
                        <span className="stats-tag-bar-count">{count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TagCloudPanel ─────────────────────────────────────────────────────────────

type ConsolidationGroup = { canonical: string; similar: string[]; reason: string };

type ConsolidatePhase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'review'; groups: ConsolidationGroup[]; checked: boolean[] }
  | { phase: 'applying' }
  | { phase: 'done'; merged: number; count: number }
  | { phase: 'empty' }
  | { phase: 'error'; message: string };

function TagCloudPanel({
  stats,
  onTagClick,
  onApprove,
  onReject,
  onClose,
  onRefresh,
}: {
  stats: TagStatsResponse;
  onTagClick: (tag: string) => void;
  onApprove: (tag: string) => Promise<void>;
  onReject: (tag: string, itemId: string) => Promise<void>;
  onClose: () => void;
  onRefresh?: () => void;
}) {
  const [mergingTag, setMergingTag] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [approvingTag, setApprovingTag] = useState<string | null>(null);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [consolidate, setConsolidate] = useState<ConsolidatePhase>({ phase: 'idle' });

  useEffect(() => {
    api.getTagSuggestions().then(setSuggestions).catch(() => {});
  }, []);

  async function handleConsolidate() {
    setConsolidate({ phase: 'loading' });
    try {
      const groups = await api.suggestTagConsolidation();
      if (groups.length === 0) {
        setConsolidate({ phase: 'empty' });
      } else {
        setConsolidate({ phase: 'review', groups, checked: groups.map(() => true) });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setConsolidate({ phase: 'error', message });
    }
  }

  async function handleApplyConsolidation() {
    if (consolidate.phase !== 'review') return;
    const selected = consolidate.groups.filter((_, i) => consolidate.checked[i]);
    if (selected.length === 0) return;
    setConsolidate({ phase: 'applying' });
    try {
      const result = await api.applyTagConsolidation(selected);
      setConsolidate({ phase: 'done', merged: selected.length, count: result.tagsAffected.length });
      onRefresh?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setConsolidate({ phase: 'error', message });
    }
  }

  function toggleConsolidateCheck(i: number) {
    if (consolidate.phase !== 'review') return;
    const newChecked = [...consolidate.checked];
    newChecked[i] = !newChecked[i];
    setConsolidate({ ...consolidate, checked: newChecked });
  }

  function selectAllConsolidate(val: boolean) {
    if (consolidate.phase !== 'review') return;
    setConsolidate({ ...consolidate, checked: consolidate.groups.map(() => val) });
  }

  async function approveSuggestedTag(tag: string) {
    setApprovingTag(tag);
    try {
      await onApprove(tag);
      setSuggestions((prev) => prev.map((s) => ({
        ...s,
        suggestedTags: s.suggestedTags.filter((t) => t !== tag),
      })).filter((s) => s.suggestedTags.length > 0));
      onRefresh?.();
    } finally {
      setApprovingTag(null);
    }
  }

  async function approveAllSuggested(suggestion: TagSuggestion) {
    for (const tag of suggestion.suggestedTags) {
      await onApprove(tag).catch(() => {});
    }
    setSuggestions((prev) => prev.filter((s) => s.itemId !== suggestion.itemId));
    onRefresh?.();
  }

  const maxCount = Math.max(...stats.approved.map((t) => t.count), 1);

  function tagFontSize(count: number): number {
    const min = 11;
    const max = 24;
    return min + ((count / maxCount) * (max - min));
  }

  function tagOpacity(count: number): number {
    return 0.55 + (count / maxCount) * 0.45;
  }

  async function handleMergeConfirm() {
    if (!mergingTag || !mergeTarget || mergeTarget === mergingTag) return;
    try {
      const result = await api.mergeTags(mergingTag, mergeTarget);
      setMergeStatus(`Merged "${mergingTag}" into "${mergeTarget}" (${result.itemsUpdated} item${result.itemsUpdated !== 1 ? 's' : ''} updated)`);
      setMergingTag(null);
      setMergeTarget('');
      onRefresh?.();
    } catch {
      setMergeStatus('Merge failed');
    }
  }

  async function handleRenameConfirm() {
    if (!renamingTag || !renameValue.trim() || renameValue.trim() === renamingTag) {
      setRenamingTag(null);
      return;
    }
    try {
      await api.renameTag(renamingTag, renameValue.trim());
      setMergeStatus(`Renamed "${renamingTag}" to "${renameValue.trim()}"`);
      onRefresh?.();
    } catch {
      setMergeStatus('Rename failed');
    }
    setRenamingTag(null);
    setRenameValue('');
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel tag-cloud-panel">
        <div className="modal-header">
          <span>Tag Browser</span>
          <span className="tag-cloud-stats">{stats.totalItems} items · {stats.approved.length} tags · {stats.pending.length} pending{suggestions.length > 0 ? ` · ${suggestions.length} suggestions` : ''}</span>
          <button
            className="btn-consolidate"
            onClick={handleConsolidate}
            disabled={consolidate.phase === 'loading' || consolidate.phase === 'applying'}
            title="Use AI to find and merge similar tags"
          >
            {consolidate.phase === 'loading' ? 'Analyzing tags...' : consolidate.phase === 'applying' ? 'Merging...' : '✨ Consolidate'}
          </button>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {mergeStatus && <div className="tag-merge-status">{mergeStatus}</div>}
          {consolidate.phase === 'review' && (
            <div className="consolidate-review">
              <div className="consolidate-review-header">
                <span className="consolidate-review-title">Proposed Consolidations</span>
                <div className="consolidate-review-actions">
                  <button className="btn-sm" onClick={() => selectAllConsolidate(true)}>Select All</button>
                  <button className="btn-sm" onClick={() => selectAllConsolidate(false)}>Deselect All</button>
                </div>
              </div>
              <div className="consolidate-groups">
                {consolidate.groups.map((g, i) => (
                  <div key={g.canonical} className={`consolidate-group${consolidate.checked[i] ? ' consolidate-group--checked' : ''}`}>
                    <label className="consolidate-group-label">
                      <input
                        type="checkbox"
                        checked={consolidate.checked[i] ?? true}
                        onChange={() => toggleConsolidateCheck(i)}
                      />
                      <span className="consolidate-canonical">{g.canonical}</span>
                    </label>
                    <div className="consolidate-similar">
                      Merging: {g.similar.map((s, si) => (
                        <span key={s}>{si > 0 ? ', ' : ''}<span className="consolidate-similar-tag">"{s}"</span></span>
                      ))} &rarr; <strong>{g.canonical}</strong>
                    </div>
                    <div className="consolidate-reason">{g.reason}</div>
                  </div>
                ))}
              </div>
              <div className="consolidate-review-footer">
                <button
                  className="btn-primary"
                  onClick={handleApplyConsolidation}
                  disabled={!consolidate.checked.some(Boolean)}
                >Apply Selected</button>
                <button className="btn-sm" onClick={() => setConsolidate({ phase: 'idle' })}>&#x2715;</button>
              </div>
            </div>
          )}
          {consolidate.phase === 'empty' && (
            <div className="consolidate-empty">&#10003; Tags are already well-organized!</div>
          )}
          {consolidate.phase === 'done' && (
            <div className="consolidate-done">Merged {consolidate.merged} group{consolidate.merged !== 1 ? 's' : ''} &mdash; {consolidate.count} tag{consolidate.count !== 1 ? 's' : ''} consolidated</div>
          )}
          {consolidate.phase === 'error' && (
            <div className="consolidate-error">Consolidation failed: {consolidate.message}</div>
          )}
          {mergingTag ? (
            <div className="tag-merge-form">
              <span>Merge <strong>{mergingTag}</strong> into:</span>
              <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} autoFocus>
                <option value="">— select target —</option>
                {stats.approved
                  .filter((t) => t.name !== mergingTag)
                  .map((t) => (
                    <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
                  ))}
              </select>
              <button className="tag-panel-approve" onClick={handleMergeConfirm} disabled={!mergeTarget}>Confirm</button>
              <button className="tag-panel-reject" onClick={() => { setMergingTag(null); setMergeTarget(''); }}>Cancel</button>
            </div>
          ) : stats.approved.length === 0 ? (
            <p className="tag-cloud-empty">No approved tags yet.</p>
          ) : (
            <div className="tag-cloud">
              {stats.approved.map(({ name, count }) => (
                <span key={name} className="tag-cloud-item-wrap">
                  {renamingTag === name ? (
                    <input
                      className="tag-rename-input"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleRenameConfirm(); }
                        if (e.key === 'Escape') { setRenamingTag(null); setRenameValue(''); }
                      }}
                      onBlur={() => { setRenamingTag(null); setRenameValue(''); }}
                    />
                  ) : (
                    <span
                      className="tag-cloud-item"
                      style={{ fontSize: `${tagFontSize(count)}px`, opacity: tagOpacity(count) }}
                      title={`${count} item${count !== 1 ? 's' : ''} — double-click to rename`}
                      onClick={() => { onClose(); onTagClick(name); }}
                      onDoubleClick={(e) => { e.stopPropagation(); setRenamingTag(name); setRenameValue(name); setMergeStatus(null); }}
                    >
                      {name}
                    </span>
                  )}
                  <button
                    className="tag-merge-btn"
                    title={`Merge "${name}" into another tag`}
                    onClick={() => { setMergingTag(name); setMergeTarget(''); setMergeStatus(null); }}
                  >⇒</button>
                </span>
              ))}
            </div>
          )}

          {stats.pending.length > 0 && (
            <>
              <div className="tag-cloud-section-label">Pending review</div>
              <div className="tags-panel-body" style={{ maxHeight: 200 }}>
                {stats.pending.map((p) => (
                  <div className="tag-panel-row" key={`${p.tag}-${p.itemId}`}>
                    <span className="tag-panel-name">{p.tag}</span>
                    <span className="tag-panel-item" title={p.itemTitle}>{p.itemTitle || '—'}</span>
                    <button className="tag-panel-approve" onClick={() => onApprove(p.tag)}>&#x2713;</button>
                    <button className="tag-panel-reject" onClick={() => onReject(p.tag, p.itemId)}>&#x2717;</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {suggestions.length > 0 && (
            <>
              <div className="tag-cloud-section-label">Suggestions</div>
              <div className="tags-panel-body" style={{ maxHeight: 220 }}>
                {suggestions.map((s) => (
                  <div key={s.itemId} className="tag-suggestion-row">
                    <span className="tag-suggestion-title" title={s.title}>{s.title || '—'}</span>
                    <div className="tag-suggestion-tags">
                      {s.suggestedTags.map((tag) => (
                        <span key={tag} className="tag-suggestion-chip">
                          {tag}
                          <button
                            className="tag-suggestion-approve"
                            title={`Approve "${tag}"`}
                            disabled={approvingTag === tag}
                            onClick={() => approveSuggestedTag(tag)}
                          >&#x2713;</button>
                        </span>
                      ))}
                    </div>
                    <button
                      className="tag-panel-approve tag-suggestion-approve-all"
                      title="Approve all suggested tags for this item"
                      onClick={() => approveAllSuggested(s)}
                    >Approve all</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ArticleChat ──────────────────────────────────────────────────────────────

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function ArticleChat({
  content,
  itemId,
  messages,
  onMessages,
}: {
  content: string;
  itemId?: string;
  messages: ChatMessage[];
  onMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load persisted chat history from DB when itemId changes
  useEffect(() => {
    if (!itemId) return;
    api.getChatHistory(itemId).then(data => {
      if (data.messages.length > 0) onMessages(data.messages);
    }).catch(() => {});
  }, [itemId]);

  async function handleSend() {
    const msg = input.trim();
    if (!msg || loading) return;
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: msg }];
    onMessages(newMessages);
    setInput('');
    setLoading(true);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    try {
      let reply: string;
      if (itemId) {
        const res = await api.discussItem(itemId, msg, messages);
        reply = res.reply;
      } else {
        const res = await api.previewChat(content, newMessages);
        reply = res.reply;
      }
      onMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (err) {
      onMessages([...newMessages, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    }
  }

  return (
    <div className="reader-discuss-section">
      <div className="reader-discuss-header">
        <div className="reader-section-label">Discuss</div>
        {itemId && messages.length > 0 && (
          <button
            className="chat-clear-btn"
            onClick={() => {
              api.clearChatHistory(itemId).then(() => { onMessages([]); setInput(''); }).catch(() => {});
            }}
            title="Clear chat history"
          >Clear</button>
        )}
      </div>
      <div className="reader-discuss-messages">
        {messages.length === 0 && (
          <div className="reader-discuss-empty">Ask anything about this article — the model has the full transcript and summary as context.</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`reader-discuss-msg reader-discuss-msg--${msg.role}`}>
            <span className="reader-discuss-role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
            <span className="reader-discuss-content">{msg.content}</span>
          </div>
        ))}
        {loading && (
          <div className="reader-discuss-msg reader-discuss-msg--assistant reader-discuss-msg--loading">
            <span className="reader-discuss-role">Assistant</span>
            <span className="reader-discuss-content reader-discuss-typing">Thinking…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="reader-discuss-input-row">
        <textarea
          ref={inputRef}
          className="reader-discuss-input"
          placeholder="Ask a question about this article…"
          value={input}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          disabled={loading}
        />
        <button
          className="reader-discuss-send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          {loading ? '…' : 'Send'}
        </button>
      </div>
      {!itemId && messages.length > 0 && (
        <button
          className="reader-discuss-clear-btn"
          onClick={() => { onMessages([]); setInput(''); }}
        >
          Clear conversation
        </button>
      )}
    </div>
  );
}

// ── QuickCaptureModal ─────────────────────────────────────────────────────────

type DuplicateHint =
  | { type: 'done'; id: string; title: string }
  | { type: 'processing' }
  | null;

function QuickCaptureModal({ onClose, onQueued, onPreviewSaved }: { onClose: () => void; onQueued?: (id: string, url: string) => void; onPreviewSaved?: (result: QuickPreviewResult) => void }) {
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
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
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

  async function handleResummarize(id: string) {
    try {
      await fetch(`/items/${encodeURIComponent(id)}/resummarize`, { method: 'POST' });
    } catch { /* non-fatal */ }
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
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

  async function handleQuickSummary() {
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

  function handleDismissPreview() {
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

// ── PreviewsPanel ────────────────────────────────────────────────────────────

function PreviewsPanel({
  previews,
  onDelete,
  onSaveToKb,
  onClose,
}: {
  previews: QuickPreviewResult[];
  onDelete: (url: string) => void;
  onSaveToKb: (url: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
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
  const [focusedIdx, setFocusedIdx] = useState(0);
  const pending = tagData.pending;

  useEffect(() => {
    setFocusedIdx(0);
  }, [pending.length]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
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

// ── ItemCard (list item) ──────────────────────────────────────────────────────

function ItemCard({
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
}) {
  const approvedTags = (item.tags ?? []).filter((t) => (tagStatusMap[t] ?? 'pending') === 'approved');
  const isRead = !!item.readAt;
  const isStarred = !!item.starred;
  const readingProgress = parseInt(localStorage.getItem('kb_scroll_progress_' + item.id) ?? '0', 10);
  const isArchived = !!item.archived;
  const isPinned = !!item.pinned;
  const contentDate = item.publishedAt ?? item.createdAt;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePointerDown() {
    longPressTimer.current = setTimeout(() => {
      onToggleSelect(item.id);
    }, 500);
  }

  function handlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleClick(e: React.MouseEvent) {
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

// ── ReaderPane helpers ────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TIMESTAMP_RE = /\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/g;

function buildTranscriptHtml(raw: string, searchQuery: string, activeMatchIdx: number): string {
  const paragraphs = formatTranscript(raw);
  const parts = paragraphs.map((para) => {
    let rendered = '';
    let lastIndex = 0;
    TIMESTAMP_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TIMESTAMP_RE.exec(para)) !== null) {
      rendered += escapeHtml(para.slice(lastIndex, m.index));
      rendered += `<span class="timestamp-chip">${escapeHtml(m[1] ?? '')}</span>`;
      lastIndex = m.index + m[0].length;
    }
    rendered += escapeHtml(para.slice(lastIndex));
    return `<p>${rendered}</p>`;
  });
  let html = parts.join('');
  if (searchQuery) {
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let matchCount = 0;
    html = html.replace(new RegExp(`(${escaped})(?=[^<]*(?:<|$))`, 'gi'), (_full, word) => {
      const cls = matchCount === activeMatchIdx ? 'transcript-highlight active' : 'transcript-highlight';
      matchCount++;
      return `<mark class="${cls}">${word}</mark>`;
    });
  }
  return html;
}

function formatTranscript(raw: string): string[] {
  if (/\n\n/.test(raw)) {
    return raw.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  }
  const sentences = raw.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const paragraphs: string[] = [];
  let current: string[] = [];
  let wordCount = 0;
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).length;
    current.push(sentence.trim());
    wordCount += words;
    if (wordCount >= 200) {
      paragraphs.push(current.join(' '));
      current = [];
      wordCount = 0;
    }
  }
  if (current.length) paragraphs.push(current.join(' '));
  return paragraphs.filter(Boolean);
}

function countMatches(text: string, query: string): number {
  if (!query) return 0;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(escaped, 'gi')) ?? []).length;
}

const TRANSCRIPT_COLLAPSE_LIMIT = 3000;
const TRANSCRIPT_PREVIEW_LENGTH = 1500;

// ── ReaderPane ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function readingStats(text: string | undefined): { wordCount: number; minutes: number } | null {
  if (!text) return null;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount === 0) return null;
  const minutes = Math.ceil(wordCount / 200);
  return { wordCount, minutes };
}

function ReaderPane({
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
}) {
  const isEphemeral = isEphemeralItem(item);
  const related = useMemo(() => (item && !isEphemeralItem(item) ? computeRelated(item, allItems) : []), [item, allItems]);
  const visibleTags = (item?.tags ?? []).filter((t) => (tagStatusMap[t] ?? 'pending') !== 'rejected');
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
    function onScroll() {
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
    function onKey(e: KeyboardEvent) {
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
    function onKey(e: KeyboardEvent) {
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
    function onClickOutside(e: MouseEvent) {
      if (shareDropdownRef.current && e.target instanceof Node && !shareDropdownRef.current.contains(e.target)) {
        setShareDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [shareDropdownOpen]);

  async function copyToClipboard(text: string, setFn: (v: boolean) => void) {
    await navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 1500);
  }

  function buildMarkdownText() {
    if (!item) return '';
    const approvedTags = (item.tags ?? []).filter((t) => (tagStatusMap[t] ?? 'pending') === 'approved');
    const tldrLines = Array.isArray(item.tldr) ? item.tldr.map((l) => `- ${l}`).join('\n') : '';
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

  async function handleResummarize() {
    if (!item || resummarizing) return;
    setResummarizing(true);
    try {
      await api.resummarize(item.id);
      const poll = async () => {
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

  async function handleOpenHistory() {
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

  async function handleRestoreVersion(historyId: number) {
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

  function handleNotesChange(value: string) {
    setNotes(value);
    setNoteSaved(false);
    if (noteDebounce.current) clearTimeout(noteDebounce.current);
    noteDebounce.current = setTimeout(() => doSaveNote(value), 2000);
  }

  async function doSaveNote(value: string) {
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

  async function handleSaveHighlight() {
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

  async function handleDeleteHighlight(id: string) {
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

  function copyTranscript() {
    const itemTranscript = isKnowledgeItemDetail(item) ? item.transcript
      : isEphemeralItem(item) ? item.transcript : undefined;
    if (!itemTranscript) return;
    navigator.clipboard.writeText(itemTranscript).then(() => {
      setTranscriptCopied(true);
      setTimeout(() => setTranscriptCopied(false), 2000);
    }).catch(() => {});
  }

  function copyItem() {
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

  const approvedVisibleTags = visibleTags.filter((t) => (tagStatusMap[t] ?? 'pending') === 'approved');
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
            {approvedVisibleTags.map((tag) => (
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
              onClick={(e) => { e.stopPropagation(); copyToClipboard((item.tldr ?? []).map((l) => `- ${l}`).join('\n'), setTldrCopied).catch(() => {}); }}
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
      {visibleTags.some((t) => (tagStatusMap[t] ?? 'pending') === 'pending') && (
        <>
          <div className="reader-divider" />
          <div className="reader-tags">
            {visibleTags.map((tag) => {
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
                  {(rel.tags ?? []).filter((t) => (item.tags ?? []).includes(t)).join(' · ')}
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

// ── CollectionsPanel ─────────────────────────────────────────────────────────

function CollectionsPanel({
  collections,
  activeCollectionId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onClose,
}: {
  collections: Collection[];
  activeCollectionId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreate(name);
      setNewName('');
    } finally {
      setCreating(false);
    }
  }

  function startRename(col: Collection) {
    setRenamingId(col.id);
    setRenameValue(col.name);
  }

  async function commitRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    await onRename(id, name);
    setRenamingId(null);
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel collections-panel">
        <div className="modal-header">
          <span>Collections</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="collections-new-row">
            <input
              className="collections-new-input"
              type="text"
              placeholder="New collection name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              autoFocus
            />
            <button
              className="collections-new-btn"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? '…' : 'Create'}
            </button>
          </div>

          {collections.length === 0 ? (
            <p className="collections-empty">No collections yet.</p>
          ) : (
            <div className="collections-list">
              <div
                className={`collection-row${activeCollectionId === null ? ' active' : ''}`}
                onClick={() => { onSelect(null); onClose(); }}
              >
                <span className="collection-row-name">All Items</span>
              </div>
              {collections.map((col) => (
                <div key={col.id} className={`collection-row${activeCollectionId === col.id ? ' active' : ''}`}>
                  {renamingId === col.id ? (
                    <input
                      className="collection-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(col.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => commitRename(col.id)}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="collection-row-name"
                      onClick={() => { onSelect(col.id); onClose(); }}
                    >
                      {col.name}
                      <span className="collection-row-count">{col.itemCount}</span>
                    </span>
                  )}
                  <div className="collection-row-actions">
                    <button
                      className="collection-action-btn"
                      title="Rename"
                      onClick={(e) => { e.stopPropagation(); startRename(col); }}
                    >
                      &#x270E;
                    </button>
                    <button
                      className="collection-action-btn collection-action-delete"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); onDelete(col.id); }}
                    >
                      &#x1F5D1;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AddToCollectionDropdown ───────────────────────────────────────────────────

function AddToCollectionDropdown({
  itemId,
  collections,
  itemCollectionIds,
  onToggle,
  onCreate,
  onClose,
}: {
  itemId: string;
  collections: Collection[];
  itemCollectionIds: Set<string>;
  onToggle: (collectionId: string, inCollection: boolean) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [onClose]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreate(name);
      setNewName('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="add-to-collection-dropdown" ref={ref}>
      <div className="add-to-collection-header">Add to collection</div>
      {collections.length === 0 ? (
        <div className="add-to-collection-empty">No collections yet</div>
      ) : (
        <div className="add-to-collection-list">
          {collections.map((col) => {
            const inCol = itemCollectionIds.has(col.id);
            return (
              <label key={col.id} className="add-to-collection-row">
                <input
                  type="checkbox"
                  checked={inCol}
                  onChange={() => onToggle(col.id, inCol)}
                />
                <span>{col.name}</span>
                <span className="collection-row-count">{col.itemCount}</span>
              </label>
            );
          })}
        </div>
      )}
      <div className="add-to-collection-new">
        <input
          className="collections-new-input"
          type="text"
          placeholder="New collection…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
        />
        <button
          className="collections-new-btn"
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
        >
          {creating ? '…' : '+'}
        </button>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

// ── ExportButton ──────────────────────────────────────────────────────────────

function ExportButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="export-btn-wrap" ref={ref}>
      <button className="header-export-btn" onClick={() => setOpen((v) => !v)} title="Export">
        Export
      </button>
      {open && (
        <div className="export-dropdown">
          <button className="export-dropdown-item" onClick={() => { api.exportJson(); setOpen(false); }}>JSON</button>
          <button className="export-dropdown-item" onClick={() => { api.exportMarkdown(); setOpen(false); }}>Markdown</button>
          <button className="export-dropdown-item" onClick={() => { api.downloadDigest(7); setOpen(false); }}>Weekly Digest</button>
          <button className="export-dropdown-item" onClick={() => { api.downloadDigest(30); setOpen(false); }}>Monthly Digest</button>
        </div>
      )}
    </div>
  );
}

// ── Queue Log ─────────────────────────────────────────────────────────────────

interface QueueLogEntry {
  id: string;
  url: string;
  submittedAt: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  title?: string;
  error?: string;
}

function itemToQueueEntry(item: KnowledgeItemPreview): QueueLogEntry {
  const entry: QueueLogEntry = {
    id: item.id,
    url: item.url,
    submittedAt: item.createdAt,
    status: item.status,
  };
  if (item.title) entry.title = item.title;
  if (item.error) entry.error = item.error;
  return entry;
}

// ── QueuePanel ────────────────────────────────────────────────────────────────

const QUEUE_COLLAPSE_LIMIT = 7;

function QueuePanel({
  log,
  onClose,
  onRetry,
  onClearCompleted,
  onNavigate,
}: {
  log: QueueLogEntry[];
  onClose: () => void;
  onRetry: (entry: QueueLogEntry) => Promise<void> | void;
  onClearCompleted: () => void;
  onNavigate: (id: string) => void;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const active = log.filter((e) => e.status === 'queued' || e.status === 'processing');
  const done = log.filter((e) => e.status === 'done');
  const errored = log.filter((e) => e.status === 'error');
  const hasDone = done.length > 0;

  // All entries in display order: active → errors → done
  const allEntries = [...active, ...errored, ...done];
  const needsCollapse = allEntries.length > QUEUE_COLLAPSE_LIMIT;
  const visibleEntries = needsCollapse && !showAll
    ? allEntries.slice(0, QUEUE_COLLAPSE_LIMIT)
    : allEntries;
  const hiddenCount = allEntries.length - QUEUE_COLLAPSE_LIMIT;

  function statusIcon(entry: QueueLogEntry) {
    if (entry.status === 'queued' || entry.status === 'processing') {
      return <span className="queue-item-icon spinning">&#x27F3;</span>;
    }
    if (entry.status === 'done') {
      return <span className="queue-item-icon" style={{ color: '#38c76a' }}>&#x2713;</span>;
    }
    return <span className="queue-item-icon" style={{ color: '#f87171' }}>&#x2717;</span>;
  }

  function QueueRow({ entry }: { entry: QueueLogEntry }) {
    const [retrying, setRetrying] = React.useState(false);
    const label = entry.title || entry.url;
    const isDone = entry.status === 'done';

    return (
      <div className="queue-item-row">
        {statusIcon(entry)}
        <div className="queue-item-body">
          <div
            className={`queue-item-title${isDone ? '' : ' no-click'}`}
            title={label}
            onClick={isDone ? () => onNavigate(entry.id) : undefined}
          >
            {label}
          </div>
          {entry.title && (
            <div className="queue-item-url" title={entry.url}>{entry.url}</div>
          )}
          <div className="queue-item-time">{formatRelativeDate(entry.submittedAt)}</div>
          {entry.status === 'error' && entry.error && (
            entry.error.toLowerCase().includes('whisper not installed') ? (
              <div className="queue-item-whisper-hint">
                Install Whisper to process this video:
                <code className="sys-status-cmd">pip install openai-whisper</code>
                <a className="sys-status-link" href="https://github.com/openai/whisper" target="_blank" rel="noreferrer">Docs</a>
              </div>
            ) : (
              <div className="queue-item-error">{entry.error}</div>
            )
          )}
          {entry.status === 'error' && (
            <button
              className="queue-item-retry-btn"
              disabled={retrying}
              onClick={async () => {
                setRetrying(true);
                try { await onRetry(entry); } finally { setRetrying(false); }
              }}
            >
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="queue-panel">
      <div className="queue-panel-header">
        <span>&#x2699; Processing Queue</span>
        <button className="queue-panel-close" onClick={onClose}>&times;</button>
      </div>
      <div className="queue-panel-body">
        {log.length === 0 ? (
          <div className="queue-panel-empty">No recent submissions.</div>
        ) : (
          <>
            {active.length > 0 && visibleEntries.some((e) => e.status === 'queued' || e.status === 'processing') && (
              <div className="queue-panel-section-label">Active ({active.length})</div>
            )}
            {visibleEntries
              .filter((e) => e.status === 'queued' || e.status === 'processing')
              .map((e) => <QueueRow key={e.id} entry={e} />)}
            {errored.length > 0 && visibleEntries.some((e) => e.status === 'error') && (
              <div className="queue-panel-section-label">Errors ({errored.length})</div>
            )}
            {visibleEntries
              .filter((e) => e.status === 'error')
              .map((e) => <QueueRow key={e.id} entry={e} />)}
            {done.length > 0 && visibleEntries.some((e) => e.status === 'done') && (
              <div className="queue-panel-section-label">Done ({done.length})</div>
            )}
            {visibleEntries
              .filter((e) => e.status === 'done')
              .map((e) => <QueueRow key={e.id} entry={e} />)}
            {needsCollapse && (
              <button
                className="queue-show-more-btn"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Show less' : `Show ${hiddenCount} more`}
              </button>
            )}
          </>
        )}
      </div>
      {hasDone && (
        <div className="queue-panel-footer">
          <button className="queue-panel-clear-btn" onClick={onClearCompleted}>
            Clear completed
          </button>
        </div>
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

const SEARCH_HISTORY_KEY = 'kb-search-history';
const MAX_HISTORY = 10;

function loadSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveSearchHistory(history: string[]) {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function App() {
  const [allItems, setAllItems] = useState<KnowledgeItemPreview[]>([]);
  const [tagData, setTagData] = useState<TagData>({ approved: [], pending: [], rejected: [] });
  const [tagStatusMap, setTagStatusMap] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [semanticMode, setSemanticMode] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [activeDays, setActiveDays] = useState(0);
  const [showTagsPanel, setShowTagsPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showTagCloud, setShowTagCloud] = useState(false);
  const [tagStats, setTagStats] = useState<TagStatsResponse | null>(null);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [tagSuggestionsCount, setTagSuggestionsCount] = useState(0);
  const [queueFilter, setQueueFilter] = useState<'processing' | 'error' | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [filterStudyLater, setFilterStudyLater] = useState(false);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [showPresetsDropdown, setShowPresetsDropdown] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [showPresetSaveInput, setShowPresetSaveInput] = useState(false);
  const prevItemsRef = useRef<KnowledgeItemPreview[]>([]);
  const detailCache = useRef<Map<string, KnowledgeItemDetail>>(new Map());
  const [detailCacheVersion, setDetailCacheVersion] = useState(0);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState<KnowledgeItemPreview[] | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [ftsResults, setFtsResults] = useState<KnowledgeItemPreview[] | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listPaneRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(30);

  // Search history
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadSearchHistory());
  const [searchFocused, setSearchFocused] = useState(false);

  // Queue log
  const [queueLog, setQueueLog] = useState<QueueLogEntry[]>([]);
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [showQueuePanel, setShowQueuePanel] = useState(false);

  // Share toast
  const [shareToast, setShareToast] = useState(false);

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Reading stats
  const [readingStats, setReadingStats] = useState<ReadingStatsResponse | null>(null);
  const [showStreakPopover, setShowStreakPopover] = useState(false);

  // Domain stats
  const [domainStats, setDomainStats] = useState<{ domain: string; count: number; lastSaved: string }[]>([]);
  const [showSourcesPopover, setShowSourcesPopover] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);

  // Ollama status
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [ollamaDismissed, setOllamaDismissed] = useState(false);

  // Collections
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [showCollectionsPanel, setShowCollectionsPanel] = useState(false);
  const [itemsInCollections, setItemsInCollections] = useState<Set<string>>(new Set());

  // Quick capture
  const [showQuickCapture, setShowQuickCapture] = useState(false);

  // Ephemeral items (in-memory previews)
  const [ephemeralItems, setEphemeralItems] = useState<EphemeralItem[]>([]);

  // Notifications (persisted setting loaded with others)
  const [notificationsOn, setNotificationsOn] = useState(false);

  // Load theme from settings on mount
  useEffect(() => {
    api.getSettings().then((s) => {
      const t = s['theme'] ?? 'dark';
      const resolved: 'dark' | 'light' = t === 'light' ? 'light' : 'dark';
      setTheme(resolved);
      document.body.classList.toggle('theme-light', resolved === 'light');
      document.body.classList.toggle('theme-dark', resolved === 'dark');
      setNotificationsOn((s['notifications_enabled'] ?? '0') === '1');
    }).catch(() => {});
  }, []);

  function toggleTheme() {
    const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.body.classList.toggle('theme-light', next === 'light');
    document.body.classList.toggle('theme-dark', next === 'dark');
    api.updateSetting('theme', next).catch(() => {});
  }

  // Load reading stats and domain stats on mount
  useEffect(() => {
    api.getReadingStats().then(setReadingStats).catch(() => {});
    api.getDomainStats().then(setDomainStats).catch(() => {});
    api.listCollections().then(setCollections).catch(() => {});
    api.getFilterPresets().then(setFilterPresets).catch(() => {});
  }, []);

  // Ollama status polling
  useEffect(() => {
    function checkOllama() {
      api.getOllamaStatus().then(({ ok }) => {
        setOllamaOk(ok);
        if (ok) setOllamaDismissed(false);
      }).catch(() => setOllamaOk(false));
    }
    checkOllama();
    const interval = setInterval(checkOllama, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Sort
  type SortOption = 'newest' | 'oldest' | 'recently-read' | 'highest-rated' | 'most-starred' | 'title-az' | 'title-za';
  const SORT_OPTIONS: readonly SortOption[] = ['newest', 'oldest', 'recently-read', 'highest-rated', 'most-starred', 'title-az', 'title-za'];
  function isSortOption(v: string): v is SortOption {
    return SORT_OPTIONS.some(t => t === v);
  }
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    const stored = localStorage.getItem('kb-sort');
    return (stored !== null && isSortOption(stored)) ? stored : 'newest';
  });

  function handleSortChange(opt: SortOption) {
    setSortOption(opt);
    localStorage.setItem('kb-sort', opt);
  }

  // Type filter
  type TypeFilter = 'all' | 'youtube' | 'article' | 'pdf';
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // Unread only filter
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteToast, setDeleteToast] = useState<string | null>(null);
  const [batchCollectionPickerOpen, setBatchCollectionPickerOpen] = useState(false);

  const selectionMode = selectedIds.size > 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBatchStar() {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => api.toggleStar(id).then(({ starred }) => {
      setAllItems((prev) => prev.map((it) => it.id === id ? { ...it, starred } : it));
    }).catch(() => {})));
  }

  async function handleBatchDelete() {
    const ids = Array.from(selectedIds);
    if (!window.confirm(`Delete ${ids.length} item${ids.length !== 1 ? 's' : ''}?`)) return;
    try {
      await api.batchDelete(ids);
      setAllItems((prev) => prev.filter((it) => !selectedIds.has(it.id)));
      clearSelection();
      setDeleteToast(`Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`);
      setTimeout(() => setDeleteToast(null), 2500);
    } catch {}
  }

  function handleBatchExport() {
    const ids = Array.from(selectedIds);
    window.open(`${BASE}/export/json?ids=${ids.join(',')}`, '_blank');
  }

  async function handleBatchAddToCollection(collectionId: string) {
    const ids = Array.from(selectedIds);
    const col = collections.find((c) => c.id === collectionId);
    setBatchCollectionPickerOpen(false);
    try {
      await api.batchAddToCollection(collectionId, ids);
      setDeleteToast(`Added ${ids.length} item${ids.length !== 1 ? 's' : ''} to ${col?.name ?? 'collection'}`);
      setTimeout(() => setDeleteToast(null), 2500);
    } catch {}
  }

  // Handle an item-updated SSE event: refresh that item and sync UI state
  const handleItemUpdate = useCallback((data: { id: string; status: string; title?: string }) => {
    // Reload the full items list to get fresh data
    loadItems();
    // Also refresh the queue log so queued/processing items appear immediately
    refreshQueueLog();
  }, []);

  // Load everything on mount; use SSE for live updates with 5s polling fallback
  useEffect(() => {
    loadItems();
    loadTags();
    loadCollections();
    refreshQueueLog();
    api.getTagSuggestions().then((s) => setTagSuggestionsCount(s.length)).catch(() => {});
    // Respect ?item= URL param on load
    const urlParam = new URLSearchParams(window.location.search).get('item');
    if (urlParam) {
      setSelectedId(urlParam);
    }

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let sseConnected = false;

    const es = new EventSource('http://127.0.0.1:3737/events');

    // If SSE doesn't connect within 5 seconds, fall back to polling
    const fallbackTimer = setTimeout(() => {
      if (!sseConnected) {
        pollInterval = setInterval(loadItems, 5000);
      }
    }, 5000);

    es.addEventListener('item-updated', (e: MessageEvent) => {
      sseConnected = true;
      try {
        const parsed: unknown = JSON.parse(e.data);
        if (isRecord(parsed)) {
          const id = typeof parsed.id === 'string' ? parsed.id : '';
          const status = typeof parsed.status === 'string' ? parsed.status : '';
          const title = typeof parsed.title === 'string' ? parsed.title : undefined;
          if (id && status) handleItemUpdate({ id, status, ...(title !== undefined ? { title } : {}) });
        }
      } catch {}
    });

    es.addEventListener('open', () => {
      sseConnected = true;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    });

    es.addEventListener('error', () => {
      if (!sseConnected && !pollInterval) {
        pollInterval = setInterval(loadItems, 5000);
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      es.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Debounce search input
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      // #tag shortcut: treat as tag filter
      if (searchText.startsWith('#')) {
        const tag = searchText.slice(1).trim();
        if (tag) {
          setActiveTagFilters((prev) => prev.includes(tag) ? prev : [...prev, tag]);
          setSearchText('');
          setSearchQuery('');
        }
        return;
      }
      setSearchQuery(searchText);
      // Save non-empty queries to history
      if (searchText.trim()) {
        setSearchHistory((prev) => {
          const deduped = [searchText.trim(), ...prev.filter((s) => s !== searchText.trim())].slice(0, MAX_HISTORY);
          saveSearchHistory(deduped);
          return deduped;
        });
      }
    }, 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchText]);

  // Semantic search: fetch when mode is on and query changes
  useEffect(() => {
    if (!semanticMode || !searchQuery) {
      setSemanticResults(null);
      return;
    }
    setSemanticLoading(true);
    api.semanticSearch(searchQuery)
      .then((results) => { setSemanticResults(results); })
      .catch(() => { setSemanticResults([]); })
      .finally(() => setSemanticLoading(false));
  }, [semanticMode, searchQuery]);

  // FTS search: fetch snippets from server when query changes (non-semantic)
  useEffect(() => {
    if (semanticMode || !searchQuery) {
      setFtsResults(null);
      return;
    }
    api.searchItems(searchQuery)
      .then((results) => { setFtsResults(results); })
      .catch(() => { setFtsResults(null); });
  }, [semanticMode, searchQuery]);

  async function loadItems() {
    try {
      const items = await api.getItems();
      // Detect transitions to 'done' for green flash
      const prev = prevItemsRef.current;
      const newlyDone = items
        .filter((it) => it.status === 'done')
        .filter((it) => {
          const old = prev.find((p) => p.id === it.id);
          return old && old.status !== 'done';
        })
        .map((it) => it.id);
      if (newlyDone.length > 0) {
        setFlashIds((existing) => {
          const next = new Set([...existing, ...newlyDone]);
          return next;
        });
        setTimeout(() => {
          setFlashIds((existing) => {
            const next = new Set(existing);
            newlyDone.forEach((id) => next.delete(id));
            return next;
          });
        }, 1500);
        // Browser notifications for newly done items
        setNotificationsOn((enabled) => {
          if (enabled && 'Notification' in window && Notification.permission === 'granted') {
            for (const id of newlyDone) {
              const it = items.find((x) => x.id === id);
              if (it?.title) {
                new Notification('✓ Knowledge Base', { body: it.title, icon: '/favicon.ico' });
              }
            }
          }
          return enabled;
        });
      }
      prevItemsRef.current = items;
      setAllItems(items);
      // Sync queue log statuses from server items
      syncQueueLogFromItems(items);
    } catch {} finally {
      setLoading(false);
    }
  }

  function refreshQueueLog() {
    api.getRecentItems(20, true)
      .then((items) => setQueueLog(items.map(itemToQueueEntry)))
      .catch(() => {});
  }

  function syncQueueLogFromItems(items: KnowledgeItemPreview[]) {
    // With server-sourced queue log, a fresh fetch is the canonical sync
    refreshQueueLog();
  }

  function addToQueueLog(_id: string, _url: string) {
    // After submit, server has the item — just refresh from server
    refreshQueueLog();
  }

  function handleRetryItem(entry: QueueLogEntry) {
    // Optimistically mark as queued for instant feedback
    setQueueLog((prev) =>
      prev.map((e) => {
        if (e.id !== entry.id) return e;
        const updated: QueueLogEntry = { ...e, status: 'queued' as const };
        delete updated.error;
        return updated;
      })
    );
    return api.retryItem(entry.id)
      .then(() => refreshQueueLog())
      .catch(() => refreshQueueLog());
  }

  function clearCompletedFromLog() {
    // Hide done items from UI via clearedIds; items remain in DB
    setClearedIds((prev) => {
      const next = new Set(prev);
      queueLog.filter((e) => e.status === 'done').forEach((e) => next.add(e.id));
      return next;
    });
  }

  async function loadTags() {
    try {
      const data = await api.getTags();
      setTagData(data);
      const map: Record<string, string> = {};
      for (const t of data.approved) map[t] = 'approved';
      for (const t of data.rejected) map[t] = 'rejected';
      for (const p of data.pending) map[p.tag] = 'pending';
      setTagStatusMap(map);
    } catch {}
  }

  async function loadTagStats() {
    try {
      const [stats, suggestions] = await Promise.all([api.getTagStats(), api.getTagSuggestions()]);
      setTagStats(stats);
      setTagSuggestionsCount(suggestions.length);
    } catch {}
  }

  // Mark item read + fetch full item with transcript
  async function selectItem(item: KnowledgeItemPreview) {
    setSelectedId(item.id);
    // Mark read
    api.markRead(item.id).then(() => {
      setAllItems((prev) =>
        prev.map((it) => it.id === item.id ? { ...it, readAt: new Date().toISOString() } : it)
      );
      api.getReadingStats().then(setReadingStats).catch(() => {});
    }).catch(() => {});
    // Fetch full detail (with transcript) into cache — don't pollute preview list
    try {
      const full = await api.getItem(item.id);
      detailCache.current.set(full.id, full);
      // Trigger re-render so reader picks up cached detail
      setDetailCacheVersion((v) => v + 1);
    } catch {}
  }

  // Queue counts
  const processingItems = useMemo(
    () => allItems.filter((it) => it.status === 'processing' || it.status === 'queued'),
    [allItems]
  );
  const errorItems = useMemo(
    () => allItems.filter((it) => it.status === 'error'),
    [allItems]
  );

  // Filtering
  const filteredItems = useMemo(() => {
    // Queue filter overrides everything
    if (queueFilter === 'processing') return [...processingItems, ...errorItems];
    if (queueFilter === 'error') return errorItems;

    // Semantic mode: use server results directly
    if (semanticMode && searchQuery && semanticResults !== null) {
      return semanticResults;
    }

    // FTS mode: use server results with snippets when available
    if (!semanticMode && searchQuery && ftsResults !== null) {
      return ftsResults;
    }

    let items = allItems.filter((it) => it.status === 'done');

    // Archived filter: show archived OR non-archived, not both
    if (showArchivedOnly) {
      items = items.filter((it) => !!it.archived);
    } else {
      items = items.filter((it) => !it.archived);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((it) =>
        it.title?.toLowerCase().includes(q) ||
        it.summary?.toLowerCase().includes(q)
      );
    }

    if (activeTagFilters.length) {
      items = items.filter((it) =>
        activeTagFilters.every((tag) => (it.tags ?? []).includes(tag))
      );
    }

    if (activeDays > 0) {
      const cutoff = Date.now() - activeDays * 24 * 60 * 60 * 1000;
      items = items.filter((it) => new Date(it.createdAt).getTime() >= cutoff);
    }

    if (showStarredOnly) {
      items = items.filter((it) => !!it.starred);
    }

    if (filterStudyLater) {
      items = items.filter((it) => !!it.studyLater);
    }

    if (activeCollectionId) {
      items = items.filter((it) => itemsInCollections.has(it.id));
    }

    if (typeFilter !== 'all') {
      if (typeFilter === 'pdf') {
        items = items.filter((it) => it.url.toLowerCase().endsWith('.pdf'));
      } else {
        items = items.filter((it) => it.type === typeFilter);
      }
    }

    if (unreadOnly) {
      items = items.filter((it) => !it.readAt);
    }

    // Apply sort (pinned items always float to top)
    items = [...items].sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (bPinned !== aPinned) return bPinned - aPinned;
      if (sortOption === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortOption === 'title-az') return (a.title ?? a.url).localeCompare(b.title ?? b.url);
      if (sortOption === 'title-za') return (b.title ?? b.url).localeCompare(a.title ?? a.url);
      if (sortOption === 'recently-read') {
        if (a.readAt && b.readAt) return new Date(b.readAt).getTime() - new Date(a.readAt).getTime();
        if (a.readAt) return -1;
        if (b.readAt) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortOption === 'highest-rated') {
        const aRating = a.rating ?? 0;
        const bRating = b.rating ?? 0;
        if (bRating !== aRating) return bRating - aRating;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortOption === 'most-starred') {
        const aStarred = a.starred ? 1 : 0;
        const bStarred = b.starred ? 1 : 0;
        if (bStarred !== aStarred) return bStarred - aStarred;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return items;
  }, [allItems, searchQuery, activeTagFilters, activeDays, queueFilter, processingItems, errorItems, semanticMode, semanticResults, ftsResults, showStarredOnly, filterStudyLater, showArchivedOnly, sortOption, activeCollectionId, itemsInCollections, typeFilter, unreadOnly]);

  // Reset visible window when filters change
  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, activeTagFilters, activeDays, queueFilter, showStarredOnly, filterStudyLater, showArchivedOnly, sortOption, activeCollectionId, typeFilter, unreadOnly]);

  // Infinite scroll: load more when sentinel enters view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) setVisibleCount((n) => n + 20); },
      { root: listPaneRef.current }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [filteredItems]);

  // Use cached detail if available, otherwise fall back to preview
  const selectedItem = useMemo((): KnowledgeItemDetail | KnowledgeItemPreview | EphemeralItem | null => {
    if (!selectedId) return null;
    if (selectedId.startsWith('preview-')) {
      return ephemeralItems.find((it) => it.id === selectedId) ?? null;
    }
    return detailCache.current.get(selectedId) ?? allItems.find((it) => it.id === selectedId) ?? null;
  }, [allItems, selectedId, ephemeralItems, detailCacheVersion]);

  const filteredItemsRef = useRef(filteredItems);
  const selectedIdRef = useRef(selectedId);
  filteredItemsRef.current = filteredItems;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      // Ctrl+Shift+A / Cmd+Shift+A — open Bulk Add
      if (e.key === 'A' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowBulkAdd(true);
        return;
      }
      // Ctrl+L / Cmd+L — quick capture
      if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowQuickCapture(true);
        return;
      }
      if (e.key === '/') {
        if (!inInput) { e.preventDefault(); searchInputRef.current?.focus(); }
        return;
      }
      if (e.key === 'Escape') {
        if (inInput) { e.target.blur(); setSearchText(''); }
        else { setSearchText(''); setSelectedId(null); }
        return;
      }
      if (e.key === '?') {
        if (!inInput) setShowShortcuts((v) => !v);
        return;
      }
      if (inInput) return;
      const items = filteredItemsRef.current;
      const curId = selectedIdRef.current;
      const curIdx = items.findIndex((it) => it.id === curId);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = items[curIdx < items.length - 1 ? curIdx + 1 : 0];
        if (next) {
          setSelectedId(next.id);
          listPaneRef.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[curIdx <= 0 ? items.length - 1 : curIdx - 1];
        if (prev) {
          setSelectedId(prev.id);
          listPaneRef.current?.querySelector<HTMLElement>(`[data-id="${prev.id}"]`)?.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      if (e.key === 'Enter') {
        const cur = items.find((it) => it.id === curId);
        if (cur) selectItem(cur);
        return;
      }
      if (e.key === 'r') {
        const cur = allItems.find((it) => it.id === curId);
        if (!cur) return;
        if (cur.readAt) {
          api.markUnread(cur.id).then(() =>
            setAllItems((prev) => prev.map((it) => {
              if (it.id !== cur.id) return it;
              const updated = { ...it };
              delete updated.readAt;
              return updated;
            }))
          ).catch(() => {});
        } else {
          api.markRead(cur.id).then(() =>
            setAllItems((prev) => prev.map((it) => it.id === cur.id ? { ...it, readAt: new Date().toISOString() } : it))
          ).catch(() => {});
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [allItems]);

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
    setShowStarredOnly(false);
    setFilterStudyLater(false);
    setShowArchivedOnly(false);
    setActiveCollectionId(null);
  }

  function shareItem(id: string) {
    const url = `http://127.0.0.1:3737/?item=${encodeURIComponent(id)}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }).catch(() => {});
  }

  function removeFromHistory(term: string) {
    setSearchHistory((prev) => {
      const next = prev.filter((s) => s !== term);
      saveSearchHistory(next);
      return next;
    });
  }

  function clearHistory() {
    setSearchHistory([]);
    saveSearchHistory([]);
  }

  const hasFilters = searchText || activeTagFilters.length > 0 || activeDays > 0 || showStarredOnly || filterStudyLater || showArchivedOnly || !!activeCollectionId;

  async function handleStar(id: string) {
    try {
      const { starred } = await api.toggleStar(id);
      setAllItems((prev) => prev.map((it) => it.id === id ? { ...it, starred } : it));
    } catch {}
  }

  async function handlePin(id: string) {
    try {
      const { pinned } = await api.togglePin(id);
      setAllItems((prev) => prev.map((it) => it.id === id ? { ...it, pinned } : it));
    } catch {}
  }

  async function handleArchive(id: string) {
    try {
      const { archived } = await api.archiveItem(id);
      setAllItems((prev) => prev.map((it) => it.id === id ? { ...it, archived } : it));
    } catch {}
  }

  async function handleStudyLater(id: string) {
    const result = await api.toggleStudyLater(id);
    setAllItems((prev) => prev.map((it) => it.id === id ? { ...it, studyLater: result.studyLater } : it));
  }

  async function handleDelete(id: string) {
    await api.deleteItem(id);
    setAllItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedId(null);
  }

  async function handleRate(id: string, rating: number) {
    try {
      await api.rateItem(id, rating);
      setAllItems((prev) => prev.map((it) => it.id === id ? { ...it, rating } : it));
    } catch {}
  }

  async function handleTagAction(action: 'approve' | 'reject', tag: string, itemId: string, reason?: string) {
    if (action === 'approve') {
      await api.approveTag(tag);
    } else {
      await api.rejectTag(tag, itemId, reason ?? '');
    }
    await loadTags();
  }

  async function loadCollections() {
    try {
      const cols = await api.listCollections();
      setCollections(cols);
      const allInCols = new Set<string>();
      for (const col of cols) {
        if (col.itemCount > 0) {
          const colItems = await api.getCollectionItems(col.id);
          for (const it of colItems) allInCols.add(it.id);
        }
      }
      setItemsInCollections(allInCols);
    } catch {}
  }

  async function handleCollectionCreate(name: string, itemId?: string) {
    const result = await api.createCollection(name);
    if (itemId) await api.addItemToCollection(result.id, itemId);
    await loadCollections();
  }

  async function handleCollectionToggle(collectionId: string, itemId: string, inCollection: boolean) {
    if (inCollection) {
      await api.removeItemFromCollection(collectionId, itemId);
    } else {
      await api.addItemToCollection(collectionId, itemId);
    }
    await loadCollections();
  }

  async function handleCollectionRename(id: string, name: string) {
    await api.renameCollection(id, name);
    await loadCollections();
  }

  async function handleCollectionDelete(id: string) {
    await api.deleteCollection(id);
    if (activeCollectionId === id) setActiveCollectionId(null);
    await loadCollections();
  }

  async function handleLoadPreset(preset: FilterPreset) {
    setSearchText(preset.searchQuery ?? '');
    setActiveTagFilters(preset.tagFilter ?? []);
    setActiveDays(preset.dateFilter ? parseInt(preset.dateFilter, 10) || 0 : 0);
    setSemanticMode(preset.semanticMode);
    setShowStarredOnly(preset.showStarredOnly);
    setShowPresetsDropdown(false);
  }

  async function handleSavePreset() {
    const name = presetNameInput.trim();
    if (!name) return;
    const presetFilters: Parameters<typeof api.saveFilterPreset>[1] = {};
    if (searchText) presetFilters.searchQuery = searchText;
    if (activeTagFilters.length > 0) presetFilters.tagFilter = activeTagFilters;
    if (activeDays > 0) presetFilters.dateFilter = String(activeDays);
    if (semanticMode) presetFilters.semanticMode = semanticMode;
    if (showStarredOnly) presetFilters.showStarredOnly = showStarredOnly;
    await api.saveFilterPreset(name, presetFilters);
    const presets = await api.getFilterPresets();
    setFilterPresets(presets);
    setPresetNameInput('');
    setShowPresetSaveInput(false);
  }

  async function handleDeletePreset(id: string) {
    await api.deleteFilterPreset(id);
    setFilterPresets((prev) => prev.filter((p) => p.id !== id));
  }

  const hasActiveFilters = !!(searchText || activeTagFilters.length > 0 || activeDays > 0 || showStarredOnly);

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <h1>Knowledge Base</h1>

        <div className="header-search" style={{ position: 'relative' }}>
          <span className="header-search-icon">⌕</span>
          <input
            ref={searchInputRef}
            data-testid="search-input"
            type="text"
            placeholder="Search… or #tag"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            autoComplete="off"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          />
          {searchText && (
            <button className="header-clear-btn" onClick={() => setSearchText('')}>&times;</button>
          )}
          <label className="semantic-toggle">
            <input type="checkbox" checked={semanticMode} onChange={(e) => setSemanticMode(e.target.checked)} />
            <span>{semanticLoading ? '...' : 'Semantic'}</span>
          </label>
          {searchFocused && !searchText && searchHistory.length > 0 && (
            <div className="search-history-dropdown">
              {searchHistory.map((term) => (
                <div
                  key={term}
                  className="search-history-row"
                  onMouseDown={(e) => { e.preventDefault(); setSearchText(term); }}
                >
                  <span className="search-history-icon">&#x1F551;</span>
                  <span className="search-history-term">{term}</span>
                  <button
                    className="search-history-remove"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); removeFromHistory(term); }}
                    title="Remove"
                  >&times;</button>
                </div>
              ))}
              <div className="search-history-clear">
                <button onMouseDown={(e) => { e.preventDefault(); clearHistory(); }}>Clear history</button>
              </div>
            </div>
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
        <div className="header-filters" data-testid="date-filters">
          {[{ label: 'All', days: 0 }, { label: 'Today', days: 1 }, { label: '2d', days: 2 }, { label: '3d', days: 3 }, { label: '4d', days: 4 }].map(({ label, days }) => (
            <button
              key={days}
              data-testid={`date-btn-${days}`}
              className={`date-btn${activeDays === days ? ' active' : ''}`}
              onClick={() => setActiveDays(days)}
            >
              {label}
            </button>
          ))}
          <button
            className={`starred-filter-btn${showStarredOnly ? ' active' : ''}`}
            onClick={() => setShowStarredOnly((v) => !v)}
            title="Show starred only"
          >
            &#x2605; Starred
          </button>
          <button
            className={`filter-chip${filterStudyLater ? ' active' : ''}`}
            onClick={() => setFilterStudyLater((v) => !v)}
            title="Show Study Later only"
          >
            📚 Study Later
          </button>
          <button
            className={`archived-filter-btn${showArchivedOnly ? ' active' : ''}`}
            onClick={() => setShowArchivedOnly((v) => !v)}
            title="Show archived items"
          >
            &#x1F4E6; Archived
          </button>
        </div>

        {hasFilters && (
          <button className="header-clear-all" onClick={clearAll}>&#x2715; clear</button>
        )}

        <button
          className={`header-tags-btn${tagData.pending.length > 0 ? ' has-pending' : ''}`}
          onClick={() => setShowTagsPanel(true)}
        >
          {tagData.pending.length > 0 ? `⚑ ${tagData.pending.length} pending` : 'Tags'}
          {tagSuggestionsCount > 0 && <span className="header-tags-suggestions">{` (+ ${tagSuggestionsCount} suggestions)`}</span>}
        </button>

        <button
          className="header-bulk-btn"
          onClick={() => setShowBulkAdd(true)}
          title="Bulk add URLs"
        >
          + Bulk Add
        </button>

        <button
          className="header-tagcloud-btn"
          onClick={() => { loadTagStats(); setShowTagCloud(true); }}
          title="Tag browser"
        >
          Tags
        </button>

        <button
          className={`header-collections-btn${activeCollectionId ? ' active' : ''}`}
          onClick={() => setShowCollectionsPanel(true)}
          title="Collections"
        >
          &#x1F4C1;{activeCollectionId ? ` ${collections.find((c) => c.id === activeCollectionId)?.name ?? ''}` : ' Collections'}
        </button>

        {/* Presets button + dropdown */}
        <div className='presets-btn-wrap' style={{ position: 'relative' }}>
          <button
            className='header-presets-btn'
            onClick={() => {
              setShowPresetsDropdown((v) => !v);
              setShowPresetSaveInput(false);
              setPresetNameInput('');
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
                  <button className='presets-load-btn' onClick={() => handleLoadPreset(preset)}>
                    Load
                  </button>
                  <button
                    className='presets-delete-btn'
                    onClick={() => handleDeletePreset(preset.id)}
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
                    onChange={(e) => setPresetNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSavePreset();
                      if (e.key === 'Escape') setShowPresetSaveInput(false);
                    }}
                    autoFocus
                  />
                  <button
                    className='presets-save-confirm-btn'
                    onClick={handleSavePreset}
                    disabled={!presetNameInput.trim()}
                  >
                    Save
                  </button>
                  <button className='presets-save-cancel-btn' onClick={() => setShowPresetSaveInput(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                hasActiveFilters && (
                  <div className='presets-save-trigger'>
                    <button className='presets-save-btn' onClick={() => setShowPresetSaveInput(true)}>
                      + Save current filters
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <ExportButton />

        <button className="header-theme-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <button className="header-stats-btn" onClick={() => setShowStatsPanel(true)} title="Stats">
          &#128202;
        </button>

        <button className="header-settings-btn" onClick={() => setShowSettingsPanel(true)} title="Settings">
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
              onClick={() => setShowQueuePanel((v) => !v)}
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

        <button className="header-shortcuts-btn" onClick={() => setShowShortcuts((v) => !v)} title="Keyboard shortcuts">?</button>
      </header>

      {/* Ollama warning bar */}
      {ollamaOk === false && !ollamaDismissed && (
        <div className="ollama-warning">
          <span>&#x26A0;&#xFE0F; Ollama is not running — new items cannot be summarized. Start Ollama to resume processing.</span>
          <button className="ollama-warning-dismiss" onClick={() => setOllamaDismissed(true)}>Dismiss</button>
        </div>
      )}

      {/* Reading streak bar */}
      {readingStats && readingStats.totalRead > 0 && (
        <div className="reading-streak-bar">
          <span
            className="reading-streak-summary"
            onClick={() => setShowStreakPopover((v) => !v)}
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
            <span className="reading-streak-sources-link" onClick={() => { setShowSourcesPopover((v) => !v); setShowAllSources(false); }}>
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
                <button className="sources-see-all-btn" onClick={(e) => { e.stopPropagation(); setShowAllSources(true); }}>
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
        <ErrorBoundary label="Item list">
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
                onChange={(e) => { if (isSortOption(e.target.value)) handleSortChange(e.target.value); }}
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
                    onClick={() => setTypeFilter(t)}
                  >
                    {t === 'all' ? 'All' : t === 'youtube' ? 'YouTube' : t === 'article' ? 'Web' : 'PDF'}
                  </button>
                ))}
              </div>
              <button
                className={`unread-toggle${unreadOnly ? ' active' : ''}`}
                onClick={() => setUnreadOnly((v) => !v)}
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
                      onSelect={() => setSelectedId(epItem.id)}
                      onTagClick={addTagFilter}
                      onStar={() => {}}
                      onPin={() => {}}
                      onShare={() => {}}
                      onToggleSelect={() => {}}
                    />
                    <button
                      className="ephemeral-read-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(epItem.id);
                      }}
                      title="Open in reader"
                    >Read →</button>
                    <button
                      className="ephemeral-dismiss-btn"
                      title="Dismiss — remove from memory"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEphemeralItems((prev) => prev.filter((i) => i.id !== epItem.id));
                        if (selectedId === epItem.id) setSelectedId(null);
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
                    ? `No items match ‘${searchQuery}’ — try different keywords`
                    : activeDays > 0
                      ? "No items in this time range"
                      : typeFilter !== 'all'
                        ? `No ${typeFilter === 'youtube' ? 'YouTube' : typeFilter === 'pdf' ? 'PDF' : 'web'} items saved yet` // 'article' filter shows 'web' to users
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
                    onSelect={() => selectItem(item)}
                    onTagClick={addTagFilter}
                    onStar={handleStar}
                    onPin={handlePin}
                    onShare={shareItem}
                    onToggleSelect={toggleSelect}
                    onDelete={async () => { await handleDelete(item.id); }}
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
                <button className="batch-btn" title="Star all selected" onClick={handleBatchStar}>&#x2605; Star all</button>
                <button className="batch-btn batch-btn-danger" title="Delete selected" onClick={handleBatchDelete}>&#x1F5D1; Delete</button>
                <button className="batch-btn" title="Export selected" onClick={handleBatchExport}>&#x2B07; Export</button>
                <div className="batch-collection-picker-wrapper">
                  <button className="batch-btn" title="Add to collection" onClick={() => setBatchCollectionPickerOpen((v) => !v)}>&#x1F4C1; Add to collection</button>
                  {batchCollectionPickerOpen && (
                    <div className="batch-collection-dropdown">
                      {collections.length === 0 && <div className="batch-collection-empty">No collections</div>}
                      {collections.map((col) => (
                        <button
                          key={col.id}
                          className="batch-collection-option"
                          onClick={() => handleBatchAddToCollection(col.id)}
                        >
                          {col.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="batch-btn batch-btn-clear" title="Clear selection" onClick={clearSelection}>&#x2716; Clear</button>
              </div>
            )}
          </div>
        </ErrorBoundary>

        {/* Reader */}
        <ErrorBoundary label="Reader">
          <ReaderPane
            item={selectedItem}
            allItems={allItems}
            tagStatusMap={tagStatusMap}
            onTagAction={handleTagAction}
            onSelectItem={(item) => selectItem(item)}
            onItemReloaded={(item) => { detailCache.current.set(item.id, item); setDetailCacheVersion((v) => v + 1); }}
            onShare={shareItem}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onRate={handleRate}
            onStudyLater={handleStudyLater}
            collections={collections}
            onCollectionToggle={handleCollectionToggle}
            onCollectionCreate={handleCollectionCreate}
            onBack={() => setSelectedId(null)}
          />
        </ErrorBoundary>
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

      {/* Queue panel */}
      {showQueuePanel && (
        <QueuePanel
          log={queueLog.filter((e) => !clearedIds.has(e.id))}
          onClose={() => setShowQueuePanel(false)}
          onRetry={handleRetryItem}
          onClearCompleted={clearCompletedFromLog}
          onNavigate={(id) => {
            const item = allItems.find((it) => it.id === id);
            if (item) { selectItem(item); setShowQueuePanel(false); }
          }}
        />
      )}

      {/* Settings panel */}
      {showSettingsPanel && (
        <SettingsPanel onClose={() => setShowSettingsPanel(false)} />
      )}

      {/* Stats panel */}
      {showStatsPanel && (
        <StatsPanel onClose={() => setShowStatsPanel(false)} />
      )}

      {/* Bulk Add modal */}
      {showBulkAdd && (
        <BulkAddModal onClose={() => setShowBulkAdd(false)} onQueued={addToQueueLog} />
      )}

      {/* Quick capture modal */}
      {showQuickCapture && (
        <QuickCaptureModal
          onClose={() => setShowQuickCapture(false)}
          onQueued={addToQueueLog}
          onPreviewSaved={(result) => {
            const epItem = makeEphemeralItem(result);
            setEphemeralItems((prev) => {
              const deduped = prev.filter((p) => p.url !== result.url);
              return [epItem, ...deduped].slice(0, 10);
            });
            setSelectedId(epItem.id);
          }}
        />
      )}

      {/* Tag Cloud panel */}
      {showTagCloud && tagStats && (
        <TagCloudPanel
          stats={tagStats}
          onTagClick={(tag) => { addTagFilter(tag); setShowTagCloud(false); }}
          onApprove={async (tag) => { await handleTagAction('approve', tag, ''); await loadTagStats(); }}
          onReject={async (tag, itemId) => { await handleTagAction('reject', tag, itemId); await loadTagStats(); }}
          onClose={() => setShowTagCloud(false)}
          onRefresh={loadTagStats}
        />
      )}

      {/* Collections panel */}
      {showCollectionsPanel && (
        <CollectionsPanel
          collections={collections}
          activeCollectionId={activeCollectionId}
          onSelect={(id) => setActiveCollectionId(id)}
          onCreate={(name) => handleCollectionCreate(name)}
          onRename={handleCollectionRename}
          onDelete={handleCollectionDelete}
          onClose={() => setShowCollectionsPanel(false)}
        />
      )}


            {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div className="shortcuts-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-header">
              <span>Keyboard Shortcuts</span>
              <button className="shortcuts-close" onClick={() => setShowShortcuts(false)}>&times;</button>
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

declare global {
  interface Window { __kb_root?: ReturnType<typeof createRoot> }
}
if (!window.__kb_root) {
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Missing #root element — check index.html');
  window.__kb_root = createRoot(rootEl);
}
window.__kb_root.render(<App />);
