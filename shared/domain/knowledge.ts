export type KnowledgeItemId = string & { readonly __brand: 'KnowledgeItemId' }

// NOTE: 'article' maps to legacy 'web' DB values — migration pending
export type KnowledgeItemType = 'article' | 'youtube' | 'video' | 'pdf'

export type KnowledgeItemStatus = 'queued' | 'processing' | 'done' | 'error'

export interface KnowledgeItemPreview {
  id: KnowledgeItemId
  title: string
  url: string
  type: KnowledgeItemType
  status: KnowledgeItemStatus
  rating?: number
  tags: string[]
  createdAt: string
  summary?: string
}
