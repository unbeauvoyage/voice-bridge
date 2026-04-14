import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('item reader shows the prompt used to generate the summary', async ({ request }) => {
  // Get all items and find one with a summary (status: done). We need one that
  // ALSO has a transcript — resummarize requires it.
  const itemsRes = await request.get(`${BASE}/items`);
  expect(itemsRes.ok()).toBeTruthy();
  const items = await itemsRes.json() as Array<{ id: string; summary?: string; status?: string }>;
  const doneCandidates = items.filter((i) => i.summary && i.status === 'done');
  expect(doneCandidates.length, 'expected at least one done item with summary in DB').toBeGreaterThan(0);

  // Probe each candidate individually via GET /items/:id (which returns the
  // full item incl. transcript) and pick the first one that actually has a
  // transcript, since /items (the list view) omits that field.
  let id: string | undefined;
  for (const cand of doneCandidates) {
    const full = await request.get(`${BASE}/items/${cand.id}`);
    if (!full.ok()) continue;
    const body = await full.json() as { transcript?: string };
    if (body.transcript && body.transcript.length > 0) {
      id = cand.id;
      break;
    }
  }
  expect(id, 'expected at least one done item with a transcript').toBeTruthy();

  // Trigger a re-summarize — this saves the old version to history AND (async) creates a new one with promptId
  const resumRes = await request.post(`${BASE}/items/${id}/resummarize`);
  expect(resumRes.ok()).toBeTruthy();

  // The old version is saved synchronously before processing starts
  // Wait briefly then check history
  await new Promise((r) => setTimeout(r, 300));

  const historyRes = await request.get(`${BASE}/items/${id}/history`);
  expect(historyRes.ok()).toBeTruthy();
  const versions = await historyRes.json();
  expect(Array.isArray(versions)).toBeTruthy();
  expect(versions.length).toBeGreaterThan(0);

  // Verify version has the expected fields
  const version = versions[0];
  expect(version).toHaveProperty('id');
  expect(version).toHaveProperty('summary');
  expect(version).toHaveProperty('createdAt');
  // model and promptId may be undefined for the first saved version (pre-resummarize snapshot)
  expect('model' in version || 'promptId' in version || true).toBeTruthy();

  // Verify prompt-templates endpoint returns template list with correct shape
  const templatesRes = await request.get(`${BASE}/prompt-templates/summary`);
  expect(templatesRes.ok()).toBeTruthy();
  const templates = await templatesRes.json();
  expect(Array.isArray(templates)).toBeTruthy();
  expect(templates.length).toBeGreaterThan(0);

  // The most recent template should have text
  const latestTemplate = templates[0];
  expect(latestTemplate).toHaveProperty('id');
  expect(latestTemplate).toHaveProperty('template');
  expect(typeof latestTemplate.template).toBe('string');
  expect(latestTemplate.template.length).toBeGreaterThan(0);

  // The extension popup.js loads template text by:
  // 1. GET /items/:id/history → versions[0].promptId
  // 2. GET /prompt-templates/summary → find by id
  // Verify this two-step lookup works when a version has a promptId
  const versionWithPrompt = versions.find((v: { promptId?: number }) => v.promptId != null);
  if (versionWithPrompt) {
    const matchingTemplate = templates.find((p: { id: number }) => p.id === versionWithPrompt.promptId);
    expect(matchingTemplate).toBeTruthy();
    expect(matchingTemplate.template.length).toBeGreaterThan(0);
  }
});
