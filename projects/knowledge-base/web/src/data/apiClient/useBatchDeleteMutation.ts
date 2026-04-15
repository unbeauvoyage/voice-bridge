/**
 * useBatchDeleteMutation — Batch delete mutation.
 *
 * Invalidates items list and every items-in-collection query, since the
 * deleted items may have belonged to one or more collections.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api.ts'
import { ITEMS_QUERY_KEY } from './useItemsQuery.ts'

export function useBatchDeleteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => api.batchDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['items-in-collection'] })
    },
  })
}
