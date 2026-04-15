/**
 * IngestPage — renders the item ingest / add-item flow.
 *
 * Route: /ingest
 *
 * This page is a self-contained ingest UI. It manages its own open/close
 * state for the BulkAddModal and provides a minimal shell when closed.
 *
 * It imports from the knowledge-ingest feature public API only.
 */

import React, { useState } from 'react';
import { BulkAddModal } from '../features/knowledge-ingest/index.ts';

export interface IngestPageProps {
  /** Optional callback when an item is successfully queued */
  onQueued?: (id: string, url: string) => void;
}

/**
 * IngestPage is the "/ingest" route page.
 *
 * It renders the BulkAddModal as the primary UI for this route.
 * The modal's "close" action navigates back to "/" via the onClose callback
 * or simply toggles the modal off, leaving an empty ingest shell.
 */
export function IngestPage({ onQueued }: IngestPageProps): React.JSX.Element {
  const [showModal, setShowModal] = useState(true);

  return (
    <div className="ingest-page" data-testid="ingest-page">
      {showModal ? (
        <BulkAddModal
          onClose={() => setShowModal(false)}
          {...(onQueued !== undefined ? { onQueued } : {})}
        />
      ) : (
        <div className="ingest-page-shell">
          <button
            className="ingest-reopen-btn"
            onClick={() => setShowModal(true)}
          >
            + Bulk Add
          </button>
        </div>
      )}
    </div>
  );
}
