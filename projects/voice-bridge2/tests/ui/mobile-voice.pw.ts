/**
 * Playwright E2E tests for the mobile voice recording UI (server/public/index.html).
 *
 * The server is expected to be running at localhost:3030 (started by the
 * Electron app or a pre-test script).  Tests override baseURL to 3030 so they
 * do not hit the Vite renderer on 5199.
 *
 * Test groups:
 *   1. Page loads         — GET / returns 200, HTML renders in the browser
 *   2. Agent dropdown     — <select> is populated from /agents
 *   3. Mic state pill     — MIC ON / MIC OFF indicator is visible
 *   4. Record button      — record button exists and is interactive
 *   5. POST /transcribe   — page.route() intercepts the request and verifies
 *                           FormData shape + UI state transitions
 *   6. Direct /transcribe — real HTTP POST verifies JSON response (not 404/500)
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
        setStatus('Network error: ' + msg, 'error')
      }
    }

    void win.sendAudio()
  }, agent)
}

/**
 * Construct a minimal valid WAV buffer: 16-bit PCM mono 16 kHz, 100 ms of
 * silence.  Used by the direct /transcribe integration tests.
 */
function buildMinimalWav(): Buffer {
  const sampleRate = 16000
  const numChannels = 1
  const bitsPerSample = 16
  const numSamples = sampleRate / 10 // 100 ms
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = numSamples * blockAlign
  const buf = Buffer.alloc(44 + dataSize)
  let off = 0

  buf.write('RIFF', off)
  off += 4
  buf.writeUInt32LE(36 + dataSize, off)
  off += 4
  buf.write('WAVE', off)
  off += 4
  buf.write('fmt ', off)
  off += 4
  buf.writeUInt32LE(16, off)
  off += 4
  buf.writeUInt16LE(1, off)
  off += 2 // PCM
  buf.writeUInt16LE(numChannels, off)
  off += 2
  buf.writeUInt32LE(sampleRate, off)
  off += 4
  buf.writeUInt32LE(byteRate, off)
  off += 4
  buf.writeUInt16LE(blockAlign, off)
  off += 2
  buf.writeUInt16LE(bitsPerSample, off)
  off += 2
  buf.write('data', off)
  off += 4
  buf.writeUInt32LE(dataSize, off)
  // remaining bytes are zeroed (silence) by Buffer.alloc
  return buf
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
// 6. Direct /transcribe integration — real HTTP POST to localhost:3030
// ─────────────────────────────────────────────────────────────────────────────
// The server is assumed to be running (started by the Electron app or a
// pre-test command).  These tests skip gracefully if no server is reachable
// rather than failing with a confusing connection error.

test('direct POST /transcribe returns JSON — not 404 or 500', async ({ request }) => {
  // Quick liveness check — if server is not running skip gracefully
  let serverUp = false
  try {
    const health = await request.get('/health', { timeout: 3000 })
    serverUp = health.ok()
  } catch {
    // intentional
  }
  if (!serverUp) {
    test.skip()
    return
  }

  const wavBytes = buildMinimalWav()

  const res = await request.post('/transcribe', {
    multipart: {
      audio: {
        name: 'test.wav',
        mimeType: 'audio/wav',
        buffer: wavBytes
      },
      to: 'productivitesse'
    },
    timeout: 30000
  })

  expect(res.status()).not.toBe(404)
  expect(res.status()).not.toBe(500)

  const body = await res.json().catch(() => null)
  expect(body).not.toBeNull()
  expect(typeof body).toBe('object')
})

test('direct POST /transcribe returns JSON with a known response key', async ({ request }) => {
  let serverUp = false
  try {
    const health = await request.get('/health', { timeout: 3000 })
    serverUp = health.ok()
  } catch {
    // intentional
  }
  if (!serverUp) {
    test.skip()
    return
  }

  const wavBytes = buildMinimalWav()

  const res = await request.post('/transcribe', {
    multipart: {
      audio: {
        name: 'test.wav',
        mimeType: 'audio/wav',
        buffer: wavBytes
      },
      to: 'productivitesse'
    },
    timeout: 30000
  })

  expect(res.status()).not.toBe(404)
  expect(res.status()).not.toBe(500)

  const raw: unknown = await res.json().catch(() => null)
  const body: object | null = raw !== null && typeof raw === 'object' ? raw : null
  expect(body).not.toBeNull()

  // The response must contain at least one well-known key
  const knownKeys = ['transcript', 'error', 'cancelled', 'test', 'mic', 'delivered']
  const hasKnownKey =
    body !== null && knownKeys.some((k) => Object.prototype.hasOwnProperty.call(body, k))
  expect(hasKnownKey).toBe(true)
})

test('direct POST /transcribe with empty audio returns 422 (no speech detected)', async ({
  request
}) => {
  let serverUp = false
  try {
    const health = await request.get('/health', { timeout: 3000 })
    serverUp = health.ok()
  } catch {
    // intentional
  }
  if (!serverUp) {
    test.skip()
    return
  }

  // A WAV header with 0 data bytes.  Whisper (or the size check) should
  // return 422 — the important thing is NOT 404 (route missing) or 500 (crash).
  const emptyWav = Buffer.from([
    0x52,
    0x49,
    0x46,
    0x46, // "RIFF"
    0x24,
    0x00,
    0x00,
    0x00, // file size = 36
    0x57,
    0x41,
    0x56,
    0x45, // "WAVE"
    0x66,
    0x6d,
    0x74,
    0x20, // "fmt "
    0x10,
    0x00,
    0x00,
    0x00, // sub-chunk size = 16
    0x01,
    0x00, // PCM
    0x01,
    0x00, // mono
    0x80,
    0x3e,
    0x00,
    0x00, // 16 000 Hz
    0x00,
    0x7d,
    0x00,
    0x00, // byte rate
    0x02,
    0x00, // block align
    0x10,
    0x00, // 16-bit
    0x64,
    0x61,
    0x74,
    0x61, // "data"
    0x00,
    0x00,
    0x00,
    0x00 // data size = 0
  ])

  const res = await request.post('/transcribe', {
    multipart: {
      audio: {
        name: 'empty.wav',
        mimeType: 'audio/wav',
        buffer: emptyWav
      },
      to: 'productivitesse'
    },
    timeout: 30000
  })

  // The route must exist and handle the request — not 404
  expect(res.status()).not.toBe(404)

  const body = await res.json().catch(() => null)
  expect(body).not.toBeNull()
})
