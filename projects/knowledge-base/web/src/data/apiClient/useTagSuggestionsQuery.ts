/**
 * useTagSuggestionsQuery — Layer 1 hook for tag suggestions.
 *
 * Re-exported at: features/tags/index.ts
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api.ts'

export const TAG_SUGGESTIONS_QUERY_KEY = ['tag-suggestions']

export function useTagSuggestionsQuery() {
  return useQuery({
    queryKey: TAG_SUGGESTIONS_QUERY_KEY,
    queryFn: async () => {
      const suggestions = await api.getTagSuggestions()
      return suggestions
    },
  })
}
