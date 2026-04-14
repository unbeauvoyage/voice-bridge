export interface FeedItem {
  url: string;
  title: string;
  pubDate: string;
}

export interface ParsedFeed {
  title: string;
  items: FeedItem[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

function extractTagContent(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? decodeEntities((m[1] ?? '').trim()) : '';
}

function extractAttr(xml: string, attr: string): string {
  const re = new RegExp(`${attr}=["']([^"']+)["']`, 'i');
  const m = xml.match(re);
  return m ? (m[1] ?? '') : '';
}

function parseRssItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1] ?? '';
    // Extract link — prefer <link> text content, fall back to guid if it's a URL
    let url = extractTagContent(block, 'link');
    if (!url) {
      const guid = extractTagContent(block, 'guid');
      if (/^https?:\/\//i.test(guid)) url = guid;
    }
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const title = extractTagContent(block, 'title') || url;
    const pubDate = extractTagContent(block, 'pubDate') || extractTagContent(block, 'dc:date') || new Date().toISOString();
    items.push({ url, title, pubDate });
  }
  return items;
}

function parseAtomItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1] ?? '';
    // Atom links: <link href="url" rel="alternate"/> or <link href="url"/>
    const linkBlockRe = /<link([^>]*)>/gi;
    let url = '';
    let lm: RegExpExecArray | null;
    while ((lm = linkBlockRe.exec(block)) !== null) {
      const attrs = lm[1] ?? '';
      const rel = extractAttr(attrs, 'rel') || 'alternate';
      if (rel === 'alternate' || rel === '') {
        const href = extractAttr(attrs, 'href');
        if (href && /^https?:\/\//i.test(href)) { url = href; break; }
      }
    }
    if (!url) continue;
    const title = decodeEntities(
      extractTagContent(block, 'title') || url
    );
    const pubDate = extractTagContent(block, 'updated') || extractTagContent(block, 'published') || new Date().toISOString();
    items.push({ url, title, pubDate });
  }
  return items;
}

export async function parseFeed(url: string): Promise<ParsedFeed> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'KnowledgeBase/1.0 Feed Reader' },
  });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const xml = await res.text();

  const isAtom = /<feed[\s>]/i.test(xml);
  const items = isAtom ? parseAtomItems(xml) : parseRssItems(xml);

  // Feed title
  let feedTitle = '';
  if (isAtom) {
    const titleBlock = xml.match(/<feed[\s\S]*?>([\s\S]*?)<entry/i)?.[1] ?? xml;
    feedTitle = extractTagContent(titleBlock, 'title');
  } else {
    const channelBlock = xml.match(/<channel[\s>]([\s\S]*?)(?:<item|$)/i)?.[1] ?? xml;
    feedTitle = extractTagContent(channelBlock, 'title');
  }

  // Return up to 50 most recent items (preserve document order which is usually newest-first)
  return { title: feedTitle || url, items: items.slice(0, 50) };
}
