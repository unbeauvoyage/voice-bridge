import type { ExtractedContent, KnowledgeSection } from './types.ts';

interface SummarizeResult {
  tldr: string[];
  summary: string;
  sections: KnowledgeSection[];
  tags: string[];
}

const MAX_CONTENT_CHARS = 12000;
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';

function truncate(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text;
  return text.slice(0, MAX_CONTENT_CHARS) + '\n\n[Content truncated for summarization]';
}

async function ollamaChat(prompt: string): Promise<string> {
  const model = process.env['OLLAMA_MODEL'] ?? 'llama3.2';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let res: Response;
  try {
    res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, messages: [{ role: 'user', content: prompt }] }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Ollama timed out — is it still running?');
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('Connection refused') || msg.includes('connect')) {
      throw new Error('Ollama not running — start with: ollama serve');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`);
  const data = await res.json() as { message: { content: string } };
  return data.message.content;
}

export async function summarize(
  extracted: ExtractedContent,
  approvedTags: string[] = [],
  rejectedTags: string[] = [],
): Promise<SummarizeResult> {
  const tagGuidance = [
    approvedTags.length
      ? `Preferred existing tags (reuse these when they fit — ordered general to specific): ${approvedTags.join(', ')}`
      : '',
    rejectedTags.length
      ? `Never use these tags (rejected): ${rejectedTags.join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

  const prompt = `You are a knowledge extraction assistant. Analyze the following content thoroughly and respond with ONLY valid JSON in this exact format:
{
  "tldr": [
    "One-liner that captures the core message of the whole piece",
    "Second key takeaway the author wants you to leave with",
    "Third essential point"
  ],
  "summary": "2-3 sentence overview of the entire content",
  "sections": [
    {
      "title": "Section Title",
      "points": ["detailed point 1", "detailed point 2", "..."]
    }
  ],
  "tags": ["tag1", "tag2", "tag3"]
}

Rules:
- tldr: 3-5 bullet points, each a single punchy sentence. Capture what the author is fundamentally trying to say — not just facts, but the point. Reading the tldr alone should give a complete understanding of the content. Write from the author's perspective: "The author argues...", "The key insight is...", etc.
- Cover EVERY significant point in the content — do not skip anything
- Organize points into logical sections with descriptive titles
- Each point should be a complete, informative sentence
- Aim for 3-8 sections, each with 3-8 points
- Generate 3-6 tags ordered from most general to most specific
- Reuse preferred tags wherever they apply. Only create new tags when none of the preferred ones fit
${tagGuidance}

Content:
${truncate(extracted.content)}`;

  const text = await ollamaChat(prompt);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { tldr: [], summary: text.slice(0, 200), sections: [], tags: [] };
  }

  let parsed: SummarizeResult;
  try {
    parsed = JSON.parse(jsonMatch[0]) as SummarizeResult;
  } catch {
    return { tldr: [], summary: text.slice(0, 200), sections: [], tags: [] };
  }

  return {
    tldr: Array.isArray(parsed.tldr) ? parsed.tldr : [],
    summary: parsed.summary ?? '',
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}

export async function suggestTags(
  transcript: string,
  approvedTags: string[] = [],
  rejectedTags: string[] = [],
): Promise<string[]> {
  const tagGuidance = [
    approvedTags.length
      ? `Preferred existing tags (reuse these when they fit): ${approvedTags.join(', ')}`
      : '',
    rejectedTags.length
      ? `Never use these tags (rejected): ${rejectedTags.join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

  const prompt = `Given the following content, suggest 3-6 topic tags ordered from most general to most specific.
Reuse preferred tags wherever they apply. Only create new tags when none fit.
${tagGuidance}

Respond with ONLY a JSON array of strings, e.g.: ["tag1", "tag2", "tag3"]

Content:
${truncate(transcript)}`;

  const text = await ollamaChat(prompt);

  const arrayMatch = text.match(/\[[\s\S]*?\]/);
  if (!arrayMatch) return [];
  try {
    const parsed = JSON.parse(arrayMatch[0]) as unknown[];
    return parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    return [];
  }
}
