import type { Feed, KnowledgeItem, KnowledgeItemPreview, KnowledgeItemDetail, KnowledgeSection } from '../src/types.ts';
import { toKnowledgeItemId } from '../src/types.ts';
export type { KnowledgeItemId } from '../src/types.ts';
export { toKnowledgeItemId };

/** Type predicate: narrows unknown to a plain object (Record<string, unknown>). */
function isApiObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
import type { Highlight } from '../src/db.ts';

export type { Highlight };

export type { Feed, KnowledgeItemPreview, KnowledgeItemDetail, KnowledgeSection };

export interface Collection {
  id: string;
  name: string;
  itemCount: number;
}

export const BASE = 'http://127.0.0.1:3737';

export interface TagsResponse {
  approved: string[];
  pending: { tag: string; itemId: string; itemTitle: string }[];
  rejected: string[];
}

export interface StatusResponse {
  id: string;
  status: string;
  title: string;
  summary: string;
  error?: string;
}

export interface TagStatsResponse {
  approved: { name: string; count: number }[];
  pending: { tag: string; itemId: string; itemTitle: string }[];
  rejected: string[];
  totalItems: number;
}

export interface ReadingStatsResponse {
  totalRead: number;
  readToday: number;
  readThisWeek: number;
  currentStreak: number;
  dailyGoal: number;
  weeklyGoal: number;
  dailyProgress: number;
  weeklyProgress: number;
}

export interface StatsSummary {
  totalItems: number;
  totalRead: number;
  totalStarred: number;
  totalPinned: number;
  totalNotes: number;
  avgRating: number;
  topTags: { tag: string; count: number }[];
  byType: { youtube: number; article: number; video: number; pdf: number };
  savedThisWeek: number;
  savedThisMonth: number;
  mostReadDomain: string;
  avgReadingTime: number;
}

export interface TagSuggestion {
  itemId: string;
  title: string;
  suggestedTags: string[];
}

export interface SummaryVersion {
  id: number;
  summary: string;
  tldr: string[];
  sections: KnowledgeSection[];
  createdAt: string;
  model?: string;
  promptId?: number;
}

export interface PromptVersion {
  id: number;
  prompt: string;
  created_at: string;
  is_active: number;
}

export interface SummaryQuality {
  rating: number | null;
  reason: string | null;
  ratedAt: string | null;
}

export interface FilterPreset {
  id: string;
  name: string;
  searchQuery: string | null;
  tagFilter: string[];
  dateFilter: string | null;
  typeFilter: string | null;
  semanticMode: boolean;
  showStarredOnly: boolean;
  createdAt: string;
}

/**
 * Typed HTTP helper. The API server is trusted (same origin, controlled schema).
 * `res.json()` returns `Promise<unknown>` in strict mode; we resolve to unknown
 * then widen via the generic parameter. The cast is isolated to this one function.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data: unknown = await res.json();
      if (isApiObject(data)) {
        const errField = data.error;
        if (typeof errField === 'string') message = errField;
      }
    } catch {
      // ignore parse errors — keep the HTTP status message
    }
    throw new Error(message);
  }
  // res.json() returns Promise<any> per lib.dom.d.ts — assigning to the
  // generic return type T is safe because the API schema is server-controlled.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return res.json();
}

export interface UrlPreview {
  title: string;
  description: string;
  url: string;
}

export interface QuickPreviewResult {
  url: string;
  title: string;
  summary: string;
  tldr: string[];
  tags: string[];
  sections: KnowledgeSection[];
  content: string;
  type: 'youtube' | 'video' | 'article';
}

export const api = {
  getItems: (sort?: 'rating'): Promise<KnowledgeItemPreview[]> =>
    request<KnowledgeItemPreview[]>(sort ? `/items?sort=${sort}` : '/items'),

  getRecentItems: (limit?: number, all?: boolean): Promise<KnowledgeItemPreview[]> =>
    request<KnowledgeItemPreview[]>(`/items/recent?limit=${limit ?? 20}${all ? '&all=1' : ''}`),

  rateItem: (id: string, rating: number): Promise<void> =>
    request<void>(`/items/${encodeURIComponent(id)}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    }),

  checkUrl: (url: string): Promise<{ exists: false } | { exists: true; id: string; status: string; title: string }> =>
    request<{ exists: false } | { exists: true; id: string; status: string; title: string }>(`/items/check?url=${encodeURIComponent(url)}`),

  previewUrl: (url: string): Promise<UrlPreview> =>
    request<UrlPreview>(`/preview?url=${encodeURIComponent(url)}`),

  previewQuick: (url: string): Promise<QuickPreviewResult> =>
    request<QuickPreviewResult>('/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }),

  previewChat: (content: string, messages: { role: 'user' | 'assistant'; content: string }[]): Promise<{ reply: string }> =>
    request<{ reply: string }>('/preview/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, messages }),
    }),

  getItem: (id: string): Promise<KnowledgeItemDetail> =>
    request<KnowledgeItemDetail>(`/items/${encodeURIComponent(id)}`),

  discussItem: (id: string, message: string, history: { role: 'user' | 'assistant'; content: string }[]): Promise<{ reply: string }> =>
    request<{ reply: string }>(`/items/${encodeURIComponent(id)}/discuss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    }),

  processUrl: (url: string): Promise<{ id: string; status: string }> =>
    request<{ id: string; status: string }>('/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }),

  searchItems: (q: string, tag?: string): Promise<KnowledgeItemPreview[]> => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (tag) params.set('tag', tag);
    return request<KnowledgeItemPreview[]>(`/search?${params}`);
  },

  markRead: (id: string): Promise<void> =>
    request<void>(`/items/${encodeURIComponent(id)}/read`, { method: 'POST' }),

  markUnread: (id: string): Promise<void> =>
    request<void>(`/items/${encodeURIComponent(id)}/unread`, { method: 'POST' }),

  getTags: (): Promise<TagsResponse> =>
    request<TagsResponse>('/tags'),

  approveTag: (tag: string): Promise<void> =>
    request<void>('/tags/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag }),
    }),

  rejectTag: (tag: string, itemId: string, reason = ''): Promise<void> =>
    request<void>('/tags/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, itemId, reason }),
    }),

  getTagRules: (): Promise<{ rules: string }> =>
    request<{ rules: string }>('/tag-rules'),

  getTagRejections: (): Promise<{ id: string; tag: string; reason: string; itemId: string | null; createdAt: string }[]> =>
    request<{ id: string; tag: string; reason: string; itemId: string | null; createdAt: string }[]>('/tags/rejections'),

  getStatus: (id: string): Promise<StatusResponse> =>
    request<StatusResponse>(`/status/${encodeURIComponent(id)}`),

  semanticSearch: (q: string): Promise<KnowledgeItemPreview[]> =>
    request<KnowledgeItemPreview[]>(`/search?q=${encodeURIComponent(q)}&semantic=true`),

  getSettings: (): Promise<Record<string, string>> =>
    request<Record<string, string>>('/settings'),

  updateSetting: (key: string, value: string): Promise<void> =>
    request<void>('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    }),

  resummarize: (id: string): Promise<void> =>
    request<void>(`/items/${encodeURIComponent(id)}/resummarize`, { method: 'POST' }),

  saveNote: (id: string, notes: string): Promise<void> =>
    request<void>(`/items/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    }),

  getTagStats: (): Promise<TagStatsResponse> =>
    request<TagStatsResponse>('/tags/stats'),

  exportJson: (): void => { window.open(`${BASE}/export/json`, '_blank'); },
  exportMarkdown: (): void => { window.open(`${BASE}/export/markdown`, '_blank'); },

  toggleStar: (id: string): Promise<{ starred: boolean }> =>
    request<{ starred: boolean }>(`/items/${encodeURIComponent(id)}/star`, { method: 'POST' }),

  getRelated: (id: string): Promise<KnowledgeItemPreview[]> =>
    request<KnowledgeItemPreview[]>(`/items/${encodeURIComponent(id)}/related`),

  getReadingStats: (): Promise<ReadingStatsResponse> =>
    request<ReadingStatsResponse>('/reading-stats'),

  deleteItem: (id: string): Promise<void> =>
    request<void>(`/items/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  batchDelete: (ids: string[]): Promise<void> =>
    request<void>('/items/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }),

  retryItem: async (id: string): Promise<{ ok: boolean }> => {
    const item = await request<{ status: string }>(`/items/${encodeURIComponent(id)}`);
    if (item.status !== 'error') return { ok: true };
    await request<void>(`/items/${encodeURIComponent(id)}/resummarize`, { method: 'POST' });
    return { ok: true };
  },

  archiveItem: (id: string): Promise<{ archived: boolean }> =>
    request<{ archived: boolean }>(`/items/${encodeURIComponent(id)}/archive`, { method: 'POST' }),

  getArchivedItems: (): Promise<KnowledgeItemPreview[]> =>
    request<KnowledgeItemPreview[]>('/items/archived'),

  listCollections: (): Promise<Collection[]> =>
    request<Collection[]>('/collections'),

  createCollection: (name: string): Promise<{ id: string }> =>
    request<{ id: string }>('/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),

  deleteCollection: (id: string): Promise<void> =>
    request<void>(`/collections/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  renameCollection: (id: string, name: string): Promise<void> =>
    request<void>(`/collections/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),

  getCollectionItems: (collectionId: string): Promise<KnowledgeItemPreview[]> =>
    request<KnowledgeItemPreview[]>(`/collections/${encodeURIComponent(collectionId)}/items`),

  addItemToCollection: (collectionId: string, itemId: string): Promise<void> =>
    request<void>(`/collections/${encodeURIComponent(collectionId)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    }),

  removeItemFromCollection: (collectionId: string, itemId: string): Promise<void> =>
    request<void>(`/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    }),

  getItemCollections: (itemId: string): Promise<{ id: string; name: string }[]> =>
    request<{ id: string; name: string }[]>(`/items/${encodeURIComponent(itemId)}/collections`),

  downloadDigest: (days: number): void => { window.open(`${BASE}/digest?days=${days}`, '_blank'); },

  getDomainStats: (): Promise<{ domain: string; count: number; lastSaved: string }[]> =>
    request<{ domain: string; count: number; lastSaved: string }[]>('/stats/domains'),

  mergeTags: (from: string, to: string): Promise<{ ok: boolean; itemsUpdated: number }> =>
    request<{ ok: boolean; itemsUpdated: number }>('/tags/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    }),

  importBookmarks: (file: File): Promise<{ total: number; queued: number; duplicates: number; skipped: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${BASE}/import/bookmarks`, { method: 'POST', body: formData })
      .then(async (res) => {
        if (!res.ok) {
          let message = `HTTP ${res.status}`;
          try {
            const data: unknown = await res.json();
            if (isApiObject(data)) {
              const errField = data.error;
              if (typeof errField === 'string') message = errField;
            }
          } catch {
            // ignore parse errors — keep the HTTP status message
          }
          throw new Error(message);
        }
        return res.json();
      });
  },

  getSystemStatus: (): Promise<{ whisper: boolean; ytdlp: boolean; pdftotext: boolean }> =>
    request<{ whisper: boolean; ytdlp: boolean; pdftotext: boolean }>('/system/status'),

  getOllamaStatus: (): Promise<{ ok: boolean; url: string }> =>
    request<{ ok: boolean; url: string }>('/ollama/status'),

  togglePin: (id: string): Promise<{ pinned: boolean }> =>
    request<{ pinned: boolean }>(`/items/${encodeURIComponent(id)}/pin`, { method: 'POST' }),

  toggleStudyLater: (id: string): Promise<{ ok: boolean; studyLater: boolean }> =>
    request<{ ok: boolean; studyLater: boolean }>(`/items/${encodeURIComponent(id)}/study-later`, { method: 'POST' }),

  listFeeds: (): Promise<Feed[]> =>
    request<Feed[]>('/feeds'),

  addFeed: (url: string, name?: string): Promise<{ id: string }> =>
    request<{ id: string }>('/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, name }),
    }),

  deleteFeed: (id: string): Promise<void> =>
    request<void>(`/feeds/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  checkFeed: (id: string): Promise<{ ok: boolean }> =>
    request<{ ok: boolean }>(`/feeds/${encodeURIComponent(id)}/check`, { method: 'POST' }),

  getTestDataCount: (): Promise<{ count: number }> =>
    request<{ count: number }>('/admin/test-data/count'),

  clearTestData: (): Promise<{ deleted: number }> =>
    request<{ deleted: number }>('/admin/test-data', { method: 'DELETE' }),

  getStatsSummary: (): Promise<StatsSummary> =>
    request<StatsSummary>('/stats/summary'),

  getTagSuggestions: (): Promise<TagSuggestion[]> =>
    request<TagSuggestion[]>('/tags/suggestions'),

  renameTag: (from: string, to: string): Promise<{ ok: boolean }> =>
    request<{ ok: boolean }>('/tags/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    }),

  getSummaryHistory: (id: string): Promise<SummaryVersion[]> =>
    request<SummaryVersion[]>(`/items/${encodeURIComponent(id)}/history`),

  restoreSummaryVersion: (id: string, historyId: number): Promise<void> =>
    request<void>(`/items/${encodeURIComponent(id)}/history/${historyId}/restore`, { method: 'POST' }),

  batchAddToCollection: (collectionId: string, itemIds: string[]): Promise<{ ok: boolean; added: number }> =>
    request<{ ok: boolean; added: number }>(`/collections/${encodeURIComponent(collectionId)}/items/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds }),
    }),

  suggestTagConsolidation: (): Promise<{ canonical: string; similar: string[]; reason: string }[]> =>
    request<{ canonical: string; similar: string[]; reason: string }[]>('/tags/consolidate/suggest', { method: 'POST' }),

  applyTagConsolidation: (groups: { canonical: string; similar: string[] }[]): Promise<{ merged: number; tagsAffected: string[] }> =>
    request<{ merged: number; tagsAffected: string[] }>('/tags/consolidate/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups }),
    }),
  getFilterPresets: (): Promise<FilterPreset[]> =>
    request<FilterPreset[]>('/filter-presets'),

  saveFilterPreset: (name: string, filters: {
    searchQuery?: string;
    tagFilter?: string[];
    dateFilter?: string;
    typeFilter?: string;
    semanticMode?: boolean;
    showStarredOnly?: boolean;
  }): Promise<{ id: string }> =>
    request<{ id: string }>('/filter-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ...filters }),
    }),

  deleteFilterPreset: (id: string): Promise<{ ok: boolean }> =>
    request<{ ok: boolean }>(`/filter-presets/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getHighlights: (itemId: string): Promise<Highlight[]> =>
    request<Highlight[]>(`/items/${encodeURIComponent(itemId)}/highlights`),

  saveHighlight: (itemId: string, text: string, section: string, comment?: string): Promise<{ id: string }> =>
    request<{ id: string }>(`/items/${encodeURIComponent(itemId)}/highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, section, comment }),
    }),

  deleteHighlight: (id: string): Promise<void> =>
    request<void>(`/highlights/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  rebuildEmbeddings: (): Promise<{ ok: boolean; message: string }> =>
    request<{ ok: boolean; message: string }>('/embed/rebuild', { method: 'POST' }),

  getChatHistory: (id: string): Promise<{ messages: Array<{ role: 'user' | 'assistant'; content: string }> }> =>
    request(`/items/${encodeURIComponent(id)}/chat`),

  clearChatHistory: (id: string): Promise<{ ok: boolean }> =>
    request(`/items/${encodeURIComponent(id)}/chat`, { method: 'DELETE' }),

  getSummaryQuality: (id: string): Promise<SummaryQuality> =>
    request<SummaryQuality>(`/items/${encodeURIComponent(id)}/summary-quality`),

  saveSummaryQuality: (id: string, rating: number, reason?: string): Promise<{ ok: boolean }> =>
    request<{ ok: boolean }>(`/items/${encodeURIComponent(id)}/summary-quality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, reason }),
    }),

  getSummaryPrompts: (): Promise<PromptVersion[]> =>
    request<PromptVersion[]>('/prompts/summary'),

  getChatPrompts: (): Promise<PromptVersion[]> =>
    request<PromptVersion[]>('/prompts/chat'),

  saveSummaryPrompt: (prompt: string): Promise<{ id: number }> =>
    request<{ id: number }>('/prompts/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    }),

  saveChatPrompt: (prompt: string): Promise<{ id: number }> =>
    request<{ id: number }>('/prompts/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    }),
};