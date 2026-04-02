import { getManifest, findBookForChapter, loadSearchIndex } from './chapters.js';
import { formatRef } from './refs.js';

const STORAGE_KEY = 'scripture-history';
const MAX_RECENT = 10;

let _dropdown = null;

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { recent: [] };
  } catch { return { recent: [] }; }
}

function saveHistory(h) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

export function savePosition(workId, chapterId) {
  const h = loadHistory();
  h.recent = h.recent.filter(e => !(e.workId === workId && e.chapterId === chapterId));
  h.recent.unshift({ workId, chapterId, ts: Date.now() });
  if (h.recent.length > MAX_RECENT) h.recent.length = MAX_RECENT;
  saveHistory(h);
}

export function getLastPosition() {
  const h = loadHistory();
  return h.recent.length ? h.recent[0] : null;
}

export function renderProgress($, workId, chapterId) {
  const bar = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');
  if (!bar || !label) return;

  const manifest = getManifest(workId);
  if (!manifest) return;

  const bookId = findBookForChapter(workId, chapterId);
  if (!bookId) return;

  const book = manifest.books.find(b => b.id === bookId);
  if (!book) return;

  const total = book.chapters.length;
  const idx = book.chapters.findIndex(ch => ch.id === chapterId);
  const current = idx + 1;

  bar.style.width = `${(current / total) * 100}%`;
  label.textContent = total === 1 ? book.name : `${book.name} \u2014 ${current} of ${total}`;
}

export function initResume($, navigateFn) {
  const btn = $.resumeBtn;
  if (!btn) return;

  _dropdown = document.createElement('div');
  _dropdown.className = 'resume-dropdown glass';
  _dropdown.hidden = true;
  document.body.appendChild(_dropdown);

  btn.addEventListener('click', async () => {
    if (!_dropdown.hidden) { _dropdown.hidden = true; return; }
    await renderResumeList(navigateFn);
    const rect = btn.getBoundingClientRect();
    _dropdown.style.top = `${rect.bottom + 4}px`;
    _dropdown.style.right = `${window.innerWidth - rect.right}px`;
    _dropdown.hidden = false;
  });

  document.addEventListener('click', (e) => {
    if (_dropdown.hidden) return;
    if (e.target.closest('.resume-dropdown') || e.target.closest('#resume-btn')) return;
    _dropdown.hidden = true;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !_dropdown.hidden) _dropdown.hidden = true;
  });
}

async function renderResumeList(navigateFn) {
  _dropdown.replaceChildren();

  const h = loadHistory();
  if (!h.recent.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No reading history yet.';
    _dropdown.appendChild(p);
    return;
  }

  const heading = document.createElement('div');
  heading.className = 'resume-heading';
  heading.textContent = 'Recent';
  _dropdown.appendChild(heading);

  let searchIndex = null;
  try { searchIndex = await loadSearchIndex(); } catch { /* ok */ }

  for (const entry of h.recent) {
    const row = document.createElement('div');
    row.className = 'resume-row';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    const refLabel = document.createElement('div');
    refLabel.className = 'resume-ref';
    refLabel.textContent = formatRef(entry.chapterId, 1).replace(/:1$/, '');
    row.appendChild(refLabel);

    const text = document.createElement('div');
    text.className = 'resume-text';
    let previewText = '';
    if (searchIndex) {
      const found = searchIndex.find(e => e.ref === `${entry.workId}:${entry.chapterId}:1`);
      if (found) previewText = found.text;
    }
    if (!previewText) {
      const manifest = getManifest(entry.workId);
      previewText = manifest ? manifest.title : entry.workId;
    }
    text.textContent = previewText;
    row.appendChild(text);

    const nav = () => { navigateFn(entry.workId, entry.chapterId); _dropdown.hidden = true; };
    row.addEventListener('click', nav);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(); }
    });
    _dropdown.appendChild(row);
  }
}
