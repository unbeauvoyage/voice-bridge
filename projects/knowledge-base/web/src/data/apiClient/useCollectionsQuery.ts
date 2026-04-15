/**
 * useCollectionsQuery — Layer 1 hook for fetching collections.
 *
 * Re-exported at: features/collections/index.ts
 */
import { useQuery } from '@tanstack/react-query'
import { api, type Collection } from '../../../api.ts'

export const COLLECTIONS_QUERY_KEY = ['collections']

export function useCollectionsQuery() {
  return useQuery({
    queryKey: COLLECTIONS_QUERY_KEY,
    queryFn: async () => {
      const collections = await api.listCollections()
      return collections
    },
  })
}
