import { join } from 'path';
import type { KnowledgeItem } from './types.ts';

const KNOWLEDGE_DIR = join(import.meta.dir, '..', 'knowledge');
const ITEMS_DIR = join(KNOWLEDGE_DIR, 'items');
const INDEX_PATH = join(KNOWLEDGE_DIR, 'index.json');

async function ensureDirs(): Promise<void> {
  await Bun.write(join(ITEMS_DIR, '.gitkeep'), '');
}

function itemToMarkdown(item: KnowledgeItem): string {
  const frontmatter = [
    '---',
    `id: ${item.id}`,
    `url: ${item.url}`,
    `type: ${item.type}`,
    `title: "${item.title.replace(/"/g, '\\"')}"`,
    item.author ? `author: "${item.author.replace(/"/g, '\\"')}"` : null,
    `dateAdded: ${item.dateAdded}`,
    `tags: [${item.tags.map((t) => `"${t}"`).join(', ')}]`,
    `summary: "${item.summary.replace(/"/g, '\\"')}"`,
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  const sectionsMarkdown = item.sections
    .map((s) => `## ${s.title}\n${s.points.map((p) => `- ${p}`).join('\n')}`)
    .join('\n\n');

  return `${frontmatter}

# ${item.title}

## Summary
${item.summary}

${sectionsMarkdown}

## Content
${item.content}
`;
}

export async function saveItem(item: KnowledgeItem): Promise<void> {
  await ensureDirs();

  const mdPath = join(ITEMS_DIR, `${item.id}.md`);
  await Bun.write(mdPath, itemToMarkdown(item));

  const index = await loadIndex();
  const existingIdx = index.findIndex((i) => i.id === item.id);
  // Store index entry without full content
  const indexEntry = { ...item, content: '' };
  if (existingIdx >= 0) {
    index[existingIdx] = indexEntry;
  } else {
    index.push(indexEntry);
  }
  await Bun.write(INDEX_PATH, JSON.stringify(index, null, 2));
}

export async function loadIndex(): Promise<KnowledgeItem[]> {
  const file = Bun.file(INDEX_PATH);
  const exists = await file.exists();
  if (!exists) return [];
  const text = await file.text();
  return JSON.parse(text) as KnowledgeItem[];
}

export async function loadItem(id: string): Promise<string | null> {
  const file = Bun.file(join(ITEMS_DIR, `${id}.md`));
  const exists = await file.exists();
  if (!exists) return null;
  return file.text();
}

export async function itemExists(url: string): Promise<boolean> {
  const index = await loadIndex();
  return index.some((item) => item.url === url);
}
