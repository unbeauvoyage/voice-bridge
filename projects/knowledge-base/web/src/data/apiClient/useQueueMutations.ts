/**
 * useQueueMutations — Queue-related mutations.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api.ts'

export const QUEUE_LOG_QUERY_KEY = ['queue-log'] as const
export const ITEMS_QUERY_KEY = ['items'] as const

export function useRetryItemMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.retryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_LOG_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY })
    },
  })
}
