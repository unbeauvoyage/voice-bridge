import { useQuery } from '@tanstack/react-query'
import { listAgents } from '../../../../data/apiClient'

const AGENTS_QUERY_KEY = ['agents']

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useAgentsQuery() {
  return useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: () => listAgents({}),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}
