/**
 * KnowledgeReaderPage — renders the knowledge reader for a specific item.
 *
 * Route: /item/:id
 *
 * This is a per-route page shell that composes feature components.
 * It imports from feature public APIs only and reads the item ID
 * from the URL via useParams.
 *
 * Phase 3 target: this page fetches the item itself and owns reader state.
 * Current state (Phase 2→3 transition): accepts all reader state + callbacks
 * as props forwarded from App.
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { ReaderPane } from '../features/knowledge-reader/index.ts';
import type { KnowledgeItemPreview, KnowledgeItemDetail, Collection } from '../../api.ts';
import type { EphemeralItem } from '../types.ts';

export interface KnowledgeReaderPageProps {
  /** All items — used by ReaderPane for related-items computation */
  allItems: KnowledgeItemPreview[];
  /** The currently selected item detail */
  selectedItem: KnowledgeItemDetail | KnowledgeItemPreview | EphemeralItem | null;
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
}

/**
 * KnowledgeReaderPage is the "/item/:id" route page.
 *
 * It reads the item ID from the URL params and delegates rendering
 * to the ReaderPane feature component.
 */
export function KnowledgeReaderPage({
  allItems,
  selectedItem,
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
}: KnowledgeReaderPageProps): React.JSX.Element {
  // Read item ID from URL — used for linking and potential future fetch
  const { id } = useParams<{ id: string }>();

  return (
    <div className="knowledge-reader-page" data-testid="knowledge-reader-page" data-item-id={id}>
      <ReaderPane
        item={selectedItem}
        allItems={allItems}
        tagStatusMap={tagStatusMap}
        onTagAction={onTagAction}
        onSelectItem={onSelectItem}
        onItemReloaded={onItemReloaded}
        onShare={onShare}
        onArchive={onArchive}
        onDelete={onDelete}
        onRate={onRate}
        onStudyLater={onStudyLater}
        collections={collections}
        onCollectionToggle={onCollectionToggle}
        onCollectionCreate={onCollectionCreate}
        onBack={onBack}
      />
    </div>
  );
}
