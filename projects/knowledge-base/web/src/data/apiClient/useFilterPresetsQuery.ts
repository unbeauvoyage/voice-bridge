/**
 * useFilterPresetsQuery — Layer 1 hook for filter presets.
 *
 * Re-exported at: features/knowledge-list/index.ts
 */
import { useQuery } from '@tanstack/react-query'
import { api, type FilterPreset } from '../../../api.ts'

export const FILTER_PRESETS_QUERY_KEY = ['filter-presets']

export function useFilterPresetsQuery() {
  return useQuery({
    queryKey: FILTER_PRESETS_QUERY_KEY,
    queryFn: async () => {
      const presets = await api.getFilterPresets()
      return presets
    },
  })
}
