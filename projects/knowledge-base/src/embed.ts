import { config } from './config.ts';

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? config.embedModel;
const OLLAMA_URL = config.ollamaUrl;

export interface EmbeddingResponse {
  embeddings: number[][];
}

export function isEmbeddingResponse(v: unknown): v is EmbeddingResponse {
  if (typeof v !== 'object' || v === null) return false;
  if (!('embeddings' in v)) return false;
  const embeddings = Reflect.get(v, 'embeddings');
  if (!Array.isArray(embeddings) || embeddings.length === 0) return false;
  const first: unknown = embeddings[0];
  return Array.isArray(first) && first.every((x: unknown) => typeof x === 'number');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
    });
    if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
    const raw: unknown = await res.json();
    if (!isEmbeddingResponse(raw)) {
      throw new Error('Expected {embeddings: number[][]} from Ollama /api/embed');
    }
    return raw.embeddings[0] ?? [];
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Embedding timed out');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// Text to embed: use article body (transcript) for richer semantic signal;
// fall back to summary + tldr if no transcript is available.
export function itemEmbedText(item: { title: string; transcript?: string; summary?: string; tldr?: string[] }): string {
  const body = item.transcript ? item.transcript.slice(0, 6000) : [item.summary ?? '', ...(item.tldr ?? [])].join(' ');
  return `${item.title} ${body}`.trim();
}
