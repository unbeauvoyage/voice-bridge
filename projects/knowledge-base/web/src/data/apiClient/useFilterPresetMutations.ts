/**
 * useFilterPresetMutations — Filter preset mutations.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type FilterPreset } from '../../../api.ts'

export const FILTER_PRESETS_QUERY_KEY = ['filter-presets'] as const

export function useSaveFilterPresetMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, filters }: { name: string; filters: Parameters<typeof api.saveFilterPreset>[1] }) =>
      api.saveFilterPreset(name, filters),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FILTER_PRESETS_QUERY_KEY })
    },
  })
}

export function useDeleteFilterPresetMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteFilterPreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FILTER_PRESETS_QUERY_KEY })
    },
  })
}
