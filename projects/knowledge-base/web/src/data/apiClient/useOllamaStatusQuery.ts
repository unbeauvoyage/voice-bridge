/**
 * useOllamaStatusQuery — Layer 1 hook for Ollama status.
 *
 * Re-exported at: features/settings/index.ts
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api.ts'

export const OLLAMA_STATUS_QUERY_KEY = ['ollama-status']

export function useOllamaStatusQuery() {
  return useQuery({
    queryKey: OLLAMA_STATUS_QUERY_KEY,
    queryFn: async () => {
      const status = await api.getOllamaStatus()
      return status
    },
    refetchInterval: 30000, // Poll every 30 seconds
  })
}
