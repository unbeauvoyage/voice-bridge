import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../../../../data/apiClient'
import type { PartialSettings } from '../../../../data/apiClient/types.gen'

const SETTINGS_QUERY_KEY = ['settings']

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => getSettings()
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: PartialSettings) => updateSettings({ body: patch }),
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, data)
    }
  })
}
