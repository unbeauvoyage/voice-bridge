import type { ExtractedContent } from './types.ts';

interface SummarizeResult {
  summary: string;
  keyPoints: string[];
  tags: string[];
}

const MAX_CONTENT_CHARS = 6000;
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';

function truncate(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text;
  return text.slice(0, MAX_CONTENT_CHARS) + '\n\n[Content truncated for summarization]';
}

export async function summarize(extracted: ExtractedContent): Promise<SummarizeResult> {
  const model = process.env['OLLAMA_MODEL'] ?? 'llama3.2';

  const prompt = `Summarize the following content. Respond with ONLY valid JSON in this exact format:
{"summary":"one sentence","keyPoints":["point1","point2","point3"],"tags":["tag1","tag2"]}

Content:
${truncate(extracted.content)}`;

  let res: Response;
  try {
    res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('Connection refused') || msg.includes('connect')) {
      throw new Error('Ollama not running — start with: ollama serve');
    }
    throw err;
  }

  if (!res.ok) {
    throw new Error(`Ollama returned HTTP ${res.status}`);
  }

  const data = await res.json() as { message: { content: string } };
  const text = data.message.content;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { summary: text.slice(0, 200), keyPoints: [], tags: [] };
  }

  let parsed: SummarizeResult;
  try {
    parsed = JSON.parse(jsonMatch[0]) as SummarizeResult;
  } catch {
    return { summary: text.slice(0, 200), keyPoints: [], tags: [] };
  }

  return {
    summary: parsed.summary ?? '',
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}
