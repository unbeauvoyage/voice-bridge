/**
 * useTagStatsQuery — Layer 1 hook for tag statistics.
 *
 * Re-exported at: features/tags/index.ts
 */
import { useQuery } from '@tanstack/react-query'
import { api, type TagStatsResponse } from '../../../api.ts'

export const TAG_STATS_QUERY_KEY = ['tag-stats']

export function useTagStatsQuery() {
  return useQuery({
    queryKey: TAG_STATS_QUERY_KEY,
    queryFn: async () => {
      const stats = await api.getTagStats()
      return stats
    },
  })
}
