import React from 'react';
import type { QueueLogEntry } from '../../../shared/queue-log.ts';

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

// ── QueuePanel ────────────────────────────────────────────────────────────────

const QUEUE_COLLAPSE_LIMIT = 7;

export function QueuePanel({
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
}): React.JSX.Element {
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

  function statusIcon(entry: QueueLogEntry): React.JSX.Element {
    if (entry.status === 'queued' || entry.status === 'processing') {
      return <span className="queue-item-icon spinning">&#x27F3;</span>;
    }
    if (entry.status === 'done') {
      return <span className="queue-item-icon" style={{ color: '#38c76a' }}>&#x2713;</span>;
    }
    return <span className="queue-item-icon" style={{ color: '#f87171' }}>&#x2717;</span>;
  }

  function QueueRow({ entry }: { entry: QueueLogEntry }): React.JSX.Element {
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
