import { useQuery } from '@tanstack/react-query'
import { getStatus } from '../../../../data/apiClient'

const STATUS_QUERY_KEY = ['status']

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useStatusQuery() {
  return useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: () => getStatus(),
    refetchInterval: 3000 // Poll every 3 seconds
  })
}
