import { watch } from 'node:fs';
import type { ExtractedContent } from './types.ts';
import { config } from './config.ts';
import { logger } from './logger.ts';
import { summarize, suggestTags, llmQuery, llmChat } from './summarize.ts';
import {
  sqlite,
  getItem, getItemByUrl, itemExistsByUrl, listItems, searchItems, updateItem, markRead, markUnread, getRecentItems,
  getApprovedTags, getRejectedTags, getPendingTagsWithItems, upsertTag, approveTag, rejectTag, renameTag, mergeTags,
  getSetting, setSetting, getAllSettings,
  semanticSearch, ftsSearch, backfillFts, getEmbedStatus,
  saveNote, updateSummary, getTagStats, getAllItemsFull, saveSummaryVersion, getSummaryHistory,
  toggleStar, togglePin, getRelatedItems, getReadingStats, deleteItem, archiveItem, listArchivedItems, rateItem,
  createCollection, deleteCollection, renameCollection,
  addItemToCollection, removeItemFromCollection, listCollections, getCollectionItems, getItemCollections,
  getItemsInRange, getDomainStats, getStatsSummary, getItemsWithUnapprovedTags,
  addFeed, deleteFeed, listFeeds, updateFeedChecked, getFeedItemUrls,
  clearTestData, getTestDataCount,
  saveFilterPreset, getFilterPresets, deleteFilterPreset,
  saveHighlight, getHighlights, deleteHighlight,
  saveTagRejection, getTagRejections, getTagRules,
  getChatHistory, saveChatMessage, clearChatHistory,
  saveSummaryQuality, getSummaryQuality,
  listPromptTemplates as listPrompts, upsertPromptTemplate as upsertPrompt,
} from './db.ts';
import type { FilterPresetData } from './db.ts';
import { parseFeed } from './extract/rss.ts';
import { generateEmbedding, itemEmbedText } from './embed.ts';
import { saveEmbedding } from './db.ts';
import { recordConsolidation } from './db/tag-normalization.ts';
import { db as drizzleDb } from './db/client.ts';
import { createQueue, detectType, deriveTagRules } from './queue.ts';
import webIndex from '../web/index.html';

// ── SSE clients ──────────────────────────────────────────────────────────────

const sseClients = new Set<ReadableStreamDefaultController>();

function broadcastSse(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const ctrl of sseClients) {
    try {
      ctrl.enqueue(payload);
    } catch {
      sseClients.delete(ctrl);
    }
  }
}

// Heartbeat every 30s to keep connections alive
setInterval(() => {
  const payload = `event: heartbeat\ndata: {}\n\n`;
  for (const ctrl of sseClients) {
    try {
      ctrl.enqueue(payload);
    } catch {
      sseClients.delete(ctrl);
    }
  }
}, 30_000);

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// ── Queue ─────────────────────────────────────────────────────────────────────

const queue = createQueue({
  db: sqlite,
  maxConcurrent: config.maxConcurrentJobs,
  onProgress: (id, status, title) => {
    broadcastSse('item-updated', { id, status, ...(title ? { title } : {}) });
  },
});

const { enqueue, retryFailed } = queue;

async function retag(itemId: string): Promise<void> {
  const item = getItem(itemId);
  if (!item || !item.transcript) return;
  const approved = getApprovedTags();
  const rejected = getRejectedTags();
  const newTags = await suggestTags(item.transcript, approved, rejected);
  if (!newTags.length) return;
  for (const tag of newTags) upsertTag(tag, 'pending');
  updateItem(itemId, { tags: newTags });
}

// ── Feed checker ─────────────────────────────────────────────────────────────

async function checkFeed(feedId: string): Promise<void> {
  const feeds = listFeeds();
  const feed = feeds.find((f) => f.id === feedId);
  if (!feed || !feed.active) return;

  const parsed = await parseFeed(feed.url);
  const existingUrls = new Set(getFeedItemUrls(feedId));

  let newCount = 0;
  let latestDate = feed.lastItemDate ?? '';

  for (const item of parsed.items) {
    if (!existingUrls.has(item.url)) {
      const { id: canonicalId, status } = enqueue(item.url, feedId);
      if (status === 'queued') {
        newCount++;
        // enqueue already started processing; track for feed count
        void canonicalId;
      }
      if (!latestDate || item.pubDate > latestDate) latestDate = item.pubDate;
    }
  }

  const totalCount = (feed.itemCount ?? 0) + newCount;
  updateFeedChecked(feedId, latestDate || new Date().toISOString(), totalCount);
  if (newCount > 0) logger.info('feed', 'queued new items', { url: feed.url, count: newCount });
}

async function checkAllFeeds(): Promise<void> {
  const feeds = listFeeds().filter((f) => f.active);
  for (const feed of feeds) {
    await checkFeed(feed.id).catch((e) => logger.error('feed', 'check failed', { url: feed.url, error: String(e) }));
  }
}

// Check on startup after queue recovery, then every 30 minutes
setTimeout(() => checkAllFeeds().catch((e) => logger.error('feed', 'checkAllFeeds failed', { error: String(e) })), 5000);
setInterval(() => checkAllFeeds().catch((e) => logger.error('feed', 'checkAllFeeds failed', { error: String(e) })), 30 * 60 * 1000);

// urls.txt watcher — queue any new URLs on file change
const URLS_FILE = 'urls.txt';

async function processUrlsFile(): Promise<void> {
  const file = Bun.file(URLS_FILE);
  if (!(await file.exists())) return;
  const text = await file.text();
  const urls = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const url of urls) {
    if (!itemExistsByUrl(url)) {
      logger.info('watcher', 'queuing url', { url });
      enqueue(url);
    }
  }
}

processUrlsFile();
backfillFts();
let watchDebounce: ReturnType<typeof setTimeout> | null = null;
watch(URLS_FILE, { persistent: false }, () => {
  if (watchDebounce) clearTimeout(watchDebounce);
  watchDebounce = setTimeout(() => {
    logger.info('watcher', 'urls.txt changed — checking for new URLs');
    processUrlsFile();
  }, 500);
});

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get('origin') ?? '';
  const localOrigin = `http://${config.host}:${config.port}`;
  if (origin.startsWith('chrome-extension://') || origin === localOrigin) {
    return origin;
  }
  return localOrigin;
}

function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(req),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function json(data: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(req ? corsHeaders(req) : { 'Access-Control-Allow-Origin': `http://${config.host}:${config.port}` }),
    },
  });
}

async function parseBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await req.json();
    return isPlainObject(value) ? value : null;
  } catch { return null; }
}

export { getString, getNumber, getBoolean } from './body-helpers.ts';

Bun.serve({
  hostname: config.host,
  port: config.port,
  idleTimeout: 120,
  routes: {
    '/': webIndex,
    // SPA routes — serve the same HTML shell; React Router handles client-side routing
    '/ingest': webIndex,
    '/item/*': webIndex,
  },
  development: {
    hmr: true,
    console: true,
  },
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    if (req.method === 'GET' && url.pathname === '/events') {
      // ReadableStream.start() is called synchronously, so ctrl is always
      // initialized before the stream is used. We capture it via a mutable
      // cell to avoid the definite-assignment assertion (!).
      let ctrl: ReadableStreamDefaultController | undefined;
      const stream = new ReadableStream({
        start(controller) {
          ctrl = controller;
          sseClients.add(ctrl);
          ctrl.enqueue(': connected\n\n');
        },
        cancel() {
          if (ctrl) sseClients.delete(ctrl);
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders(req),
        },
      });
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true }, 200, req);
    }

    if (req.method === 'GET' && url.pathname === '/manifest.json') {
      return Response.json({
        name: 'Knowledge Base',
        short_name: 'KB',
        description: 'Personal knowledge base for saving and summarizing content',
        start_url: '/',
        display: 'standalone',
        background_color: '#1a1a2e',
        theme_color: '#1a1a2e',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      });
    }

    if (req.method === 'GET' && url.pathname === '/icon.svg') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" rx="32" fill="#1a1a2e"/>
  <rect x="44" y="36" width="104" height="120" rx="8" fill="#7c3aed"/>
  <rect x="56" y="56" width="80" height="8" rx="4" fill="#e2d9f3"/>
  <rect x="56" y="72" width="80" height="8" rx="4" fill="#e2d9f3"/>
  <rect x="56" y="88" width="60" height="8" rx="4" fill="#e2d9f3"/>
  <rect x="56" y="112" width="80" height="8" rx="4" fill="#a78bfa"/>
  <rect x="56" y="128" width="50" height="8" rx="4" fill="#a78bfa"/>
</svg>`;
      return new Response(svg, {
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' },
      });
    }

    if (req.method === 'GET' && url.pathname === '/preview') {
      const targetUrl = url.searchParams.get('url') ?? '';
      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        return json({ error: 'Invalid URL' }, 400, req);
      }
      try {
        const res = await fetch(targetUrl, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBase/1.0)' },
        });
        const html = await res.text();
        const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? '';
        const desc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1]?.trim() ?? '';
        const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]?.trim() ?? '';
        const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1]?.trim() ?? '';
        return json({ title: ogTitle || title, description: ogDesc || desc, url: targetUrl }, 200, req);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ error: `Preview failed: ${msg}` }, 502, req);
      }
    }

    if (req.method === 'POST' && url.pathname === '/preview') {
      const body = await parseBody(req);
      if (!body?.url || typeof body.url !== 'string' || !/^https?:\/\//i.test(body.url)) {
        return json({ error: 'Missing or invalid url field' }, 400, req);
      }
      const targetUrl = body.url;
      try {
        const { extractWeb } = await import('./extract/web.ts');
        const { isPdfUrl, extractPdf } = await import('./extract/pdf.ts');
        const { extractYoutube } = await import('./extract/youtube.ts');
        const pdfMode = isPdfUrl(targetUrl);
        const type = detectType(targetUrl);
        let extracted: Awaited<ReturnType<typeof extractWeb>> | Awaited<ReturnType<typeof extractPdf>> | Awaited<ReturnType<typeof extractYoutube>>;
        if (pdfMode) {
          extracted = await extractPdf(targetUrl);
        } else if (type === 'youtube') {
          extracted = await extractYoutube(targetUrl);
        } else {
          extracted = await extractWeb(targetUrl);
        }
        const { tldr, summary, tags, sections } = await summarize(
          { ...extracted, url: targetUrl },
        );
        return json({ url: targetUrl, title: extracted.title, summary, tldr, tags, sections, content: extracted.content, type }, 200, req);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Ollama')) return json({ error: msg }, 503, req);
        return json({ error: `Preview failed: ${msg}` }, 502, req);
      }
    }

    if (req.method === 'POST' && url.pathname === '/preview/chat') {
      type ChatMessage = { role: 'user' | 'assistant'; content: string };
      const body = await parseBody(req);
      if (!body?.content || typeof body.content !== 'string') {
        return json({ error: 'Missing content field' }, 400, req);
      }
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user' || !lastMessage.content.trim()) {
        return json({ error: 'Last message must be a non-empty user message' }, 400, req);
      }
      try {
        const ollamaMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
          { role: 'system', content: `You are discussing the following article with the user. Answer questions about it accurately. If something is not covered in the article, say so.\nAlways respond in English, regardless of the article language or what language the user writes in. You may include original-language terms in parentheses for important nuanced terms.\n\n---\n${body.content}\n---` },
          ...messages,
        ];
        const reply = await llmChat(ollamaMessages);
        return json({ reply: reply.trim() }, 200, req);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ error: msg }, 503, req);
      }
    }

    if (req.method === 'GET' && url.pathname === '/ollama/status') {
      const ok = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2000) })
        .then(r => r.ok).catch(() => false);
      return json({ ok, url: config.ollamaUrl }, 200, req);
    }

    if (req.method === 'GET' && url.pathname === '/reading-stats') {
      return json(getReadingStats(), 200, req);
    }

    if (req.method === 'GET' && url.pathname === '/items') {
      const sort = url.searchParams.get('sort');
      return json(listItems(sort === 'rating' ? 'rating' : undefined), 200, req);
    }

    if (req.method === 'GET' && url.pathname === '/search') {
      const q = url.searchParams.get('q') ?? '';
      const tag = url.searchParams.get('tag') ?? '';
      const semantic = url.searchParams.get('semantic') === 'true';
      if (!q && !tag) return json([], 200, req);
      if (semantic && q) {
        try {
          const embedding = await generateEmbedding(q);
          return json(semanticSearch(embedding), 200, req);
        } catch (e) {
          logger.error('search', 'semantic embedding failed', { error: String(e) });
          return json({ error: 'Semantic search unavailable' }, 503, req);
        }
      }
      if (q && !tag) {
        try {
          const ftsResults = ftsSearch(q);
          if (ftsResults.length > 0) {
            return json(ftsResults.map(({ item, snippet }) => ({ ...item, snippet })), 200, req);
          }
        } catch {
          // FTS failed (e.g. bad query syntax) — fall through to LIKE search
        }
      }
      return json(searchItems(q, tag), 200, req);
    }

    if (req.method === 'GET' && url.pathname === '/embed/status') {
      return json(getEmbedStatus(), 200, req);
    }

    // POST /embed/rebuild — re-embed all done items using current strategy
    if (req.method === 'POST' && url.pathname === '/embed/rebuild') {
      // Fire-and-forget background job; returns immediately
      (async () => {
        const items = getAllItemsFull().filter(i => i.status === 'done' && i.transcript);
        let rebuilt = 0;
        for (const item of items) {
          try {
            const text = itemEmbedText(item);
            const embedding = await generateEmbedding(text);
            saveEmbedding(item.id, embedding);
            rebuilt++;
          } catch {
            // skip this item
          }
        }
        logger.info('embed', 'rebuild complete', { rebuilt });
      })().catch(() => {});
      return json({ ok: true, message: 'Rebuild started in background' }, 200, req);
    }

    // GET /items/:id/export/markdown — must come before GET /items/:id
    if (req.method === 'GET' && url.pathname.match(/^\/items\/[^/]+\/export\/markdown$/)) {
      const id = url.pathname.slice('/items/'.length, -'/export/markdown'.length);
      const item = getItem(id);
      if (!item) return json({ error: 'Item not found' }, 404, req);
      const tldrLines = (item.tldr ?? []).map((l) => `- ${l}`).join('\n');
      const sectionsText =
        (item.sections ?? []).length > 0
          ? (item.sections ?? [])
              .map((sec) => {
                const pts = (sec.points ?? []).map((p) => `- ${p}`).join('\n');
                return `### ${sec.title}\n${pts}`;
              })
              .join('\n\n')
          : '';
      const dateStr = item.publishedAt ?? item.createdAt ?? '';
      const parts = [
        `# ${item.title ?? item.url}`,
        `URL: ${item.url}`,
        `Date: ${dateStr}`,
        `Tags: ${(item.tags ?? []).join(', ')}`,
        '',
        tldrLines ? `## TL;DR\n${tldrLines}` : '',
        '',
        item.summary ? `## Summary\n${item.summary}` : '',
        '',
        sectionsText ? `## Key Points\n${sectionsText}` : '',
      ];
      const markdown = parts
        .filter((l, i, arr) => !(l === '' && (i === 0 || arr[i - 1] === '')))
        .join('\n')
        .trim();
      const filename = `${slugify(item.title ?? item.url ?? id) || id}.md`;
      return new Response(markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          ...corsHeaders(req),
        },
      });
    }

    // POST /items/:id/read — must come before GET /items/:id
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/read$/)) {
      const id = url.pathname.slice('/items/'.length, -'/read'.length);
      if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
      markRead(id);
      return json({ ok: true }, 200, req);
    }

    // POST /items/:id/unread
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/unread$/)) {
      const id = url.pathname.slice('/items/'.length, -'/unread'.length);
      if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
      markUnread(id);
      return json({ ok: true }, 200, req);
    }

    // POST /items/:id/rate
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/rate$/)) {
      const id = url.pathname.slice('/items/'.length, -'/rate'.length);
      if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
      const body = await parseBody(req);
      const rating = Number(body?.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return json({ error: 'Rating must be an integer between 1 and 5' }, 400, req);
      }
      rateItem(id, rating);
      return json({ ok: true, rating }, 200, req);
    }

    // POST /items/:id/discuss — chat about an article using its full content as context
    // TODO: swap llmQuery for a web-search-capable model (e.g. Perplexity API or an Ollama model with tools)
    //       so discussions can be enriched with latest information beyond the article.
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/discuss$/)) {
      const id = url.pathname.slice('/items/'.length, -'/discuss'.length);
      const item = getItem(id);
      if (!item) return json({ error: 'Item not found' }, 404, req);

      type DiscussMessage = { role: 'user' | 'assistant'; content: string };
      const body = await parseBody(req);
      const rawMessage = body?.message;
      if (typeof rawMessage !== 'string' || !rawMessage.trim()) return json({ error: 'Missing message' }, 400, req);
      const message = rawMessage.trim();

      // Save the user message to DB
      saveChatMessage(id, 'user', message);

      // Build article context — prefer full transcript, fall back to summary
      const contextParts: string[] = [];
      if (item.title) contextParts.push(`Title: ${item.title}`);
      if (item.url) contextParts.push(`URL: ${item.url}`);
      if (Array.isArray(item.tldr) && item.tldr.length) {
        contextParts.push(`TL;DR:\n${item.tldr.map((l) => `- ${l}`).join('\n')}`);
      }
      if (item.summary) contextParts.push(`Summary:\n${item.summary}`);
      if (Array.isArray(item.sections) && item.sections.length) {
        const sectionText = item.sections.map((s) => {
          const pts = (s.points ?? []).map((p: string) => `  - ${p}`).join('\n');
          return `${s.title}:\n${pts}`;
        }).join('\n\n');
        contextParts.push(`Key points:\n${sectionText}`);
      }
      if (item.transcript) contextParts.push(`Full transcript:\n${item.transcript}`);

      const articleContext = contextParts.join('\n\n');

      // Use DB history as authoritative conversation history
      const history = getChatHistory(id);
      // Exclude the message we just saved (last entry) so we don't duplicate it in the prompt
      const priorHistory = history.slice(0, -1);
      const historyText = priorHistory.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

      const prompt = `You are a knowledgeable assistant helping the user understand and discuss an article they saved.
Always respond in English, regardless of the language used in the article or by the user. If the user writes in another language, reply in English anyway. You may quote or include original-language terms in parentheses when they have important nuance.
Use the article content below to answer questions accurately. Quote or reference specific parts when relevant.
If the answer is not in the article, say so clearly.

--- ARTICLE CONTENT ---
${articleContext}
--- END ARTICLE CONTENT ---

${historyText ? `Previous conversation:\n${historyText}\n` : ''}User: ${message}
Assistant:`;

      try {
        const reply = await llmQuery(prompt);
        // Save the assistant reply to DB
        saveChatMessage(id, 'assistant', reply.trim());
        return json({ reply: reply.trim() }, 200, req);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return json({ error: msg }, 503, req);
      }
    }

    // GET /items/:id/chat — return chat history
    if (req.method === 'GET' && url.pathname.match(/^\/items\/[^/]+\/chat$/)) {
      const id = url.pathname.slice('/items/'.length, -'/chat'.length);
      return json({ messages: getChatHistory(id) }, 200, req);
    }

    // DELETE /items/:id/chat — clear chat history
    if (req.method === 'DELETE' && url.pathname.match(/^\/items\/[^/]+\/chat$/)) {
      const id = url.pathname.slice('/items/'.length, -'/chat'.length);
      clearChatHistory(id);
      return json({ ok: true }, 200, req);
    }

    // POST /items/:id/resummarize
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/resummarize$/)) {
      const id = url.pathname.slice('/items/'.length, -'/resummarize'.length);
      const item = getItem(id);
      if (!item) return json({ error: 'Item not found' }, 404, req);
      if (!item.transcript) return json({ error: 'No transcript to re-summarize' }, 400, req);
      // Save current summary to history before overwriting
      if (item.summary) {
        saveSummaryVersion(id, item.summary, item.tldr ?? [], item.sections ?? []);
      }
      updateItem(id, { status: 'processing' });
      // Async — don't await
      (async () => {
        try {
          const approved = getApprovedTags();
          const rejected = getRejectedTags();
          const extracted: ExtractedContent = { title: item.title, content: item.transcript ?? '', url: item.url };
          if (item.author) extracted.author = item.author;
          const { tldr, summary, sections, tags, publishedAt, model, promptId } = await summarize(extracted, approved, rejected);
          for (const tag of tags) upsertTag(tag, 'pending');
          const summaryFields: Parameters<typeof updateSummary>[1] = { summary, tldr, sections, tags };
          if (publishedAt) summaryFields.publishedAt = publishedAt;
          if (model) summaryFields.summaryModel = model;
          updateSummary(id, summaryFields);
          saveSummaryVersion(id, summary, tldr, sections, model, promptId);
          // Re-generate embedding — non-fatal
          try {
            const updated = getItem(id);
            if (updated) {
              const text = itemEmbedText(updated);
              const embedding = await generateEmbedding(text);
              saveEmbedding(id, embedding);
            }
          } catch {}
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          updateItem(id, { status: 'error', error: msg });
        }
      })();
      return json({ ok: true }, 200, req);
    }

    // GET /items/:id/history — summary version history
    if (req.method === 'GET' && url.pathname.match(/^\/items\/[^/]+\/history$/)) {
      const id = url.pathname.slice('/items/'.length, -'/history'.length);
      if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
      return json(getSummaryHistory(id), 200, req);
    }

    // POST /items/:id/history/:historyId/restore
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/history\/[^/]+\/restore$/)) {
      const parts = url.pathname.slice('/items/'.length).split('/history/');
      const itemId = parts[0];
      const restorePart = parts[1];
      if (!itemId || !restorePart) return json({ error: 'Invalid path' }, 400, req);
      const historyId = parseInt(restorePart.replace('/restore', ''), 10);
      const item = getItem(itemId);
      if (!item) return json({ error: 'Item not found' }, 404, req);
      const history = getSummaryHistory(itemId);
      const version = history.find((h) => h.id === historyId);
      if (!version) return json({ error: 'History version not found' }, 404, req);
      // Save current summary to history before restoring
      if (item.summary) {
        saveSummaryVersion(itemId, item.summary, item.tldr ?? [], item.sections ?? []);
      }
      updateSummary(itemId, { summary: version.summary, tldr: version.tldr, sections: version.sections, tags: item.tags ?? [] });
      return json({ ok: true }, 200, req);
    }

    // GET /items/:id/summary-quality
    if (req.method === 'GET' && url.pathname.match(/^\/items\/[^/]+\/summary-quality$/)) {
      const id = url.pathname.slice('/items/'.length, -'/summary-quality'.length);
      if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
      return json(getSummaryQuality(id), 200, req);
    }

    // POST /items/:id/summary-quality
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/summary-quality$/)) {
      const id = url.pathname.slice('/items/'.length, -'/summary-quality'.length);
      if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
      const body = await parseBody(req);
      if (body === null) return json({ error: 'Invalid JSON body' }, 400, req);
      const rating = body.rating;
      if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return json({ error: 'rating must be an integer between 1 and 5' }, 400, req);
      }
      const reason = typeof body.reason === 'string' ? body.reason : undefined;
      saveSummaryQuality(id, rating, reason);
      return json({ ok: true }, 200, req);
    }

    // GET /prompts/summary — list all summary prompt versions
    if (req.method === 'GET' && url.pathname === '/prompts/summary') {
      return json(listPrompts('summary_prompt_templates'), 200, req);
    }

    // POST /prompts/summary — save/upsert summary prompt
    if (req.method === 'POST' && url.pathname === '/prompts/summary') {
      const body = await parseBody(req);
      if (body === null || typeof body.prompt !== 'string' || !body.prompt.trim()) {
        return json({ error: 'prompt is required' }, 400, req);
      }
      const id = upsertPrompt('summary_prompt_templates', body.prompt);
      return json({ id, is_active: 1 }, 200, req);
    }

    // GET /prompts/chat — list all chat prompt versions
    if (req.method === 'GET' && url.pathname === '/prompts/chat') {
      return json(listPrompts('chat_prompt_templates'), 200, req);
    }

    // POST /prompts/chat — save/upsert chat prompt
    if (req.method === 'POST' && url.pathname === '/prompts/chat') {
      const body = await parseBody(req);
      if (body === null || typeof body.prompt !== 'string' || !body.prompt.trim()) {
        return json({ error: 'prompt is required' }, 400, req);
      }
      const id = upsertPrompt('chat_prompt_templates', body.prompt);
      return json({ id, is_active: 1 }, 200, req);
    }

    // POST /items/:id/notes
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/notes$/)) {
      const id = url.pathname.slice('/items/'.length, -'/notes'.length);
      if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
      const body = await parseBody(req);
      if (body === null) return json({ error: 'Invalid JSON body' }, 400, req);
      saveNote(id, typeof body.notes === 'string' ? body.notes : '');
      return json({ ok: true }, 200, req);
    }

    // POST /items/:id/star — toggle star
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/star$/)) {
      const id = url.pathname.slice('/items/'.length, -'/star'.length);
      if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
      const starred = toggleStar(id);
      return json({ starred }, 200, req);
    }

    // POST /items/:id/pin — toggle pin
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/pin$/)) {
      const id = url.pathname.slice('/items/'.length, -'/pin'.length);
      if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
      const pinned = togglePin(id);
      return json({ pinned }, 200, req);
    }

    // POST /items/:id/study-later — toggle study later flag
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/study-later$/)) {
      const id = url.pathname.slice('/items/'.length, -'/study-later'.length);
      const item = getItem(id);
      if (!item) return json({ error: 'Item not found' }, 404, req);
      const newValue = !(item.studyLater ?? false);
      updateItem(id, { study_later: newValue ? 1 : 0 });
      return json({ ok: true, studyLater: newValue }, 200, req);
    }

    // POST /items/:id/archive — toggle archive state
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/archive$/)) {
      const id = url.pathname.slice('/items/'.length, -'/archive'.length);
      const item = getItem(id);
      if (!item) return json({ error: 'Item not found' }, 404, req);
      const archived = !item.archived;
      archiveItem(id, archived);
      return json({ archived }, 200, req);
    }

    // GET /items/archived — list archived items
    if (req.method === 'GET' && url.pathname === '/items/archived') {
      return json(listArchivedItems(), 200, req);
    }

    // GET /items/recent?limit=N&all=1 — recent items for queue log / extension
    // all=1 includes queued/processing/error items (not just done)
    if (req.method === 'GET' && url.pathname === '/items/recent') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);
      const includeAll = url.searchParams.get('all') === '1';
      return json(getRecentItems(limit, includeAll), 200, req);
    }

    // GET /items/check?url=... — lightweight duplicate check
    if (req.method === 'GET' && url.pathname === '/items/check') {
      const checkUrl = url.searchParams.get('url') ?? '';
      if (!checkUrl) return json({ error: 'Missing url parameter' }, 400, req);
      const existing = getItemByUrl(checkUrl);
      if (!existing) return json({ exists: false }, 200, req);
      return json({ exists: true, id: existing.id, status: existing.status, title: existing.title ?? '' }, 200, req);
    }

    // GET /items/:id/related
    if (req.method === 'GET' && url.pathname.match(/^\/items\/[^/]+\/related$/)) {
      const id = url.pathname.slice('/items/'.length, -'/related'.length);
      const limitParam = url.searchParams.get('limit');
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 5, 20) : 5;
      return json(getRelatedItems(id, limit), 200, req);
    }

    // GET /filter-presets
    if (req.method === 'GET' && url.pathname === '/filter-presets') {
      return json(getFilterPresets(), 200, req);
    }

    // POST /filter-presets
    if (req.method === 'POST' && url.pathname === '/filter-presets') {
      const body = await parseBody(req);
      if (!body || typeof body.name !== 'string' || !body.name) return json({ error: 'name is required' }, 400, req);
      const presetData: FilterPresetData = {};
      if (typeof body.searchQuery === 'string') presetData.searchQuery = body.searchQuery;
      if (Array.isArray(body.tagFilter)) presetData.tagFilter = body.tagFilter.filter((t: unknown): t is string => typeof t === 'string');
      if (typeof body.dateFilter === 'string') presetData.dateFilter = body.dateFilter;
      if (typeof body.typeFilter === 'string') presetData.typeFilter = body.typeFilter;
      if (typeof body.semanticMode === 'boolean') presetData.semanticMode = body.semanticMode;
      if (typeof body.showStarredOnly === 'boolean') presetData.showStarredOnly = body.showStarredOnly;
      const id = saveFilterPreset(body.name, presetData);
      return json({ id }, 201, req);
    }

    // DELETE /filter-presets/:id
    if (req.method === 'DELETE' && url.pathname.match(/^\/filter-presets\/[^/]+$/)) {
      const id = url.pathname.slice('/filter-presets/'.length);
      deleteFilterPreset(id);
      return json({ ok: true }, 200, req);
    }

    // GET /items/:id/highlights
    if (req.method === 'GET' && url.pathname.match(/^\/items\/[^/]+\/highlights$/)) {
      const id = url.pathname.slice('/items/'.length, -'/highlights'.length);
      if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
      return json(getHighlights(id), 200, req);
    }

    // POST /items/:id/highlights
    if (req.method === 'POST' && url.pathname.match(/^\/items\/[^/]+\/highlights$/)) {
      const id = url.pathname.slice('/items/'.length, -'/highlights'.length);
      if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
      const body = await parseBody(req);
      if (body === null) return json({ error: 'Invalid JSON body' }, 400, req);
      if (typeof body.text !== 'string' || !body.text || typeof body.section !== 'string' || !body.section) {
        return json({ error: 'Missing text or section' }, 400, req);
      }
      const highlightId = saveHighlight(id, body.text, body.section, typeof body.comment === 'string' ? body.comment : undefined);
      return json({ id: highlightId }, 201, req);
    }

    // DELETE /highlights/:id
    if (req.method === 'DELETE' && url.pathname.match(/^\/highlights\/[^/]+$/)) {
      const id = url.pathname.slice('/highlights/'.length);
      deleteHighlight(id);
      return json({ ok: true }, 200, req);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/items/')) {
      const id = url.pathname.slice('/items/'.length);
      if (id) {
        const item = getItem(id);
        if (!item) return json({ error: 'Item not found' }, 404, req);
        return json(item, 200, req);
      }
    }

    if (req.method === 'GET' && url.pathname.startsWith('/status/')) {
      const id = url.pathname.slice('/status/'.length);
      const item = getItem(id);
      if (!item) return json({ error: 'Item not found' }, 404, req);
      return json({ id: item.id, status: item.status, title: item.title, summary: item.summary, error: item.error }, 200, req);
    }

    if (req.method === 'POST' && url.pathname === '/process') {
      const body = await parseBody(req);
      if (!body) return json({ error: 'Invalid JSON body' }, 400, req);
      if (!body.url || typeof body.url !== 'string') return json({ error: 'Missing url field' }, 400, req);
      const existing = getItemByUrl(body.url);
      if (existing && existing.status !== 'queued' && existing.status !== 'processing') {
        return json({ id: existing.id, status: 'exists', message: 'Already saved' }, 200, req);
      }
      return json(enqueue(body.url), 200, req);
    }

    // ── Tag endpoints ──────────────────────────────────────────────────────────

    if (req.method === 'GET' && url.pathname === '/tags/stats') {
      return json(getTagStats(), 200, req);
    }

    if (req.method === 'GET' && url.pathname === '/tags') {
      return json({
        approved: getApprovedTags(),
        pending: getPendingTagsWithItems(),
        rejected: getRejectedTags(),
      }, 200, req);
    }

    if (req.method === 'POST' && url.pathname === '/tags/approve') {
      const body = await parseBody(req);
      if (!body?.tag || typeof body.tag !== 'string') return json({ error: 'Missing tag field' }, 400, req);
      approveTag(body.tag);
      return json({ ok: true }, 200, req);
    }

    if (req.method === 'GET' && url.pathname === '/settings') {
      return json(getAllSettings(), 200, req);
    }

    if (req.method === 'POST' && url.pathname === '/settings') {
      const body = await parseBody(req);
      if (!body?.key || typeof body.key !== 'string' || typeof body.value !== 'string') {
        return json({ error: 'Missing key or value field' }, 400, req);
      }
      setSetting(body.key, body.value);
      return json({ ok: true }, 200, req);
    }

    if (req.method === 'POST' && url.pathname === '/tags/reject') {
      const body = await parseBody(req);
      if (!body?.tag || typeof body.tag !== 'string') return json({ error: 'Missing tag field' }, 400, req);
      const rejectReason = typeof body.reason === 'string' ? body.reason : '';
      const rejectItemId = typeof body.itemId === 'string' ? body.itemId : undefined;
      rejectTag(body.tag);
      saveTagRejection(body.tag, rejectReason, rejectItemId);
      if (rejectItemId) retag(rejectItemId).catch(() => {});
      deriveTagRules().catch(() => {});
      return json({ ok: true }, 200, req);
    }

    if (req.method === 'GET' && url.pathname === '/tag-rules') {
      return json({ rules: getTagRules() }, 200, req);
    }

    if (req.method === 'GET' && url.pathname === '/tags/rejections') {
      const rows = getTagRejections();
      return json(rows.map((r) => ({
        id: r.id,
        tag: r.tag,
        reason: r.reason,
        itemId: r.item_id,
        createdAt: r.created_at,
      })), 200, req);
    }

    if (req.method === 'POST' && url.pathname === '/tags/rename') {
      const body = await parseBody(req);
      if (!body?.from || typeof body.from !== 'string' || !body?.to || typeof body.to !== 'string') {
        return json({ error: 'Missing from or to field' }, 400, req);
      }
      const approved = getApprovedTags();
      if (!approved.includes(body.from)) return json({ error: `Tag "${body.from}" not found` }, 404, req);
      renameTag(body.from, body.to);
      return json({ ok: true }, 200, req);
    }

    if (req.method === 'POST' && url.pathname === '/tags/merge') {
      const body = await parseBody(req);
      if (!body?.from || typeof body.from !== 'string' || !body?.to || typeof body.to !== 'string') {
        return json({ error: 'Missing from or to field' }, 400, req);
      }
      const itemsUpdated = mergeTags(body.from, body.to);
      return json({ ok: true, itemsUpdated }, 200, req);
    }

    // ── Tag consolidation endpoints ───────────────────────────────────────────

    if (req.method === 'POST' && url.pathname === '/tags/consolidate/suggest') {
      const approved = getApprovedTags();
      if (approved.length < 2) return json([], 200, req);
      const prompt = `You are a tag deduplication assistant. Here is a list of tags from a personal knowledge base:

${approved.map((t) => `- ${t}`).join('\n')}

Identify groups of tags that mean the same thing or are very similar (synonyms, different phrasings, singular/plural, etc.).
For each group, suggest a single canonical tag name in Title Case with spaces (e.g. "Game Development", "Machine Learning"). Acronyms stay uppercase: "AI", "LLM", "VR".

Return ONLY valid JSON array:
[
  {
    "canonical": "AI Future",
    "similar": ["future of ai", "ai's future", "ai going forward", "future ai"],
    "reason": "All refer to the future of artificial intelligence"
  }
]

Only include groups with 2+ members. If no groups found, return [].
Do not include groups where the tags are clearly different topics.`;
      try {
        const text = await llmQuery(prompt);
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (!arrayMatch) return json([], 200, req);
        const parsed: unknown = JSON.parse(arrayMatch[0]);
        if (!Array.isArray(parsed)) return json([], 200, req);
        const valid = parsed.filter(
          (g): g is { canonical: string; similar: string[]; reason: string } =>
            isPlainObject(g) &&
            typeof g.canonical === 'string' &&
            Array.isArray(g.similar) &&
            g.similar.length > 0
        );
        return json(valid, 200, req);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return json({ error: msg }, 503, req);
      }
    }

    if (req.method === 'POST' && url.pathname === '/tags/consolidate/apply') {
      const body = await parseBody(req);
      if (!body?.groups || !Array.isArray(body.groups)) return json({ error: 'Missing groups array' }, 400, req);
      let merged = 0;
      const tagsAffected: string[] = [];
      for (const group of body.groups) {
        if (!group.canonical || !Array.isArray(group.similar)) continue;
        for (const tag of group.similar) {
          if (tag === group.canonical) continue;
          mergeTags(tag, group.canonical);
          recordConsolidation(drizzleDb, tag, group.canonical);
          tagsAffected.push(tag);
          merged++;
        }
        approveTag(group.canonical);
      }
      return json({ merged, tagsAffected }, 200, req);
    }

    // ── Export endpoints ───────────────────────────────────────────────────────

    if (req.method === 'GET' && url.pathname === '/export/json') {
      const date = new Date().toISOString().slice(0, 10);
      const items = getAllItemsFull();
      return new Response(JSON.stringify(items, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="knowledge-base-${date}.json"`,
          ...corsHeaders(req),
        },
      });
    }

    if (req.method === 'GET' && url.pathname === '/export/markdown') {
      const date = new Date().toISOString().slice(0, 10);
      const items = getAllItemsFull();
      const lines: string[] = [];
      for (const item of items) {
        lines.push(`## ${item.title}`);
        lines.push(`**URL:** ${item.url}`);
        lines.push(`**Date:** ${item.createdAt}`);
        lines.push(`**Tags:** ${(item.tags ?? []).join(', ') || '—'}`);
        lines.push('');
        if (item.tldr && item.tldr.length > 0) {
          lines.push('**TL;DR:**');
          for (const bullet of item.tldr) lines.push(`- ${bullet}`);
          lines.push('');
        }
        if (item.summary) {
          lines.push(item.summary);
          lines.push('');
        }
        lines.push('---');
        lines.push('');
      }
      return new Response(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="knowledge-base-${date}.md"`,
          ...corsHeaders(req),
        },
      });
    }

    // DELETE /items/:id
    if (req.method === 'DELETE' && url.pathname.startsWith('/items/')) {
      const id = url.pathname.slice('/items/'.length);
      if (id && !id.includes('/')) {
        if (!getItem(id)) return json({ error: 'Item not found' }, 404, req);
        deleteItem(id);
        return json({ ok: true }, 200, req);
      }
    }

    // POST /items/retry-failed — bulk-retry all failed queue items
    if (req.method === 'POST' && url.pathname === '/items/retry-failed') {
      const count = retryFailed();
      return json({ retried: count }, 200, req);
    }

    // POST /items/batch-delete
    if (req.method === 'POST' && url.pathname === '/items/batch-delete') {
      const body = await parseBody(req);
      if (!body?.ids || !Array.isArray(body.ids)) return json({ error: 'Missing ids array' }, 400, req);
      for (const id of body.ids) {
        if (typeof id === 'string' && getItem(id)) deleteItem(id);
      }
      return json({ ok: true, deleted: body.ids.length }, 200, req);
    }

    // ── Collection endpoints ───────────────────────────────────────────────────

    if (req.method === 'GET' && url.pathname === '/collections') {
      return json(listCollections(), 200, req);
    }

    if (req.method === 'POST' && url.pathname === '/collections') {
      const body = await parseBody(req);
      if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
        return json({ error: 'Missing name field' }, 400, req);
      }
      try {
        const id = createCollection(body.name.trim());
        return json({ id }, 201, req);
      } catch {
        return json({ error: 'Collection name already exists' }, 409, req);
      }
    }

    if (req.method === 'DELETE' && url.pathname.match(/^\/collections\/[^/]+$/)) {
      const id = url.pathname.slice('/collections/'.length);
      deleteCollection(id);
      return json({ ok: true }, 200, req);
    }

    if (req.method === 'PATCH' && url.pathname.match(/^\/collections\/[^/]+$/)) {
      const id = url.pathname.slice('/collections/'.length);
      const body = await parseBody(req);
      if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
        return json({ error: 'Missing name field' }, 400, req);
      }
      try {
        renameCollection(id, body.name.trim());
        return json({ ok: true }, 200, req);
      } catch {
        return json({ error: 'Collection name already exists' }, 409, req);
      }
    }

    if (req.method === 'GET' && url.pathname.match(/^\/collections\/[^/]+\/items$/)) {
      const id = url.pathname.slice('/collections/'.length, -'/items'.length);
      return json(getCollectionItems(id), 200, req);
    }

    if (req.method === 'POST' && url.pathname.match(/^\/collections\/[^/]+\/items$/)) {
      const id = url.pathname.slice('/collections/'.length, -'/items'.length);
      const body = await parseBody(req);
      if (!body?.itemId || typeof body.itemId !== 'string') {
        return json({ error: 'Missing itemId field' }, 400, req);
      }
      addItemToCollection(id, body.itemId);
      return json({ ok: true }, 200, req);
    }

    if (req.method === 'DELETE' && url.pathname.match(/^\/collections\/[^/]+\/items\/[^/]+$/)) {
      const parts = url.pathname.slice('/collections/'.length).split('/items/');
      const collectionId = parts[0];
      const itemId = parts[1];
      if (!collectionId || !itemId) return json({ error: 'Invalid path' }, 400, req);
      removeItemFromCollection(collectionId, itemId);
      return json({ ok: true }, 200, req);
    }

    if (req.method === 'GET' && url.pathname.match(/^\/items\/[^/]+\/collections$/)) {
      const id = url.pathname.slice('/items/'.length, -'/collections'.length);
      return json(getItemCollections(id), 200, req);
    }

    // POST /collections/:id/items/batch
    if (req.method === 'POST' && url.pathname.match(/^\/collections\/[^/]+\/items\/batch$/)) {
      const collectionId = url.pathname.slice('/collections/'.length, -'/items/batch'.length);
      const body = await parseBody(req);
      if (!body?.itemIds || !Array.isArray(body.itemIds)) {
        return json({ error: 'Missing itemIds array' }, 400, req);
      }
      for (const itemId of body.itemIds) {
        if (typeof itemId === 'string') addItemToCollection(collectionId, itemId);
      }
      return json({ ok: true, added: body.itemIds.length }, 200, req);
    }

    // ── Digest endpoint ───────────────────────────────────────────────────────

    if (req.method === 'GET' && url.pathname === '/digest') {
      const daysParam = url.searchParams.get('days');
      const days = Math.min(Math.max(parseInt(daysParam ?? '7', 10) || 7, 1), 365);
      const format = url.searchParams.get('format');
      const now = new Date();
      const toDate = now.toISOString();
      const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      const items = getItemsInRange(fromDate, toDate);

      const toStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const fromD = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const fromStr = fromD.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const lines: string[] = [];
      lines.push(`# Knowledge Digest — ${fromStr}–${toStr}`);
      lines.push('');
      lines.push(`## This Week's Highlights (${items.length} item${items.length !== 1 ? 's' : ''})`);
      lines.push('');

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        const savedDate = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const tags = (item.tags ?? []).join(', ') || '';
        lines.push(`### ${i + 1}. ${item.title}`);
        lines.push(`*Saved ${savedDate}${tags ? ` · Tags: ${tags}` : ''}*`);
        if (item.tldr && item.tldr.length > 0) {
          for (const bullet of item.tldr.slice(0, 3)) {
            lines.push(`- ${bullet}`);
          }
        } else if (item.summary) {
          const snippet = item.summary.slice(0, 200).replace(/\n/g, ' ');
          lines.push(`- ${snippet}${item.summary.length > 200 ? '…' : ''}`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push(`*Generated by Knowledge Base on ${toStr}*`);
      lines.push('');

      const markdown = lines.join('\n');
      const dateSlug = now.toISOString().slice(0, 10);

      if (format === 'text') {
        return new Response(markdown, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            ...corsHeaders(req),
          },
        });
      }

      return new Response(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="digest-${dateSlug}.md"`,
          ...corsHeaders(req),
        },
      });
    }

    // ── Domain stats endpoint ─────────────────────────────────────────────────

    if (req.method === 'GET' && url.pathname === '/stats/domains') {
      return json(getDomainStats(), 200, req);
    }

    // ── Stats summary endpoint ────────────────────────────────────────────────

    if (req.method === 'GET' && url.pathname === '/stats/summary') {
      return json(getStatsSummary(), 200, req);
    }

    // ── Tag suggestions endpoint ──────────────────────────────────────────────

    if (req.method === 'GET' && url.pathname === '/tags/suggestions') {
      const suggestions = getItemsWithUnapprovedTags().map(({ id, title, rawTags }) => ({
        itemId: id,
        title,
        suggestedTags: rawTags,
      }));
      return json(suggestions, 200, req);
    }

    // ── System status endpoint ────────────────────────────────────────────────

    if (req.method === 'GET' && url.pathname === '/system/status') {
      const [whisperOk, ytdlpOk, pdfOk] = await Promise.all([
        Bun.$`which whisper`.quiet().then(() => true).catch(() => false),
        Bun.$`which yt-dlp`.quiet().then(() => true).catch(() => false),
        Bun.$`which pdftotext`.quiet().then(() => true).catch(() => false),
      ]);
      return json({ whisper: whisperOk, ytdlp: ytdlpOk, pdftotext: pdfOk }, 200, req);
    }

    // ── Bookmark / CSV import endpoint ────────────────────────────────────────

    if (req.method === 'POST' && url.pathname === '/import/bookmarks') {
      let formData: FormData;
      try { formData = await req.formData(); } catch { return json({ error: 'Invalid form data' }, 400, req); }
      const file = formData.get('file');
      if (!(file instanceof File)) return json({ error: 'Missing file field' }, 400, req);

      const text = await file.text();
      const filename = file.name.toLowerCase();
      const isCSV = filename.endsWith('.csv') || text.trimStart().startsWith('URL,');

      const urls: string[] = [];
      if (isCSV) {
        // Instapaper CSV: URL,Title,Selection,Folder — skip header row
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const firstComma = line.indexOf(',');
          const rawUrl = firstComma === -1 ? line : line.slice(0, firstComma).replace(/^"|"$/g, '').trim();
          if (/^https?:\/\//i.test(rawUrl)) urls.push(rawUrl);
        }
      } else {
        // Netscape bookmark HTML (Chrome, Firefox, Pocket export)
        const matches = text.matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"/gi);
        for (const m of matches) {
          if (m[1]) urls.push(m[1]);
        }
      }

      let queued = 0;
      let duplicates = 0;
      let skipped = 0;
      for (const u of urls) {
        if (!u.startsWith('http')) { skipped++; continue; }
        const existing = getItemByUrl(u);
        if (existing) { duplicates++; continue; }
        enqueue(u);
        queued++;
      }
      return json({ total: urls.length, queued, duplicates, skipped }, 200, req);
    }

    // ── Feed endpoints ────────────────────────────────────────────────────────

    if (req.method === 'GET' && url.pathname === '/feeds') {
      return json(listFeeds(), 200, req);
    }

    if (req.method === 'POST' && url.pathname === '/feeds') {
      const body = await parseBody(req);
      if (!body?.url || typeof body.url !== 'string' || !body.url.trim()) {
        return json({ error: 'Missing url field' }, 400, req);
      }
      const feedUrl = body.url.trim();
      const feedName = typeof body.name === 'string' ? body.name.trim() || undefined : undefined;
      let feedId: string;
      try {
        feedId = addFeed(feedUrl, feedName);
      } catch {
        return json({ error: 'Feed URL already exists' }, 409, req);
      }
      // Immediately check the new feed (non-blocking)
      checkFeed(feedId).catch((e) => logger.error('feed', 'initial check failed', { id: feedId, error: String(e) }));
      return json({ id: feedId }, 201, req);
    }

    if (req.method === 'DELETE' && url.pathname.match(/^\/feeds\/[^/]+$/)) {
      const id = url.pathname.slice('/feeds/'.length);
      deleteFeed(id);
      return json({ ok: true }, 200, req);
    }

    if (req.method === 'POST' && url.pathname.match(/^\/feeds\/[^/]+\/check$/)) {
      const id = url.pathname.slice('/feeds/'.length, -'/check'.length);
      checkFeed(id).catch((e) => logger.error('feed', 'manual check failed', { id, error: String(e) }));
      return json({ ok: true }, 200, req);
    }

    if (req.method === 'GET' && url.pathname === '/admin/test-data/count') {
      return json({ count: getTestDataCount() }, 200, req);
    }

    if (req.method === 'DELETE' && url.pathname === '/admin/test-data') {
      const deleted = clearTestData();
      return json({ deleted }, 200, req);
    }

    return json({ error: 'Not found' }, 404, req);
  },
});

// ── Startup ───────────────────────────────────────────────────────────────────

logger.info('startup', `Server ready on http://${config.host}:${config.port}`);
queue.recover().catch((e) => logger.error('startup', 'Recovery failed', { error: String(e) }));
queue.start();

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function gracefulShutdown(): Promise<void> {
  logger.info('shutdown', 'Waiting for active jobs...');
  await queue.stop();
  logger.info('shutdown', 'Clean exit');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
