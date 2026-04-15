import React, { useState, useEffect } from 'react';
import { api } from '../../../../api.ts';
import type { TagStatsResponse, TagSuggestion } from '../../../../api.ts';

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

export function TagCloudPanel({
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
}): React.JSX.Element {
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

  async function handleConsolidate(): Promise<void> {
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

  async function handleApplyConsolidation(): Promise<void> {
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

  function toggleConsolidateCheck(i: number): void {
    if (consolidate.phase !== 'review') return;
    const newChecked = [...consolidate.checked];
    newChecked[i] = !newChecked[i];
    setConsolidate({ ...consolidate, checked: newChecked });
  }

  function selectAllConsolidate(val: boolean): void {
    if (consolidate.phase !== 'review') return;
    setConsolidate({ ...consolidate, checked: consolidate.groups.map(() => val) });
  }

  async function approveSuggestedTag(tag: string): Promise<void> {
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

  async function approveAllSuggested(suggestion: TagSuggestion): Promise<void> {
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

  async function handleMergeConfirm(): Promise<void> {
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

  async function handleRenameConfirm(): Promise<void> {
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
