/**
 * Overlay HUD E2E tests — all OverlayMode values + error paths.
 *
 * Modes under test:
 *   recording  → RecordingOverlay: pulsing REC pill + timer + target name
 *   success    → StatusOverlay: "✓  Delivered → {target}"
 *   cancelled  → StatusOverlay: "⊘  Cancelled"
 *   error      → StatusOverlay: "✗  Delivery failed"
 *   hidden     → clears the visible overlay
 *   message    → MessageToastStack: agent name + body text
 *
 * All modes are driven via the injected __overlayBridge / __triggerOverlay
 * surface — no real Electron IPC is required.
 *
 * These tests are the regression guard for the CEO's primary visual
 * interface. Every mode must be covered; any removed mode breaks this file.
 */

import { test, expect, type Page } from '@playwright/test'

// ── Shared setup ──────────────────────────────────────────────────────────────

/**
 * Inject the __overlayBridge mock and expose __triggerOverlay before the
 * page loads.  Must be called before page.goto().
 */
async function installOverlayBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type OverlayPayload = { mode: string; text?: string }
    const callbacks: Array<(payload: OverlayPayload) => void> = []
    Reflect.set(window, '__overlayBridge', {
      onShow(cb: (payload: OverlayPayload) => void): () => void {
        callbacks.push(cb)
        return (): void => {
          const idx = callbacks.indexOf(cb)
          if (idx >= 0) callbacks.splice(idx, 1)
        }
      }
    })
    Reflect.set(window, '__triggerOverlay', (payload: OverlayPayload): void => {
      callbacks.forEach((cb) => cb(payload))
    })
  })
}

async function trigger(page: Page, mode: string, text?: string): Promise<void> {
  await page.evaluate(
    ({ mode: m, text: t }) => {
      const raw: unknown = Reflect.get(window, '__triggerOverlay')
      if (typeof raw === 'function') raw({ mode: m, text: t })
    },
    { mode, text }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. recording mode
// ─────────────────────────────────────────────────────────────────────────────

test('recording pill is visible when overlay mode is recording', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'recording', 'command')
  await expect(page.locator('text=REC')).toBeVisible({ timeout: 3000 })
})

test('recording overlay shows the target agent name', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'recording', 'productivitesse')
  await expect(page.locator('text=productivitesse')).toBeVisible({ timeout: 3000 })
})

test('recording overlay shows a timer (MM:SS format)', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'recording', 'command')
  // Timer starts at 00:00
  await expect(page.locator('text=00:00')).toBeVisible({ timeout: 3000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. success mode
// ─────────────────────────────────────────────────────────────────────────────

test('success mode shows "Delivered" status with target', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'success', 'productivitesse')
  await expect(page.locator('text=Delivered')).toBeVisible({ timeout: 3000 })
  await expect(page.locator('text=productivitesse')).toBeVisible({ timeout: 3000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. cancelled mode
// ─────────────────────────────────────────────────────────────────────────────

test('cancelled mode shows "Cancelled" status', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'cancelled', '')
  await expect(page.locator('text=Cancelled')).toBeVisible({ timeout: 3000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. error mode — CEO's primary failure signal
// ─────────────────────────────────────────────────────────────────────────────

test('error mode shows "Delivery failed" status', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'error', 'atlas')
  await expect(page.locator('text=Delivery failed')).toBeVisible({ timeout: 3000 })
})

test('error mode does not show "Delivered" (no false positive)', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'error', 'atlas')
  // Wait for error overlay to appear first
  await expect(page.locator('text=Delivery failed')).toBeVisible({ timeout: 3000 })
  // Then assert no "Delivered" text is shown alongside it
  await expect(page.locator('text=Delivered')).not.toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. hidden mode
// ─────────────────────────────────────────────────────────────────────────────

test('hidden mode clears the overlay after recording', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'recording', 'command')
  await expect(page.locator('text=REC')).toBeVisible({ timeout: 3000 })
  await trigger(page, 'hidden')
  await expect(page.locator('text=REC')).not.toBeVisible({ timeout: 3000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. message mode (MessageToastStack)
// ─────────────────────────────────────────────────────────────────────────────

test('message toast shows agent name when mode is message', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'message', 'atlas: Task completed')
  await expect(page.locator('text=atlas')).toBeVisible({ timeout: 3000 })
})

test('message toast shows body text after the colon', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'message', 'productivitesse: Build complete — 0 errors')
  await expect(page.locator('text=productivitesse')).toBeVisible({ timeout: 3000 })
  await expect(page.locator('text=Build complete')).toBeVisible({ timeout: 3000 })
})

test('multiple toasts stack — both agent names visible', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'message', 'atlas: First message')
  await trigger(page, 'message', 'command: Second message')
  await expect(page.locator('text=atlas')).toBeVisible({ timeout: 3000 })
  await expect(page.locator('text=command')).toBeVisible({ timeout: 3000 })
})
