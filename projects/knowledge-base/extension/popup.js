const SERVER = 'http://127.0.0.1:3737';

let currentUrl = '';

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

async function loadRecentItems() {
  const list = document.getElementById('items-list');
  try {
    const res = await fetch(`${SERVER}/items`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    if (!items.length) {
      list.innerHTML = '<div class="empty-state">No items saved yet.</div>';
      return;
    }
    const recent = items.slice(-5).reverse();
    list.innerHTML = recent
      .map(
        (item) => `
        <div class="item">
          <div class="item-body">
            <a class="item-title" href="${escapeAttr(item.url)}" title="${escapeAttr(item.title)}">${escapeHtml(item.title)}</a>
            <div class="item-date">${formatDate(item.dateAdded)}</div>
          </div>
          <button class="read-btn" data-id="${escapeAttr(item.id)}">Read</button>
        </div>`
      )
      .join('');

    list.querySelectorAll('.item-title').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: a.href });
      });
    });

    list.querySelectorAll('.read-btn').forEach((btn) => {
      btn.addEventListener('click', () => openModal(btn.dataset.id));
    });
  } catch {
    list.innerHTML = '<div class="empty-state">Could not load items.</div>';
  }
}

async function openModal(id) {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');

  // Show with loading state
  titleEl.textContent = 'Loading...';
  bodyEl.innerHTML = '';
  overlay.classList.add('visible');
  overlay.scrollTop = 0;

  try {
    const res = await fetch(`${SERVER}/items/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const item = await res.json();

    titleEl.textContent = item.title ?? id;

    // Summary
    let html = `<p class="modal-summary">${escapeHtml(item.summary ?? '')}</p>`;

    // Sections
    if (Array.isArray(item.sections) && item.sections.length) {
      html += item.sections
        .map((s) => {
          const points = Array.isArray(s.points) ? s.points : [];
          return `<h3 class="modal-section-title">${escapeHtml(s.title)}</h3>
            <ul class="modal-points">${points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`;
        })
        .join('');
    }

    // Tags
    if (Array.isArray(item.tags) && item.tags.length) {
      html += `<div class="modal-tags">${item.tags.map((t) => `<span class="modal-tag">${escapeHtml(t)}</span>`).join('')}</div>`;
    }

    // Full transcript collapsible
    if (item.content) {
      html += `<details class="modal-transcript">
        <summary>Full transcript</summary>
        <pre>${escapeHtml(item.content)}</pre>
      </details>`;
    }

    // Open original link
    html += `<a class="modal-open-link" id="modal-open-link" href="#">Open original &rarr;</a>`;

    bodyEl.innerHTML = html;

    const openLink = document.getElementById('modal-open-link');
    openLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: item.url });
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

async function init() {
  document.getElementById('modal-close').addEventListener('click', closeModal);

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

  await loadRecentItems();

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

      // Fire-and-forget — don't poll, return immediately
      setStatus('Queued — processing in background', 'success');
    } catch (err) {
      setStatus(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

init();
