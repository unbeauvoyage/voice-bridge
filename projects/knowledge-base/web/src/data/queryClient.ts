/**
 * queryClient — React Query client configuration.
 *
 * Singleton QueryClient instance for server state management.
 * Features import data hooks from their feature's data/ and hooks/ folders,
 * which all use this client under the hood.
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 5, // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
})
