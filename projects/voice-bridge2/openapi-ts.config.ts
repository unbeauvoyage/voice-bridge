import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: {
    path: 'src/data/openapi.json'
  },
  output: {
    path: 'src/data/apiClient'
  },
  client: 'fetch'
})
