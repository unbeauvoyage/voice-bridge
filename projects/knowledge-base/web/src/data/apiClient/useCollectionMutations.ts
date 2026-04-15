/**
 * useCollectionMutations — Collection-related mutations.
 *
 * All mutations invalidate:
 *   - collections list (COLLECTIONS_QUERY_KEY)
 *   - per-collection items (items-in-collection, *) so the list filter
 *     sees fresh membership after add/remove/batch-add/delete
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api.ts'

export const COLLECTIONS_QUERY_KEY = ['collections'] as const
const ITEMS_IN_COLLECTION_KEY_PREFIX = ['items-in-collection'] as const

/** Invalidate both the collections list and every per-collection items query. */
function invalidateCollections(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY })
  queryClient.invalidateQueries({ queryKey: ITEMS_IN_COLLECTION_KEY_PREFIX })
}

export function useCreateCollectionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.createCollection(name),
    onSuccess: () => {
      invalidateCollections(queryClient)
    },
  })
}

export function useRenameCollectionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.renameCollection(id, name),
    onSuccess: () => {
      invalidateCollections(queryClient)
    },
  })
}

export function useDeleteCollectionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCollection(id),
    onSuccess: () => {
      invalidateCollections(queryClient)
    },
  })
}

export function useAddItemToCollectionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ collectionId, itemId }: { collectionId: string; itemId: string }) =>
      api.addItemToCollection(collectionId, itemId),
    onSuccess: () => {
      invalidateCollections(queryClient)
    },
  })
}

export function useRemoveItemFromCollectionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ collectionId, itemId }: { collectionId: string; itemId: string }) =>
      api.removeItemFromCollection(collectionId, itemId),
    onSuccess: () => {
      invalidateCollections(queryClient)
    },
  })
}

export function useBatchAddToCollectionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ collectionId, ids }: { collectionId: string; ids: string[] }) =>
      api.batchAddToCollection(collectionId, ids),
    onSuccess: () => {
      invalidateCollections(queryClient)
    },
  })
}
