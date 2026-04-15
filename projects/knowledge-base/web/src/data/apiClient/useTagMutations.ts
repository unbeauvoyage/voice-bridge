/**
 * useTagMutations — Tag-related mutations with cache invalidation.
 *
 * Tag mutations ripple across three caches:
 *   - TAGS_QUERY_KEY          (approved / pending / rejected lists)
 *   - TAG_STATS_QUERY_KEY     (usage counts, used by TagCloudPanel)
 *   - TAG_SUGGESTIONS_QUERY_KEY (auto-suggestions badge, header counter)
 *
 * Invalidating only TAGS_QUERY_KEY lets tag stats and suggestions stale,
 * which is why the old god-component had manual `loadTagStats()` calls
 * sprinkled around. With this helper, the calls are no longer needed.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api.ts'

export const TAGS_QUERY_KEY = ['tags'] as const
export const TAG_STATS_QUERY_KEY = ['tag-stats'] as const
export const TAG_SUGGESTIONS_QUERY_KEY = ['tag-suggestions'] as const

/** Invalidate every tag-related query so tag UI always reflects the write. */
function invalidateTags(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY })
  queryClient.invalidateQueries({ queryKey: TAG_STATS_QUERY_KEY })
  queryClient.invalidateQueries({ queryKey: TAG_SUGGESTIONS_QUERY_KEY })
}

export function useApproveTagMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tag: string) => api.approveTag(tag),
    onSuccess: () => {
      invalidateTags(queryClient)
    },
  })
}

export function useRejectTagMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tag, itemId, reason }: { tag: string; itemId: string; reason: string }) =>
      api.rejectTag(tag, itemId, reason),
    onSuccess: () => {
      invalidateTags(queryClient)
    },
  })
}
