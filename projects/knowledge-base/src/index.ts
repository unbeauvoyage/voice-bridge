import { extractYoutube } from './extract/youtube.ts';
import { extractWeb } from './extract/web.ts';
import { summarize } from './summarize.ts';
import { saveItem, loadIndex, loadItem, itemExists } from './storage.ts';
import type { KnowledgeItem } from './types.ts';
import { asKnowledgeItemId } from './types.ts';

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

async function processUrl(url: string, index: number, total: number): Promise<void> {
  console.log(`\n[${index}/${total}] Processing: ${url}`);

  if (await itemExists(url)) {
    console.log(`  Skipping — already in knowledge base`);
    return;
  }

  const type: 'youtube' | 'article' = isYouTubeUrl(url) ? 'youtube' : 'article';

  console.log(`  Extracting ${type} content...`);
  const extracted = type === 'youtube' ? await extractYoutube(url) : await extractWeb(url);
  console.log(`  Title: ${extracted.title}`);

  console.log(`  Summarizing...`);
  const { summary, sections, tags } = await summarize(extracted);

  const id = asKnowledgeItemId(slugify(extracted.title) || `item-${Date.now()}`);
  const item: KnowledgeItem = {
    id,
    url,
    type,
    title: extracted.title,
    createdAt: new Date().toISOString(),
    tags,
    tldr: [],
    summary,
    sections,
    transcript: extracted.content,
    status: 'done',
  };
  if (extracted.author !== undefined) item.author = extracted.author;

  await saveItem(item);
  console.log(`  Saved: ${id}`);
  console.log(`  Tags: ${tags.join(', ')}`);
  console.log(`  Summary: ${summary}`);
}

async function listItems(): Promise<void> {
  const items = await loadIndex();
  if (items.length === 0) {
    console.log('Knowledge base is empty.');
    return;
  }
  console.log(`\nKnowledge Base — ${items.length} items\n`);
  for (const item of items) {
    console.log(`  [${item.type}] ${item.id}`);
    console.log(`    Title: ${item.title}`);
    console.log(`    Date:  ${item.createdAt.slice(0, 10)}`);
    console.log(`    Tags:  ${item.tags.join(', ')}`);
    console.log(`    ${item.summary}`);
    console.log();
  }
}

async function viewItem(id: string): Promise<void> {
  const item = await loadItem(id);
  if (!item) {
    console.error(`Item not found: ${id}`);
    process.exit(1);
  }
  console.log(`Title:   ${item.title}`);
  console.log(`URL:     ${item.url}`);
  console.log(`Added:   ${item.createdAt}`);
  console.log(`Tags:    ${item.tags.join(', ')}`);
  console.log(`\nSummary:\n${item.summary}`);
  if (item.sections.length) {
    for (const s of item.sections) {
      console.log(`\n## ${s.title}`);
      for (const p of s.points) console.log(`  - ${p}`);
    }
  }
  if (item.transcript) {
    console.log(`\n--- Transcript (${item.transcript.length} chars) ---\n`);
    console.log(item.transcript.slice(0, 2000) + (item.transcript.length > 2000 ? '\n[truncated]' : ''));
  }
}

async function readUrlsFromFile(filePath: string): Promise<string[]> {
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) throw new Error(`File not found: ${filePath}`);
  const text = await file.text();
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    await listItems();
    return;
  }

  const viewIdx = args.indexOf('--view');
  if (viewIdx !== -1) {
    const id = args[viewIdx + 1];
    if (!id) {
      console.error('Usage: --view <id>');
      process.exit(1);
    }
    await viewItem(id);
    return;
  }

  let urls: string[] = [];

  const fileIdx = args.indexOf('--file');
  if (fileIdx !== -1) {
    const filePath = args[fileIdx + 1];
    if (!filePath) {
      console.error('Usage: --file <path>');
      process.exit(1);
    }
    urls = await readUrlsFromFile(filePath);
  }

  const positional = args.filter((a, i) => {
    if (a.startsWith('--')) return false;
    const prev = args[i - 1];
    if (prev === '--file' || prev === '--view') return false;
    return true;
  });
  urls = [...urls, ...positional];

  if (urls.length === 0) {
    console.log('Usage:');
    console.log('  bun run src/index.ts <url> [url...]');
    console.log('  bun run src/index.ts --file urls.txt');
    console.log('  bun run src/index.ts --list');
    console.log('  bun run src/index.ts --view <id>');
    return;
  }

  const total = urls.length;
  let errors = 0;
  for (const [i, url] of urls.entries()) {
    try {
      await processUrl(url, i + 1, total);
    } catch (err) {
      console.error(`  Error processing ${url}: ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }
  }

  console.log(`\nDone. ${total - errors}/${total} URLs processed successfully.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
