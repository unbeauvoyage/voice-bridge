import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setTarget } from '../../../../data/apiClient'

const STATUS_QUERY_KEY = ['status']

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useTargetMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: string) => setTarget({ body: { target } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY })
    }
  })
}
