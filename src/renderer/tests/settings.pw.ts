import { test, expect } from '@playwright/test'

// These tests describe settings panel behavior after the feature-first refactor.
// They are written before the implementation — they MUST FAIL until extraction is complete.

test('TTS toggle renders in settings panel', async ({ page }) => {
  await page.goto('/')

  // After refactor: SettingsControls component renders a TTS checkbox
  // The label "TTS" should appear in the settings panel
  await expect(page.locator('label', { hasText: 'TTS' })).toBeVisible({ timeout: 3000 })
})

test('agent target dropdown renders in settings panel', async ({ page }) => {
  await page.goto('/')

  // After refactor: SettingsControls renders a select element for target agent
  // It should have "command" as an option (from KNOWN_AGENTS)
  const dropdown = page.locator('select')
  await expect(dropdown).toBeVisible({ timeout: 3000 })
  await expect(dropdown.locator('option[value="command"]')).toHaveCount(1)
})
