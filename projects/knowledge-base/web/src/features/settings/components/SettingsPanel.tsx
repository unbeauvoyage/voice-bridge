import React, { useState, useEffect } from 'react';
import { api, type PromptVersion } from '../../../../api.ts';
import { SystemStatusRow } from './SystemStatusRow.tsx';

type SystemStatus = { whisper: boolean; ytdlp: boolean; pdftotext: boolean; ollama: boolean };

export function SettingsPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
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

  async function handleSave(): Promise<void> {
    await api.updateSetting('summary_language', lang);
    await api.updateSetting('translate_terms', keepTerms ? 'true' : 'false');
    await api.updateSetting('notifications_enabled', notificationsEnabled ? '1' : '0');
    await api.updateSetting('daily_reading_goal', String(dailyGoal));
    await api.updateSetting('weekly_reading_goal', String(weeklyGoal));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleNotificationsToggle(checked: boolean): Promise<void> {
    if (checked && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    const granted = 'Notification' in window && Notification.permission === 'granted';
    setNotificationsEnabled(checked && granted);
  }

  async function handleClearTestData(): Promise<void> {
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

  async function handleRebuildEmbeddings(): Promise<void> {
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
