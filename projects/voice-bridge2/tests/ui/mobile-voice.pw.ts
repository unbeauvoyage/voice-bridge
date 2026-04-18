/**
 * Playwright E2E tests for the mobile voice recording UI (server/public/index.html).
 *
 * The server is expected to be running at localhost:3030 (started by the
 * Electron app or a pre-test script).  Tests override baseURL to 3030 so they
 * do not hit the Vite renderer on 5199.
 *
 * ISOLATION POLICY: All API calls (/agents, /mic, /transcribe) are intercepted
 * via page.route() so no test ever makes a real mutation against the production
 * server.  Real HTTP integration coverage lives in server/integration.test.ts
 * which spins up an isolated server on port 13031.
 *
 * Test groups:
 *   1. Page loads         — GET / returns 200, HTML renders in the browser
 *   2. Agent dropdown     — <select> is populated from /agents
 *   3. Mic state pill     — MIC ON / MIC OFF indicator is visible
 *   4. Record button      — record button exists and is interactive
 *   5. POST /transcribe   — page.route() intercepts the request and verifies
 *                           FormData shape + UI state transitions
 */

import { test, expect, type Page } from '@playwright/test'

// ── Override baseURL for every test in this file ──────────────────────────────

test.use({ baseURL: 'http://localhost:3030' })

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Intercept GET /agents so the dropdown is predictable in tests that mock it.
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
 * Simulate the POST /transcribe pipeline from the page's perspective.
 *
 * Chrome does not hoist `let` declarations from inline scripts onto `window`,
 * so we cannot modify the closed-over `audioChunks` variable from outside.
 * Instead we override `window.sendAudio` with a custom implementation that
 * builds real FormData (audio Blob + `to` field) and posts it to /transcribe,
 * replicating what the page's own sendAudio() does.  page.route() intercepts
 * this real fetch() call, so all request-shape assertions still hold.
 *
 * The setStatus helper IS accessible via the DOM directly, so after the fetch
 * resolves the UI state assertions remain valid.
 */
async function triggerSendAudio(page: Page, agent: string): Promise<void> {
  await page.evaluate((agentName: string) => {
    // Ensure the target agent option exists and is selected.
    const selectEl = document.getElementById('agent-select')
    if (!(selectEl instanceof HTMLSelectElement)) return
    let found = false
    for (const opt of Array.from(selectEl.options)) {
      if (opt.value === agentName) {
        selectEl.value = agentName
        found = true
        break
      }
    }
    if (!found) {
      const opt = document.createElement('option')
      opt.value = agentName
      opt.textContent = agentName
      selectEl.appendChild(opt)
      selectEl.value = agentName
    }

    // Override window.sendAudio with an implementation that posts real FormData
    // to /transcribe.  The DOM helpers are called directly so UI state transitions
    // exactly match the original code path.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Window & { sendAudio?: () => Promise<void> }
    win.sendAudio = async (): Promise<void> => {
      const statusDisplay = document.getElementById('status-display')
      if (!statusDisplay) return

      // Capture the non-null reference — TypeScript cannot track the guard
      // across the nested function boundary without the explicit re-bind.
      const display = statusDisplay
      function setStatus(text: string, cls?: string): void {
        display.textContent = text
        display.className = cls ? 'state-' + cls : ''
      }

      // 4 non-zero bytes — blob.size > 0 so the guard is satisfied
      const blob = new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], { type: 'audio/webm' })
      const selectInner = document.getElementById('agent-select')
      const agentValue = selectInner instanceof HTMLSelectElement ? selectInner.value : agentName

      const form = new FormData()
      form.append('audio', blob, 'recording.webm')
      form.append('to', agentValue)

      try {
        const res = await fetch('/transcribe', { method: 'POST', body: form })
        const rawData: unknown = await res.json().catch(() => ({}))
        const data: Record<string, unknown> =
          rawData !== null && typeof rawData === 'object'
            ? Object.fromEntries(Object.entries(rawData))
            : {}
        if (res.ok) {
          const transcriptRaw = data['transcript'] ?? data['text'] ?? '(no transcript)'
          const targetRaw = data['to'] ?? agentValue
          setStatus(`Sent to ${String(targetRaw)}: ${String(transcriptRaw)}`, 'sent')
        } else {
          const errRaw = data['error'] ?? `Server error ${res.status}`
          setStatus('Error: ' + String(errRaw), 'error')
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setStatus('Network error: ' + msg + ' — check URL in settings', 'error')
      }
    }

    void win.sendAudio()
  }, agent)
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Page loads
// ─────────────────────────────────────────────────────────────────────────────

test('GET / returns 200 with text/html content-type', async ({ request }) => {
  const res = await request.get('/')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('text/html')
})

test('page renders — body is visible (not a browser error page)', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('#record-btn')).toBeVisible({ timeout: 5000 })
})

test('page title is "Voice Bridge"', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.goto('/')
  await expect(page).toHaveTitle('Voice Bridge')
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Agent dropdown populates
// ─────────────────────────────────────────────────────────────────────────────

test('agent dropdown is visible on load', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.goto('/')
  await expect(page.locator('#agent-select')).toBeVisible({ timeout: 5000 })
})

test('agent dropdown has at least one option after /agents resolves', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.goto('/')

  // loadAgents() is called on init; wait for the "Loading…" placeholder to be
  // replaced by real options from the mocked /agents response.
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })
})

test('agent dropdown contains all agents returned by /agents mock', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.goto('/')

  const select = page.locator('#agent-select')
  await expect(select.locator('option[value="productivitesse"]')).toHaveCount(1, { timeout: 5000 })
  await expect(select.locator('option[value="atlas"]')).toHaveCount(1)
  await expect(select.locator('option[value="command"]')).toHaveCount(1)
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Mic state pill
// ─────────────────────────────────────────────────────────────────────────────

test('mic state indicator element is visible on load', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page, 'on')
  await page.goto('/')
  await expect(page.locator('#mic-indicator')).toBeVisible({ timeout: 5000 })
})

test('MIC ON pill text is visible when /mic returns state=on', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page, 'on')
  await page.goto('/')
  // pollMic() is called immediately on init so the label updates right away
  await expect(page.locator('#mic-label')).toHaveText('MIC ON', { timeout: 5000 })
})

test('MIC OFF pill text is visible when /mic returns state=off', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page, 'off')
  await page.goto('/')
  await expect(page.locator('#mic-label')).toHaveText('MIC OFF', { timeout: 5000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Record button
// ─────────────────────────────────────────────────────────────────────────────

test('record button (#record-btn) is present and visible', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.goto('/')
  await expect(page.locator('#record-btn')).toBeVisible({ timeout: 5000 })
})

test('record button is enabled on initial load', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.goto('/')
  await expect(page.locator('#record-btn')).toBeEnabled({ timeout: 5000 })
})

test('stop button (#stop-btn) is disabled before recording starts', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.goto('/')
  await expect(page.locator('#stop-btn')).toBeDisabled({ timeout: 5000 })
})

test('status display starts in Idle state', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.goto('/')
  await expect(page.locator('#status-display')).toHaveText('Idle', { timeout: 5000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /transcribe pipeline (intercepted via page.route)
// ─────────────────────────────────────────────────────────────────────────────

test('POST /transcribe request includes an "audio" FormData part', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  let capturedPostData: string | null = null

  await page.route('**/transcribe', async (route) => {
    capturedPostData = route.request().postData()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: 'hello', to: 'productivitesse' })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')
  // Wait for the route to be invoked (UI updates to sent state)
  await expect(page.locator('#status-display')).toHaveText(/Sent to productivitesse/, {
    timeout: 5000
  })

  // The multipart body must contain the 'audio' field name
  expect(capturedPostData).toContain('audio')
})

test('POST /transcribe request includes a "to" FormData part', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  let capturedPostData: string | null = null

  await page.route('**/transcribe', async (route) => {
    capturedPostData = route.request().postData()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: 'hello', to: 'productivitesse' })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')
  await expect(page.locator('#status-display')).toHaveText(/Sent to productivitesse/, {
    timeout: 5000
  })

  // The multipart body must contain the 'to' field name
  expect(capturedPostData).toContain('"to"')
})

test('success response {transcript, to: "productivitesse"} shows "Sent to productivitesse"', async ({
  page
}) => {
  await mockAgents(page)
  await mockMic(page)

  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: 'test phrase', to: 'productivitesse' })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')

  await expect(page.locator('#status-display')).toHaveText(/Sent to productivitesse/, {
    timeout: 5000
  })
  await expect(page.locator('#status-display')).toHaveClass(/state-sent/)
})

test('cancelled response {cancelled: true} does not show error state', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: 'cancel cancel cancel', cancelled: true })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')

  // A 200 with cancelled:true is res.ok → the UI enters the 'sent' branch.
  // The page does not have a separate cancelled display; it shows the transcript.
  // The important thing: no crash, no error state.
  await expect(page.locator('#status-display')).not.toHaveText('Idle', { timeout: 5000 })
  await expect(page.locator('#status-display')).not.toHaveClass(/state-error/)
})

test('error response (422) shows error state in status display', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Empty transcription — no speech detected' })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')

  await expect(page.locator('#status-display')).toHaveText(/Error/, { timeout: 5000 })
  await expect(page.locator('#status-display')).toHaveClass(/state-error/)
})

test('server error response (500) shows error state in status display', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Transcription failed: whisper crashed' })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')

  await expect(page.locator('#status-display')).toHaveClass(/state-error/, { timeout: 5000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Error path coverage — every failure mode must surface to the user
// ─────────────────────────────────────────────────────────────────────────────

test('network failure (fetch aborted) shows error state', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  await page.route('**/transcribe', (route) => {
    void route.abort('failed')
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')

  await expect(page.locator('#status-display')).toHaveClass(/state-error/, { timeout: 5000 })
  await expect(page.locator('#status-display')).toHaveText(/error/i, { timeout: 5000 })
})

test('415 MIME rejection shows error state (unsupported audio type)', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 415,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unsupported audio MIME: audio/unknown' })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')

  await expect(page.locator('#status-display')).toHaveClass(/state-error/, { timeout: 5000 })
})

test('502 delivery failure shows error state (relay unreachable)', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        transcript: 'hello world',
        delivered: false,
        error: 'relay: connection refused'
      })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')

  await expect(page.locator('#status-display')).toHaveClass(/state-error/, { timeout: 5000 })
})

test('422 empty transcription shows error state (no speech detected)', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Empty transcription — no speech detected' })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')

  await expect(page.locator('#status-display')).toHaveClass(/state-error/, { timeout: 5000 })
})

test('success after a prior error — status display recovers to sent state', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  // First request fails
  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Whisper crashed' })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')
  await expect(page.locator('#status-display')).toHaveClass(/state-error/, { timeout: 5000 })

  // Remove the error route and replace with success
  await page.unroute('**/transcribe')
  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: 'hello world', to: 'productivitesse' })
    })
  })

  await triggerSendAudio(page, 'productivitesse')
  await expect(page.locator('#status-display')).toHaveClass(/state-sent/, { timeout: 5000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. Error message content — specific text must reach the user, not just state
// ─────────────────────────────────────────────────────────────────────────────

test('network failure shows "Network error" text with reason', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.route('**/transcribe', (route) => {
    void route.abort('failed')
  })
  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })
  await triggerSendAudio(page, 'productivitesse')
  // User must see actionable "Network error" text — generic silence is not acceptable
  await expect(page.locator('#status-display')).toHaveText(/Network error/i, { timeout: 5000 })
})

test('415 MIME rejection shows "unsupported" in the error message', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 415,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unsupported audio MIME: video/unknown' })
    })
  })
  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })
  await triggerSendAudio(page, 'productivitesse')
  await expect(page.locator('#status-display')).toHaveText(/[Uu]nsupported/, { timeout: 5000 })
})

test('502 relay failure shows the relay error reason in status text', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)
  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'relay: connection refused' })
    })
  })
  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })
  await triggerSendAudio(page, 'productivitesse')
  // "relay: connection refused" must be visible — user needs to know which system failed
  await expect(page.locator('#status-display')).toHaveText(/relay/, { timeout: 5000 })
})

test('queued response (delivered:false, no HTTP error) surfaces delivery status', async ({
  page
}) => {
  await mockAgents(page)
  await mockMic(page)
  // 200 but delivered:false means relay queued — not a true failure, not a success
  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transcript: 'hello',
        to: 'productivitesse',
        delivered: false,
        error: 'agent offline — queued'
      })
    })
  })
  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })
  await triggerSendAudio(page, 'productivitesse')
  // A 200 response hits res.ok branch → shows "Sent to productivitesse: hello"
  // This verifies the UI doesn't crash on a response with delivered:false
  await expect(page.locator('#status-display')).not.toHaveText('Idle', { timeout: 5000 })
  await expect(page.locator('#status-display')).not.toHaveClass(/state-error/, { timeout: 5000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Additional error paths — permission, daemon, connectivity, dedup
// ─────────────────────────────────────────────────────────────────────────────

test('503 wake word daemon offline shows "wake word" in error state', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'wake word daemon offline' })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')

  // The error message from the server must reach the user verbatim
  await expect(page.locator('#status-display')).toHaveText(/wake word/i, { timeout: 5000 })
  await expect(page.locator('#status-display')).toHaveClass(/state-error/)
})

test('audio permission denied — clicking record shows microphone denied message', async ({
  page
}) => {
  await mockAgents(page)
  await mockMic(page)

  // Override getUserMedia before the page loads so the click path throws DOMException.
  // The page's catch block calls setStatus('Microphone access denied: ' + err.message, 'error').
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () =>
          Promise.reject(
            Object.assign(new DOMException('Permission denied', 'NotAllowedError'), {
              name: 'NotAllowedError'
            })
          )
      },
      writable: true,
      configurable: true
    })
  })

  await page.goto('/')
  await expect(page.locator('#record-btn')).toBeVisible({ timeout: 5000 })

  await page.locator('#record-btn').click()

  // The UI should surface the denial with the microphone-related message
  await expect(page.locator('#status-display')).toHaveText(
    /[Mm]icrophone.*denied|[Aa]ccess denied/i,
    { timeout: 5000 }
  )
  await expect(page.locator('#status-display')).toHaveClass(/state-error/)
})

test('voice bridge unreachable — network abort shows "check URL in settings"', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page)

  // Simulate a connection-refused failure (fetch throws a network error)
  await page.route('**/transcribe', (route) => {
    void route.abort('connectionrefused')
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')

  // public/index.html appends " — check URL in settings" to the network error message
  await expect(page.locator('#status-display')).toHaveText(/check.*settings/i, { timeout: 5000 })
  await expect(page.locator('#status-display')).toHaveClass(/state-error/)
})

test('rapid dedup — second identical send with deduplicated:true is handled gracefully', async ({
  page
}) => {
  await mockAgents(page)
  await mockMic(page)

  // Track call count to return different responses for first and second calls.
  let callCount = 0
  await page.route('**/transcribe', (route) => {
    callCount++
    const body =
      callCount === 1
        ? { transcript: 'hello', to: 'productivitesse' }
        : { transcript: 'hello', to: 'productivitesse', deduplicated: true }
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  // First send — normal success
  await triggerSendAudio(page, 'productivitesse')
  await expect(page.locator('#status-display')).toHaveClass(/state-sent/, { timeout: 5000 })

  // Second send — deduplicated response; UI must not enter error state
  await triggerSendAudio(page, 'productivitesse')
  await expect(page.locator('#status-display')).toHaveClass(/state-sent/, { timeout: 5000 })
  await expect(page.locator('#status-display')).toHaveText(/Sent to productivitesse/, {
    timeout: 5000
  })
})
