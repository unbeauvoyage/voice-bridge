/**
 * Playwright E2E tests for agent-selection localStorage persistence in the mobile UI.
 *
 * Tests at http://localhost:3030 (voice-bridge server / public/index.html).
 *
 * ISOLATION POLICY: All API calls (/agents, /mic, /transcribe) are intercepted
 * via page.route() — no test makes real HTTP calls.
 *
 * FEATURE STATUS: As of writing, public/index.html does NOT implement
 * localStorage persistence for the selected agent. loadAgents() always
 * repopulates the dropdown from scratch with no restore, and no 'change'
 * listener writes a selection to localStorage. All 3 tests below are
 * expected to FAIL until the feature is implemented.
 *
 * Failing tests serve as the specification. Implement the feature to make them
 * pass:
 *   - On dropdown 'change': localStorage.setItem('selectedAgent', agentSelect.value)
 *   - After loadAgents() resolves: restore the stored value if it exists and is
 *     a valid option, otherwise leave the first option selected.
 */

import { test, expect, type Page } from '@playwright/test'

// ── Override baseURL for every test in this file ──────────────────────────────

test.use({ baseURL: 'http://localhost:3030' })

// ── Shared helpers (copied locally — Playwright does not support cross-file imports) ──

/**
 * Intercept GET /agents so the dropdown is predictable in tests.
 * Always returns productivitesse, atlas, command in that order.
 */
async function mockAgents(page: Page): Promise<void> {
  await page.route('**/agents', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        agents: [{ name: 'productivitesse' }, { name: 'atlas' }, { name: 'command' }]
      })
    })
  })
}

/**
 * Intercept GET /mic so the mic state pill is deterministic.
 */
async function mockMic(page: Page, state: 'on' | 'off' = 'on'): Promise<void> {
  await page.route('**/mic', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ state })
    })
  })
}

/**
 * Wait for the agent dropdown to be populated with real options (past the
 * "Loading agents…" placeholder). The first real option from mockAgents is
 * always 'productivitesse'.
 */
async function waitForDropdownPopulated(page: Page): Promise<void> {
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Persistence across page reload
// ─────────────────────────────────────────────────────────────────────────────

test('selected agent persists after page reload — localStorage value restored on navigation', async ({
  page
}) => {
  await mockAgents(page)
  await mockMic(page, 'on')

  await page.goto('/')
  await waitForDropdownPopulated(page)

  // User selects atlas — the app should write 'atlas' to localStorage
  await page.selectOption('#agent-select', 'atlas')
  await expect(page.locator('#agent-select')).toHaveValue('atlas')

  // Routes remain active across reload because they are registered on the page
  // object, which persists through navigation within the same test.

  // Reload simulates returning to the app — localStorage is preserved across
  // navigations (same origin, same browser context).
  await page.reload()
  await waitForDropdownPopulated(page)

  // After reload the app must restore the stored selection: 'atlas'.
  // This will FAIL until the feature is implemented in public/index.html.
  await expect(page.locator('#agent-select')).toHaveValue('atlas')
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Invalid stored value falls back to first valid option
// ─────────────────────────────────────────────────────────────────────────────

test('invalid stored agent falls back to first agent in list', async ({ page }) => {
  // Inject a bogus agent name into localStorage before the page script runs.
  // addInitScript fires before any in-page scripts, so the restore logic sees
  // the value at the same moment the page initialises.
  await page.addInitScript(() => {
    localStorage.setItem('selectedAgent', 'nonexistent-agent')
  })

  await mockAgents(page)
  await mockMic(page, 'on')

  await page.goto('/')
  await waitForDropdownPopulated(page)

  // 'nonexistent-agent' is not in the option list, so the app must fall back to
  // the first valid option ('productivitesse') rather than leaving the select
  // in an undefined / empty state.
  //
  // This will FAIL until the feature is implemented in public/index.html.
  await expect(page.locator('#agent-select')).not.toHaveValue('nonexistent-agent')

  // The fallback must be the first real option, not an empty/placeholder value.
  await expect(page.locator('#agent-select')).toHaveValue('productivitesse')
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Selection retained across multiple switches and a reload
// ─────────────────────────────────────────────────────────────────────────────

test('agent selection is retained across multiple agent switches', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page, 'on')

  await page.goto('/')
  await waitForDropdownPopulated(page)

  // First switch — atlas
  await page.selectOption('#agent-select', 'atlas')
  await expect(page.locator('#agent-select')).toHaveValue('atlas')

  // Second switch — command (overwrites the stored value)
  await page.selectOption('#agent-select', 'command')
  await expect(page.locator('#agent-select')).toHaveValue('command')

  // Reload — the last stored selection ('command') must be restored.
  // This will FAIL until the feature is implemented in public/index.html.
  await page.reload()
  await waitForDropdownPopulated(page)

  await expect(page.locator('#agent-select')).toHaveValue('command')
})
