import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

type Level = 'info' | 'warn' | 'error' | 'debug';

/** Concrete leaf values that are safe to log and serialize to JSON. */
export type LogValue = string | number | boolean | null | undefined;

/** Structured log data: a flat record of JSON-serializable primitives. */
export type LogData = Record<string, LogValue>;

// JSONL file persistence — same schema as relay logger
const KB_LOG_DIR = join(homedir(), '.local', 'share', 'knowledge-base', 'logs');
const KB_LOG_FILE = join(KB_LOG_DIR, 'kb.jsonl');

// Ensure log directory exists on import
try {
  mkdirSync(KB_LOG_DIR, { recursive: true });
} catch { /* ignore — log writes will fail silently anyway */ }

function log(level: Level, context: string, message: string, data?: LogData): void {
  const entry = {
    ts: new Date().toISOString(),
    level: level.toUpperCase(),
    ctx: context,
    msg: message,
    ...(data ?? {}),
  };
  const line = JSON.stringify(entry);

  // Console output (captured by pm2)
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  // File persistence
  try {
    appendFileSync(KB_LOG_FILE, line + '\n');
  } catch { /* fs failure — don't crash the app */ }
}

export const logger = {
  info: (ctx: string, msg: string, data?: LogData) => log('info', ctx, msg, data),
  warn: (ctx: string, msg: string, data?: LogData) => log('warn', ctx, msg, data),
  error: (ctx: string, msg: string, data?: LogData) => log('error', ctx, msg, data),
  debug: (ctx: string, msg: string, data?: LogData) => log('debug', ctx, msg, data),
};
