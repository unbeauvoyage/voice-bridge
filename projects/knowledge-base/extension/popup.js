const SERVER = 'http://127.0.0.1:3737';

let currentUrl = '';
// tag status cache: tag name -> 'pending' | 'approved' | 'rejected'
let tagStatusMap = {};
let searchDebounce = null;

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

// ── Items list ─────────────────────────────────────────────────────────────────

function renderItems(items, { heading = 'Recent Items', emptyMsg = 'No items saved yet.' } = {}) {
  document.getElementById('items-heading').textContent = heading;
  const list = document.getElementById('items-list');
  if (!items.length) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(emptyMsg)}</div>`;
    return;
  }
  list.innerHTML = items.slice(0, 20).map((item) => {
    const isRead = !!item.readAt;
    const dot = isRead ? '<span class="read-dot" title="Read"></span>' : '';
    const titleClass = isRead ? 'item-title is-read' : 'item-title';
    // Approved tag chips (clickable filter)
    const approvedTags = (item.tags || []).filter((t) => (tagStatusMap[t] ?? 'pending') === 'approved');
    const tagChips = approvedTags.length
      ? `<div class="item-tags">${approvedTags.map((t) =>
          `<span class="item-tag" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</span>`
        ).join('')}</div>`
      : '';
    return `
    <div class="item">
      ${dot}
      <div class="item-body">
        <a class="${titleClass}" href="${escapeAttr(item.url)}" title="${escapeAttr(item.title)}">${escapeHtml(item.title)}</a>
        <div class="item-date">${formatDate(item.dateAdded)}</div>
        ${tagChips}
      </div>
      <button class="visit-btn" data-url="${escapeAttr(item.url)}" title="Open original">↗</button>
      <button class="read-btn" data-id="${escapeAttr(item.id)}">Read</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.item-title').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: a.href }); });
  });
  list.querySelectorAll('.visit-btn').forEach((btn) => {
    btn.addEventListener('click', () => chrome.tabs.create({ url: btn.dataset.url }));
  });
  list.querySelectorAll('.read-btn').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.id));
  });
  list.querySelectorAll('.item-tag').forEach((chip) => {
    chip.addEventListener('click', () => filterByTag(chip.dataset.tag));
  });
}

async function loadRecentItems() {
  const list = document.getElementById('items-list');
  try {
    const res = await fetch(`${SERVER}/items`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    renderItems(items.slice(0, 5));
  } catch {
    list.innerHTML = '<div class="empty-state">Could not load items.</div>';
  }
}

async function runSearch(q, tag) {
  const list = document.getElementById('items-list');
  if (!q && !tag) { await loadRecentItems(); return; }
  list.innerHTML = '<div class="empty-state">Searching…</div>';
  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (tag) params.set('tag', tag);
    const res = await fetch(`${SERVER}/search?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    const headingParts = [];
    if (q) headingParts.push(`"${q}"`);
    if (tag) headingParts.push(`#${tag}`);
    renderItems(items, {
      heading: `Results for ${headingParts.join(' + ')}`,
      emptyMsg: 'No results found.',
    });
  } catch {
    list.innerHTML = '<div class="empty-state">Search failed.</div>';
  }
}

function filterByTag(tag) {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  input.value = '';
  clearBtn.classList.add('visible');
  // Store tag filter in a data attribute on the input
  input.dataset.tagFilter = tag;
  runSearch('', tag);
}

function clearSearch() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  input.value = '';
  delete input.dataset.tagFilter;
  clearBtn.classList.remove('visible');
  loadRecentItems();
}

// ── Tag review section ─────────────────────────────────────────────────────────

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

    const section = document.getElementById('tags-section');
    const list = document.getElementById('tags-list');

    if (!data.pending.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    list.innerHTML = data.pending.map((p) => `
      <div class="tag-row" data-tag="${escapeAttr(p.tag)}" data-item-id="${escapeAttr(p.itemId)}">
        <span class="tag-name">${escapeHtml(p.tag)}</span>
        <span class="tag-item-title">${escapeHtml(p.itemTitle || '—')}</span>
        <button class="tag-approve-btn" title="Approve">✓</button>
        <button class="tag-reject-btn" title="Reject">✗</button>
      </div>`).join('');

    list.querySelectorAll('.tag-approve-btn').forEach((btn) => {
      const row = btn.closest('.tag-row');
      btn.addEventListener('click', async () => {
        const tag = row.dataset.tag;
        await fetch(`${SERVER}/tags/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag }),
        });
        row.remove();
        tagStatusMap[tag] = 'approved';
        if (!list.children.length) section.style.display = 'none';
      });
    });

    list.querySelectorAll('.tag-reject-btn').forEach((btn) => {
      const row = btn.closest('.tag-row');
      btn.addEventListener('click', async () => {
        const tag = row.dataset.tag;
        const itemId = row.dataset.itemId;
        btn.textContent = '...';
        btn.disabled = true;
        await fetch(`${SERVER}/tags/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag, itemId }),
        });
        row.remove();
        tagStatusMap[tag] = 'rejected';
        if (!list.children.length) section.style.display = 'none';
        // Reload after a moment — retag may produce new pending tags
        setTimeout(() => loadPendingTags(), 3000);
      });
    });
  } catch {
    // non-fatal
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

async function openModal(id) {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');

  titleEl.textContent = 'Loading...';
  bodyEl.innerHTML = '';
  overlay.classList.add('visible');
  overlay.scrollTop = 0;

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
              `<button class="modal-tag-approve" title="Approve">✓</button>` +
              `<button class="modal-tag-reject" title="Reject">✗</button>` +
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

    bodyEl.innerHTML = html;

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

      badge.querySelector('.modal-tag-reject')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await fetch(`${SERVER}/tags/reject`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag, itemId }),
        });
        badge.remove();
        tagStatusMap[tag] = 'rejected';
        loadPendingTags();
      });
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

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  document.getElementById('modal-close').addEventListener('click', closeModal);

  // Search bar
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    searchClear.classList.toggle('visible', q.length > 0 || !!searchInput.dataset.tagFilter);
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      delete searchInput.dataset.tagFilter;
      runSearch(q, '');
    }, 300);
  });

  searchClear.addEventListener('click', clearSearch);

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

  await Promise.all([loadRecentItems(), loadPendingTags()]);

  document.getElementById('save-btn').addEventListener('click', async () => {
    if (!currentUrl) { setStatus('No URL to save.', 'error'); return; }

    const btn = document.getElementById('save-btn');
    btn.disabled = true;

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

      setStatus('Queued — processing in background', 'success');
    } catch (err) {
      setStatus(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

init();
