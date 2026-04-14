import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Loads extension/raise-form.js into a blank page and exercises the inline
// raise form. This is a pure-DOM unit test — no server or chrome APIs involved.
// It guards against regressions where the textarea isn't focusable, clicks
// bubble out of the form, or the submit callback never receives the note.

const RAISE_FORM_JS = readFileSync(
  resolve(__dirname, '..', 'extension', 'raise-form.js'),
  'utf8',
);

async function mountRaiseFormSandbox(page: import('@playwright/test').Page) {
  await page.setContent(`
    <!doctype html>
    <html>
    <body>
      <div id="items-list">
        <div class="item" data-id="alpha">
          <button class="raise-btn" data-id="alpha">🚩</button>
        </div>
        <div class="item" data-id="beta">
          <button class="raise-btn" data-id="beta">🚩</button>
        </div>
      </div>
      <script>${RAISE_FORM_JS}</script>
    </body>
    </html>
  `);
}

test('raise form textarea accepts typed notes and submits them', async ({ page }) => {
  await mountRaiseFormSandbox(page);

  // Open the form for item alpha. The onSubmit handler writes the received
  // note to window.__lastNote so the test can assert on it afterwards.
  await page.evaluate(() => {
    (window as any).__lastNote = null;
    const itemEl = document.querySelector('.item[data-id="alpha"]') as HTMLElement;
    (window as any).createRaiseForm(itemEl, {
      onSubmit: async (note: string) => {
        (window as any).__lastNote = note;
      },
    });
  });

  // Form should be visible, following the alpha item.
  const form = page.locator('.raise-form');
  await expect(form).toHaveCount(1);
  await expect(form).toBeVisible();

  const textarea = form.locator('.raise-note');
  await expect(textarea).toBeFocused();

  // Type a note — this is the regression: textarea must accept input.
  const note = 'This is the CEO note — why I care about this item.';
  await textarea.fill(note);
  await expect(textarea).toHaveValue(note);

  // Click Raise — onSubmit fires with the note, form is removed.
  await form.locator('.raise-submit').click();
  await expect(form).toHaveCount(0);

  const received = await page.evaluate(() => (window as any).__lastNote);
  expect(received).toBe(note);
});

test('raise form toggles closed when the same item button is re-clicked', async ({ page }) => {
  await mountRaiseFormSandbox(page);

  // Open for alpha.
  await page.evaluate(() => {
    const itemEl = document.querySelector('.item[data-id="alpha"]') as HTMLElement;
    (window as any).createRaiseForm(itemEl, { onSubmit: async () => {} });
  });
  await expect(page.locator('.raise-form')).toHaveCount(1);

  // "Re-click" the same button — the builder sees an existing form and closes it.
  await page.evaluate(() => {
    const itemEl = document.querySelector('.item[data-id="alpha"]') as HTMLElement;
    (window as any).createRaiseForm(itemEl, { onSubmit: async () => {} });
  });
  await expect(page.locator('.raise-form')).toHaveCount(0);
});

test('raise form reopens in edit mode with existing note pre-filled and Update button', async ({ page }) => {
  await mountRaiseFormSandbox(page);

  const existingNote = 'Previously raised because of X';
  await page.evaluate((note) => {
    const itemEl = document.querySelector('.item[data-id="alpha"]') as HTMLElement;
    (window as any).createRaiseForm(itemEl, {
      mode: 'edit',
      initialNote: note,
      onUpdate: async (newNote: string) => {
        (window as any).__updatedNote = newNote;
      },
      onUnraise: async () => {},
    });
  }, existingNote);

  const form = page.locator('.raise-form');
  await expect(form).toHaveCount(1);
  const textarea = form.locator('.raise-note');
  await expect(textarea).toHaveValue(existingNote);
  // Submit button should read "Update" in edit mode
  await expect(form.locator('.raise-submit')).toHaveText(/update/i);
  // An unraise link should be present
  await expect(form.locator('.raise-unraise')).toBeVisible();
});

test('editing a raised note calls onUpdate with the new text', async ({ page }) => {
  await mountRaiseFormSandbox(page);

  await page.evaluate(() => {
    (window as any).__updatedNote = null;
    const itemEl = document.querySelector('.item[data-id="alpha"]') as HTMLElement;
    (window as any).createRaiseForm(itemEl, {
      mode: 'edit',
      initialNote: 'old',
      onUpdate: async (note: string) => { (window as any).__updatedNote = note; },
      onUnraise: async () => {},
    });
  });

  const form = page.locator('.raise-form');
  const textarea = form.locator('.raise-note');
  await textarea.fill('a much better reason');
  await form.locator('.raise-submit').click();
  await expect(form).toHaveCount(0);

  const received = await page.evaluate(() => (window as any).__updatedNote);
  expect(received).toBe('a much better reason');
});

test('unraise link in edit-mode raise form calls onUnraise and closes the form', async ({ page }) => {
  await mountRaiseFormSandbox(page);

  await page.evaluate(() => {
    (window as any).__unraised = false;
    const itemEl = document.querySelector('.item[data-id="alpha"]') as HTMLElement;
    (window as any).createRaiseForm(itemEl, {
      mode: 'edit',
      initialNote: 'something',
      onUpdate: async () => {},
      onUnraise: async () => { (window as any).__unraised = true; },
    });
  });

  const form = page.locator('.raise-form');
  await form.locator('.raise-unraise').click();
  await expect(form).toHaveCount(0);

  const unraised = await page.evaluate(() => (window as any).__unraised);
  expect(unraised).toBe(true);
});

test('opening raise form for a second item closes the first', async ({ page }) => {
  await mountRaiseFormSandbox(page);

  await page.evaluate(() => {
    const alpha = document.querySelector('.item[data-id="alpha"]') as HTMLElement;
    (window as any).createRaiseForm(alpha, { onSubmit: async () => {} });
  });
  await expect(page.locator('.raise-form')).toHaveCount(1);

  await page.evaluate(() => {
    const beta = document.querySelector('.item[data-id="beta"]') as HTMLElement;
    (window as any).createRaiseForm(beta, { onSubmit: async () => {} });
  });

  const forms = page.locator('.raise-form');
  await expect(forms).toHaveCount(1);
  // The surviving form should be the one following beta.
  const followsBeta = await page.evaluate(() => {
    const beta = document.querySelector('.item[data-id="beta"]') as HTMLElement;
    return beta.nextElementSibling?.classList.contains('raise-form') === true;
  });
  expect(followsBeta).toBe(true);
});
