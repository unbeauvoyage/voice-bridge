import { watch } from 'node:fs';
import { extractYoutube } from './extract/youtube.ts';
import { extractWeb } from './extract/web.ts';
import { summarize } from './summarize.ts';
import { getItem, getItemByUrl, insertItem, itemExistsByUrl, listItems, updateItem } from './db.ts';

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

async function processItem(id: string, url: string): Promise<void> {
  updateItem(id, { status: 'processing' });
  try {
    const type: 'youtube' | 'web' = isYouTubeUrl(url) ? 'youtube' : 'web';
    const extracted = type === 'youtube' ? await extractYoutube(url) : await extractWeb(url);
    const { summary, sections, tags } = await summarize(extracted);

    updateItem(id, {
      title: extracted.title,
      author: extracted.author,
      type,
      transcript: extracted.content,
      summary,
      sections,
      tags,
      status: 'done',
    });
  } catch (err) {
    updateItem(id, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function enqueue(url: string): { id: string; status: string } {
  const existing = getItemByUrl(url);
  if (existing) {
    return { id: existing.id, status: existing.status };
  }
  const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  insertItem({ id, url, type: isYouTubeUrl(url) ? 'youtube' : 'web', dateAdded: new Date().toISOString() });
  processItem(id, url).catch(() => {});
  return { id, status: 'queued' };
}

// urls.txt watcher — queue any new URLs on file change
const URLS_FILE = 'urls.txt';

async function processUrlsFile(): Promise<void> {
  const file = Bun.file(URLS_FILE);
  if (!(await file.exists())) return;
  const text = await file.text();
  const urls = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const url of urls) {
    if (!itemExistsByUrl(url)) {
      console.log(`[watcher] Queuing: ${url}`);
      enqueue(url);
    }
  }
}

processUrlsFile();
watch(URLS_FILE, { persistent: false }, () => {
  console.log('[watcher] urls.txt changed — checking for new URLs...');
  processUrlsFile();
});

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
      return json(listItems());
    }

    if (req.method === 'GET' && url.pathname.startsWith('/items/')) {
      const id = url.pathname.slice('/items/'.length);
      if (id) {
        const item = getItem(id);
        if (!item) return json({ error: 'Item not found' }, 404);
        return json(item);
      }
    }

    if (req.method === 'GET' && url.pathname.startsWith('/status/')) {
      const id = url.pathname.slice('/status/'.length);
      const item = getItem(id);
      if (!item) return json({ error: 'Item not found' }, 404);
      return json({ id: item.id, status: item.status, title: item.title, summary: item.summary, error: item.error });
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
      const result = enqueue(body.url);
      return json(result);
    }

    return json({ error: 'Not found' }, 404);
  },
});

console.log('Knowledge Base server running on http://127.0.0.1:3737');
