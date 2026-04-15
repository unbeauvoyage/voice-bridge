# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api-tags.spec.ts >> DELETE /tags/:tag removes tag from approved list
- Location: tests/api-tags.spec.ts:33:1

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
  5  | test('GET /tags/rejections returns expected shape', async ({ request }) => {
  6  |   // Seed one rejection so we can assert shape
  7  |   const tag = `reject-shape-${Date.now()}`;
  8  |   await request.post(`${BASE}/tags/reject`, {
  9  |     data: { tag, reason: 'shape test' },
  10 |     headers: { 'Content-Type': 'application/json' },
  11 |   });
  12 | 
  13 |   const res = await request.get(`${BASE}/tags/rejections`);
  14 |   expect(res.ok()).toBeTruthy();
  15 |   const body = await res.json();
  16 |   expect(Array.isArray(body)).toBe(true);
  17 |   const match = (body as Array<Record<string, unknown>>).find((r) => r.tag === tag);
  18 |   expect(match).toBeDefined();
  19 |   expect(typeof match!.id).toBe('string');
  20 |   expect(match!.tag).toBe(tag);
  21 |   expect(typeof match!.reason).toBe('string');
  22 |   expect(typeof match!.createdAt).toBe('string');
  23 | });
  24 | 
  25 | test('GET /tag-rules returns rules string', async ({ request }) => {
  26 |   const res = await request.get(`${BASE}/tag-rules`);
  27 |   expect(res.ok()).toBeTruthy();
  28 |   const body = await res.json();
  29 |   expect(body).toHaveProperty('rules');
  30 |   expect(typeof body.rules).toBe('string');
  31 | });
  32 | 
  33 | test('DELETE /tags/:tag removes tag from approved list', async ({ request }) => {
  34 |   const tag = `delete-me-tag-${Date.now()}`;
  35 | 
  36 |   // Approve it first so it appears in approved list
  37 |   const approveRes = await request.post(`${BASE}/tags/approve`, {
  38 |     data: { tag },
  39 |     headers: { 'Content-Type': 'application/json' },
  40 |   });
  41 |   expect(approveRes.ok()).toBeTruthy();
  42 | 
  43 |   const before = await (await request.get(`${BASE}/tags`)).json();
  44 |   expect((before.approved as string[]).includes(tag)).toBe(true);
  45 | 
  46 |   const delRes = await request.delete(`${BASE}/tags/${encodeURIComponent(tag)}`);
> 47 |   expect(delRes.ok()).toBeTruthy();
     |                       ^ Error: expect(received).toBeTruthy()
  48 | 
  49 |   const after = await (await request.get(`${BASE}/tags`)).json();
  50 |   expect((after.approved as string[]).includes(tag)).toBe(false);
  51 | });
  52 | 
```