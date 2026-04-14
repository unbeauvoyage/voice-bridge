import type { KnowledgeItemPreview as SharedKnowledgeItemPreview, KnowledgeItemId, KnowledgeItemStatus, KnowledgeItemType } from '@env/domain'

export type { KnowledgeItemType }

export type { KnowledgeItemId, KnowledgeItemStatus }

/** Assert that id is a valid KnowledgeItemId (non-empty, non-whitespace string). */
function assertKnowledgeItemId(id: string): asserts id is KnowledgeItemId {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`Invalid KnowledgeItemId: ${JSON.stringify(id)}`);
  }
}

/** Construct a branded KnowledgeItemId. Throws if id is empty or whitespace. */
export function toKnowledgeItemId(id: string): KnowledgeItemId {
  assertKnowledgeItemId(id);
  return id;
}

/**
 * @deprecated Use toKnowledgeItemId instead — it validates at runtime.
 * Kept for callers that have already validated the string by other means.
 */
export function asKnowledgeItemId(id: string): KnowledgeItemId {
  return toKnowledgeItemId(id);
}

export interface KnowledgeSection {
  title: string;
  points: string[];
}

export interface KnowledgeItem {
  id: KnowledgeItemId;
  url: string;
  type: KnowledgeItemType;
  title: string;
  author?: string;
  createdAt: string;
  tags: string[];
  tldr: string[];
  summary: string;
  sections: KnowledgeSection[];
  transcript?: string;
  status: KnowledgeItemStatus;
  error?: string;
  readAt?: string;
  notes?: string;
  starred?: boolean;
  archived?: boolean;
  publishedAt?: string;
  pinned?: boolean;
  studyLater?: boolean;
  feedId?: string;
  feedName?: string;
  rating?: number;
  imageUrl?: string;
  summaryModel?: string;
}

export interface Feed {
  id: string;
  url: string;
  name: string | null;
  lastChecked: string | null;
  lastItemDate: string | null;
  itemCount: number;
  active: boolean;
  createdAt: string;
}

// Full in-app preview shape — extends the shared cross-service contract.
// Adds app-specific fields not in the cross-service contract.
// Fields already in SharedKnowledgeItemPreview (tldr, summaryModel, starred, rating) are inherited.
export interface KnowledgeItemPreview extends Omit<SharedKnowledgeItemPreview, 'type'> {
  type: KnowledgeItemType;
  author?: string;
  createdAt: string;
  sections: KnowledgeSection[];
  error?: string;
  readAt?: string;
  notes?: string;
  archived?: boolean;
  publishedAt?: string;
  pinned?: boolean;
  studyLater?: boolean;
  feedId?: string;
  feedName?: string;
  imageUrl?: string;
  snippet?: string;
}

// Full detail — returned by /items/:id only (includes transcript)
export interface KnowledgeItemDetail extends KnowledgeItem {
  transcript: string;
}

export interface ExtractedContent {
  title: string;
  author?: string;
  content: string;
  url: string;
  publishedAt?: string;
  imageUrl?: string;
}
