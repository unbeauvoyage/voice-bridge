import type { KnowledgeItemPreview } from '../../api.ts'

export interface QueueLogEntry {
  id: string
  url: string
  submittedAt: string
  status: 'queued' | 'processing' | 'done' | 'error'
  title?: string
  error?: string
}

export function itemToQueueEntry(item: KnowledgeItemPreview): QueueLogEntry {
  const entry: QueueLogEntry = {
    id: item.id,
    url: item.url,
    submittedAt: item.createdAt,
    status: item.status,
  }

  if (item.title) {
    entry.title = item.title
  }

  if (item.error) {
    entry.error = item.error
  }

  return entry
}
