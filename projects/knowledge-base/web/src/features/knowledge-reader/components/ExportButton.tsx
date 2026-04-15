import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../../api.ts';

// ── ExportButton ──────────────────────────────────────────────────────────────

export function ExportButton(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent): void {
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
