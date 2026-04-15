const SERVER = 'http://127.0.0.1:3737';

let currentUrl = '';
// tag status cache: tag name -> 'pending' | 'approved' | 'rejected'
let tagStatusMap = {};
let searchDebounce = null;

// ── Font size control ─────────────────────────────────────────────────────────

const FONT_SIZE_STEPS = [12, 13, 14, 15, 16, 17, 18, 20];
const FONT_SIZE_DEFAULT = 15;
const FONT_SIZE_KEY = 'fontSizePreference';

function applyFontSize(px) {
  document.documentElement.style.setProperty('--font-size', `${px}px`);
  const label = document.getElementById('font-size-label');
  if (label) label.textContent = `${px}px`;
}

function loadFontSizePreference() {
  chrome.storage.local.get([FONT_SIZE_KEY], (result) => {
    const saved = result[FONT_SIZE_KEY];
    const px = FONT_SIZE_STEPS.includes(saved) ? saved : FONT_SIZE_DEFAULT;
    applyFontSize(px);
  });
}

function saveFontSizePreference(px) {
  chrome.storage.local.set({ [FONT_SIZE_KEY]: px });
}

function getCurrentFontSize() {
  const style = document.documentElement.style.getPropertyValue('--font-size');
  return parseInt(style, 10) || FONT_SIZE_DEFAULT;
}

function changeFontSize(direction) {
  const current = getCurrentFontSize();
  const idx = FONT_SIZE_STEPS.indexOf(current);
  let nextIdx;
  if (idx === -1) {
    nextIdx = FONT_SIZE_STEPS.indexOf(FONT_SIZE_DEFAULT);
  } else {
    nextIdx = Math.max(0, Math.min(FONT_SIZE_STEPS.length - 1, idx + direction));
  }
  const next = FONT_SIZE_STEPS[nextIdx];
  applyFontSize(next);
  saveFontSizePreference(next);
}

// ── Saveable popup size via custom drag handle ───────────────────────────────
// Chrome popup windows do NOT resize when the DOM uses CSS `resize: both` —
// the window only reads document dimensions at render time. We drive our own
// drag on #resize-handle and update #app-root + <body> + <html> dimensions
// simultaneously so Chrome actually grows the popup window.
const POPUP_MIN_W = 380;
const POPUP_MIN_H = 500;
const POPUP_MAX_W = 800;
const POPUP_MAX_H = 700;
const POPUP_DEFAULT_W = 780;
const POPUP_DEFAULT_H = 600;

function applyPopupSize(w, h) {
  const appRoot = document.getElementById('app-root');
  if (!appRoot) return;
  if (w) {
    appRoot.style.width = w + 'px';
    document.body.style.width = w + 'px';
    document.documentElement.style.width = w + 'px';
  }
  if (h) {
    appRoot.style.height = h + 'px';
    document.body.style.height = h + 'px';
    document.documentElement.style.height = h + 'px';
  }
}

function initPopupSize() {
  const appRoot = document.getElementById('app-root');
  const handle = document.getElementById('resize-handle');
  if (!appRoot) return;

  // Restore persisted size (fallback to defaults)
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['popupWidth', 'popupHeight'], ({ popupWidth, popupHeight }) => {
      applyPopupSize(popupWidth || POPUP_DEFAULT_W, popupHeight || POPUP_DEFAULT_H);
    });
  } else {
    applyPopupSize(POPUP_DEFAULT_W, POPUP_DEFAULT_H);
  }

  if (!handle) return;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = appRoot.getBoundingClientRect();
    startW = rect.width;
    startH = rect.height;
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const w = Math.max(POPUP_MIN_W, Math.min(POPUP_MAX_W, Math.round(startW + dx)));
    const h = Math.max(POPUP_MIN_H, Math.min(POPUP_MAX_H, Math.round(startH + dy)));
    applyPopupSize(w, h);
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const rect = appRoot.getBoundingClientRect();
      chrome.storage.local.set({
        popupWidth: Math.round(rect.width),
        popupHeight: Math.round(rect.height),
      });
    }
  });
}

// ── Client-side filter state ───────────────────────────────────────────────────
let allItems = [];           // full list from GET /items, refreshed on load
let activeTagFilters = [];   // string[] — AND match
let activeDays = 0;          // 0 = all, 1 = today, 2/3/4 = last N days
let activeCollectionId = ''; // '' = all, otherwise collection id

// ── Collection filter ──────────────────────────────────────────────────────────

async function loadCollections() {
  try {
    const res = await fetch(`${SERVER}/collections`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return;
    const collections = await res.json();
    // Sort alphabetically by name
    collections.sort((a, b) => a.name.localeCompare(b.name));
    const select = document.getElementById('collection-filter');
    if (!select) return;
    // Remove all options except the first "All" option
    while (select.options.length > 1) select.remove(1);
    for (const col of collections) {
      const opt = document.createElement('option');
      opt.value = col.id;
      opt.textContent = col.name;
      select.appendChild(opt);
    }
  } catch {
    // silently fail — collections filter is non-critical
  }
}

async function applyCollectionFilter(colId) {
  activeCollectionId = colId;
  if (!colId) {
    // Reload all items
    await loadAllItems();
    return;
  }
  const list = document.getElementById('items-list');
  list.innerHTML = '<div class="empty-state">Loading\u2026</div>';
  try {
    const res = await fetch(`${SERVER}/collections/${encodeURIComponent(colId)}/items`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    allItems = items;
    const filtered = applyFilters(allItems);
    const select = document.getElementById('collection-filter');
    const colName = select ? (select.options[select.selectedIndex]?.text || '') : '';
    renderItems(filtered, {
      heading: colName ? `Collection: ${colName}` : 'Collection',
      emptyMsg: 'No items in this collection.',
    });
  } catch {
    list.innerHTML = '<div class="empty-state">Could not load collection items.</div>';
  }
}

// Alias used by delete handler
function loadItems() {
  loadAllItems();
}

// ── Processing queue — sourced from server ────────────────────────────────────

async function loadRecentItems() {
  try {
    const res = await fetch(`${SERVER}/items/recent?limit=10&all=1`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('Server not available');
    return await res.json();
  } catch {
    return null; // null = server not available
  }
}

async function checkServer() {
  try {
    const res = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Filter logic ──────────────────────────────────────────────────────────────

function applyFilters(items) {
  let result = items;

  if (activeTagFilters.length) {
    result = result.filter((item) =>
      activeTagFilters.every((tag) => (item.tags || []).includes(tag))
    );
  }

  if (activeDays > 0) {
    const now = Date.now();
    const cutoff = now - activeDays * 24 * 60 * 60 * 1000;
    result = result.filter((item) => new Date(item.dateAdded).getTime() >= cutoff);
  }

  return result;
}

function hasActiveFilters() {
  return activeTagFilters.length > 0 || activeDays > 0;
}

function updateFilterBar() {
  const tagsRow = document.getElementById('filter-tags-row');

  // Remove existing chips (keep label and clear button)
  tagsRow.querySelectorAll('.filter-tag-chip').forEach((c) => c.remove());

  // Show tags row only when there are active tag filters
  if (activeTagFilters.length > 0) {
    tagsRow.classList.remove('hidden');
  } else {
    tagsRow.classList.add('hidden');
  }

  // Insert chips before the clear button
  const clearBtn = document.getElementById('filter-clear-btn');
  for (const tag of activeTagFilters) {
    const chip = document.createElement('span');
    chip.className = 'filter-tag-chip';
    chip.innerHTML = `${escapeHtml(tag)}<button class="filter-tag-remove" data-tag="${escapeAttr(tag)}" title="Remove">&times;</button>`;
    chip.querySelector('.filter-tag-remove').addEventListener('click', () => removeTagFilter(tag));
    tagsRow.insertBefore(chip, clearBtn);
  }

  // Update date buttons
  document.querySelectorAll('.date-filter-btn').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.days) === activeDays);
  });
}

function addTagFilter(tag) {
  if (!activeTagFilters.includes(tag)) {
    activeTagFilters.push(tag);
  }
  updateFilterBar();
  applyAndRender();
}

function removeTagFilter(tag) {
  activeTagFilters = activeTagFilters.filter((t) => t !== tag);
  updateFilterBar();
  applyAndRender();
}

function setDayFilter(days) {
  activeDays = days;
  updateFilterBar();
  applyAndRender();
}

function clearAllFilters() {
  activeTagFilters = [];
  activeDays = 0;
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  searchInput.value = '';
  searchClear.classList.remove('visible');
  clearTimeout(searchDebounce);
  updateFilterBar();
  applyAndRender();
}

function applyAndRender() {
  const searchInput = document.getElementById('search-input');
  const q = searchInput.value.trim();

  if (q) {
    // Text search: hit server, then apply client filters to result
    runSearch(q);
    return;
  }

  const filtered = applyFilters(allItems);
  const heading = buildHeading();
  renderItems(filtered, { heading, emptyMsg: 'No items match the current filters.' });
}

function buildHeading() {
  if (!hasActiveFilters()) return 'Recent Items';
  const parts = [];
  if (activeTagFilters.length) parts.push(activeTagFilters.map((t) => `#${t}`).join(' + '));
  if (activeDays > 0) parts.push(activeDays === 1 ? 'Today' : `Last ${activeDays}d`);
  return `Filtered: ${parts.join(', ')}`;
}

// ── Items list ─────────────────────────────────────────────────────────────────

function renderItems(items, { heading = 'Recent Items', emptyMsg = 'No items saved yet.' } = {}) {
  document.getElementById('items-heading').textContent = heading;
  const list = document.getElementById('items-list');
  if (!items.length) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(emptyMsg)}</div>`;
    return;
  }
  list.innerHTML = items.slice(0, 50).map((item) => {
    const isRead = !!item.readAt;
    const dot = isRead ? '<span class="read-dot" title="Read"></span>' : '';
    const titleClass = isRead ? 'item-title is-read' : 'item-title';
    const itemTitle = item.title || cleanDisplayUrl(item.url);
    // Approved tag chips (clickable — adds to filter)
    const approvedTags = (item.tags || []).filter((t) => (tagStatusMap[t] ?? 'pending') === 'approved');
    const tagChips = approvedTags.length
      ? `<div class="item-tags">${approvedTags.map((t) =>
          `<span class="item-tag" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</span>`
        ).join('')}</div>`
      : '';
    const publishedDate = item.publishedAt
      ? `<div class="item-published-at">Published ${formatDate(item.publishedAt)}</div>`
      : '';
    return `
    <div class="item">
      ${dot}
      <div class="item-body">
        <span class="${titleClass}" data-id="${escapeAttr(item.id)}" title="${escapeAttr(itemTitle)}" role="link" tabindex="0">${escapeHtml(itemTitle)}</span>
        <div class="item-date">${formatDate(item.dateAdded)}</div>
        ${publishedDate}
        ${tagChips}
      </div>
      <button class="raise-btn" data-id="${escapeAttr(item.id)}" title="Raise to Consideration">🚩</button>
      <button class="visit-btn" data-url="${escapeAttr(item.url)}" title="Open original">↗</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.item-title').forEach((el) => {
    const openReader = () => {
      openModal(el.dataset.id);
    };
    el.addEventListener('click', openReader);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReader(); }
    });
  });
  list.querySelectorAll('.visit-btn').forEach((btn) => {
    btn.addEventListener('click', () => chrome.tabs.create({ url: btn.dataset.url }));
  });
  // Initial raise state + click handler.
  // Once raised the button stays clickable: clicking it re-opens the form in
  // edit mode with the existing note pre-filled, and offers an Unraise link.
  list.querySelectorAll('.raise-btn').forEach((btn) => {
    const id = btn.dataset.id;
    const itemEl = btn.closest('.item');

    function setRaised(raised, note) {
      if (raised) {
        btn.textContent = 'Raised ✓';
        btn.title = 'Raised — click to edit or unraise';
        btn.classList.add('raised');
        btn.dataset.raised = '1';
        btn.dataset.note = note || '';
      } else {
        btn.textContent = '🚩';
        btn.title = 'Raise to Consideration';
        btn.classList.remove('raised');
        btn.dataset.raised = '';
        btn.dataset.note = '';
      }
    }

    fetch(`${SERVER}/items/${encodeURIComponent(id)}/consider`, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && data.raised) setRaised(true, data.note || '');
      })
      .catch(() => {});

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isRaised = btn.dataset.raised === '1';
      if (isRaised) {
        // Re-fetch latest note in case another client updated it.
        fetch(`${SERVER}/items/${encodeURIComponent(id)}/consider`, { signal: AbortSignal.timeout(3000) })
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            const initialNote = (data && data.raised) ? (data.note || '') : (btn.dataset.note || '');
            window.createRaiseForm(itemEl, {
              mode: 'edit',
              initialNote,
              onUpdate: async (note) => {
                await fetch(`${SERVER}/items/${encodeURIComponent(id)}/consider`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ note: note || '' }),
                });
                btn.dataset.note = note || '';
              },
              onUnraise: async () => {
                await fetch(`${SERVER}/items/${encodeURIComponent(id)}/consider`, {
                  method: 'DELETE',
                });
                setRaised(false);
              },
            });
          })
          .catch(() => {});
      } else {
        window.createRaiseForm(itemEl, {
          onSubmit: async (note) => {
            await fetch(`${SERVER}/items/${encodeURIComponent(id)}/consider`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ note: note || '' }),
            });
            setRaised(true, note || '');
          },
        });
      }
    });
  });
  list.querySelectorAll('.item-tag').forEach((chip) => {
    chip.addEventListener('click', () => addTagFilter(chip.dataset.tag));
  });
}

// ── Quick summary for currently open URL ─────────────────────────────────────

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Strip protocol differences and trailing slash; ignore hash
    const host = u.host.toLowerCase();
    let path = u.pathname.replace(/\/+$/, '');
    if (path === '') path = '/';
    return `${host}${path}${u.search}`;
  } catch {
    return String(url).replace(/\/+$/, '');
  }
}

function renderQuickSummaryForCurrentUrl() {
  const card = document.getElementById('quick-summary-card');
  if (!card) return;
  if (!currentUrl) {
    card.classList.add('hidden');
    return;
  }
  const target = normalizeUrl(currentUrl);
  if (!target) {
    card.classList.add('hidden');
    return;
  }
  const match = allItems.find((item) => normalizeUrl(item.url) === target);
  if (!match) {
    card.classList.add('hidden');
    return;
  }

  const titleEl = document.getElementById('quick-summary-title');
  const tldrEl = document.getElementById('quick-summary-tldr');
  titleEl.textContent = match.title || match.url || '(untitled)';
  titleEl.title = match.title || '';
  titleEl.onclick = (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${SERVER}/?item=${encodeURIComponent(match.id)}` });
  };

  const tldr = Array.isArray(match.tldr) ? match.tldr : [];
  if (tldr.length) {
    tldrEl.innerHTML = tldr.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  } else {
    tldrEl.innerHTML = '';
  }
  card.classList.remove('hidden');
}

async function loadAllItems() {
  const list = document.getElementById('items-list');
  try {
    const res = await fetch(`${SERVER}/items`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allItems = await res.json();
    applyAndRender();
    renderQuickSummaryForCurrentUrl();
  } catch {
    list.innerHTML = '<div class="empty-state">Could not load items.</div>';
  }
}

async function runSearch(q) {
  const list = document.getElementById('items-list');
  if (!q) { applyAndRender(); return; }
  list.innerHTML = '<div class="empty-state">Searching\u2026</div>';
  try {
    const params = new URLSearchParams({ q });
    const res = await fetch(`${SERVER}/search?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let items = await res.json();
    // Apply client-side tag + date filters on top of server text results
    items = applyFilters(items);
    const headingParts = [`"${q}"`];
    if (activeTagFilters.length) headingParts.push(activeTagFilters.map((t) => `#${t}`).join(' + '));
    if (activeDays > 0) headingParts.push(activeDays === 1 ? 'Today' : `Last ${activeDays}d`);
    renderItems(items, {
      heading: `Results for ${headingParts.join(' ')}`,
      emptyMsg: 'No results found.',
    });
  } catch {
    list.innerHTML = '<div class="empty-state">Search failed.</div>';
  }
}

// ── Tag pending banner ────────────────────────────────────────────────────────

async function loadPendingTags() {
  try {
    const res = await fetch(`${SERVER}/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return;
    const data = await res.json();

    // Rebuild tag status cache for the modal
    tagStatusMap = {};
    for (const t of data.approved) tagStatusMap[t] = 'approved';
    for (const t of data.rejected) tagStatusMap[t] = 'rejected';
    for (const p of data.pending) tagStatusMap[p.tag] = 'pending';

    const bar = document.getElementById('tags-pending-bar');
    const countEl = document.getElementById('tags-pending-count');
    const count = data.pending.length;

    if (!count) {
      bar.classList.add('hidden');
      return;
    }

    bar.classList.remove('hidden');
    countEl.textContent = `${count} tag${count !== 1 ? 's' : ''} pending review`;
  } catch {
    // non-fatal
  }
}

// ── Processing queue UI ───────────────────────────────────────────────────────

async function renderQueue() {
  const items = await loadRecentItems();
  const section = document.getElementById('processing-section');
  const list = document.getElementById('processing-list');
  const badge = document.getElementById('queue-badge');

  if (!items) {
    // Server not available — hide queue section
    section.classList.remove('visible');
    badge.classList.remove('visible');
    return;
  }

  const active = items.filter(e => e.status === 'queued' || e.status === 'processing');
  const recent = items.filter(e => e.status === 'done' || e.status === 'error').slice(0, 10);
  const display = [...active, ...recent];

  if (active.length === 0 && recent.length === 0) {
    section.classList.remove('visible');
    badge.classList.remove('visible');
    return;
  }

  section.classList.add('visible');

  if (active.length > 0) {
    badge.textContent = `${active.length} processing`;
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }

  const COLLAPSE_LIMIT = 4;
  const itemsHtml = display.map((item, idx) => {
    const dotClass = item.status === 'processing' ? 'processing'
      : item.status === 'done' ? 'done'
      : item.status === 'error' ? 'error'
      : 'queued';
    const label = item.status === 'processing' ? 'Processing...'
      : item.status === 'done' ? 'Done'
      : item.status === 'error' ? 'Error'
      : 'Queued';
    const displayTitle = item.title || cleanDisplayUrl(item.url);
    const retryBtn = item.status === 'error'
      ? `<button class="processing-retry-btn" data-id="${escapeAttr(item.id)}" data-url="${escapeAttr(item.url)}">Retry</button>`
      : '';
    const hiddenClass = idx >= COLLAPSE_LIMIT ? ' processing-item-hidden' : '';
    const hiddenStyle = idx >= COLLAPSE_LIMIT ? ' style="display:none"' : '';
    return `
    <div class="processing-item${hiddenClass}"${hiddenStyle}>
      <span class="processing-status-dot ${dotClass}"></span>
      <span class="processing-item-title" title="${escapeAttr(displayTitle)}">${escapeHtml(displayTitle)}</span>
      <span class="processing-status-label">${escapeHtml(label)}</span>
      ${retryBtn}
    </div>`;
  }).join('');

  const hiddenCount = Math.max(0, display.length - COLLAPSE_LIMIT);
  const toggleHtml = hiddenCount > 0
    ? `<button class="processing-toggle" type="button" data-expanded="false">Show ${hiddenCount} more \u25be</button>`
    : '';

  const errorCount = display.filter(e => e.status === 'error').length;
  const retryAllHtml = errorCount > 0
    ? `<button class="processing-retry-all-btn" type="button" data-testid="retry-all-failed">Retry all failed (${errorCount})</button>`
    : '';

  list.innerHTML = retryAllHtml + itemsHtml + toggleHtml;

  const retryAllBtn = list.querySelector('.processing-retry-all-btn');
  if (retryAllBtn) {
    retryAllBtn.addEventListener('click', () => retryAllFailed(retryAllBtn));
  }

  list.querySelectorAll('.processing-retry-btn').forEach(btn => {
    btn.addEventListener('click', () => retryItem(btn.dataset.id, btn.dataset.url));
  });

  const toggleBtn = list.querySelector('.processing-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const expanded = toggleBtn.dataset.expanded === 'true';
      const hiddenItems = list.querySelectorAll('.processing-item-hidden');
      if (expanded) {
        hiddenItems.forEach(el => { el.style.display = 'none'; });
        toggleBtn.dataset.expanded = 'false';
        toggleBtn.textContent = `Show ${hiddenItems.length} more \u25be`;
      } else {
        hiddenItems.forEach(el => { el.style.display = ''; });
        toggleBtn.dataset.expanded = 'true';
        toggleBtn.textContent = 'Show less \u25b4';
      }
    });
  }
}

async function retryAllFailed(btn) {
  try {
    btn.disabled = true;
    btn.textContent = 'Retrying…';
    await fetch(`${SERVER}/items/retry-failed`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    });
    await renderQueue();
  } catch {
    btn.disabled = false;
    btn.textContent = 'Retry all failed';
  }
}

async function retryItem(id, url) {
  try {
    await fetch(`${SERVER}/items/${encodeURIComponent(id)}/resummarize`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    await renderQueue();
    pollItem(id);
  } catch {
    // non-fatal
  }
}

async function pollItem(id) {
  let checks = 0;
  const interval = setInterval(async () => {
    checks++;
    if (checks > 120) { clearInterval(interval); return; }
    try {
      const res = await fetch(`${SERVER}/status/${encodeURIComponent(id)}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'done' || data.status === 'error') {
        clearInterval(interval);
        if (data.status === 'done') {
          setTimeout(() => loadAllItems(), 500);
        }
        await renderQueue();
      } else {
        // Re-render to pick up any title updates
        await renderQueue();
      }
    } catch {
      // non-fatal
    }
  }, 2000);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

async function openModal(id) {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const deleteBtn = document.getElementById('modal-delete');
  const readInAppBtn = document.getElementById('modal-read-in-app');

  titleEl.textContent = 'Loading...';
  bodyEl.innerHTML = '';
  overlay.classList.add('visible');
  overlay.scrollTop = 0;

  // Wire delete button for this item
  deleteBtn.onclick = async () => {
    if (!confirm('Delete this item?')) return;
    await fetch(`${SERVER}/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
    closeModal();
    loadItems();
  };

  // Wire "Read in app" button — opens the web app in a new tab.
  if (readInAppBtn) {
    readInAppBtn.onclick = () => {
      chrome.tabs.create({ url: `${SERVER}/?item=${encodeURIComponent(id)}` });
    };
  }

  // Mark as read — fire and forget, update UI optimistically
  fetch(`${SERVER}/items/${encodeURIComponent(id)}/read`, { method: 'POST' })
    .then(() => {
      const readBtn = document.querySelector(`.read-btn[data-id="${CSS.escape(id)}"]`);
      if (readBtn) {
        const itemEl = readBtn.closest('.item');
        const titleLink = itemEl?.querySelector('.item-title');
        if (titleLink) titleLink.classList.add('is-read');
        if (itemEl && !itemEl.querySelector('.read-dot')) {
          const dot = document.createElement('span');
          dot.className = 'read-dot';
          dot.title = 'Read';
          itemEl.insertBefore(dot, itemEl.firstChild);
        }
      }
    })
    .catch(() => {});

  try {
    const res = await fetch(`${SERVER}/items/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const item = await res.json();

    titleEl.textContent = item.title ?? id;

    let html = '';

    // Study Later toggle
    const studyActive = item.studyLater ? ' active' : '';
    const studyText = item.studyLater ? '&#9989; Studying' : '&#128218; Study Later';
    html += `<button class="modal-study-later-btn${studyActive}" id="modal-study-later">${studyText}</button>`;

    // TL;DR
    if (Array.isArray(item.tldr) && item.tldr.length) {
      html += '<div class="modal-tldr">' +
        item.tldr.map((line) => `<div class="modal-tldr-line">${escapeHtml(line)}</div>`).join('') +
        '</div>';
    }

    // Summary model
    if (item.summaryModel) {
      html += `<div class="reader-summary-model">Model: ${escapeHtml(item.summaryModel)}</div>`;
    }

    // Prompt details placeholder (populated async after render)
    html += `<div id="modal-prompt-container"></div>`;

    // Summary
    if (item.summary) {
      html += `<p class="modal-summary">${escapeHtml(item.summary)}</p>`;
    }

    // Sections
    if (Array.isArray(item.sections) && item.sections.length) {
      html += item.sections.map((s) => {
        const points = Array.isArray(s.points) ? s.points : [];
        return `<h3 class="modal-section-title">${escapeHtml(s.title)}</h3>
          <ul class="modal-points">${points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`;
      }).join('');
    }

    // Tags with status colours + inline approve/reject for pending ones
    if (Array.isArray(item.tags) && item.tags.length) {
      const visibleTags = item.tags.filter((t) => (tagStatusMap[t] ?? 'pending') !== 'rejected');
      if (visibleTags.length) {
        html += '<div class="modal-tags">';
        for (const tag of visibleTags) {
          const st = tagStatusMap[tag] ?? 'pending';
          if (st === 'approved') {
            html += `<span class="modal-tag approved">${escapeHtml(tag)}</span>`;
          } else {
            html += `<span class="modal-tag pending" data-tag="${escapeAttr(tag)}" data-item-id="${escapeAttr(item.id)}">` +
              `${escapeHtml(tag)} ` +
              `<button class="modal-tag-approve" title="Approve">\u2713</button>` +
              `<button class="modal-tag-reject" title="Reject">\u2717</button>` +
              `</span>`;
          }
        }
        html += '</div>';
      }
    }

    // Open original link
    if (item.url) {
      html += `<a class="modal-open-link" data-url="${escapeAttr(item.url)}" href="#">Open original &rarr;</a>`;
    }

    // Full transcript (collapsible)
    if (item.transcript) {
      html += `<details class="modal-transcript">
        <summary>Full transcript</summary>
        <pre>${escapeHtml(item.transcript)}</pre>
      </details>`;
    }

    // Summary quality rating
    if (item.summary) {
      html += `<div class="modal-quality-section">
        <div class="reader-summary-quality-row">
          <span class="reader-rating-label">Summary quality</span>
          <div class="reader-stars" id="modal-quality-stars">
            ${[1,2,3,4,5].map((s) => `<button class="reader-star-btn" data-star="${s}" title="${s} star${s!==1?'s':''}">★</button>`).join('')}
          </div>
        </div>
        <textarea class="reader-summary-quality-reason" id="modal-quality-reason" rows="2" placeholder="Why this rating? (optional)"></textarea>
        <button class="reader-quality-save-btn" id="modal-quality-save">Save rating</button>
      </div>`;
    }

    // Chat section
    html += `<div class="modal-chat-section">
      <div class="modal-chat-label">Chat</div>
      <div class="preview-chat-messages" id="modal-chat-messages"></div>
      <div class="preview-chat-input-row">
        <textarea class="preview-chat-input" id="modal-chat-input" rows="2" placeholder="Ask about this item..."></textarea>
        <button class="preview-chat-send-btn" id="modal-chat-send">Send</button>
      </div>
    </div>`;

    bodyEl.innerHTML = html;

    // Load and display prompt used for this summary
    (async () => {
      const container = bodyEl.querySelector('#modal-prompt-container');
      if (!container) return;
      try {
        const histRes = await fetch(`${SERVER}/items/${encodeURIComponent(id)}/history`, { signal: AbortSignal.timeout(3000) });
        if (!histRes.ok) return;
        const versions = await histRes.json();
        if (!versions.length) return;
        const latest = versions[0];
        let promptText = latest.prompt;
        if (!promptText && latest.promptId) {
          const prRes = await fetch(`${SERVER}/prompt-templates/summary`, { signal: AbortSignal.timeout(3000) });
          if (prRes.ok) {
            const templates = await prRes.json();
            const match = templates.find((p) => p.id === latest.promptId);
            if (match) promptText = match.template;
          }
        }
        if (promptText) {
          container.innerHTML = `<details class="modal-prompt-details">
            <summary class="modal-prompt-summary">Prompt used ▸</summary>
            <pre class="modal-prompt-text">${escapeHtml(promptText)}</pre>
          </details>`;
        }
      } catch (_) {}
    })();

    // Wire Study Later toggle
    const studyBtn = bodyEl.querySelector('#modal-study-later');
    if (studyBtn) {
      studyBtn.addEventListener('click', async () => {
        studyBtn.disabled = true;
        try {
          const r = await fetch(`${SERVER}/items/${encodeURIComponent(id)}/study-later`, { method: 'POST' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data = await r.json();
          studyBtn.classList.toggle('active', data.studyLater);
          studyBtn.innerHTML = data.studyLater ? '&#9989; Studying' : '&#128218; Study Later';
        } catch (e) {
          // silent fail — button stays in current state
        } finally {
          studyBtn.disabled = false;
        }
      });
    }

    // Wire open-original
    const openLink = bodyEl.querySelector('.modal-open-link');
    if (openLink) {
      openLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: openLink.dataset.url });
      });
    }

    // Wire inline tag approve/reject buttons
    bodyEl.querySelectorAll('.modal-tag.pending').forEach((badge) => {
      const tag = badge.dataset.tag;
      const itemId = badge.dataset.itemId;

      badge.querySelector('.modal-tag-approve')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await fetch(`${SERVER}/tags/approve`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag }),
        });
        badge.classList.replace('pending', 'approved');
        badge.querySelector('.modal-tag-approve')?.remove();
        badge.querySelector('.modal-tag-reject')?.remove();
        tagStatusMap[tag] = 'approved';
        loadPendingTags();
      });

      badge.querySelector('.modal-tag-reject')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const originalHTML = badge.innerHTML;
        badge.innerHTML = `<input type="text" class="modal-tag-reason-input" placeholder="Reason (optional)"> <button class="modal-tag-reason-confirm" title="Confirm">✓</button> <button class="modal-tag-reason-cancel" title="Cancel">✗ Cancel</button>`;
        const input = badge.querySelector('.modal-tag-reason-input');
        input.focus();
        badge.querySelector('.modal-tag-reason-confirm').addEventListener('click', async (ev) => {
          ev.stopPropagation();
          await fetch(`${SERVER}/tags/reject`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag, itemId, reason: input.value }),
          });
          badge.remove();
          tagStatusMap[tag] = 'rejected';
          loadPendingTags();
        });
        badge.querySelector('.modal-tag-reason-cancel').addEventListener('click', (ev) => {
          ev.stopPropagation();
          badge.innerHTML = originalHTML;
        });
      });
    });

    // Wire summary quality rating
    const qualityStarsEl = bodyEl.querySelector('#modal-quality-stars');
    if (qualityStarsEl) {
      let currentQuality = 0;

      function updateStars(rating) {
        qualityStarsEl.querySelectorAll('.reader-star-btn').forEach((btn) => {
          btn.classList.toggle('filled', Number(btn.dataset.star) <= rating);
        });
      }

      // Load existing rating
      try {
        const sqRes = await fetch(`${SERVER}/items/${encodeURIComponent(id)}/summary-quality`, { signal: AbortSignal.timeout(3000) });
        if (sqRes.ok) {
          const sq = await sqRes.json();
          if (sq.rating != null) { currentQuality = sq.rating; updateStars(currentQuality); }
          if (sq.reason) { const r = bodyEl.querySelector('#modal-quality-reason'); if (r) r.value = sq.reason; }
        }
      } catch (_) {}

      // Star click
      qualityStarsEl.querySelectorAll('.reader-star-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentQuality = Number(btn.dataset.star);
          updateStars(currentQuality);
        });
      });

      // Save button
      bodyEl.querySelector('#modal-quality-save')?.addEventListener('click', async () => {
        const saveBtn = bodyEl.querySelector('#modal-quality-save');
        const reason = bodyEl.querySelector('#modal-quality-reason')?.value ?? '';
        saveBtn.disabled = true;
        try {
          await fetch(`${SERVER}/items/${encodeURIComponent(id)}/summary-quality`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: currentQuality, reason }),
          });
          saveBtn.textContent = 'Saved \u2713';
          setTimeout(() => { saveBtn.textContent = 'Save rating'; saveBtn.disabled = false; }, 1500);
        } catch (_) {
          saveBtn.textContent = 'Error — retry';
          saveBtn.disabled = false;
        }
      });
    }

    // Load chat history
    const chatMessagesEl = bodyEl.querySelector('#modal-chat-messages');
    const chatInput = bodyEl.querySelector('#modal-chat-input');
    const chatSend = bodyEl.querySelector('#modal-chat-send');

    function appendChatMessage(role, content) {
      const msgEl = document.createElement('div');
      msgEl.className = `preview-chat-msg preview-chat-msg--${role}`;
      msgEl.innerHTML = `<div class="preview-chat-role">${role === 'user' ? 'You' : 'Assistant'}</div>` +
        `<div class="preview-chat-content">${escapeHtml(content)}</div>`;
      chatMessagesEl.appendChild(msgEl);
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }

    try {
      const chatRes = await fetch(`${SERVER}/items/${encodeURIComponent(id)}/chat`, { signal: AbortSignal.timeout(5000) });
      if (chatRes.ok) {
        const history = await chatRes.json();
        if (Array.isArray(history)) {
          history.forEach((msg) => appendChatMessage(msg.role, msg.content));
        }
      }
    } catch (_) {}

    async function sendChatMessage() {
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      chatSend.disabled = true;
      appendChatMessage('user', text);
      try {
        const r = await fetch(`${SERVER}/items/${encodeURIComponent(id)}/discuss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        appendChatMessage('assistant', data.reply);
      } catch (err) {
        appendChatMessage('assistant', `Error: ${err.message}`);
      } finally {
        chatSend.disabled = false;
        chatInput.focus();
      }
    }

    chatSend.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });

  } catch (err) {
    bodyEl.innerHTML = `<p class="modal-summary" style="color:#ff6060">Error loading item: ${escapeHtml(err.message)}</p>`;
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('visible');
}

function setStatus(msg, type = '') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = type;
}

function setSaveBtnState(state, label) {
  const btn = document.getElementById('save-btn');
  btn.textContent = label;
  btn.className = '';
  if (state) btn.classList.add(state);
}

function resetSaveBtn() {
  const btn = document.getElementById('save-btn');
  btn.textContent = 'Save to Knowledge Base';
  btn.className = '';
  btn.disabled = false;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Render a URL in a short, readable form when we don't have a title yet.
// Drops the protocol and "www.", truncates long paths. Returns "(untitled)"
// if the input isn't a parseable URL or is empty.
function cleanDisplayUrl(raw) {
  if (!raw) return '(untitled)';
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    let path = u.pathname === '/' ? '' : u.pathname;
    if (path.length > 40) path = path.slice(0, 37) + '…';
    return host + path;
  } catch {
    return '(untitled)';
  }
}

// ── Already-saved check ───────────────────────────────────────────────────────

let duplicateItemId = null;

async function checkDuplicate(url) {
  const banner = document.getElementById('duplicate-banner');
  const bannerText = document.getElementById('duplicate-banner-text');
  const resummarizeBtn = document.getElementById('duplicate-banner-resummarize');

  try {
    const res = await fetch(`${SERVER}/items/check?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.exists) return;

    duplicateItemId = data.id;
    const isActive = data.status === 'queued' || data.status === 'processing';
    const isError = data.status === 'error';

    if (isActive) {
      bannerText.textContent = 'Currently being processed\u2026';
      resummarizeBtn.classList.add('hidden');
    } else if (isError) {
      bannerText.textContent = `Summarization failed${data.title ? ': ' + data.title : ''} \u2014 retry?`;
      resummarizeBtn.textContent = 'Retry';
      resummarizeBtn.classList.remove('hidden');
    } else {
      bannerText.textContent = `Already saved${data.title ? ': ' + data.title : ''}`;
      resummarizeBtn.classList.remove('hidden');
    }
    banner.classList.remove('hidden');
    document.getElementById('save-btn').classList.add('hidden');
  } catch {
    // non-fatal
  }
}

function showStatus(msg, type = '') {
  setStatus(msg, type);
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  initPopupSize();
  // Load font size preference immediately so the popup renders at the right size
  loadFontSizePreference();

  // Wire font size buttons
  document.getElementById('font-size-decrease').addEventListener('click', () => changeFontSize(-1));
  document.getElementById('font-size-increase').addEventListener('click', () => changeFontSize(+1));

  document.getElementById('modal-close').addEventListener('click', closeModal);

  // Search bar
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    searchClear.classList.toggle('visible', q.length > 0);
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => runSearch(q), 300);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.remove('visible');
    applyAndRender();
  });

  // Filter bar — clear button
  document.getElementById('filter-clear-btn').addEventListener('click', clearAllFilters);

  // Refresh button
  document.getElementById('items-refresh-btn').addEventListener('click', loadAllItems);

  // Tags pending bar — "Review →" opens web app
  document.getElementById('tags-pending-review-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://127.0.0.1:3737/' });
  });

  // Date filter buttons
  document.querySelectorAll('.date-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => setDayFilter(Number(btn.dataset.days)));
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab?.url ?? '';
  const urlEl = document.getElementById('current-url');
  urlEl.textContent = currentUrl || '(no URL)';
  urlEl.title = currentUrl;

  const alive = await checkServer();
  if (!alive) {
    setStatus('');
    document.getElementById('save-btn').disabled = true;
    document.getElementById('items-list').innerHTML = `
      <div class="server-error">
        Server not running — start with:
        <code>bun run server</code>
      </div>`;
    return;
  }

  // Load queue from server and start polling any pending items
  await renderQueue();
  const initialItems = await loadRecentItems();
  if (initialItems) {
    for (const item of initialItems.filter(e => e.status === 'queued' || e.status === 'processing')) {
      pollItem(item.id);
    }
  }

  await Promise.all([loadAllItems(), loadPendingTags(), loadCollections()]);
  renderQuickSummaryForCurrentUrl();

  // Wire collection filter dropdown
  const collectionFilter = document.getElementById('collection-filter');
  if (collectionFilter) {
    collectionFilter.addEventListener('change', () => {
      applyCollectionFilter(collectionFilter.value);
    });
  }

  if (currentUrl && (currentUrl.startsWith('http://') || currentUrl.startsWith('https://'))) {
    checkDuplicate(currentUrl);
  }

  // Banner dismiss
  document.getElementById('duplicate-banner-dismiss').addEventListener('click', () => {
    document.getElementById('duplicate-banner').classList.add('hidden');
    document.getElementById('save-btn').classList.remove('hidden');
  });

  // Banner re-summarize
  document.getElementById('duplicate-banner-resummarize').addEventListener('click', async () => {
    if (!duplicateItemId) return;
    try {
      await fetch(`${SERVER}/items/${encodeURIComponent(duplicateItemId)}/resummarize`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
      document.getElementById('duplicate-banner-text').textContent = 'Saving again\u2026';
      document.getElementById('duplicate-banner-resummarize').classList.add('hidden');
    } catch {
      setStatus('Save again failed', 'error');
    }
  });

  document.getElementById('quick-summary-btn').addEventListener('click', runQuickSummary);

  document.getElementById('save-btn').addEventListener('click', async (e) => {
    if (!currentUrl) { setStatus('No URL to save.', 'error'); return; }

    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    setStatus('');

    try {
      const res = await fetch(`${SERVER}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: currentUrl }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.status === 'exists') {
        setSaveBtnState('duplicate', 'Already saved');
        setStatus('Already in your KB', 'info');
        setTimeout(resetSaveBtn, 3000);
        return;
      }

      // Successfully queued — refresh from server immediately
      setSaveBtnState('saved', 'Saved \u2713');
      setStatus('Queued \u2014 processing in background', 'success');
      await renderQueue();
      pollItem(data.id);
      setTimeout(resetSaveBtn, 3000);
    } catch (err) {
      setSaveBtnState('error-state', 'Error');
      setStatus(`Error: ${err.message}`, 'error');
      setTimeout(resetSaveBtn, 3000);
    }
  });
}

// ── Quick Summary ─────────────────────────────────────────────────────────────

async function runQuickSummary() {
  if (!currentUrl || (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://'))) {
    setStatus('No valid URL to summarize.', 'error');
    return;
  }

  const btn = document.getElementById('quick-summary-btn');
  const resultEl = document.getElementById('preview-result');

  btn.disabled = true;
  btn.textContent = 'Summarizing\u2026';
  resultEl.classList.add('hidden');
  resultEl.innerHTML = '';
  setStatus('');

  try {
    const res = await fetch(`${SERVER}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUrl }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    const data = await res.json();

    // Build full preview — title, TL;DR, summary, key sections, chat
    const tldrHtml = Array.isArray(data.tldr) && data.tldr.length
      ? `<div class="preview-section-label">TL;DR</div>
         <ul class="preview-tldr">${data.tldr.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
      : '';

    const summaryHtml = data.summary
      ? `<div class="preview-section-label">Summary</div>
         <div class="preview-summary">${escapeHtml(data.summary)}</div>`
      : '';

    const sectionsHtml = Array.isArray(data.sections) && data.sections.length
      ? `<div class="preview-section-label">Key Points</div>
         ${data.sections.map((sec) => `
           <div class="preview-key-section">
             <div class="preview-key-section-title">${escapeHtml(sec.title)}</div>
             <ul class="preview-key-points">
               ${(sec.points || []).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
             </ul>
           </div>`).join('')}`
      : '';

    const tagsHtml = Array.isArray(data.tags) && data.tags.length
      ? `<div class="preview-tags">${data.tags.map((t) => `<span class="preview-tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    resultEl.innerHTML = `
      <div class="preview-title">${escapeHtml(data.title || currentUrl)}</div>
      ${tldrHtml}
      ${summaryHtml}
      ${sectionsHtml}
      ${tagsHtml}
      <div class="preview-chat-section">
        <div class="preview-section-label">Discuss</div>
        <div class="preview-chat-messages" id="preview-chat-messages"></div>
        <div class="preview-chat-input-row">
          <textarea class="preview-chat-input" id="preview-chat-input" rows="2" placeholder="Ask a question about this article…"></textarea>
          <button class="preview-chat-send-btn" id="preview-chat-send-btn">Send</button>
        </div>
      </div>
      <div class="preview-result-actions">
        <button class="preview-dismiss-btn" id="preview-dismiss-btn">Dismiss</button>
      </div>`;
    resultEl.classList.remove('hidden');

    // Chat state
    const chatMessages = [];
    const articleContent = data.content || data.summary || '';

    function appendChatMsg(role, content) {
      const el = document.getElementById('preview-chat-messages');
      if (!el) return;
      const div = document.createElement('div');
      div.className = `preview-chat-msg preview-chat-msg--${role}`;
      div.innerHTML = `<span class="preview-chat-role">${role === 'user' ? 'You' : 'Assistant'}</span><span class="preview-chat-content">${escapeHtml(content)}</span>`;
      el.appendChild(div);
      el.scrollTop = el.scrollHeight;
    }

    async function sendChat() {
      const inputEl = document.getElementById('preview-chat-input');
      const sendBtn = document.getElementById('preview-chat-send-btn');
      if (!inputEl || !sendBtn) return;
      const msg = inputEl.value.trim();
      if (!msg) return;
      inputEl.value = '';
      sendBtn.disabled = true;
      chatMessages.push({ role: 'user', content: msg });
      appendChatMsg('user', msg);
      try {
        const res2 = await fetch(`${SERVER}/preview/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: articleContent, messages: chatMessages }),
          signal: AbortSignal.timeout(60000),
        });
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        const d2 = await res2.json();
        chatMessages.push({ role: 'assistant', content: d2.reply });
        appendChatMsg('assistant', d2.reply);
      } catch (err) {
        appendChatMsg('assistant', `Error: ${err.message}`);
        chatMessages.pop(); // remove failed user message
      } finally {
        sendBtn.disabled = false;
      }
    }

    document.getElementById('preview-chat-send-btn').addEventListener('click', sendChat);
    document.getElementById('preview-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });

    document.getElementById('preview-dismiss-btn').addEventListener('click', () => {
      resultEl.classList.add('hidden');
      resultEl.innerHTML = '';
    });

  } catch (err) {
    setStatus(`Summary failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Quick Summary';
  }
}

init();
