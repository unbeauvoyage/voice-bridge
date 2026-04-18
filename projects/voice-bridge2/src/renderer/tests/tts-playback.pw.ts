/**
 * Playwright E2E tests for TTS-triggered overlay UI behavior.
 *
 * TTS audio playback is server-side (edge-tts process) and cannot be verified
 * directly in Playwright. These tests verify the overlay UI behavior when
 * TTS-triggering events arrive via the __overlayBridge IPC surface.
 *
 * Tests at http://localhost:5199 (Vite overlay renderer / overlay.html).
 *
 * Helpers (installOverlayBridge, trigger) are redefined locally — Playwright
 * does not support cross-file helper imports at runtime.
 *
 * ISOLATION POLICY: No real Electron IPC or HTTP calls are made.
 * All overlay events are injected via the __overlayBridge mock installed by
 * addInitScript, exactly matching how the production Electron main process
 * fires events at the renderer.
 *
 * Test groups:
 *   1. Message toast appears on relay message event
 *   2. Multiple messages stack as separate toasts
 *   3. TTS-unavailable message surfaced as toast — overlay does not crash
 *   4. Hidden mode clears the recording/status overlay; toasts follow their own lifecycle
 */

import { test, expect, type Page } from '@playwright/test'

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Inject the __overlayBridge mock and expose __triggerOverlay before the
 * page loads. Must be called before page.goto().
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
// 1. Message toast appears when relay message arrives
// ─────────────────────────────────────────────────────────────────────────────

test('message toast is visible when a relay message event arrives', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')
  await trigger(page, 'message', 'atlas: meeting at 3pm')

  // The overlay parses "atlas: meeting at 3pm" → agent="atlas", body="meeting at 3pm".
  // Both parts must appear in the DOM so the user can read the full message.
  await expect(page.locator('text=meeting at 3pm')).toBeVisible({ timeout: 3000 })
  await expect(page.locator('text=atlas')).toBeVisible({ timeout: 3000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Multiple messages stack as separate toasts
// ─────────────────────────────────────────────────────────────────────────────

test('two message events produce two separate visible toasts', async ({ page }) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')

  // Trigger two distinct messages — each must render as its own toast item.
  // The MessageToastStack appends rather than replaces, so both must be in DOM.
  await trigger(page, 'message', 'atlas: first message')
  await trigger(page, 'message', 'command: second message')

  await expect(page.locator('text=first message')).toBeVisible({ timeout: 3000 })
  await expect(page.locator('text=second message')).toBeVisible({ timeout: 3000 })

  // Both agent names must be visible to identify which agent sent each message
  await expect(page.locator('text=atlas')).toBeVisible({ timeout: 3000 })
  await expect(page.locator('text=command')).toBeVisible({ timeout: 3000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. TTS unavailable — overlay shows message toast without crashing
// ─────────────────────────────────────────────────────────────────────────────

test('TTS-unavailable message surfaces as a toast and does not put the overlay in error state', async ({
  page
}) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')

  // When edge-tts fails the server sends a relay message with this text.
  // The overlay has no concept of TTS state — it receives a message event and
  // renders it as a toast. Verify the toast appears and the body is intact.
  await trigger(page, 'message', 'atlas: TTS unavailable')

  // Toast body text must be shown so the user knows TTS failed
  await expect(page.locator('text=TTS unavailable')).toBeVisible({ timeout: 3000 })

  // The overlay must not enter any error UI state.
  // The overlay root must be present in the DOM (not removed/crashed), and
  // the body must not acquire a state-error class.
  // Note: body has overflow:hidden + transparent bg by design, so toBeVisible()
  // is not used here — we assert the root element count instead.
  await expect(page.locator('#overlay-root')).toHaveCount(1)
  await expect(page.locator('body')).not.toHaveClass(/state-error/)
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Hidden mode clears the recording/status overlay; toasts are independent
// ─────────────────────────────────────────────────────────────────────────────

test('hidden mode clears the recording overlay but message toasts remain until they auto-expire', async ({
  page
}) => {
  await installOverlayBridge(page)
  await page.goto('/overlay.html')

  // First bring up a recording overlay so we have something to clear
  await trigger(page, 'recording', 'command')
  await expect(page.locator('text=REC')).toBeVisible({ timeout: 3000 })

  // Also add a message toast
  await trigger(page, 'message', 'atlas: background task done')
  await expect(page.locator('text=background task done')).toBeVisible({ timeout: 3000 })

  // Trigger hidden mode — this clears the recording/status overlay only.
  // Message toasts have their own 7-second lifecycle managed independently;
  // the hidden event does NOT clear them. This is intentional: background
  // messages from agents should remain visible regardless of recording state.
  await trigger(page, 'hidden')

  // The REC pill must be gone — hidden mode collapsed the recording overlay
  await expect(page.locator('text=REC')).not.toBeVisible({ timeout: 3000 })

  // The message toast from before must still be visible — hidden does not
  // clear toasts; they expire on their own timer (7 seconds after arrival)
  await expect(page.locator('text=background task done')).toBeVisible({ timeout: 3000 })
})
