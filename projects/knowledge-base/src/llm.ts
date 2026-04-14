import { config } from './config.ts';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResult {
  content: string;
  model: string;
}

export interface LLMOptions {
  model?: string;
  timeoutMs?: number;
}

export interface OpenAICompatibleResponse {
  /** Model name — may be absent in some compatible implementations; falls back to request model. */
  model?: string;
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export function isOpenAICompatibleResponse(v: unknown): v is OpenAICompatibleResponse {
  if (typeof v !== 'object' || v === null) return false;
  // model is optional — skip if absent, reject if present but not a string
  if ('model' in v && typeof Reflect.get(v, 'model') !== 'string') return false;
  const choices = Reflect.get(v, 'choices');
  if (!Array.isArray(choices) || choices.length === 0) return false;
  const firstChoice: unknown = choices[0];
  if (typeof firstChoice !== 'object' || firstChoice === null) return false;
  const message: unknown = 'message' in firstChoice ? Reflect.get(firstChoice, 'message') : undefined;
  if (typeof message !== 'object' || message === null) return false;
  return 'content' in message && typeof Reflect.get(message, 'content') === 'string';
}

const OLLAMA_TIMEOUT = Number(process.env['OLLAMA_TIMEOUT'] ?? config.retryBackoffBaseMs);

export async function llmComplete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResult> {
  const model = options?.model ?? config.ollamaModel;
  const timeoutMs = options?.timeoutMs ?? OLLAMA_TIMEOUT;
  const baseUrl = config.llmBaseUrl ?? config.ollamaUrl;
  const url = `${baseUrl}/v1/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`LLM timed out after ${timeoutMs}ms — is it still running?`);
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('Connection refused') || msg.includes('connect')) {
      throw new Error('LLM not running — start with: ollama serve');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`LLM returned HTTP ${res.status}`);
  }

  let raw = '';
  try {
    raw = await res.text();
    const parsed: unknown = JSON.parse(raw);
    if (!isOpenAICompatibleResponse(parsed)) {
      throw new Error('Unexpected LLM response shape');
    }
    const firstChoice = parsed.choices[0];
    if (!firstChoice) throw new Error('Unexpected LLM response shape');
    const content = firstChoice.message.content;
    const reportedModel = (parsed.model !== undefined && parsed.model.length > 0) ? parsed.model : model;
    return { content, model: reportedModel };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Unexpected LLM')) throw err;
    process.stderr.write(`[llm] ERROR: Bad JSON response from LLM: ${raw}\n`);
    throw new Error('LLM returned invalid JSON');
  }
}
