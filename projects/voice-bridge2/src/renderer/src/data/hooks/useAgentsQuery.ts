import { useQuery } from '@tanstack/react-query'
import { listAgents } from '../../../../data/apiClient'

const AGENTS_QUERY_KEY = ['agents']

export function useAgentsQuery() {
  return useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: () => listAgents({}),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}
