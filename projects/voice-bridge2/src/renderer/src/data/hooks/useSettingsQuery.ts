import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../../../../data/apiClient'
import type { PartialSettings } from '../../../../data/apiClient/types.gen'

const SETTINGS_QUERY_KEY = ['settings']

export function useSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => getSettings()
  })
}

export function useSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: PartialSettings) => updateSettings({ body: patch }),
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, data)
    }
  })
}
