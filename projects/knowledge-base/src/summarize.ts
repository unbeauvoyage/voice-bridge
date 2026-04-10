import type { ExtractedContent, KnowledgeSection } from './types.ts';

interface SummarizeResult {
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

export async function summarize(extracted: ExtractedContent): Promise<SummarizeResult> {
  const model = process.env['OLLAMA_MODEL'] ?? 'llama3.2';

  const prompt = `You are a knowledge extraction assistant. Analyze the following content thoroughly and respond with ONLY valid JSON in this exact format:
{
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
- Cover EVERY significant point in the content — do not skip anything
- Organize points into logical sections with descriptive titles
- Each point should be a complete, informative sentence
- Aim for 3-8 sections, each with 3-8 points
- tags should be 3-6 short lowercase keywords

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
    return { summary: text.slice(0, 200), sections: [], tags: [] };
  }

  let parsed: SummarizeResult;
  try {
    parsed = JSON.parse(jsonMatch[0]) as SummarizeResult;
  } catch {
    return { summary: text.slice(0, 200), sections: [], tags: [] };
  }

  return {
    summary: parsed.summary ?? '',
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}
