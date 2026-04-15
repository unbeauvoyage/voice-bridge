/**
 * useItemsQuery — Layer 1 hook for listing knowledge items.
 *
 * Wraps api.getItems() in React Query with standard cache key.
 * Components and features never import this directly — they import from feature index.ts.
 *
 * Re-exported at: features/knowledge-list/index.ts
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api.ts'
import type { KnowledgeItemPreview } from '../../../api.ts'

export const ITEMS_QUERY_KEY = ['items']

export function useItemsQuery() {
  return useQuery({
    queryKey: ITEMS_QUERY_KEY,
    queryFn: async () => {
      const items = await api.getItems()
      return items
    },
  })
}
