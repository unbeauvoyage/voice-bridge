// Builds the inline "Raise to Consideration" form and wires its interactions.
// Exposed on window so both popup.js and the Playwright test can load it.
//
// createRaiseForm(itemEl, opts) -> HTMLDivElement
//   opts.mode        — 'create' (default) or 'edit'
//   opts.initialNote — string to pre-fill the textarea (used in edit mode)
//   opts.onSubmit    — create-mode: async (note) => void
//   opts.onUpdate    — edit-mode:   async (note) => void
//   opts.onUnraise   — edit-mode:   async () => void  (also shows Unraise link)
//   opts.onCancel    — () => void
//
// The form stops mouse/keyboard events from bubbling out so nothing in the
// surrounding popup can steal focus from the textarea.
(function (global) {
  function createRaiseForm(itemEl, opts = {}) {
    const { mode = 'create', initialNote = '', onSubmit, onUpdate, onUnraise, onCancel } = opts;

    // Toggle: if a form already follows this item, close it and bail.
    const existing = itemEl.nextElementSibling;
    if (existing && existing.classList && existing.classList.contains('raise-form')) {
      existing.remove();
      if (onCancel) onCancel();
      return null;
    }
    // Close any other open raise-forms in the document.
    const all = itemEl.ownerDocument.querySelectorAll('.raise-form');
    all.forEach((el) => el.remove());

    const isEdit = mode === 'edit';
    const submitLabel = isEdit ? 'Update' : 'Raise';
    const workingLabel = isEdit ? 'Updating…' : 'Raising…';

    const doc = itemEl.ownerDocument;
    const form = doc.createElement('div');
    form.className = 'raise-form';
    const parts = [
      '<textarea class="raise-note" placeholder="Why are you raising this? (optional)" rows="2"></textarea>',
      '<div class="raise-form-actions">',
      `  <button type="button" class="raise-submit">${submitLabel}</button>`,
      '  <a href="#" class="raise-cancel">Cancel</a>',
    ];
    if (isEdit) {
      parts.push('  <a href="#" class="raise-unraise">Unraise</a>');
    }
    parts.push('</div>');
    form.innerHTML = parts.join('\n');

    // Prevent clicks or keystrokes inside the form from bubbling to item-level
    // handlers (which would otherwise steal focus / open the reader / toggle).
    form.addEventListener('click', (e) => e.stopPropagation());
    form.addEventListener('mousedown', (e) => e.stopPropagation());
    form.addEventListener('keydown', (e) => e.stopPropagation());

    itemEl.insertAdjacentElement('afterend', form);

    const textarea = form.querySelector('.raise-note');
    if (initialNote) textarea.value = initialNote;
    // Focus after the current event loop tick so the click that opened the
    // form doesn't immediately re-focus the button.
    setTimeout(() => {
      textarea.focus();
      // Place caret at end for edit mode.
      const len = textarea.value.length;
      try { textarea.setSelectionRange(len, len); } catch {}
    }, 0);

    const cancelLink = form.querySelector('.raise-cancel');
    cancelLink.addEventListener('click', (ev) => {
      ev.preventDefault();
      form.remove();
      if (onCancel) onCancel();
    });

    const submitBtn = form.querySelector('.raise-submit');
    submitBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      submitBtn.textContent = workingLabel;
      try {
        const handler = isEdit ? onUpdate : onSubmit;
        if (handler) await handler(textarea.value || '');
        form.remove();
      } catch {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      }
    });

    if (isEdit) {
      const unraiseLink = form.querySelector('.raise-unraise');
      unraiseLink.addEventListener('click', async (ev) => {
        ev.preventDefault();
        if (unraiseLink.classList.contains('working')) return;
        unraiseLink.classList.add('working');
        unraiseLink.textContent = 'Unraising…';
        try {
          if (onUnraise) await onUnraise();
          form.remove();
        } catch {
          unraiseLink.classList.remove('working');
          unraiseLink.textContent = 'Unraise';
        }
      });
    }

    return form;
  }

  global.createRaiseForm = createRaiseForm;
})(typeof window !== 'undefined' ? window : globalThis);
