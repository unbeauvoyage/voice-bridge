/**
 * useItemDetailQuery — Layer 1 hook for fetching a single item's full details.
 *
 * Takes an item ID and fetches full KnowledgeItemDetail (includes content, highlights, etc).
 * Re-exported at: features/knowledge-reader/index.ts
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api.ts'
import type { KnowledgeItemDetail } from '../../../api.ts'

export const ITEM_DETAIL_QUERY_KEY = (id: string | null) => ['item-detail', id]

export function useItemDetailQuery(id: string | null | undefined) {
  return useQuery({
    queryKey: ITEM_DETAIL_QUERY_KEY(id ?? null),
    queryFn: async () => {
      if (!id) throw new Error('Item ID required for detail query')
      const item = await api.getItem(id)
      return item
    },
    enabled: !!id,
  })
}
