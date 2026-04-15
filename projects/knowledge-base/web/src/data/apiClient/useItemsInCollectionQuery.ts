/**
 * useItemsInCollectionQuery — Layer 1 hook for items belonging to a specific collection.
 *
 * Given a collectionId, returns the set of item IDs in that collection.
 * Used by the list filter so "select collection X" filters to X's items.
 *
 * Pre-refactor bug: the previous implementation built a union set across
 * ALL collections and used it whenever `activeCollectionId` was non-null,
 * so selecting a specific collection did not filter to that collection.
 * This query replaces that incorrect behavior.
 *
 * Re-exported at: features/collections/index.ts
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api.ts'

export const ITEMS_IN_COLLECTION_QUERY_KEY = (collectionId: string | null): readonly unknown[] =>
  ['items-in-collection', collectionId] as const

/**
 * Returns a Set of item IDs belonging to the given collection. When
 * collectionId is null the hook is disabled and returns an empty set.
 */
export function useItemsInCollectionQuery(collectionId: string | null): {
  data: Set<string>
  isLoading: boolean
} {
  const q = useQuery({
    queryKey: ITEMS_IN_COLLECTION_QUERY_KEY(collectionId),
    queryFn: async (): Promise<Set<string>> => {
      if (!collectionId) return new Set()
      const items = await api.getCollectionItems(collectionId)
      return new Set(items.map((it) => it.id))
    },
    enabled: !!collectionId,
  })
  return {
    data: q.data ?? new Set<string>(),
    isLoading: q.isLoading,
  }
}
