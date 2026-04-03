/* ===================================================================
   data-io.js — Export/import user data (notes, bookmarks, settings, history).
   =================================================================== */

const KEYS = ['scripture-user', 'scripture-display', 'scripture-history'];

/* ── export ────────────────────────────────────────────────────────── */

export function exportData() {
  const data = {};
  for (const k of KEYS) {
    const raw = localStorage.getItem(k);
    if (raw) {
      try { data[k] = JSON.parse(raw); }
      catch { data[k] = raw; }
    }
  }
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `scripture-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported');
}

/* ── import (internal) ─────────────────────────────────────────────── */

function importData(replace) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch { showToast('Invalid JSON file'); return; }

      if (replace) {
        for (const k of KEYS) {
          if (data[k] !== undefined) localStorage.setItem(k, JSON.stringify(data[k]));
          else localStorage.removeItem(k);
        }
        showToast('Data replaced — reloading');
      } else {
        // Merge scripture-user
        const existing = JSON.parse(localStorage.getItem('scripture-user') || '{"notes":{},"bookmarks":[]}');
        const incoming = data['scripture-user'] || { notes: {}, bookmarks: [] };
        const merged = {
          notes: Object.assign({}, existing.notes || {}, incoming.notes || {}),
          bookmarks: [...new Set([...(existing.bookmarks || []), ...(incoming.bookmarks || [])])]
        };
        localStorage.setItem('scripture-user', JSON.stringify(merged));

        // Overwrite display and history
        if (data['scripture-display']) localStorage.setItem('scripture-display', JSON.stringify(data['scripture-display']));
        if (data['scripture-history']) localStorage.setItem('scripture-history', JSON.stringify(data['scripture-history']));

        const noteCount = Object.keys(incoming.notes || {}).length;
        const bmCount = (incoming.bookmarks || []).length;
        showToast(`Merged ${noteCount} notes, ${bmCount} bookmarks — reloading`);
      }
      setTimeout(() => location.reload(), 600);
    };
    reader.readAsText(file);
  });
  input.click();
}

/* ── prompt dialog ─────────────────────────────────────────────────── */

export function promptImport() {
  const overlay = document.createElement('div');
  overlay.className = 'sim-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Import data');

  const panel = document.createElement('div');
  panel.className = 'sim-overlay-panel glass import-dialog';

  const heading = document.createElement('h2');
  heading.className = 'import-heading';
  heading.textContent = 'Import Data';

  const desc = document.createElement('p');
  desc.className = 'import-desc';
  desc.textContent = 'Merge keeps existing data and adds new entries. Replace overwrites everything.';

  const actions = document.createElement('div');
  actions.className = 'import-actions';

  const mergeBtn = document.createElement('button');
  mergeBtn.className = 'ghost-btn';
  mergeBtn.textContent = 'Merge';

  const replaceBtn = document.createElement('button');
  replaceBtn.className = 'ghost-btn import-replace-btn';
  replaceBtn.textContent = 'Replace All';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'ghost-btn';
  cancelBtn.textContent = 'Cancel';

  actions.appendChild(mergeBtn);
  actions.appendChild(replaceBtn);
  actions.appendChild(cancelBtn);
  panel.appendChild(heading);
  panel.appendChild(desc);
  panel.appendChild(actions);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close() { overlay.remove(); }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  mergeBtn.addEventListener('click', () => {
    close();
    importData(false);
  });

  replaceBtn.addEventListener('click', () => {
    if (!confirm('Replace all data? This cannot be undone.')) return;
    close();
    importData(true);
  });
}
