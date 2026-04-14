import { extractYoutube } from './extract/youtube.ts';
import { extractWeb } from './extract/web.ts';
import { extractVideo, isVideoUrl, type VideoExtractResult } from './extract/video.ts';
import { extractPdf, isPdfUrl } from './extract/pdf.ts';
import { summarize, llmQuery } from './summarize.ts';
import {
  getItem, getItemByUrl, insertItem, updateItem, upsertTag,
  getApprovedTags, getRejectedTags,
  getItemsToRetry, incrementRetry,
  saveEmbedding, saveSummaryVersion,
  getTagRejections, getTagRules, saveTagRules,
} from './db.ts';
import { generateEmbedding, itemEmbedText } from './embed.ts';
import { logger } from './logger.ts';
import { config } from './config.ts';
import { asKnowledgeItemId } from './types.ts';
import type { Database } from 'bun:sqlite';

// ── URL type detection ────────────────────────────────────────────────────────

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
}

export function detectType(url: string): 'youtube' | 'video' | 'article' {
  if (isYouTubeUrl(url)) return 'youtube';
  if (isVideoUrl(url)) return 'video';
  return 'article';
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface QueueOptions {
  db: Database;
  maxConcurrent?: number;
  /** Called after each item completes or errors. Used by server.ts to push SSE events. */
  onProgress?: (id: string, status: string, title?: string) => void;
}

export interface QueueHandle {
  /** Insert (if new) and schedule processing for a URL. Returns canonical item id and status. */
  enqueue: (url: string, feedId?: string) => { id: string; status: string };
  /** Recover items left in 'processing' state at startup, then re-submit all queued items. */
  recover: () => Promise<void>;
  /** Start the retry scheduler (re-queues failed items every 10 minutes). */
  start: () => void;
  /** Stop the retry scheduler and wait for active jobs to drain (up to 30 s). */
  stop: () => Promise<void>;
  /** Requeue every item currently in 'error' state. Returns how many were requeued. */
  retryFailed: () => number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createQueue(options: QueueOptions): QueueHandle {
  const { db: _db, maxConcurrent = 2, onProgress } = options;

  let activeJobs = 0;
  const pendingQueue: Array<() => void> = [];
  let retryTimer: ReturnType<typeof setInterval> | null = null;

  // ── Semaphore ───────────────────────────────────────────────────────────────

  function runWithSemaphore(fn: () => Promise<void>): void {
    if (activeJobs < maxConcurrent) {
      activeJobs++;
      fn().finally(() => {
        activeJobs--;
        const next = pendingQueue.shift();
        if (next) next();
      });
    } else {
      pendingQueue.push(() => runWithSemaphore(fn));
    }
  }

  // ── Item processor ──────────────────────────────────────────────────────────

  async function processItem(id: string, url: string): Promise<void> {
    logger.info('process', 'item queued', { id });
    updateItem(id, { status: 'processing' });
    logger.info('process', 'item processing', { id });
    let completed = false;
    try {
      const pdfMode = isPdfUrl(url);
      const type = detectType(url);
      let extracted:
        | Awaited<ReturnType<typeof extractYoutube>>
        | Awaited<ReturnType<typeof extractWeb>>
        | VideoExtractResult
        | Awaited<ReturnType<typeof extractPdf>>;

      if (pdfMode) {
        extracted = await extractPdf(url);
      } else if (type === 'youtube') {
        extracted = await extractYoutube(url);
      } else if (type === 'video') {
        extracted = await extractVideo(url);
      } else {
        extracted = await extractWeb(url);
      }

      // YouTube/video: if transcript couldn't be fetched, save as error immediately
      if ('extractionError' in extracted && extracted.extractionError) {
        const msg = extracted.extractionError;
        logger.warn('process', 'item error (extraction)', { id, error: msg });
        updateItem(id, {
          title: extracted.title,
          type,
          status: 'error',
          error: msg,
        });
        onProgress?.(id, 'error', extracted.title);
        completed = true;
        return;
      }

      const approved = getApprovedTags();
      const rejected = getRejectedTags();
      const extractedWithUrl = 'url' in extracted ? extracted : { ...extracted, url };
      const metadataPublishedAt = 'publishedAt' in extractedWithUrl ? extractedWithUrl.publishedAt : undefined;
      const { tldr, summary, sections, tags, publishedAt, model, promptId } = await summarize(
        extractedWithUrl,
        approved,
        rejected,
        metadataPublishedAt,
      );

      // Register new tags as pending (won't downgrade already-approved ones)
      for (const tag of tags) upsertTag(tag, 'pending');

      const updateFields: Parameters<typeof updateItem>[1] = {
        title: extracted.title,
        type: pdfMode ? 'article' : type,
        transcript: extracted.content,
        tldr,
        summary,
        sections,
        tags,
        status: 'done',
        summaryModel: model,
      };
      const extractedAuthor = 'author' in extracted ? extracted.author : undefined;
      if (extractedAuthor !== undefined) updateFields.author = extractedAuthor;
      if (publishedAt !== undefined) updateFields.publishedAt = publishedAt;
      const extractedImageUrl = 'imageUrl' in extracted ? extracted.imageUrl : undefined;
      if (extractedImageUrl !== undefined) updateFields.imageUrl = extractedImageUrl;
      updateItem(id, updateFields);
      saveSummaryVersion(id, summary, tldr, sections, model, promptId);
      completed = true;
      logger.info('process', 'item done', { id });
      onProgress?.(id, 'done', extracted.title);

      // Generate embedding — non-fatal
      try {
        const item = getItem(id);
        if (item) {
          const text = itemEmbedText(item);
          const embedding = await generateEmbedding(text);
          saveEmbedding(id, embedding);
          logger.info('embed', 'embedded', { id });
        }
      } catch (e) {
        logger.error('embed', 'embedding failed', { id, error: String(e) });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('process', 'item error', { id, error: msg });
      updateItem(id, { status: 'error', error: msg });
      onProgress?.(id, 'error');
      completed = true;
    } finally {
      // Safety net: ensure item is never left in 'processing' state
      if (!completed) {
        updateItem(id, { status: 'error', error: 'Processing aborted unexpectedly' });
      }
    }
  }

  // ── Enqueue ─────────────────────────────────────────────────────────────────

  function enqueue(url: string, feedId?: string): { id: string; status: string } {
    // INSERT OR IGNORE is atomic; only one concurrent caller will actually insert.
    // Both callers then re-read the canonical row.
    const candidateId = asKnowledgeItemId(`item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    const insertData: Parameters<typeof insertItem>[0] = { id: candidateId, url, type: detectType(url), createdAt: new Date().toISOString() };
    if (feedId !== undefined) insertData.feedId = feedId;
    insertItem(insertData);
    const canonical = getItemByUrl(url);
    if (!canonical) {
      // Should not happen — we just inserted the item. Return queued status.
      return { id: candidateId, status: 'queued' };
    }
    // Only the caller that actually inserted (status is still 'queued') starts work
    if (canonical.id === candidateId) {
      runWithSemaphore(() => processItem(canonical.id, url));
    }
    return { id: canonical.id, status: canonical.status };
  }

  // ── Startup recovery ────────────────────────────────────────────────────────

  async function recover(): Promise<void> {
    // Items left 'processing' when the server died — reset to queued
    const stuck = _db.query<{ id: string; url: string }, []>(
      `SELECT id, url FROM items WHERE status = 'processing'`,
    ).all();
    for (const { id } of stuck) {
      updateItem(id, { status: 'queued' });
      logger.info('startup', 'reset stuck item', { id });
    }

    // Re-submit all queued items (including ones just reset) to the worker
    const queued = _db.query<{ id: string; url: string }, []>(
      `SELECT id, url FROM items WHERE status = 'queued' ORDER BY date_added ASC`,
    ).all();
    logger.info('startup', 'recovering queued items', { count: queued.length });
    for (const { id, url } of queued) {
      runWithSemaphore(() => processItem(id, url));
    }

    logger.info('startup', 'queue recovery complete', { count: queued.length });
    logger.info('startup', `server ready on http://${config.host}:${config.port}`);
  }

  // ── Retry scheduler ─────────────────────────────────────────────────────────

  function start(): void {
    if (retryTimer !== null) return;
    retryTimer = setInterval(() => {
      const toRetry = getItemsToRetry();
      for (const { id } of toRetry) {
        incrementRetry(id);
        const row = _db.query<{ url: string }, [string]>('SELECT url FROM items WHERE id = ?').get(id);
        if (!row) continue;
        updateItem(id, { status: 'queued' });
        runWithSemaphore(() => processItem(id, row.url));
        logger.info('retry', 're-queuing item', { id });
      }
    }, 10 * 60 * 1000);
  }

  async function stop(): Promise<void> {
    if (retryTimer !== null) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
    // Drain active jobs (up to 30 s)
    const deadline = Date.now() + 30_000;
    while (activeJobs > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // ── Bulk retry ──────────────────────────────────────────────────────────────

  function retryFailed(): number {
    const failed = _db.query<{ id: string; url: string }, []>(
      `SELECT id, url FROM items WHERE status = 'error'`,
    ).all();
    for (const { id, url } of failed) {
      updateItem(id, { status: 'queued' });
      runWithSemaphore(() => processItem(id, url));
      logger.info('retry', 'bulk re-queuing item', { id });
    }
    return failed.length;
  }

  return { enqueue, recover, start, stop, retryFailed };
}

// ── Tag rule derivation ───────────────────────────────────────────────────────

let deriveRulesRunning = false;

export async function deriveTagRules(): Promise<void> {
  if (deriveRulesRunning) return;
  deriveRulesRunning = true;
  try {
    const rejections = getTagRejections();
    if (rejections.length === 0) return;

    const existingRules = getTagRules();
    const rejectionLines = rejections
      .map((r) => `- "${r.tag}": ${r.reason || '(no reason given)'}`)
      .join('\n');

    const prompt = `You are a tagging policy assistant. Based on the tag rejections below, produce a concise set of tagging rules (maximum 20 rules) for consistent tag generation.

Rules should cover:
- Naming conventions (case, format — e.g. lowercase, hyphenated, no spaces)
- Granularity (not too broad like "technology", not too specific like "2024-apple-keynote")
- Grouping logic (when to split topics into separate tags vs. combine them)

Existing rules (may be empty):
${existingRules || '(none)'}

Tag rejections (tag → reason):
${rejectionLines}

Respond with ONLY the ruleset as a numbered list. No preamble, no explanation.`;

    const result = await llmQuery(prompt);
    saveTagRules(result.trim());
  } catch (err) {
    process.stderr.write(`[derive-rules] ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
  } finally {
    deriveRulesRunning = false;
  }
}
