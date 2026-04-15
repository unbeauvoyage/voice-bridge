/**
 * useReadingStatsQuery — Layer 1 hook for reading stats.
 *
 * Re-exported at: features/stats/index.ts
 */
import { useQuery } from '@tanstack/react-query'
import { api, type ReadingStatsResponse } from '../../../api.ts'

export const READING_STATS_QUERY_KEY = ['reading-stats']

export function useReadingStatsQuery() {
  return useQuery({
    queryKey: READING_STATS_QUERY_KEY,
    queryFn: async () => {
      const stats = await api.getReadingStats()
      return stats
    },
  })
}
