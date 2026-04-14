export const config = {
  port: 3737,
  host: '127.0.0.1',
  maxRetries: 3,
  maxConcurrentJobs: 2,        // semaphore limit
  requestTimeoutMs: 10_000,
  retryBackoffBaseMs: 60_000,  // base for exponential backoff
  ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  llmBaseUrl: process.env.LLM_BASE_URL,
  ollamaModel: process.env.OLLAMA_MODEL ?? 'gemma4:26b',
  embedModel: process.env.EMBED_MODEL ?? 'nomic-embed-text',
  dbPath: process.env.DB_PATH ?? 'knowledge.db',
};
