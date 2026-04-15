/**
 * useDomainStatsQuery — Layer 1 hook for domain statistics.
 *
 * Re-exported at: features/stats/index.ts
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api.ts'

export interface DomainStat {
  domain: string
  count: number
  lastSaved: string
}

export const DOMAIN_STATS_QUERY_KEY = ['domain-stats']

export function useDomainStatsQuery() {
  return useQuery({
    queryKey: DOMAIN_STATS_QUERY_KEY,
    queryFn: async () => {
      const stats = await api.getDomainStats()
      return stats
    },
  })
}
