import { sqliteTable, text, integer, blob, primaryKey } from 'drizzle-orm/sqlite-core';

// ── items ────────────────────────────────────────────────────────────────────

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  url: text('url').notNull().unique(),
  type: text('type').notNull().default('web'),
  title: text('title').notNull().default(''),
  author: text('author'),
  status: text('status').notNull().default('queued'),
  transcript: text('transcript'),
  summary: text('summary'),
  sections: text('sections'),
  tags: text('tags'),
  error: text('error'),
  createdAt: text('date_added').notNull(),
  readAt: text('read_at'),
  tldr: text('tldr'),
  notes: text('notes'),
  starred: integer('starred').notNull().default(0),
  archived: integer('archived').notNull().default(0),
  publishedAt: text('published_at'),
  pinned: integer('pinned').notNull().default(0),
  feedId: text('feed_id'),
  rating: integer('rating'),
  testData: integer('test_data').notNull().default(0),
  imageUrl: text('image_url'),
  retries: integer('retries').notNull().default(0),
  retryAfter: text('retry_after'),
  studyLater: integer('study_later').notNull().default(0),
  summaryModel: text('summary_model'),
});

// ── tags ─────────────────────────────────────────────────────────────────────

export const tags = sqliteTable('tags', {
  name: text('name').primaryKey(),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull(),
  rejectedAt: text('rejected_at'),
});

// ── user_settings ────────────────────────────────────────────────────────────

export const userSettings = sqliteTable('user_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ── collections ──────────────────────────────────────────────────────────────

export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull(),
});

// ── collection_items ─────────────────────────────────────────────────────────

export const collectionItems = sqliteTable('collection_items', {
  collectionId: text('collection_id').notNull(),
  itemId: text('item_id').notNull(),
  addedAt: text('added_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.collectionId, table.itemId] }),
]);

// ── summary_history ──────────────────────────────────────────────────────────

export const summaryHistory = sqliteTable('summary_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: text('item_id').notNull(),
  summary: text('summary'),
  tldr: text('tldr'),
  sections: text('sections'),
  createdAt: text('created_at').notNull(),
  model: text('model'),
  prompt: text('prompt'),
  promptId: integer('prompt_id'),
});

// ── feeds ────────────────────────────────────────────────────────────────────

export const feeds = sqliteTable('feeds', {
  id: text('id').primaryKey(),
  url: text('url').notNull().unique(),
  name: text('name'),
  lastChecked: text('last_checked'),
  lastItemDate: text('last_item_date'),
  itemCount: integer('item_count').default(0),
  active: integer('active').default(1),
  createdAt: text('created_at').notNull(),
});

// ── filter_presets ───────────────────────────────────────────────────────────

export const filterPresets = sqliteTable('filter_presets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  searchQuery: text('search_query'),
  tagFilter: text('tag_filter'),
  dateFilter: text('date_filter'),
  typeFilter: text('type_filter'),
  semanticMode: integer('semantic_mode').default(0),
  showStarredOnly: integer('show_starred_only').default(0),
  createdAt: text('created_at').notNull(),
});

// ── highlights ───────────────────────────────────────────────────────────────

export const highlights = sqliteTable('highlights', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  comment: text('comment'),
  section: text('section').notNull(),
  createdAt: text('created_at').notNull(),
});

// ── tag_rejections ───────────────────────────────────────────────────────────

export const tagRejections = sqliteTable('tag_rejections', {
  id: text('id').primaryKey(),
  tag: text('tag').notNull(),
  reason: text('reason').notNull().default(''),
  itemId: text('item_id'),
  createdAt: text('created_at').notNull(),
});

// ── chat_messages ────────────────────────────────────────────────────────────

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
});

// ── summary_prompt_templates / chat_prompt_templates ────────────────────────
// Stores reusable prompt template text (without per-item content). One row
// per template version — `is_active = 1` marks the current one. At runtime,
// template + content are combined just before sending to the LLM; only the
// template is persisted, so a single row is reused across many items.

export const summaryPromptTemplates = sqliteTable('summary_prompt_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  template: text('template').notNull(),
  createdAt: text('created_at').notNull().default("datetime('now')"),
  isActive: integer('is_active').notNull().default(0),
});

export const chatPromptTemplates = sqliteTable('chat_prompt_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  template: text('template').notNull(),
  createdAt: text('created_at').notNull().default("datetime('now')"),
  isActive: integer('is_active').notNull().default(0),
});

// ── summary_quality ──────────────────────────────────────────────────────────

export const summaryQuality = sqliteTable('summary_quality', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  reason: text('reason'),
  ratedAt: text('rated_at').notNull(),
});

// ── tag_consolidations ──────────────────────────────────────────────────────

export const tagConsolidations = sqliteTable('tag_consolidations', {
  variant: text('variant').primaryKey(),
  canonical: text('canonical').notNull(),
});

// ── considerations ───────────────────────────────────────────────────────────

export const considerations = sqliteTable('considerations', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  raisedAt: text('raised_at').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'reviewed'
  agentNotes: text('agent_notes'),
  ceoNote: text('ceo_note'),
});

// ── item_embeddings ──────────────────────────────────────────────────────────

export const itemEmbeddings = sqliteTable('item_embeddings', {
  itemId: text('item_id').primaryKey(),
  embedding: blob('embedding', { mode: 'buffer' }).notNull(),
});
