import type { KnowledgeItemPreview, KnowledgeItemDetail, KnowledgeSection, KnowledgeItemId } from '../api.ts';

export type { KnowledgeItemId };

// ── Ephemeral items (in-memory, not persisted) ────────────────────────────────

export interface EphemeralItem {
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

/** Returns true when item has been fully fetched and includes the transcript field. */
export function isKnowledgeItemDetail(item: KnowledgeItemPreview | KnowledgeItemDetail | EphemeralItem | null | undefined): item is KnowledgeItemDetail {
  return item != null && 'transcript' in item && !('_ephemeral' in item);
}

/** Returns true when item is an in-memory ephemeral preview (not saved to DB). */
export function isEphemeralItem(item: KnowledgeItemPreview | KnowledgeItemDetail | EphemeralItem | null | undefined): item is EphemeralItem {
  return item != null && '_ephemeral' in item && item._ephemeral === true;
}
