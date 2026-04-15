// ── Type guards ────────────────────────────────────────────────────────────────
// Re-export from web/src/types.ts for consumers that want the canonical path.

export { isKnowledgeItemDetail, isEphemeralItem, type EphemeralItem } from '../../types.ts';

/** Type predicate: narrows unknown to Record<string, unknown> after a runtime check. */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
