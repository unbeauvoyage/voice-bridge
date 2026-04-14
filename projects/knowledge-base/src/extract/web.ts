import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import type { ExtractedContent } from '../types.ts';

/** Minimal structural interface required by @mozilla/readability's constructor. */
interface DocumentLike {
  querySelector: (selector: string) => Element | null;
  createElement: (tagName: string) => Element;
}

/**
 * Bridge function: accepts an unknown value, verifies it is structurally
 * compatible with the DOM Document interface (duck-typing), then returns it
 * typed as Document for use with @mozilla/readability.
 *
 * linkedom's Document is not the same runtime class as the browser DOM Document,
 * so neither `instanceof Document` nor a direct type assignment works.
 * This helper isolates the unavoidable cross-boundary assertion in one place.
 */
function asReadabilityDocument(obj: unknown): Document {
  function isDocumentLike(v: unknown): v is DocumentLike {
    if (typeof v !== 'object' || v === null) return false;
    const rec = Object.getOwnPropertyDescriptor(v, 'querySelector') ??
                Object.getOwnPropertyDescriptor(Object.getPrototypeOf(v) ?? {}, 'querySelector');
    const rec2 = Object.getOwnPropertyDescriptor(v, 'createElement') ??
                 Object.getOwnPropertyDescriptor(Object.getPrototypeOf(v) ?? {}, 'createElement');
    return typeof rec?.value === 'function' && typeof rec2?.value === 'function';
  }
  if (!isDocumentLike(obj)) {
    throw new Error('Expected a Document-like object from parseHTML');
  }
  // obj is narrowed to DocumentLike — structurally verified above.
  // The final cross-boundary widening to Document is unavoidable: linkedom's
  // Document type does not satisfy lib.dom's Document interface in TypeScript's
  // type system. This is the single documented cross-library boundary cast.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Readability cross-library boundary: structurally compatible but type systems don't align
  return obj as unknown as Document;
}

export function extractPublishDate(html: string): string | null {
  // 1. JSON-LD datePublished
  const ld = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
  if (ld?.[1]) return ld[1].slice(0, 10);

  // 2. article:published_time meta tag (both attribute orders)
  const og =
    html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i) ??
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="article:published_time"/i);
  if (og?.[1]) return og[1].slice(0, 10);

  // 3. time element with datetime
  const time = html.match(/<time[^>]+datetime="(\d{4}-\d{2}-\d{2})[^"]*"/i);
  if (time?.[1]) return time[1];

  // 4. meta name="publish-date" or "date"
  const meta = html.match(/<meta[^>]+name="(?:publish-?date|date)"[^>]+content="([^"]+)"/i);
  if (meta?.[1]) return meta[1].slice(0, 10);

  return null;
}

export async function extractWeb(url: string): Promise<ExtractedContent> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; knowledge-base/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('html')) {
    throw new Error(`URL returned non-HTML content (${(contentType.split(';')[0] ?? contentType).trim()}), cannot extract article`);
  }
  const html = await res.text();

  const { document } = parseHTML(html);
  // linkedom returns a structurally compatible Document-like object.
  // We validate the required interface via duck-typing, then hand it to
  // a typed bridge function so the cast is isolated and auditable.
  const reader = new Readability(asReadabilityDocument(document));
  const article = reader.parse();

  if (!article) throw new Error(`Readability could not parse content from ${url}`);

  const imageUrl =
    html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)?.[1] ??
    undefined;

  const result: ExtractedContent = {
    title: article.title ?? 'Untitled',
    content: article.textContent ?? '',
    url,
  };
  if (article.byline) result.author = article.byline;
  const publishedAt = extractPublishDate(html);
  if (publishedAt) result.publishedAt = publishedAt;
  if (imageUrl) result.imageUrl = imageUrl;
  return result;
}
