import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as schema from './schema.ts';

const KNOWLEDGE_DIR = join(import.meta.dir, '..', '..', 'knowledge');
mkdirSync(KNOWLEDGE_DIR, { recursive: true });

const sqlite = new Database(join(KNOWLEDGE_DIR, 'knowledge.db'), { create: true });
// Enable WAL so concurrent readers/writers (server + test spawnSync helpers)
// don't trip over each other with SQLITE_BUSY. busy_timeout makes writers
// wait instead of immediately failing on a locked DB.
sqlite.exec('PRAGMA journal_mode = WAL');
sqlite.exec('PRAGMA busy_timeout = 5000');
sqlite.exec('PRAGMA synchronous = NORMAL');
export const db = drizzle(sqlite, { schema });
export { sqlite };
export { schema };
