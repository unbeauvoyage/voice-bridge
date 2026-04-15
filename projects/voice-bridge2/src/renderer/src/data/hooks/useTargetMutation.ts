import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { setTarget } from '../../../../data/apiClient'
import type { SetTargetResponses } from '../../../../data/apiClient/types.gen'

const STATUS_QUERY_KEY = ['status']

export function useTargetMutation(): UseMutationResult<SetTargetResponses[keyof SetTargetResponses], Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: string) => setTarget({ body: { target } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY })
    }
  })
}
