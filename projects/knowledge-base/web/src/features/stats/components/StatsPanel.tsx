import React, { useState, useEffect } from 'react';
import { api, type StatsSummary } from '../../../../api.ts';

export function StatsPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
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
