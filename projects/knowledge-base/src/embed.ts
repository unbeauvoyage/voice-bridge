import { config } from './config.ts';

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? config.embedModel;
const OLLAMA_URL = config.ollamaUrl;

export interface EmbeddingResponse {
  embedding: number[];
}

export function isEmbeddingResponse(v: unknown): v is EmbeddingResponse {
  if (typeof v !== 'object' || v === null) return false;
  if (!('embedding' in v)) return false;
  const embedding = Reflect.get(v, 'embedding');
  return Array.isArray(embedding) && embedding.every((x: unknown) => typeof x === 'number');
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text.slice(0, 8000) }),
    });
    if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
    const raw: unknown = await res.json();
    if (!isEmbeddingResponse(raw)) {
      throw new Error('Expected {embedding: number[]} from Ollama /api/embeddings');
    }
    return raw.embedding;
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
