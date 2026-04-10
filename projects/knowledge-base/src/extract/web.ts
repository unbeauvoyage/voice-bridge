import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import type { ExtractedContent } from '../types.ts';

export async function extractWeb(url: string): Promise<ExtractedContent> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; knowledge-base/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const html = await res.text();

  const { document } = parseHTML(html);
  const reader = new Readability(document as unknown as Document);
  const article = reader.parse();

  if (!article) throw new Error(`Readability could not parse content from ${url}`);

  return {
    title: article.title ?? 'Untitled',
    author: article.byline ?? undefined,
    content: article.textContent ?? '',
    url,
  };
}
