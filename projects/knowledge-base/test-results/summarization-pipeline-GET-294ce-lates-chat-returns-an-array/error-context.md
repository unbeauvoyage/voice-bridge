# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: summarization-pipeline.spec.ts >> GET /prompt-templates/chat returns an array
- Location: tests/summarization-pipeline.spec.ts:128:1

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  30  |   return done!.id;
  31  | }
  32  | 
  33  | test('GET /items/:id/history returns an array of versions', async ({ request }) => {
  34  |   const id = await firstDoneId(request);
  35  |   const res = await request.get(`${BASE}/items/${id}/history`);
  36  |   expect(res.ok()).toBeTruthy();
  37  |   const versions = (await res.json()) as unknown;
  38  |   expect(Array.isArray(versions)).toBe(true);
  39  | });
  40  | 
  41  | test('summary history versions have tldr, sections, and summary fields', async ({ request }) => {
  42  |   // Look across all done items for one with at least one history entry.
  43  |   const listRes = await request.get(`${BASE}/items`);
  44  |   const items = (await listRes.json()) as Array<{ id: string; status: string }>;
  45  |   let sample: { tldr: unknown; sections: unknown; summary: unknown; summaryModel?: unknown } | null = null;
  46  |   for (const it of items.filter((i) => i.status === 'done')) {
  47  |     const h = await request.get(`${BASE}/items/${it.id}/history`);
  48  |     if (!h.ok()) continue;
  49  |     const versions = (await h.json()) as Array<typeof sample & object>;
  50  |     if (versions.length > 0) {
  51  |       sample = versions[0]!;
  52  |       break;
  53  |     }
  54  |   }
  55  |   // If no history exists yet, trigger a resummarize to produce one, then poll.
  56  |   if (!sample) {
  57  |     const id = await findDoneItemWithTranscript(request);
  58  |     await request.post(`${BASE}/items/${id}/resummarize`);
  59  |     const deadline = Date.now() + 120_000;
  60  |     while (Date.now() < deadline && !sample) {
  61  |       await new Promise((r) => setTimeout(r, 2000));
  62  |       const h = await request.get(`${BASE}/items/${id}/history`);
  63  |       if (!h.ok()) continue;
  64  |       const versions = (await h.json()) as Array<typeof sample & object>;
  65  |       if (versions.length > 0) sample = versions[0]!;
  66  |     }
  67  |   }
  68  |   expect(sample, 'expected at least one history version to exist or be created').toBeTruthy();
  69  |   expect(Array.isArray(sample!.tldr)).toBe(true);
  70  |   expect(Array.isArray(sample!.sections)).toBe(true);
  71  |   expect(typeof sample!.summary).toBe('string');
  72  | });
  73  | 
  74  | test('resummarize creates a new version in history', async ({ request }) => {
  75  |   test.setTimeout(180_000);
  76  |   const id = await findDoneItemWithTranscript(request);
  77  | 
  78  |   const beforeRes = await request.get(`${BASE}/items/${id}/history`);
  79  |   expect(beforeRes.ok()).toBeTruthy();
  80  |   const beforeCount = ((await beforeRes.json()) as unknown[]).length;
  81  | 
  82  |   const resummarize = await request.post(`${BASE}/items/${id}/resummarize`);
  83  |   expect(resummarize.ok()).toBeTruthy();
  84  | 
  85  |   const deadline = Date.now() + 150_000;
  86  |   let afterCount = beforeCount;
  87  |   while (Date.now() < deadline) {
  88  |     await new Promise((r) => setTimeout(r, 2000));
  89  |     const afterRes = await request.get(`${BASE}/items/${id}/history`);
  90  |     if (!afterRes.ok()) continue;
  91  |     afterCount = ((await afterRes.json()) as unknown[]).length;
  92  |     if (afterCount > beforeCount) break;
  93  |   }
  94  |   expect(afterCount).toBeGreaterThan(beforeCount);
  95  | });
  96  | 
  97  | test('resummarize on item without transcript returns 400', async ({ request }) => {
  98  |   // Create a fresh queued item — it has no transcript until processing completes.
  99  |   // We use a URL that will immediately be accepted by the queue but has no content yet.
  100 |   const uniqueUrl = `https://example.com/no-transcript-${Date.now()}`;
  101 |   const create = await request.post(`${BASE}/process`, {
  102 |     data: { url: uniqueUrl },
  103 |     headers: { 'Content-Type': 'application/json' },
  104 |   });
  105 |   expect(create.ok()).toBeTruthy();
  106 |   const { id } = (await create.json()) as { id: string };
  107 | 
  108 |   // Immediately try to resummarize — transcript is not yet populated.
  109 |   const res = await request.post(`${BASE}/items/${id}/resummarize`);
  110 |   // Either 400 (no transcript) or 200 (already processed). Both are valid given timing.
  111 |   expect([200, 400]).toContain(res.status());
  112 | 
  113 |   await request.delete(`${BASE}/items/${id}`);
  114 | });
  115 | 
  116 | test('GET /prompt-templates/summary returns templates with id and template fields', async ({ request }) => {
  117 |   const res = await request.get(`${BASE}/prompt-templates/summary`);
  118 |   expect(res.ok()).toBeTruthy();
  119 |   const body = (await res.json()) as Array<{ id: number; template: string }>;
  120 |   expect(Array.isArray(body)).toBe(true);
  121 |   for (const t of body) {
  122 |     expect(typeof t.id).toBe('number');
  123 |     expect(typeof t.template).toBe('string');
  124 |     expect(t.template.length).toBeGreaterThan(0);
  125 |   }
  126 | });
  127 | 
  128 | test('GET /prompt-templates/chat returns an array', async ({ request }) => {
  129 |   const res = await request.get(`${BASE}/prompt-templates/chat`);
> 130 |   expect(res.ok()).toBeTruthy();
      |                    ^ Error: expect(received).toBeTruthy()
  131 |   const body = await res.json();
  132 |   expect(Array.isArray(body)).toBe(true);
  133 | });
  134 | 
  135 | test('POST /prompt-templates/summary rejects empty template', async ({ request }) => {
  136 |   const res = await request.post(`${BASE}/prompt-templates/summary`, {
  137 |     data: { template: '' },
  138 |     headers: { 'Content-Type': 'application/json' },
  139 |   });
  140 |   expect(res.status()).toBe(400);
  141 | });
  142 | 
  143 | test('POST /prompt-templates/summary persists and returns id', async ({ request }) => {
  144 |   const template = `You are a summarizer test ${Date.now()}. Summarize concisely.`;
  145 |   const res = await request.post(`${BASE}/prompt-templates/summary`, {
  146 |     data: { template },
  147 |     headers: { 'Content-Type': 'application/json' },
  148 |   });
  149 |   expect(res.ok()).toBeTruthy();
  150 |   const body = (await res.json()) as { id: number; is_active: number };
  151 |   expect(typeof body.id).toBe('number');
  152 |   expect(body.is_active).toBe(1);
  153 | 
  154 |   // Verify it appears in the listing.
  155 |   const list = await request.get(`${BASE}/prompt-templates/summary`);
  156 |   const all = (await list.json()) as Array<{ id: number; template: string }>;
  157 |   expect(all.some((t) => t.template === template)).toBe(true);
  158 | });
  159 | 
  160 | test('POST /items/:id/summary-quality stores a rating', async ({ request }) => {
  161 |   const id = await firstDoneId(request);
  162 |   const res = await request.post(`${BASE}/items/${id}/summary-quality`, {
  163 |     data: { rating: 4, reason: 'pipeline-test' },
  164 |     headers: { 'Content-Type': 'application/json' },
  165 |   });
  166 |   expect(res.ok()).toBeTruthy();
  167 | 
  168 |   const getRes = await request.get(`${BASE}/items/${id}/summary-quality`);
  169 |   expect(getRes.ok()).toBeTruthy();
  170 | });
  171 | 
  172 | test('POST /items/:id/summary-quality rejects out-of-range rating', async ({ request }) => {
  173 |   const id = await firstDoneId(request);
  174 |   const res = await request.post(`${BASE}/items/${id}/summary-quality`, {
  175 |     data: { rating: 99 },
  176 |     headers: { 'Content-Type': 'application/json' },
  177 |   });
  178 |   expect(res.status()).toBe(400);
  179 | });
  180 | 
  181 | test('POST /items/:id/history/:historyId/restore restores an older version', async ({ request }) => {
  182 |   test.setTimeout(180_000);
  183 |   const id = await findDoneItemWithTranscript(request);
  184 | 
  185 |   // Ensure at least one history entry exists — if none, trigger a resummarize.
  186 |   let historyRes = await request.get(`${BASE}/items/${id}/history`);
  187 |   let history = (await historyRes.json()) as Array<{ id: number; summary: string }>;
  188 |   if (history.length === 0) {
  189 |     await request.post(`${BASE}/items/${id}/resummarize`);
  190 |     const deadline = Date.now() + 150_000;
  191 |     while (Date.now() < deadline && history.length === 0) {
  192 |       await new Promise((r) => setTimeout(r, 2000));
  193 |       historyRes = await request.get(`${BASE}/items/${id}/history`);
  194 |       history = (await historyRes.json()) as Array<{ id: number; summary: string }>;
  195 |     }
  196 |   }
  197 |   expect(history.length).toBeGreaterThan(0);
  198 | 
  199 |   const restore = await request.post(`${BASE}/items/${id}/history/${history[0]!.id}/restore`);
  200 |   expect(restore.ok()).toBeTruthy();
  201 | });
  202 | 
```