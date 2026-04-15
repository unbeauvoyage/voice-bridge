# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extension-parity.spec.ts >> item reader shows the prompt used to generate the summary
- Location: tests/extension-parity.spec.ts:5:1

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const BASE = 'http://127.0.0.1:3737';
  4  | 
  5  | test('item reader shows the prompt used to generate the summary', async ({ request }) => {
  6  |   // Get all items and find one with a summary (status: done). We need one that
  7  |   // ALSO has a transcript — resummarize requires it.
  8  |   const itemsRes = await request.get(`${BASE}/items`);
  9  |   expect(itemsRes.ok()).toBeTruthy();
  10 |   const items = await itemsRes.json() as Array<{ id: string; summary?: string; status?: string }>;
  11 |   const doneCandidates = items.filter((i) => i.summary && i.status === 'done');
  12 |   expect(doneCandidates.length, 'expected at least one done item with summary in DB').toBeGreaterThan(0);
  13 | 
  14 |   // Probe each candidate individually via GET /items/:id (which returns the
  15 |   // full item incl. transcript) and pick the first one that actually has a
  16 |   // transcript, since /items (the list view) omits that field.
  17 |   let id: string | undefined;
  18 |   for (const cand of doneCandidates) {
  19 |     const full = await request.get(`${BASE}/items/${cand.id}`);
  20 |     if (!full.ok()) continue;
  21 |     const body = await full.json() as { transcript?: string };
  22 |     if (body.transcript && body.transcript.length > 0) {
  23 |       id = cand.id;
  24 |       break;
  25 |     }
  26 |   }
  27 |   expect(id, 'expected at least one done item with a transcript').toBeTruthy();
  28 | 
  29 |   // Trigger a re-summarize — this saves the old version to history AND (async) creates a new one with promptId
  30 |   const resumRes = await request.post(`${BASE}/items/${id}/resummarize`);
  31 |   expect(resumRes.ok()).toBeTruthy();
  32 | 
  33 |   // The old version is saved synchronously before processing starts
  34 |   // Wait briefly then check history
  35 |   await new Promise((r) => setTimeout(r, 300));
  36 | 
  37 |   const historyRes = await request.get(`${BASE}/items/${id}/history`);
  38 |   expect(historyRes.ok()).toBeTruthy();
  39 |   const versions = await historyRes.json();
  40 |   expect(Array.isArray(versions)).toBeTruthy();
  41 |   expect(versions.length).toBeGreaterThan(0);
  42 | 
  43 |   // Verify version has the expected fields
  44 |   const version = versions[0];
  45 |   expect(version).toHaveProperty('id');
  46 |   expect(version).toHaveProperty('summary');
  47 |   expect(version).toHaveProperty('createdAt');
  48 |   // model and promptId may be undefined for the first saved version (pre-resummarize snapshot)
  49 |   expect('model' in version || 'promptId' in version || true).toBeTruthy();
  50 | 
  51 |   // Verify prompt-templates endpoint returns template list with correct shape
  52 |   const templatesRes = await request.get(`${BASE}/prompt-templates/summary`);
> 53 |   expect(templatesRes.ok()).toBeTruthy();
     |                             ^ Error: expect(received).toBeTruthy()
  54 |   const templates = await templatesRes.json();
  55 |   expect(Array.isArray(templates)).toBeTruthy();
  56 |   expect(templates.length).toBeGreaterThan(0);
  57 | 
  58 |   // The most recent template should have text
  59 |   const latestTemplate = templates[0];
  60 |   expect(latestTemplate).toHaveProperty('id');
  61 |   expect(latestTemplate).toHaveProperty('template');
  62 |   expect(typeof latestTemplate.template).toBe('string');
  63 |   expect(latestTemplate.template.length).toBeGreaterThan(0);
  64 | 
  65 |   // The extension popup.js loads template text by:
  66 |   // 1. GET /items/:id/history → versions[0].promptId
  67 |   // 2. GET /prompt-templates/summary → find by id
  68 |   // Verify this two-step lookup works when a version has a promptId
  69 |   const versionWithPrompt = versions.find((v: { promptId?: number }) => v.promptId != null);
  70 |   if (versionWithPrompt) {
  71 |     const matchingTemplate = templates.find((p: { id: number }) => p.id === versionWithPrompt.promptId);
  72 |     expect(matchingTemplate).toBeTruthy();
  73 |     expect(matchingTemplate.template.length).toBeGreaterThan(0);
  74 |   }
  75 | });
  76 | 
```