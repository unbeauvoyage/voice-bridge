import { test, expect } from '@playwright/test'

// These tests describe overlay HUD behavior after the feature-first refactor.

test('recording pill is visible when overlay mode is recording', async ({ page }) => {
  // Inject mock __overlayBridge BEFORE the page loads so useEffect captures it
  await page.addInitScript(() => {
    const callbacks: Array<(payload: { mode: string; text?: string }) => void> = []
    window.__overlayBridge = {
      onShow(cb: (payload: { mode: string; text?: string }) => void): () => void {
        callbacks.push(cb)
        return (): void => {
          const idx = callbacks.indexOf(cb)
          if (idx >= 0) callbacks.splice(idx, 1)
        }
      },
    }
    // Expose a way to trigger the overlay from outside
    ;(window as unknown as Record<string, unknown>)['__triggerOverlay'] = (payload: {
      mode: string
      text?: string
    }): void => {
      callbacks.forEach((cb) => cb(payload))
    }
  })

  await page.goto('/overlay.html')

  // Trigger recording mode after the component is mounted
  await page.evaluate(() => {
    ;(window as unknown as Record<string, (p: { mode: string; text?: string }) => void>)[
      '__triggerOverlay'
    ]({ mode: 'recording', text: 'command' })
  })

  // The recording pill should appear — it contains "REC"
  await expect(page.locator('text=REC')).toBeVisible({ timeout: 3000 })
})

test('message toast shows agent name when mode is message', async ({ page }) => {
  await page.addInitScript(() => {
    const callbacks: Array<(payload: { mode: string; text?: string }) => void> = []
    window.__overlayBridge = {
      onShow(cb: (payload: { mode: string; text?: string }) => void): () => void {
        callbacks.push(cb)
        return (): void => {
          const idx = callbacks.indexOf(cb)
          if (idx >= 0) callbacks.splice(idx, 1)
        }
      },
    }
    ;(window as unknown as Record<string, unknown>)['__triggerOverlay'] = (payload: {
      mode: string
      text?: string
    }): void => {
      callbacks.forEach((cb) => cb(payload))
    }
  })

  await page.goto('/overlay.html')

  await page.evaluate(() => {
    ;(window as unknown as Record<string, (p: { mode: string; text?: string }) => void>)[
      '__triggerOverlay'
    ]({ mode: 'message', text: 'atlas: Task completed' })
  })

  // MessageToastStack renders agent name
  await expect(page.locator('text=atlas')).toBeVisible({ timeout: 3000 })
})
