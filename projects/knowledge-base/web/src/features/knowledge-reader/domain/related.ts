import type { KnowledgeItemPreview, KnowledgeItemDetail } from '../../../../api.ts';
import type { EphemeralItem } from '../../../types.ts';

// ── Related items computation ─────────────────────────────────────────────────

export function computeRelated(
  current: KnowledgeItemPreview | KnowledgeItemDetail | EphemeralItem,
  all: KnowledgeItemPreview[]
): KnowledgeItemPreview[] {
  const tags = new Set(current.tags ?? []);
  if (!tags.size) return [];
  return all
    .filter((it) => it.id !== current.id && it.status === 'done')
    .map((it) => ({
      item: it,
      score: (it.tags ?? []).filter((t: string) => tags.has(t)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.item);
}
