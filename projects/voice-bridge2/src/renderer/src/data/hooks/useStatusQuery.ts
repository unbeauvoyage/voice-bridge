import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getStatus } from '../../../../data/apiClient'
import type { StatusResponse } from '../../../../data/apiClient/types.gen'

const STATUS_QUERY_KEY = ['status']

export function useStatusQuery(): UseQueryResult<StatusResponse, Error> {
  return useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: () => getStatus(),
    refetchInterval: 3000 // Poll every 3 seconds
  })
}
