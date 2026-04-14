import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');

// Regression test for CEO bug: the custom #resize-handle drag in the popup
// does nothing. Dragging the handle MUST grow both #app-root AND
// document.documentElement, because Chrome popup windows only grow when
// documentElement grows.
test('resize handle drag increases app-root width', async ({ page }) => {
  const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');

  await page.addInitScript(() => {
    // Pre-seed a small starting size so the drag has room to grow.
    const store: Record<string, unknown> = { popupWidth: 500, popupHeight: 550 };
    (window as any).chrome = {
      storage: {
        local: {
          get: (keys: unknown, cb: (v: Record<string, unknown>) => void) => {
            const out: Record<string, unknown> = {};
            const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(store);
            for (const k of list) out[k as string] = store[k as string];
            cb(out);
          },
          set: (v: Record<string, unknown>, cb?: () => void) => {
            Object.assign(store, v);
            cb && cb();
          },
        },
      },
      tabs: {
        query: async () => [{ url: 'https://example.com' }],
        create: (_: unknown) => {},
      },
    };
  });

  const rewritten = popupHtml
    .replace(
      '<script src="raise-form.js"></script>',
      `<script>${readFileSync(resolve(EXT_DIR, 'raise-form.js'), 'utf8')}</script>`,
    )
    .replace(
      '<script src="popup.js"></script>',
      `<script>${readFileSync(resolve(EXT_DIR, 'popup.js'), 'utf8')}</script>`,
    );

  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

  // Viewport larger than POPUP_MAX so we can observe the resize grow freely.
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('http://127.0.0.1:3737/health');
  await page.setContent(rewritten, { waitUntil: 'load' });

  const appRoot = page.locator('#app-root');
  await expect(appRoot).toBeVisible({ timeout: 5000 });

  // Wait for initPopupSize() to have applied the default/persisted size.
  await page.waitForFunction(() => {
    const el = document.getElementById('app-root');
    return !!el && el.style.width && el.style.width !== '';
  });

  // Reproduce the real extension popup condition: scroll #app-root's content
  // to the bottom. With position:absolute inside an overflow:auto container,
  // the handle is positioned relative to the padding box but scrolls with
  // content, meaning it's NOT at a stable screen location. The CEO sees this
  // as "the drag handle doesn't work" because clicking where the handle
  // appears to be (bottom-right of the visible area) misses it entirely.
  await page.evaluate(() => {
    const el = document.getElementById('app-root')!;
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(100);

  const before = await page.evaluate(() => {
    const el = document.getElementById('app-root')!;
    return {
      appW: el.getBoundingClientRect().width,
      htmlW: document.documentElement.getBoundingClientRect().width,
    };
  });

  // Locate the handle by its real bounding box. Because it's position:fixed,
  // it must be at the viewport bottom-right — the CEO can always see it and
  // click it.
  const handle = page.locator('#resize-handle');
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  if (!box) throw new Error('resize-handle has no bounding box');

  const vp = page.viewportSize()!;
  // Regression pin: handle must live at the viewport bottom-right, not
  // somewhere inside a scrolled overflow container.
  expect(box.x + box.width).toBeGreaterThan(vp.width - 4);
  expect(box.y + box.height).toBeGreaterThan(vp.height - 4);

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // Dispatch synthetic mouse events directly. Using Playwright's mouse API
  // clamps to viewport; we want to drag "past" the current appRoot size to
  // prove the handler grows it. Events must match what the handler expects
  // (mousedown on the handle, mousemove/mouseup on document).
  await page.evaluate(
    ({ x, y }) => {
      const handleEl = document.getElementById('resize-handle')!;
      const fire = (target: EventTarget, type: string, cx: number, cy: number) => {
        const ev = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: cx,
          clientY: cy,
          button: 0,
        });
        target.dispatchEvent(ev);
      };
      fire(handleEl, 'mousedown', x, y);
      fire(document, 'mousemove', x + 60, y + 40);
      fire(document, 'mousemove', x + 120, y + 80);
      fire(document, 'mouseup', x + 120, y + 80);
    },
    { x: startX, y: startY },
  );

  const after = await page.evaluate(() => {
    const el = document.getElementById('app-root')!;
    return {
      appW: el.getBoundingClientRect().width,
      htmlW: document.documentElement.getBoundingClientRect().width,
    };
  });

  if (after.appW <= before.appW) {
    console.log('POPUP CONSOLE OUTPUT:');
    for (const l of logs) console.log(l);
    console.log('before', before, 'after', after);
  }

  expect(after.appW).toBeGreaterThan(before.appW);
  expect(after.htmlW).toBeGreaterThan(before.htmlW);
});
