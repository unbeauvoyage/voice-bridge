import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standalone Vite config for Playwright tests — serves renderer pages without Electron
export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  server: {
    port: 5199
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve('src/renderer/index.html'),
        overlay: resolve('src/renderer/overlay.html')
      }
    }
  }
})
