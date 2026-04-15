/**
 * useToggleStarMutation — Mutation hook for starring/unstarring an item.
 *
 * Invalidates items list + the affected item-detail cache on success.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api.ts'
import { ITEMS_QUERY_KEY } from './useItemsQuery.ts'
import { ITEM_DETAIL_QUERY_KEY } from './useItemDetailQuery.ts'

export function useToggleStarMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return api.toggleStar(id)
    },
    onSuccess: (_d, id) => {
      queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ITEM_DETAIL_QUERY_KEY(id) })
    },
  })
}
