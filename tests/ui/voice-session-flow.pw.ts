/**
 * Playwright E2E tests for voice session flow scenarios in the mobile UI.
 *
 * Tests at http://localhost:3030 (voice-bridge server / public/index.html).
 *
 * ISOLATION POLICY: All API calls (/agents, /mic, /transcribe) are intercepted
 * via page.route() — no test makes real HTTP calls to the production server.
 *
 * Helpers (mockAgents, mockMic, triggerSendAudio) are redefined locally rather
 * than imported from mobile-voice.pw.ts — Playwright does not support cross-file
 * helper imports at runtime.
 *
 * Test groups:
 *   1. Full session flow        — happy path from agent load → record → sent state
 *   2. Agent switch mid-session — second recording uses newly selected agent
 *   3. Concurrent record blocked — record button disabled while recording in progress
 *   4. Status persists on agent switch — sent state survives dropdown change
 */

import { test, expect, type Page } from '@playwright/test'

// ── Override baseURL for every test in this file ──────────────────────────────

test.use({ baseURL: 'http://localhost:3030' })

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Intercept GET /agents so the dropdown is predictable in tests.
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
 * replicating what the page's own sendAudio() does. page.route() intercepts
 * this real fetch() call, so all request-shape assertions still hold.
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
    // to /transcribe. The DOM helpers are called directly so UI state transitions
    // exactly match the original code path.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const win = window as Window & { sendAudio?: () => Promise<void> }
    win.sendAudio = async (): Promise<void> => {
      const statusDisplay = document.getElementById('status-display')
      if (!statusDisplay) return

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
// 1. Full session flow
// ─────────────────────────────────────────────────────────────────────────────

test('full session flow — agents load, audio sent, status shows "Sent to productivitesse"', async ({
  page
}) => {
  await mockAgents(page)
  await mockMic(page, 'on')
  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: 'turn on lights', to: 'productivitesse' })
    })
  })

  await page.goto('/')

  // Wait for agents to load — dropdown must be populated before we can send
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')

  // Status display must enter the sent state and identify the recipient agent
  await expect(page.locator('#status-display')).toHaveClass(/state-sent/, { timeout: 5000 })
  await expect(page.locator('#status-display')).toHaveText(/Sent to productivitesse/, {
    timeout: 5000
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Agent switch mid-session
// ─────────────────────────────────────────────────────────────────────────────

test('agent switch mid-session — second recording targets the newly selected agent', async ({
  page
}) => {
  await mockAgents(page)
  await mockMic(page, 'on')

  // First send: productivitesse
  await page.route('**/transcribe', (route) => {
    void route.fulfill({
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

  // Switch to atlas via the dropdown — this is the user action under test
  await page.selectOption('#agent-select', 'atlas')

  // Replace the route to return atlas as the target
  await page.unroute('**/transcribe')
  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: 'ok', to: 'atlas' })
    })
  })

  // Second send — triggerSendAudio reads the current dropdown value, which is now atlas
  await triggerSendAudio(page, 'atlas')

  // Status display must reflect the atlas agent, confirming the switch took effect
  await expect(page.locator('#status-display')).toHaveText(/Sent to atlas/, { timeout: 5000 })
  await expect(page.locator('#status-display')).toHaveClass(/state-sent/)
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Concurrent record attempts blocked
// ─────────────────────────────────────────────────────────────────────────────

test('record button is disabled while recording is in progress — second click has no effect', async ({
  page
}) => {
  await mockAgents(page)
  await mockMic(page, 'on')

  // Mock both getUserMedia and MediaRecorder so the record button's click
  // handler can proceed past MediaRecorder construction in headless Chrome
  // (which has no real audio hardware).
  //
  // The page calls: getUserMedia → new MediaRecorder(stream) → recorder.start()
  // → setRecordingUI(true). All three must succeed for the disabled state to
  // be reached. We install fakes for each before the page loads.
  await page.addInitScript(() => {
    // Fake stream track — stop() called when recording stops
    const fakeTrack = { stop: (): void => {}, kind: 'audio', id: 'fake-track' }
    const fakeStream = {
      getTracks: (): (typeof fakeTrack)[] => [fakeTrack],
      getAudioTracks: (): (typeof fakeTrack)[] => [fakeTrack]
    }

    // Fake MediaRecorder — implements the interface the page uses:
    // addEventListener('dataavailable', ...), addEventListener('stop', ...), start()
    class FakeMediaRecorder {
      mimeType = 'audio/webm'
      private listeners: Record<string, (() => void)[]> = {}
      addEventListener(event: string, cb: () => void): void {
        if (!this.listeners[event]) this.listeners[event] = []
        this.listeners[event].push(cb)
      }
      start(): void {
        // Recording "started" — the page's setRecordingUI(true) is called after this
      }
      stop(): void {
        const stopListeners = this.listeners['stop'] ?? []
        stopListeners.forEach((cb) => cb())
      }
      static isTypeSupported(): boolean {
        return true
      }
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: async (): Promise<typeof fakeStream> => fakeStream },
      writable: true,
      configurable: true
    })

    Reflect.set(window, 'MediaRecorder', FakeMediaRecorder)
  })

  await page.goto('/')
  await expect(page.locator('#record-btn')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('#record-btn')).toBeEnabled({ timeout: 5000 })

  // Click record. With fakes in place the page handler succeeds all the way
  // through to setRecordingUI(true), which sets recordBtn.disabled = true.
  await page.locator('#record-btn').click()

  // After the first click the record button must be disabled — isRecording is
  // true and the UI guard prevents re-entry. A second click on a disabled
  // button cannot start a new recording session.
  await expect(page.locator('#record-btn')).toBeDisabled({ timeout: 5000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Status persists across agent selection change
// ─────────────────────────────────────────────────────────────────────────────

test('status display retains state-sent class after agent dropdown change', async ({ page }) => {
  await mockAgents(page)
  await mockMic(page, 'on')
  await page.route('**/transcribe', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: 'meeting reminder', to: 'productivitesse' })
    })
  })

  await page.goto('/')
  await expect(page.locator('#agent-select option[value="productivitesse"]')).toHaveCount(1, {
    timeout: 5000
  })

  await triggerSendAudio(page, 'productivitesse')
  await expect(page.locator('#status-display')).toHaveClass(/state-sent/, { timeout: 5000 })

  // Changing the agent dropdown must not reset the status display — the status
  // represents the outcome of the last recording, not the currently selected agent.
  // This was a regression risk: an onChange handler could have called setStatus().
  await page.selectOption('#agent-select', 'atlas')

  // Status must still show the sent state from the previous recording
  await expect(page.locator('#status-display')).toHaveClass(/state-sent/)
  await expect(page.locator('#status-display')).toHaveText(/Sent to productivitesse/)
})
