/**
 * useTagsQuery — Layer 1 hook for fetching tags.
 *
 * Re-exported at: features/tags/index.ts
 */
import { useQuery } from '@tanstack/react-query'
import { api, type TagsResponse } from '../../../api.ts'

export const TAGS_QUERY_KEY = ['tags']

export function useTagsQuery() {
  return useQuery({
    queryKey: TAGS_QUERY_KEY,
    queryFn: async () => {
      const data = await api.getTags()
      return data
    },
  })
}
