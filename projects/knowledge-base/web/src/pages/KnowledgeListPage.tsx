/**
 * KnowledgeListPage — renders the knowledge list view.
 *
 * This is a per-route page shell that composes feature components.
 * It imports from feature public APIs only.
 *
 * Phase 3 target: this page owns the list state (items, search, filters).
 * Current state (Phase 2→3 transition): accepts all state + callbacks
 * as props forwarded from App, mirrors the KnowledgePage pattern.
 */

import React from 'react';
import { PreviewsPanel } from '../features/knowledge-list/index.ts';
import type { QuickPreviewResult } from '../../api.ts';

export interface KnowledgeListPageProps {
  /** Saved quick-preview results to render in the previews panel */
  previews?: QuickPreviewResult[];
  onPreviewDelete?: (url: string) => void;
  onPreviewSaveToKb?: (url: string) => void;
  onPreviewClose?: () => void;
  /** Whether the previews panel should be shown */
  showPreviews?: boolean;
  /** Slot for the full list UI — forwards the KnowledgePage shell */
  children?: React.ReactNode;
}

/**
 * KnowledgeListPage is the "/" route page.
 *
 * In Phase 2→3 it acts as a thin wrapper:
 *   - It provides the route boundary
 *   - When showPreviews is true, it overlays the PreviewsPanel from
 *     the knowledge-list feature
 *   - The full KnowledgePage shell is passed as children from App
 *
 * In Phase 3+ this page will own item state directly.
 */
export function KnowledgeListPage({
  previews = [],
  onPreviewDelete,
  onPreviewSaveToKb,
  onPreviewClose,
  showPreviews = false,
  children,
}: KnowledgeListPageProps): React.JSX.Element {
  return (
    <div className="knowledge-list-page" data-testid="knowledge-list-page">
      {children}
      {showPreviews && previews.length > 0 && onPreviewDelete && onPreviewSaveToKb && onPreviewClose && (
        <PreviewsPanel
          previews={previews}
          onDelete={onPreviewDelete}
          onSaveToKb={onPreviewSaveToKb}
          onClose={onPreviewClose}
        />
      )}
    </div>
  );
}
