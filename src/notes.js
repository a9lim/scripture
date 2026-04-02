/* ===================================================================
   notes.js — localStorage-backed user notes per verse.
   Storage key: "scripture-user" → { notes: { ref: text }, bookmarks: [ref] }
   =================================================================== */

import { parseRef, getManifest } from './chapters.js';
import { formatRef } from './refs.js';

const STORAGE_KEY = 'scripture-user';
const OLD_KEY = 'scripture-notes';

let _$  = null;   // DOM cache reference
let _workId = null;
let _chapterId = null;

/* ── storage helpers ─────────────────────────────────────────────── */

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }

  // Migrate from old key
  try {
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const notes = JSON.parse(old);
      const store = { notes, bookmarks: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      localStorage.removeItem(OLD_KEY);
      return store;
    }
  } catch { /* ignore */ }

  return { notes: {}, bookmarks: [] };
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function noteKey(workId, chapterId, verseNum) {
  return `${workId}:${chapterId}:${verseNum}`;
}

/* ── public API ──────────────────────────────────────────────────── */

/**
 * Store the DOM cache reference for later use.
 */
export function initNotes($) {
  _$ = $;
}

/**
 * Render note cards for the current chapter into the notes sidebar.
 * Cards are sorted by verse number. Shows empty state when no notes exist.
 */
export function renderNotes($, workId, chapterId) {
  _$ = $;
  _workId = workId;
  _chapterId = chapterId;

  const container = $.notesContent;
  container.replaceChildren();

  const all = loadStore().notes;
  const prefix = `${workId}:${chapterId}:`;
  const entries = [];

  for (const [key, text] of Object.entries(all)) {
    if (key.startsWith(prefix) && text) {
      const verseNum = parseInt(key.slice(prefix.length), 10);
      entries.push({ verseNum, text });
    }
  }

  entries.sort((a, b) => a.verseNum - b.verseNum);

  if (!entries.length) {
    showEmpty(container);
    return;
  }

  for (const { verseNum, text } of entries) {
    container.appendChild(buildCard(verseNum, text));
  }
}

/**
 * Open the sidebar (if closed), create a note card for the given verse
 * if one doesn't exist, focus the textarea, and scroll it into view.
 */
export function openNote(verseNum) {
  if (!_$ || !_workId || !_chapterId) return;

  // Open sidebar if closed
  const sidebar = _$.notesSidebar;
  if (sidebar && !sidebar.classList.contains('open')) {
    _toolbar.toggleSidebar(_$.notesToggle, sidebar);
  }

  const container = _$.notesContent;

  // Remove empty state if present
  const empty = container.querySelector('.empty-state');
  if (empty) empty.remove();

  // Check if card already exists
  let card = container.querySelector(`[data-verse="${verseNum}"]`);
  if (!card) {
    card = buildCard(verseNum, '');
    // Insert in sorted position
    const cards = container.querySelectorAll('.note-card');
    let inserted = false;
    for (const existing of cards) {
      const existingVerse = parseInt(existing.dataset.verse, 10);
      if (verseNum < existingVerse) {
        container.insertBefore(card, existing);
        inserted = true;
        break;
      }
    }
    if (!inserted) container.appendChild(card);
  }

  const textarea = card.querySelector('textarea');
  if (textarea) {
    textarea.focus();
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/* ── card construction ───────────────────────────────────────────── */

function buildCard(verseNum, text) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.dataset.verse = verseNum;

  // Verse number button — scrolls to verse in reading pane
  const verseBtn = document.createElement('button');
  verseBtn.className = 'note-verse-btn';
  verseBtn.textContent = verseNum;
  verseBtn.setAttribute('type', 'button');
  verseBtn.setAttribute('aria-label', `Scroll to verse ${verseNum}`);
  verseBtn.addEventListener('click', () => {
    const el = document.getElementById(`v${verseNum}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  card.appendChild(verseBtn);

  // Auto-expanding textarea
  const textarea = document.createElement('textarea');
  textarea.className = 'note-textarea';
  textarea.value = text;
  textarea.placeholder = 'Write a note\u2026';
  textarea.rows = 1;
  autoResize(textarea);

  // Save on input (debounced)
  const save = debounce(() => {
    const store = loadStore();
    const key = noteKey(_workId, _chapterId, verseNum);
    if (textarea.value.trim()) {
      store.notes[key] = textarea.value.trim();
      saveStore(store);
      showToast('Note saved');
    }
  }, 500);

  textarea.addEventListener('input', () => {
    autoResize(textarea);
    save();
  });

  // Delete on blur when empty
  textarea.addEventListener('blur', () => {
    if (!textarea.value.trim()) {
      const store = loadStore();
      const key = noteKey(_workId, _chapterId, verseNum);
      if (store.notes[key]) {
        delete store.notes[key];
        saveStore(store);
        showToast('Note deleted');
      }
      card.remove();
      // Show empty state if no cards remain
      const container = _$.notesContent;
      if (container && !container.querySelector('.note-card')) {
        showEmpty(container);
      }
    }
  });

  card.appendChild(textarea);
  return card;
}

/* ── bookmark helpers ────────────────────────────────────────────── */

export function toggleBookmark(workId, chapterId, verseNum) {
  const store = loadStore();
  const ref = noteKey(workId, chapterId, verseNum);
  const idx = store.bookmarks.indexOf(ref);
  if (idx === -1) {
    store.bookmarks.push(ref);
    saveStore(store);
    _haptics.trigger('selection');
    showToast('Bookmarked');
    return true;
  } else {
    store.bookmarks.splice(idx, 1);
    saveStore(store);
    _haptics.trigger('light');
    showToast('Bookmark removed');
    return false;
  }
}

export function isBookmarked(workId, chapterId, verseNum) {
  const store = loadStore();
  return store.bookmarks.includes(noteKey(workId, chapterId, verseNum));
}

export function getBookmarks() {
  return loadStore().bookmarks;
}

/* ── bookmarks rendering ─────────────────────────────────────────── */

/**
 * Render bookmarks into the bookmarks tab panel.
 * scope: 'chapter' | 'all'
 */
export function renderBookmarks($, workId, chapterId, scope, navigateFn) {
  const container = $.bookmarksContent;
  container.replaceChildren();

  // Scope toggle row
  const scopeRow = document.createElement('div');
  scopeRow.className = 'bookmark-scope';

  const btnChapter = document.createElement('button');
  btnChapter.className = 'mode-btn' + (scope === 'chapter' ? ' active' : '');
  btnChapter.dataset.scope = 'chapter';
  btnChapter.textContent = 'This chapter';
  scopeRow.appendChild(btnChapter);

  const btnAll = document.createElement('button');
  btnAll.className = 'mode-btn' + (scope === 'all' ? ' active' : '');
  btnAll.dataset.scope = 'all';
  btnAll.textContent = 'All';
  scopeRow.appendChild(btnAll);

  _forms.bindModeGroup(scopeRow, 'scope', (val) => {
    renderBookmarks($, workId, chapterId, val, navigateFn);
  });

  container.appendChild(scopeRow);

  const bookmarks = loadStore().bookmarks;

  if (!bookmarks.length) {
    showBookmarksEmpty(container);
    return;
  }

  if (scope === 'chapter') {
    const prefix = `${workId}:${chapterId}:`;
    const entries = bookmarks
      .filter(ref => ref.startsWith(prefix))
      .map(ref => {
        const parsed = parseRef(ref);
        return { ref, ...parsed };
      })
      .sort((a, b) => a.verse - b.verse);

    if (!entries.length) {
      showBookmarksEmpty(container);
      return;
    }

    for (const entry of entries) {
      container.appendChild(buildBookmarkRow(entry, navigateFn));
    }
  } else {
    // Group by workId, sorted by manifest title
    const grouped = new Map();
    for (const ref of bookmarks) {
      const parsed = parseRef(ref);
      if (!parsed) continue;
      if (!grouped.has(parsed.workId)) grouped.set(parsed.workId, []);
      grouped.get(parsed.workId).push({ ref, ...parsed });
    }

    // Sort groups by work title
    const sortedGroups = [...grouped.entries()].map(([wId, entries]) => {
      const manifest = getManifest(wId);
      return { wId, title: manifest ? manifest.title : wId, entries };
    }).sort((a, b) => a.title.localeCompare(b.title));

    for (const { title, entries } of sortedGroups) {
      const group = document.createElement('div');
      group.className = 'bookmark-work-group';

      const heading = document.createElement('h3');
      heading.textContent = title;
      group.appendChild(heading);

      // Sort entries within group by chapterId then verse
      entries.sort((a, b) => {
        if (a.chapterId < b.chapterId) return -1;
        if (a.chapterId > b.chapterId) return 1;
        return a.verse - b.verse;
      });

      for (const entry of entries) {
        group.appendChild(buildBookmarkRow(entry, navigateFn));
      }

      container.appendChild(group);
    }
  }
}

function buildBookmarkRow(entry, navigateFn) {
  const row = document.createElement('div');
  row.className = 'bookmark-row';
  row.setAttribute('tabindex', '0');
  row.setAttribute('role', 'button');

  const icon = document.createElement('span');
  icon.className = 'bookmark-icon';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('stroke', 'none');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z');
  svg.appendChild(path);
  icon.appendChild(svg);
  row.appendChild(icon);

  const content = document.createElement('div');
  content.className = 'bookmark-content';

  // Verse text: try to find it in the DOM, fallback to ref
  const verseEl = document.getElementById(`v${entry.verse}`);
  const preview = verseEl ? verseEl.textContent.trim() : entry.ref;

  const textEl = document.createElement('div');
  textEl.className = 'bookmark-text';
  textEl.textContent = preview;
  content.appendChild(textEl);

  const refEl = document.createElement('div');
  refEl.className = 'bookmark-ref';
  refEl.textContent = formatRef(entry.chapterId, entry.verse);
  content.appendChild(refEl);

  row.appendChild(content);

  const activate = () => navigateFn(entry.workId, entry.chapterId, entry.verse);
  row.addEventListener('click', activate);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  });

  return row;
}

function showBookmarksEmpty(container) {
  const p = document.createElement('p');
  p.className = 'empty-state';
  p.textContent = 'No bookmarks yet.';
  container.appendChild(p);
}

/* ── utilities ───────────────────────────────────────────────────── */

function autoResize(textarea) {
  requestAnimationFrame(() => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });
}

function showEmpty(container) {
  const p = document.createElement('p');
  p.className = 'empty-state';
  p.textContent = 'Click a verse number to add a note.';
  container.appendChild(p);
}
