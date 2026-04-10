import { extractYoutube } from './extract/youtube.ts';
import { extractWeb } from './extract/web.ts';
import { summarize } from './summarize.ts';
import { saveItem, loadIndex, loadItem, itemExists } from './storage.ts';
import type { KnowledgeItem } from './types.ts';

type JobStatus = 'queued' | 'processing' | 'done' | 'error';

interface Job {
  id: string;
  url: string;
  status: JobStatus;
  title?: string;
  summary?: string;
  error?: string;
}

const jobs = new Map<string, Job>();

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

async function processJob(job: Job): Promise<void> {
  job.status = 'processing';
  try {
    if (await itemExists(job.url)) {
      const index = await loadIndex();
      const existing = index.find((i) => i.url === job.url);
      job.status = 'done';
      job.title = existing?.title ?? 'Already saved';
      job.summary = existing?.summary ?? '';
      return;
    }

    const type: 'youtube' | 'web' = isYouTubeUrl(job.url) ? 'youtube' : 'web';
    const extracted = type === 'youtube' ? await extractYoutube(job.url) : await extractWeb(job.url);
    const { summary, sections, tags } = await summarize(extracted);

    const id = slugify(extracted.title) || `item-${Date.now()}`;
    const item: KnowledgeItem = {
      id,
      url: job.url,
      type,
      title: extracted.title,
      author: extracted.author,
      dateAdded: new Date().toISOString(),
      tags,
      summary,
      sections,
      content: extracted.content,
    };

    await saveItem(item);
    job.status = 'done';
    job.title = extracted.title;
    job.summary = summary;
  } catch (err) {
    job.status = 'error';
    job.error = err instanceof Error ? err.message : String(err);
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Bun.serve({
  hostname: '127.0.0.1',
  port: 3737,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/items') {
      const index = await loadIndex();
      return json(index);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/items/')) {
      const id = url.pathname.slice('/items/'.length);
      if (id) {
        const index = await loadIndex();
        const item = index.find((i) => i.id === id);
        if (!item) return json({ error: 'Item not found' }, 404);
        // Load full transcript from markdown file — extract ## Content section
        const raw = await loadItem(id);
        let content = '';
        if (raw) {
          const contentMatch = raw.match(/^##\s+Content\s*\n([\s\S]*)$/m);
          content = contentMatch ? contentMatch[1].trim() : '';
        }
        return json({ ...item, content });
      }
    }

    if (req.method === 'GET' && url.pathname.startsWith('/status/')) {
      const id = url.pathname.slice('/status/'.length);
      const job = jobs.get(id);
      if (!job) return json({ error: 'Job not found' }, 404);
      return json(job);
    }

    if (req.method === 'POST' && url.pathname === '/process') {
      let body: { url?: string };
      try {
        body = (await req.json()) as { url?: string };
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }

      if (!body.url || typeof body.url !== 'string') {
        return json({ error: 'Missing url field' }, 400);
      }

      const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const job: Job = { id, url: body.url, status: 'queued' };
      jobs.set(id, job);

      // Fire and forget — do not await
      processJob(job).catch(() => {});

      return json({ id, status: 'queued' });
    }

    return json({ error: 'Not found' }, 404);
  },
});

console.log('Knowledge Base server running on http://127.0.0.1:3737');
