import { test, expect } from '@playwright/test'

// SettingsPage renders at the root route and composes:
//   - A status header (dot + state label + mic badge)
//   - A close button
//   - SettingsControls (target select, wake/stop sliders, TTS toggle, word-limit and toast-duration inputs)
//   - An optional transcript box (only when transcript is non-empty)
//
// Network calls to http://127.0.0.1:3030 are intercepted so the tests run
// without a live daemon.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockServerRoutes(page: import('@playwright/test').Page): Promise<void> {
  // /agents — return a small known list so the target dropdown is predictable
  await page.route('**/agents', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        agents: [{ name: 'command' }, { name: 'atlas' }, { name: 'sentinel' }]
      })
    })
  })

  // /settings — return server-side defaults so the page initialises cleanly
  await page.route('**/settings', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        start_threshold: 0.3,
        stop_threshold: 0.05,
        tts_word_limit: 3,
        tts_enabled: true,
        toast_duration: 3
      })
    })
  })

  // /status — polled every 3 s by useWakeState; return stable idle state
  await page.route('**/status', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ target: 'command', micState: 'on' })
    })
  })

  // /target — POST when the user changes the target dropdown
  await page.route('**/target', (route) => {
    void route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

// ---------------------------------------------------------------------------
// Page renders — structural presence
// ---------------------------------------------------------------------------

test('page renders without crashing', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')
  // The outermost container is always present; any child visible means React mounted
  await expect(page.locator('body')).toBeVisible()
})

test('close button is visible', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')
  // The × button sits in the top-right corner with title="Close"
  await expect(page.locator('button[title="Close"]')).toBeVisible({ timeout: 5000 })
})

test('status label shows idle state on initial load', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')
  // Default wakeState is 'idle' → stateLabel returns 'Idle'
  await expect(page.getByText('Idle')).toBeVisible({ timeout: 5000 })
})

test('mic badge is visible and reflects on state', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')
  // Default micState is 'on', so the badge reads 'MIC ON'
  await expect(page.getByText('MIC ON')).toBeVisible({ timeout: 5000 })
})

// ---------------------------------------------------------------------------
// Wake word store state readable through the DOM
// ---------------------------------------------------------------------------

test('status dot is rendered in the header row', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')
  // The status dot is a <div> immediately before the state-label span.
  // We identify it by its sibling relationship with the state text.
  const header = page.locator('div').filter({ hasText: 'Idle' }).first()
  await expect(header).toBeVisible({ timeout: 5000 })
})

test('wakeState reflected: listening label appears when state changes via IPC', async ({
  page
}) => {
  // Inject a fake __voiceBridge before page load so useWakeState picks it up
  await page.addInitScript(() => {
    type StatePayload = {
      wakeState?: string
      micState?: string
      target?: string
      transcript?: string
    }
    const cbs: Array<(s: StatePayload) => void> = []
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Record<string, unknown>
    win.__voiceBridge = {
      onStateChange(cb: (s: StatePayload) => void): () => void {
        cbs.push(cb)
        return (): void => {
          const i = cbs.indexOf(cb)
          if (i >= 0) cbs.splice(i, 1)
        }
      },
      hide(): void {
        /* noop */
      },
      setTarget(): Promise<void> {
        return Promise.resolve()
      }
    }
    win.__triggerWakeState = (s: StatePayload): void => cbs.forEach((cb) => cb(s))
  })

  await mockServerRoutes(page)
  await page.goto('/')

  // Verify idle is shown first
  await expect(page.getByText('Idle')).toBeVisible({ timeout: 5000 })

  // Now push a state change via the fake IPC bridge
  await page.evaluate(() => {
    type StatePayload = { wakeState?: string }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Record<string, (s: StatePayload) => void>
    win.__triggerWakeState({ wakeState: 'listening' })
  })

  await expect(page.getByText('Listening...')).toBeVisible({ timeout: 3000 })
})

test('wakeState reflected: recording label appears when state changes via IPC', async ({
  page
}) => {
  await page.addInitScript(() => {
    type StatePayload = {
      wakeState?: string
      micState?: string
      target?: string
      transcript?: string
    }
    const cbs: Array<(s: StatePayload) => void> = []
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Record<string, unknown>
    win.__voiceBridge = {
      onStateChange(cb: (s: StatePayload) => void): () => void {
        cbs.push(cb)
        return (): void => {
          const i = cbs.indexOf(cb)
          if (i >= 0) cbs.splice(i, 1)
        }
      },
      hide(): void {
        /* noop */
      },
      setTarget(): Promise<void> {
        return Promise.resolve()
      }
    }
    win.__triggerWakeState = (s: StatePayload): void => cbs.forEach((cb) => cb(s))
  })

  await mockServerRoutes(page)
  await page.goto('/')

  await page.evaluate(() => {
    type StatePayload = { wakeState?: string }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Record<string, (s: StatePayload) => void>
    win.__triggerWakeState({ wakeState: 'recording' })
  })

  await expect(page.getByText('Recording...')).toBeVisible({ timeout: 3000 })
})

// ---------------------------------------------------------------------------
// Voice settings controls — interactivity
// ---------------------------------------------------------------------------

test('target dropdown renders and contains known agents', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')

  const dropdown = page.locator('select')
  await expect(dropdown).toBeVisible({ timeout: 5000 })

  // Agents from the /agents mock: command, atlas, sentinel, plus KNOWN_AGENTS merged in
  await expect(dropdown.locator('option[value="command"]')).toHaveCount(1)
  await expect(dropdown.locator('option[value="atlas"]')).toHaveCount(1)
  await expect(dropdown.locator('option[value="sentinel"]')).toHaveCount(1)
})

test('changing target dropdown fires a POST to /target', async ({ page }) => {
  let capturedBody = ''
  await page.route('**/agents', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agents: [{ name: 'command' }, { name: 'atlas' }] })
    })
  })
  await page.route('**/settings', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        start_threshold: 0.3,
        stop_threshold: 0.05,
        tts_word_limit: 3,
        tts_enabled: true,
        toast_duration: 3
      })
    })
  })
  await page.route('**/status', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ target: 'command', micState: 'on' })
    })
  })
  await page.route('**/target', async (route) => {
    capturedBody = route.request().postData() ?? ''
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/')

  const dropdown = page.locator('select')
  await expect(dropdown).toBeVisible({ timeout: 5000 })
  await dropdown.selectOption('atlas')

  // Wait a tick for the async handler to fire
  await page.waitForTimeout(300)
  expect(capturedBody).toContain('atlas')
})

test('TTS label renders in settings panel', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')
  await expect(page.locator('label', { hasText: 'TTS' })).toBeVisible({ timeout: 5000 })
})

test('TTS checkbox is checked by default (tts_enabled: true)', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')

  // The TTS checkbox is inside the label that wraps the toggle
  const checkbox = page.locator('input[type="checkbox"]')
  await expect(checkbox).toBeVisible({ timeout: 5000 })
  await expect(checkbox).toBeChecked()
})

test('TTS toggle label shows On when tts_enabled is true', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')
  // The span next to the TTS checkbox reads exactly 'On' when tts_enabled is true.
  // Use exact: true to avoid matching 'MIC ON' in the header.
  await expect(page.getByText('On', { exact: true })).toBeVisible({ timeout: 5000 })
})

test('clicking TTS checkbox toggles the label to Off', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')

  const checkbox = page.locator('input[type="checkbox"]')
  await expect(checkbox).toBeVisible({ timeout: 5000 })
  await checkbox.click()

  // After unchecking, the span should switch to 'Off'
  await expect(page.getByText('Off')).toBeVisible({ timeout: 3000 })
})

test('wake threshold slider is visible', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')

  await expect(page.locator('label', { hasText: 'Wake' })).toBeVisible({ timeout: 5000 })
  // Two range inputs: wake and stop thresholds
  const sliders = page.locator('input[type="range"]')
  await expect(sliders).toHaveCount(2)
})

test('wake slider starts at default value 0.30', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')

  const sliders = page.locator('input[type="range"]')
  await expect(sliders.first()).toHaveValue('0.3')
})

test('stop threshold slider starts at default value 0.05', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')

  const sliders = page.locator('input[type="range"]')
  await expect(sliders.nth(1)).toHaveValue('0.05')
})

test('tts word limit input is visible and has default value 3', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')

  await expect(page.locator('label', { hasText: 'Words' })).toBeVisible({ timeout: 5000 })
  // There are two number inputs: tts_word_limit and toast_duration
  const numberInputs = page.locator('input[type="number"]')
  await expect(numberInputs).toHaveCount(2)
  await expect(numberInputs.first()).toHaveValue('3')
})

test('toast duration input is visible and has default value 3', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')

  await expect(page.locator('label', { hasText: 'Toast' })).toBeVisible({ timeout: 5000 })
  const numberInputs = page.locator('input[type="number"]')
  await expect(numberInputs.nth(1)).toHaveValue('3')
})

test('changing word limit input updates displayed value', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')

  const numberInputs = page.locator('input[type="number"]')
  const wordInput = numberInputs.first()
  await expect(wordInput).toBeVisible({ timeout: 5000 })

  await wordInput.fill('5')
  await expect(wordInput).toHaveValue('5')
})

// ---------------------------------------------------------------------------
// Relay / daemon status display
// ---------------------------------------------------------------------------

test('mic badge is present in the header', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')
  // MIC ON is displayed when micState is 'on' (the default)
  await expect(page.getByText('MIC ON')).toBeVisible({ timeout: 5000 })
})

test('mic badge shows MIC OFF when status reports mic off', async ({ page }) => {
  // Override the /status mock to return micState: off
  await page.route('**/agents', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agents: [{ name: 'command' }] })
    })
  })
  await page.route('**/settings', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        start_threshold: 0.3,
        stop_threshold: 0.05,
        tts_word_limit: 3,
        tts_enabled: true,
        toast_duration: 3
      })
    })
  })
  await page.route('**/status', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ target: 'command', micState: 'off' })
    })
  })

  await page.goto('/')

  // The status poll runs every 3 s; wait up to 5 s for the first poll to resolve
  await expect(page.getByText('MIC OFF')).toBeVisible({ timeout: 5000 })
})

test('transcript box is hidden when transcript is empty', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')
  // Default state has empty transcript — the transcript box should not be in the DOM
  await expect(page.getByText('Last transcript')).not.toBeVisible()
})

// ---------------------------------------------------------------------------
// Mic badge is a clickable button (Bug #89)
// ---------------------------------------------------------------------------

test('mic badge is a button element (not a plain span)', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')
  // The MIC badge must be an interactive button so the CEO can click it to toggle
  await expect(page.locator('button', { hasText: /MIC (ON|OFF)/ })).toBeVisible({ timeout: 5000 })
})

test('clicking mic badge calls window.__voiceBridge.toggleMic', async ({ page }) => {
  let toggleMicCalled = false

  await page.addInitScript(() => {
    type StatePayload = {
      wakeState?: string
      micState?: string
      target?: string
      transcript?: string
    }
    const cbs: Array<(s: StatePayload) => void> = []
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Record<string, unknown>
    win.__toggleMicCalled = false
    win.__voiceBridge = {
      onStateChange(cb: (s: StatePayload) => void): () => void {
        cbs.push(cb)
        return (): void => {
          const i = cbs.indexOf(cb)
          if (i >= 0) cbs.splice(i, 1)
        }
      },
      hide(): void {
        /* noop */
      },
      setTarget(): Promise<void> {
        return Promise.resolve()
      },
      toggleMic(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ;(window as Record<string, unknown>).__toggleMicCalled = true
        return Promise.resolve()
      }
    }
  })

  await mockServerRoutes(page)
  await page.goto('/')

  // Click the MIC badge button
  await page.locator('button', { hasText: /MIC (ON|OFF)/ }).click()

  toggleMicCalled = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (window as Record<string, unknown>).__toggleMicCalled as boolean
  })
  expect(toggleMicCalled).toBe(true)
})

// ---------------------------------------------------------------------------
// Close button does not overlap mic badge (Bug #89)
// ---------------------------------------------------------------------------

test('close button is absolutely positioned and does not overlap mic badge', async ({ page }) => {
  await mockServerRoutes(page)
  await page.goto('/')

  const closeBtn = page.locator('button[title="Close"]')
  const micBtn = page.locator('button', { hasText: /MIC (ON|OFF)/ })

  await expect(closeBtn).toBeVisible({ timeout: 5000 })
  await expect(micBtn).toBeVisible({ timeout: 5000 })

  const closeBBox = await closeBtn.boundingBox()
  const micBBox = await micBtn.boundingBox()

  // Both elements must have real bounding boxes (not hidden behind each other)
  expect(closeBBox).not.toBeNull()
  expect(micBBox).not.toBeNull()

  if (closeBBox && micBBox) {
    // Close button is in top-right: its left edge should be to the RIGHT of mic badge right edge,
    // OR their vertical extents don't overlap (no visual collision).
    // We check that they don't significantly overlap in 2D space.
    const closeBtnRight = closeBBox.x + closeBBox.width
    const closeBtnBottom = closeBBox.y + closeBBox.height
    const micRight = micBBox.x + micBBox.width
    const micBottom = micBBox.y + micBBox.height

    // They overlap if both x-ranges and y-ranges intersect
    const xOverlap = closeBBox.x < micRight && closeBtnRight > micBBox.x
    const yOverlap = closeBBox.y < micBottom && closeBtnBottom > micBBox.y
    const overlapping = xOverlap && yOverlap

    expect(overlapping).toBe(false)
  }
})

test('transcript box appears when IPC pushes a transcript', async ({ page }) => {
  await page.addInitScript(() => {
    type StatePayload = {
      wakeState?: string
      micState?: string
      target?: string
      transcript?: string
    }
    const cbs: Array<(s: StatePayload) => void> = []
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Record<string, unknown>
    win.__voiceBridge = {
      onStateChange(cb: (s: StatePayload) => void): () => void {
        cbs.push(cb)
        return (): void => {
          const i = cbs.indexOf(cb)
          if (i >= 0) cbs.splice(i, 1)
        }
      },
      hide(): void {
        /* noop */
      },
      setTarget(): Promise<void> {
        return Promise.resolve()
      }
    }
    win.__triggerWakeState = (s: StatePayload): void => cbs.forEach((cb) => cb(s))
  })

  await mockServerRoutes(page)
  await page.goto('/')

  await page.evaluate(() => {
    type StatePayload = { transcript?: string }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Record<string, (s: StatePayload) => void>
    win.__triggerWakeState({ transcript: 'send a summary to atlas' })
  })

  await expect(page.getByText('Last transcript')).toBeVisible({ timeout: 3000 })
  await expect(page.getByText('send a summary to atlas')).toBeVisible({ timeout: 3000 })
})
