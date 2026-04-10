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

async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; knowledge-base/1.0)' },
    });
    const html = await res.text();
    const match = html.match(/<title>([^<]+)<\/title>/);
    if (match?.[1]) {
      return match[1].replace(' - YouTube', '').trim();
    }
  } catch {
    // fall through to default
  }
  return `YouTube Video ${videoId}`;
}

export async function extractYoutube(url: string): Promise<YoutubeExtractedContent> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error(`Could not extract video ID from URL: ${url}`);

  const title = await fetchVideoTitle(videoId);

  let content = '';
  let extractionError: string | undefined;
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    content = transcript.map((t) => t.text).join(' ');
  } catch {
    extractionError = 'No transcript available — video may be private or captions disabled';
  }

  return { title, content, url, extractionError };
}
