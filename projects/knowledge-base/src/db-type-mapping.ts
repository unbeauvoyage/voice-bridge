import type { KnowledgeItemType } from '@env/domain'

// Raw DB values — 'web' is the legacy value for articles; 'article' may appear after the data migration
export type DbItemType = 'web' | 'article' | 'youtube' | 'video' | 'pdf'

const KNOWN_DB_TYPES: readonly DbItemType[] = ['web', 'article', 'youtube', 'video', 'pdf']

export function isDbItemType(v: string): v is DbItemType {
  return KNOWN_DB_TYPES.some(t => t === v)
}

const DB_TO_DOMAIN: Record<DbItemType, KnowledgeItemType> = {
  web: 'article',
  article: 'article',
  youtube: 'youtube',
  video: 'video',
  pdf: 'pdf',
}

/** Map a raw DB item type string to the domain KnowledgeItemType. Falls back to 'article'. */
export function dbTypeToDomain(raw: string): KnowledgeItemType {
  if (isDbItemType(raw)) {
    return DB_TO_DOMAIN[raw]
  }
  return 'article'
}

// After the data migration (0006), 'article' is stored in DB. New inserts use 'article'.
const DOMAIN_TO_DB: Record<KnowledgeItemType, DbItemType> = {
  article: 'article',
  youtube: 'youtube',
  video: 'video',
  pdf: 'pdf',
}

const KNOWN_DOMAIN_TYPES: readonly KnowledgeItemType[] = ['article', 'youtube', 'video', 'pdf']

export function isKnowledgeItemType(v: string): v is KnowledgeItemType {
  return KNOWN_DOMAIN_TYPES.some(t => t === v)
}

/** Map a domain KnowledgeItemType to the raw DB value for writes. */
export function domainTypeToDb(type: KnowledgeItemType): DbItemType {
  return DOMAIN_TO_DB[type]
}
