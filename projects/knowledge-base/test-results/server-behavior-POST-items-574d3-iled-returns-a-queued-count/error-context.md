# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: server-behavior.spec.ts >> POST /items/retry-failed returns a queued count
- Location: tests/server-behavior.spec.ts:116:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "number"
Received: "undefined"
```

# Test source

```ts
  20  | 
  21  | test('POST /process rejects missing url field with 400', async ({ request }) => {
  22  |   const res = await request.post(`${BASE}/process`, {
  23  |     data: {},
  24  |     headers: { 'Content-Type': 'application/json' },
  25  |   });
  26  |   expect(res.status()).toBe(400);
  27  | });
  28  | 
  29  | test('POST /process rejects invalid JSON body', async ({ request }) => {
  30  |   const res = await request.post(`${BASE}/process`, {
  31  |     data: 'not json',
  32  |     headers: { 'Content-Type': 'application/json' },
  33  |   });
  34  |   expect(res.status()).toBe(400);
  35  | });
  36  | 
  37  | test('duplicate POST /process returns the same item id', async ({ request }) => {
  38  |   const url = `https://example.com/dup-proc-${Date.now()}`;
  39  |   const first = await enqueue(request, url);
  40  |   const second = await enqueue(request, url);
  41  |   expect(second.id).toBe(first.id);
  42  |   await request.delete(`${BASE}/items/${first.id}`);
  43  | });
  44  | 
  45  | test('POST /process on an already-done URL returns exists status', async ({ request }) => {
  46  |   // Find a real done item so we know its URL is in the DB.
  47  |   const listRes = await request.get(`${BASE}/items`);
  48  |   const items = (await listRes.json()) as Array<{ id: string; url: string; status: string }>;
  49  |   const done = items.find((i) => i.status === 'done');
  50  |   expect(done).toBeTruthy();
  51  | 
  52  |   const res = await request.post(`${BASE}/process`, {
  53  |     data: { url: done!.url },
  54  |     headers: { 'Content-Type': 'application/json' },
  55  |   });
  56  |   expect(res.ok()).toBeTruthy();
  57  |   const body = (await res.json()) as { id: string; status: string };
  58  |   expect(body.id).toBe(done!.id);
  59  |   expect(body.status).toBe('exists');
  60  | });
  61  | 
  62  | test('GET /status/:id returns id, status, title, summary fields', async ({ request }) => {
  63  |   const url = `https://example.com/status-${Date.now()}`;
  64  |   const { id } = await enqueue(request, url);
  65  | 
  66  |   const res = await request.get(`${BASE}/status/${id}`);
  67  |   expect(res.ok()).toBeTruthy();
  68  |   const body = (await res.json()) as { id: string; status: string };
  69  |   expect(body.id).toBe(id);
  70  |   expect(typeof body.status).toBe('string');
  71  |   expect(['queued', 'processing', 'done', 'error']).toContain(body.status);
  72  | 
  73  |   await request.delete(`${BASE}/items/${id}`);
  74  | });
  75  | 
  76  | test('GET /status/:id returns 404 for unknown id', async ({ request }) => {
  77  |   const res = await request.get(`${BASE}/status/does-not-exist-${Date.now()}`);
  78  |   expect(res.status()).toBe(404);
  79  | });
  80  | 
  81  | test('GET /items/:id returns 404 for unknown id', async ({ request }) => {
  82  |   const res = await request.get(`${BASE}/items/not-a-real-id-${Date.now()}`);
  83  |   expect(res.status()).toBe(404);
  84  | });
  85  | 
  86  | test('concurrent POST /process requests for distinct URLs all succeed', async ({ request }) => {
  87  |   const now = Date.now();
  88  |   const urls = [
  89  |     `https://example.com/concurrent-a-${now}`,
  90  |     `https://example.com/concurrent-b-${now}`,
  91  |     `https://example.com/concurrent-c-${now}`,
  92  |   ];
  93  |   const results = await Promise.all(urls.map((u) => enqueue(request, u)));
  94  |   const ids = new Set(results.map((r) => r.id));
  95  |   expect(ids.size).toBe(urls.length);
  96  |   for (const r of results) {
  97  |     expect(typeof r.id).toBe('string');
  98  |     expect(r.id.length).toBeGreaterThan(0);
  99  |   }
  100 |   // Cleanup
  101 |   for (const r of results) await request.delete(`${BASE}/items/${r.id}`);
  102 | });
  103 | 
  104 | test('concurrent POST /process for the same URL returns a single id', async ({ request }) => {
  105 |   const url = `https://example.com/concurrent-same-${Date.now()}`;
  106 |   const results = await Promise.all([
  107 |     enqueue(request, url),
  108 |     enqueue(request, url),
  109 |     enqueue(request, url),
  110 |   ]);
  111 |   const ids = new Set(results.map((r) => r.id));
  112 |   expect(ids.size).toBe(1);
  113 |   await request.delete(`${BASE}/items/${results[0]!.id}`);
  114 | });
  115 | 
  116 | test('POST /items/retry-failed returns a queued count', async ({ request }) => {
  117 |   const res = await request.post(`${BASE}/items/retry-failed`);
  118 |   expect(res.ok()).toBeTruthy();
  119 |   const body = (await res.json()) as { queued: number };
> 120 |   expect(typeof body.queued).toBe('number');
      |                              ^ Error: expect(received).toBe(expected) // Object.is equality
  121 |   expect(body.queued).toBeGreaterThanOrEqual(0);
  122 | });
  123 | 
  124 | test('GET /items/recent?limit=N respects limit cap of 50', async ({ request }) => {
  125 |   const res = await request.get(`${BASE}/items/recent?limit=100`);
  126 |   expect(res.ok()).toBeTruthy();
  127 |   const body = (await res.json()) as unknown[];
  128 |   expect(Array.isArray(body)).toBe(true);
  129 |   expect(body.length).toBeLessThanOrEqual(50);
  130 | });
  131 | 
  132 | test('GET /items/recent?all=1 includes non-done items', async ({ request }) => {
  133 |   // Create a fresh queued item so there is a non-done item to observe.
  134 |   const url = `https://example.com/recent-all-${Date.now()}`;
  135 |   const create = await request.post(`${BASE}/process`, {
  136 |     data: { url },
  137 |     headers: { 'Content-Type': 'application/json' },
  138 |   });
  139 |   const { id } = (await create.json()) as { id: string };
  140 | 
  141 |   const res = await request.get(`${BASE}/items/recent?all=1&limit=50`);
  142 |   expect(res.ok()).toBeTruthy();
  143 |   const body = (await res.json()) as Array<{ id: string }>;
  144 |   expect(Array.isArray(body)).toBe(true);
  145 |   // We can't guarantee the just-created item will appear in the top 50 if
  146 |   // there are already many items, but the response must still be an array.
  147 |   expect(body.length).toBeGreaterThan(0);
  148 | 
  149 |   await request.delete(`${BASE}/items/${id}`);
  150 | });
  151 | 
  152 | test('POST /preview rejects missing url', async ({ request }) => {
  153 |   const res = await request.post(`${BASE}/preview`, {
  154 |     data: {},
  155 |     headers: { 'Content-Type': 'application/json' },
  156 |   });
  157 |   expect(res.status()).toBe(400);
  158 | });
  159 | 
  160 | test('GET /preview rejects invalid url', async ({ request }) => {
  161 |   const res = await request.get(`${BASE}/preview?url=not-a-url`);
  162 |   expect(res.status()).toBe(400);
  163 | });
  164 | 
  165 | test('GET /manifest.json returns manifest shape', async ({ request }) => {
  166 |   const res = await request.get(`${BASE}/manifest.json`);
  167 |   expect(res.ok()).toBeTruthy();
  168 |   const body = (await res.json()) as { name: string; short_name: string; icons: unknown[] };
  169 |   expect(typeof body.name).toBe('string');
  170 |   expect(typeof body.short_name).toBe('string');
  171 |   expect(Array.isArray(body.icons)).toBe(true);
  172 | });
  173 | 
  174 | test('GET /system/status returns whisper/ytdlp/pdftotext booleans', async ({ request }) => {
  175 |   const res = await request.get(`${BASE}/system/status`);
  176 |   expect(res.ok()).toBeTruthy();
  177 |   const body = (await res.json()) as { whisper: boolean; ytdlp: boolean; pdftotext: boolean };
  178 |   expect(typeof body.whisper).toBe('boolean');
  179 |   expect(typeof body.ytdlp).toBe('boolean');
  180 |   expect(typeof body.pdftotext).toBe('boolean');
  181 | });
  182 | 
  183 | test('unknown route returns 404', async ({ request }) => {
  184 |   const res = await request.get(`${BASE}/this/route/does/not/exist`);
  185 |   expect(res.status()).toBe(404);
  186 | });
  187 | 
  188 | test('GET /export/json returns attachment with all items', async ({ request }) => {
  189 |   const res = await request.get(`${BASE}/export/json`);
  190 |   expect(res.ok()).toBeTruthy();
  191 |   expect(res.headers()['content-type']).toContain('application/json');
  192 |   const body = (await res.json()) as unknown[];
  193 |   expect(Array.isArray(body)).toBe(true);
  194 | });
  195 | 
  196 | test('GET /export/markdown returns markdown attachment', async ({ request }) => {
  197 |   const res = await request.get(`${BASE}/export/markdown`);
  198 |   expect(res.ok()).toBeTruthy();
  199 |   expect(res.headers()['content-type']).toContain('text/markdown');
  200 | });
  201 | 
  202 | test('GET /digest returns markdown with highlights heading', async ({ request }) => {
  203 |   const res = await request.get(`${BASE}/digest?days=7&format=text`);
  204 |   expect(res.ok()).toBeTruthy();
  205 |   const body = await res.text();
  206 |   expect(body).toContain('Knowledge Digest');
  207 |   expect(body).toContain("Week's Highlights");
  208 | });
  209 | 
```