import { YoutubeTranscript } from 'youtube-transcript';
import type { ExtractedContent } from '../types.ts';

export interface YoutubeExtractedContent extends ExtractedContent {
  extractionError?: string;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function fetchVideoPageData(videoId: string): Promise<{ title: string; publishedAt: string | null }> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; knowledge-base/1.0)' },
    });
    const html = await res.text();

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch?.[1] ? titleMatch[1].replace(' - YouTube', '').trim() : `YouTube Video ${videoId}`;

    // Try JSON-LD structured data first (most reliable)
    const ldMatch = html.match(/"uploadDate"\s*:\s*"([^"]+)"/);
    if (ldMatch?.[1]) return { title, publishedAt: ldMatch[1].slice(0, 10) };

    // Try itemprop meta tag
    const metaMatch = html.match(/<meta[^>]+itemprop="uploadDate"[^>]+content="([^"]+)"/i);
    if (metaMatch?.[1]) return { title, publishedAt: metaMatch[1].slice(0, 10) };

    // Try datePublished in JSON
    const ogMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (ogMatch?.[1]) return { title, publishedAt: ogMatch[1].slice(0, 10) };

    return { title, publishedAt: null };
  } catch {
    return { title: `YouTube Video ${videoId}`, publishedAt: null };
  }
}

export async function extractYoutube(url: string): Promise<YoutubeExtractedContent> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error(`Could not extract video ID from URL: ${url}`);

  const { title, publishedAt } = await fetchVideoPageData(videoId);

  let content = '';
  let extractionError: string | undefined;
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    content = transcript.map((t) => t.text).join(' ');
  } catch {
    extractionError = 'No transcript available — video may be private or captions disabled';
  }

  const imageUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const result: YoutubeExtractedContent = { title, content, url, imageUrl };
  if (publishedAt) result.publishedAt = publishedAt;
  if (extractionError) result.extractionError = extractionError;
  return result;
}
