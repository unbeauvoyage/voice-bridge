import { toKnowledgeItemId } from '../../../../api.ts';
import type { QuickPreviewResult } from '../../../../api.ts';
import type { EphemeralItem } from '../../../types.ts';

export type { EphemeralItem };

export function makeEphemeralItem(result: QuickPreviewResult): EphemeralItem {
  return {
    _ephemeral: true,
    id: toKnowledgeItemId(`preview-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    url: result.url,
    type: result.type ?? 'article',
    title: result.title || result.url,
    createdAt: new Date().toISOString(),
    tags: result.tags,
    tldr: result.tldr,
    summary: result.summary,
    sections: result.sections ?? [],
    transcript: result.content,
    status: 'done',
    starred: false,
    archived: false,
    pinned: false,
    studyLater: false,
  };
}
