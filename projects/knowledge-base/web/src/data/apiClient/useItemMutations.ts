/**
 * useItemMutations — Batch of item mutation hooks.
 *
 * Exports mutations for: pin, archive, delete, rate, markRead, markUnread, toggleStudyLater.
 *
 * Invalidation policy (per mutation):
 *   - items list (ITEMS_QUERY_KEY) — always
 *   - the affected item's detail cache — always, via ITEM_DETAIL_QUERY_KEY(id)
 *   - reading-stats — for markRead/markUnread (changes the streak/daily total)
 *   - items-in-collection — for delete (an item vanishes from its collections)
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api.ts'
import { ITEMS_QUERY_KEY } from './useItemsQuery.ts'
import { READING_STATS_QUERY_KEY } from './useReadingStatsQuery.ts'
import { ITEM_DETAIL_QUERY_KEY } from './useItemDetailQuery.ts'

type QC = ReturnType<typeof useQueryClient>

/** Invalidate list + the specific item-detail for `id`. */
function invalidateItem(queryClient: QC, id: string): void {
  queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY })
  queryClient.invalidateQueries({ queryKey: ITEM_DETAIL_QUERY_KEY(id) })
}

export function useTogglePinMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.togglePin(id),
    onSuccess: (_d, id) => {
      invalidateItem(queryClient, id)
    },
  })
}

export function useArchiveItemMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.archiveItem(id),
    onSuccess: (_d, id) => {
      invalidateItem(queryClient, id)
    },
  })
}

export function useDeleteItemMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteItem(id),
    onSuccess: (_d, id) => {
      invalidateItem(queryClient, id)
      // Deleted items vanish from every collection — refresh membership.
      queryClient.invalidateQueries({ queryKey: ['items-in-collection'] })
    },
  })
}

export function useRateItemMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) =>
      api.rateItem(id, rating),
    onSuccess: (_d, vars) => {
      invalidateItem(queryClient, vars.id)
    },
  })
}

export function useMarkReadMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.markRead(id),
    onSuccess: (_d, id) => {
      invalidateItem(queryClient, id)
      queryClient.invalidateQueries({ queryKey: READING_STATS_QUERY_KEY })
    },
  })
}

export function useMarkUnreadMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.markUnread(id),
    onSuccess: (_d, id) => {
      invalidateItem(queryClient, id)
      queryClient.invalidateQueries({ queryKey: READING_STATS_QUERY_KEY })
    },
  })
}

export function useToggleStudyLaterMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.toggleStudyLater(id),
    onSuccess: (_d, id) => {
      invalidateItem(queryClient, id)
    },
  })
}
