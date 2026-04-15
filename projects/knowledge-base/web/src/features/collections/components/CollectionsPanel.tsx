import React, { useState, useEffect, useRef } from 'react';
import type { Collection } from '../../../../api.ts';

// ── CollectionsPanel ─────────────────────────────────────────────────────────

export function CollectionsPanel({
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
}): React.JSX.Element {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  async function handleCreate(): Promise<void> {
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

  function startRename(col: Collection): void {
    setRenamingId(col.id);
    setRenameValue(col.name);
  }

  async function commitRename(id: string): Promise<void> {
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

export function AddToCollectionDropdown({
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
}): React.JSX.Element {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent): void {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [onClose]);

  async function handleCreate(): Promise<void> {
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
