import { test, expect } from '@playwright/test'

// These tests describe overlay HUD behavior after the feature-first refactor.

test('recording pill is visible when overlay mode is recording', async ({ page }) => {
  // Inject mock __overlayBridge BEFORE the page loads so useEffect captures it
  await page.addInitScript(() => {
    type OverlayPayload = { mode: string; text?: string }
    const callbacks: Array<(payload: OverlayPayload) => void> = []
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Record<string, unknown>
    win.__overlayBridge = {
      onShow(cb: (payload: OverlayPayload) => void): () => void {
        callbacks.push(cb)
        return (): void => {
          const idx = callbacks.indexOf(cb)
          if (idx >= 0) callbacks.splice(idx, 1)
        }
      }
    }
    // Expose a way to trigger the overlay from outside
    win.__triggerOverlay = (payload: OverlayPayload): void => {
      callbacks.forEach((cb) => cb(payload))
    }
  })

  await page.goto('/overlay.html')

  // Trigger recording mode after the component is mounted
  await page.evaluate(() => {
    type OverlayPayload = { mode: string; text?: string }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Record<string, (p: OverlayPayload) => void>
    win.__triggerOverlay({ mode: 'recording', text: 'command' })
  })

  // The recording pill should appear — it contains "REC"
  await expect(page.locator('text=REC')).toBeVisible({ timeout: 3000 })
})

test('message toast shows agent name when mode is message', async ({ page }) => {
  await page.addInitScript(() => {
    type OverlayPayload = { mode: string; text?: string }
    const callbacks: Array<(payload: OverlayPayload) => void> = []
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Record<string, unknown>
    win.__overlayBridge = {
      onShow(cb: (payload: OverlayPayload) => void): () => void {
        callbacks.push(cb)
        return (): void => {
          const idx = callbacks.indexOf(cb)
          if (idx >= 0) callbacks.splice(idx, 1)
        }
      }
    }
    win.__triggerOverlay = (payload: OverlayPayload): void => {
      callbacks.forEach((cb) => cb(payload))
    }
  })

  await page.goto('/overlay.html')

  await page.evaluate(() => {
    type OverlayPayload = { mode: string; text?: string }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Record<string, (p: OverlayPayload) => void>
    win.__triggerOverlay({ mode: 'message', text: 'atlas: Task completed' })
  })

  // MessageToastStack renders agent name
  await expect(page.locator('text=atlas')).toBeVisible({ timeout: 3000 })
})
