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
          <a class="item-title" href="${escapeAttr(item.url)}" title="${escapeAttr(item.title)}">${escapeHtml(item.title)}</a>
          <div class="item-date">${formatDate(item.dateAdded)}</div>
        </div>`
      )
      .join('');

    // Open links in a new tab
    list.querySelectorAll('.item-title').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: a.href });
      });
    });
  } catch {
    list.innerHTML = '<div class="empty-state">Could not load items.</div>';
  }
}

function setStatus(msg, type = '') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = type;
}

async function pollStatus(id, pollInterval = 1500) {
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER}/status/${id}`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) { clearInterval(timer); resolve({ status: 'error', error: `HTTP ${res.status}` }); return; }
        const job = await res.json();
        if (job.status === 'done' || job.status === 'error') {
          clearInterval(timer);
          resolve(job);
        }
      } catch {
        clearInterval(timer);
        resolve({ status: 'error', error: 'Lost connection to server' });
      }
    }, pollInterval);
  });
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
  // Get current tab URL
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
    setStatus('Saving...');

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

      const { id } = await res.json();
      const job = await pollStatus(id);

      if (job.status === 'done') {
        setStatus(`Saved: ${job.title ?? currentUrl}`, 'success');
        await loadRecentItems();
      } else {
        setStatus(`Error: ${job.error ?? 'Unknown error'}`, 'error');
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

init();
