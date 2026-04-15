/**
 * useQueueLogQuery — Layer 1 hook for queue log (processing items).
 *
 * Fetches recent items with all=true flag to include queue items, then transforms to QueueLogEntry.
 * Re-exported at: features/queue/index.ts
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api } from '../../../api.ts'
import { itemToQueueEntry, type QueueLogEntry } from '../../shared/queue-log.ts'

export const QUEUE_LOG_QUERY_KEY = ['queue-log']

export function useQueueLogQuery(): UseQueryResult<QueueLogEntry[], Error> {
  return useQuery({
    queryKey: QUEUE_LOG_QUERY_KEY,
    queryFn: async () => {
      const items = await api.getRecentItems(20, true)
      const log: QueueLogEntry[] = items.map(itemToQueueEntry)
      return log
    },
    refetchInterval: 5000, // Poll every 5 seconds for queue updates
  })
}
