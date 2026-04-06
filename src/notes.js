/* ===================================================================
   notes.js — localStorage-backed user notes per verse.
   Storage key: "scripture-user" → { notes: { ref: text }, bookmarks: [ref] }
   =================================================================== */

import { parseRef, getManifest, formatRef } from './chapters.js';

const STORAGE_KEY = 'scripture-user';
const OLD_KEY = 'scripture-notes';

let _$  = null;   // DOM cache reference
let _workId = null;
let _chapterId = null;
let _notesScope = 'chapter';
let _notesFilter = '';
let _bookmarksFilter = '';
let _bookmarksScope = 'chapter';
let _bm$ = null, _bmWorkId = null, _bmChapterId = null, _bmNavigateFn = null;

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

/* ── markdown helpers ───────────────────────────────────────────── */

function renderMarkdown(text) {
  let html = escapeHtml(text);
  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* (but not inside bold markers)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Verse refs: workId:chapterId:verse → clickable link
  html = html.replace(
    /\b([a-z]+:[a-z0-9-]+-\d+:\d+)\b/g,
    '<a class="note-ref-link" href="#" data-ref="$1">$1</a>'
  );
  return html;
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

  // Force full rebuild on chapter change, preserve controls on scope/filter change
  let listEl = container.querySelector('.notes-list');
  if (listEl && container.dataset.chapter !== `${workId}:${chapterId}`) {
    listEl = null;
  }
  if (!listEl) {
    container.replaceChildren();

    // Search input
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'sim-select notes-search-input';
    searchInput.placeholder = 'Filter notes\u2026';
    searchInput.setAttribute('aria-label', 'Filter notes');
    searchInput.value = _notesFilter;
    container.appendChild(searchInput);

    // Scope toggle
    const scopeRow = document.createElement('div');
    scopeRow.className = 'mode-toggles scope-toggles';

    const btnChapter = document.createElement('button');
    btnChapter.className = 'mode-btn' + (_notesScope === 'chapter' ? ' active' : '');
    btnChapter.dataset.scope = 'chapter';
    btnChapter.textContent = 'This chapter';
    scopeRow.appendChild(btnChapter);

    const btnAll = document.createElement('button');
    btnAll.className = 'mode-btn' + (_notesScope === 'all' ? ' active' : '');
    btnAll.dataset.scope = 'all';
    btnAll.textContent = 'All';
    scopeRow.appendChild(btnAll);

    container.appendChild(scopeRow);
    container.dataset.chapter = `${workId}:${chapterId}`;

    requestAnimationFrame(() => {
      _forms.bindModeGroup(scopeRow, 'scope', (val) => {
        _notesScope = val;
        renderNotes(_$, _workId, _chapterId);
      });
    });

    // Debounced search
    const debouncedRender = debounce(() => {
      _notesFilter = searchInput.value;
      renderNotes(_$, _workId, _chapterId);
    }, 250);
    searchInput.addEventListener('input', debouncedRender);

    listEl = document.createElement('div');
    listEl.className = 'notes-list';
    container.appendChild(listEl);
  } else {
    listEl.replaceChildren();
  }

  // Load notes
  const all = loadStore().notes;
  const filter = _notesFilter.toLowerCase();

  if (_notesScope === 'chapter') {
    renderNotesChapter(listEl, all, workId, chapterId, filter);
  } else {
    renderNotesAll(listEl, all, filter);
  }

  // Restore focus to search input after re-render
  if (_notesFilter) {
    const searchInput = container.querySelector('.notes-search-input');
    requestAnimationFrame(() => {
      searchInput.focus();
      searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
    });
  }
}

function renderNotesChapter(container, all, workId, chapterId, filter) {
  const prefix = `${workId}:${chapterId}:`;
  const entries = [];

  for (const [key, text] of Object.entries(all)) {
    if (key.startsWith(prefix) && text) {
      if (filter && !text.toLowerCase().includes(filter) && !key.toLowerCase().includes(filter)) continue;
      const verseNum = parseInt(key.slice(prefix.length), 10);
      entries.push({ verseNum, text });
    }
  }

  entries.sort((a, b) => a.verseNum - b.verseNum);

  if (!entries.length) {
    showEmpty(container, filter ? 'No matching notes.' : undefined);
    return;
  }

  for (const { verseNum, text } of entries) {
    container.appendChild(buildCard(verseNum, text));
  }
}

function renderNotesAll(container, all, filter) {
  const entries = [];
  for (const [key, text] of Object.entries(all)) {
    if (!text) continue;
    const parsed = parseRef(key);
    if (filter) {
      const ref = formatRef(parsed.chapterId, parsed.verse);
      if (!text.toLowerCase().includes(filter) && !ref.toLowerCase().includes(filter) && !key.toLowerCase().includes(filter)) continue;
    }
    entries.push({ ref: key, text, ...parsed });
  }

  if (!entries.length) {
    showEmpty(container, filter ? 'No matching notes.' : 'No notes yet.');
    return;
  }

  // Group by workId
  const grouped = new Map();
  for (const entry of entries) {
    if (!grouped.has(entry.workId)) grouped.set(entry.workId, []);
    grouped.get(entry.workId).push(entry);
  }

  const sortedGroups = [...grouped.entries()].map(([wId, items]) => {
    const manifest = getManifest(wId);
    return { wId, title: manifest ? manifest.title : wId, items };
  }).sort((a, b) => a.title.localeCompare(b.title));

  for (const { title, items } of sortedGroups) {
    const group = document.createElement('div');
    group.className = 'bookmark-work-group';

    const heading = document.createElement('h3');
    heading.textContent = title;
    group.appendChild(heading);

    items.sort((a, b) => {
      if (a.chapterId < b.chapterId) return -1;
      if (a.chapterId > b.chapterId) return 1;
      return a.verse - b.verse;
    });

    for (const entry of items) {
      const row = document.createElement('div');
      row.className = 'bookmark-row';
      row.setAttribute('tabindex', '0');
      row.setAttribute('role', 'button');

      const icon = document.createElement('span');
      icon.className = 'bookmark-icon note-icon-accent';
      icon.insertAdjacentHTML('afterbegin', _ICON.at('document', 16));
      row.appendChild(icon);

      const content = document.createElement('div');
      content.className = 'bookmark-content';

      const textEl = document.createElement('div');
      textEl.className = 'bookmark-text';
      textEl.textContent = entry.text;
      content.appendChild(textEl);

      const refEl = document.createElement('div');
      refEl.className = 'bookmark-ref';
      refEl.textContent = formatRef(entry.chapterId, entry.verse);
      content.appendChild(refEl);

      row.appendChild(content);

      const navigate = () => {
        history.pushState(null, '', `/scripture/${entry.workId}/${entry.chapterId}:${entry.verse}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      };
      row.addEventListener('click', navigate);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(); }
      });

      group.appendChild(row);
    }

    container.appendChild(group);
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
    // Switch from rendered display to editing mode
    const display = card.querySelector('.note-display');
    if (display) display.hidden = true;
    textarea.hidden = false;
    autoResize(textarea);
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

  // Note body container
  const body = document.createElement('div');
  body.className = 'note-body';

  // Rendered markdown display (shown when not editing)
  const display = document.createElement('div');
  display.className = 'note-display';

  // Auto-expanding textarea (shown when editing)
  const textarea = document.createElement('textarea');
  textarea.className = 'note-textarea';
  textarea.value = text;
  textarea.placeholder = 'Write a note\u2026';
  textarea.rows = 1;

  function showRendered() {
    if (textarea.value.trim()) {
      // Safe: renderMarkdown escapes input via escapeHtml() before inserting known-safe tags
      display.innerHTML = renderMarkdown(textarea.value.trim());
      display.hidden = false;
      textarea.hidden = true;
    }
  }

  function showEditing() {
    display.hidden = true;
    textarea.hidden = false;
    autoResize(textarea);
  }

  // Start in rendered mode if text exists
  if (text) {
    showRendered();
    textarea.hidden = true;
  } else {
    display.hidden = true;
  }

  // Click rendered display to edit
  display.addEventListener('click', (e) => {
    // Handle verse ref link clicks
    const refLink = e.target.closest('.note-ref-link');
    if (refLink) {
      e.preventDefault();
      const ref = refLink.dataset.ref;
      const slash = ref.indexOf(':');
      const lastColon = ref.lastIndexOf(':');
      const workId = ref.slice(0, slash);
      const chapterId = ref.slice(slash + 1, lastColon);
      const verse = parseInt(ref.slice(lastColon + 1), 10);
      history.pushState(null, '', `/scripture/${workId}/${chapterId}:${verse}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    showEditing();
    textarea.focus();
  });

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

  // On blur: show rendered view, or delete if empty
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
      const container = _$.notesContent;
      if (container && !container.querySelector('.note-card')) {
        showEmpty(container);
      }
    } else {
      showRendered();
    }
  });

  autoResize(textarea);

  body.appendChild(display);
  body.appendChild(textarea);
  card.appendChild(body);
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
  _bm$ = $; _bmWorkId = workId; _bmChapterId = chapterId; _bmNavigateFn = navigateFn;
  _bookmarksScope = scope;
  const container = $.bookmarksContent;

  // Force full rebuild on chapter change, preserve controls on scope/filter change
  let listEl = container.querySelector('.bookmarks-list');
  if (listEl && container.dataset.chapter !== `${workId}:${chapterId}`) {
    listEl = null;
  }
  if (!listEl) {
    container.replaceChildren();

    // Search input
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'sim-select notes-search-input';
    searchInput.placeholder = 'Filter bookmarks\u2026';
    searchInput.setAttribute('aria-label', 'Filter bookmarks');
    searchInput.value = _bookmarksFilter;
    container.appendChild(searchInput);

    // Scope toggle row
    const scopeRow = document.createElement('div');
    scopeRow.className = 'mode-toggles scope-toggles';

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

    container.appendChild(scopeRow);
    container.dataset.chapter = `${workId}:${chapterId}`;

    requestAnimationFrame(() => {
      _forms.bindModeGroup(scopeRow, 'scope', (val) => {
        renderBookmarks(_bm$, _bmWorkId, _bmChapterId, val, _bmNavigateFn);
      });
    });

    // Debounced search
    const debouncedRender = debounce(() => {
      _bookmarksFilter = searchInput.value;
      renderBookmarks(_bm$, _bmWorkId, _bmChapterId, _bookmarksScope, _bmNavigateFn);
    }, 250);
    searchInput.addEventListener('input', debouncedRender);

    listEl = document.createElement('div');
    listEl.className = 'bookmarks-list';
    container.appendChild(listEl);
  } else {
    listEl.replaceChildren();
  }

  const bookmarks = loadStore().bookmarks;
  const filter = _bookmarksFilter.toLowerCase();

  if (!bookmarks.length) {
    showBookmarksEmpty(listEl);
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
      .filter(entry => {
        if (!filter) return true;
        const verseEl = document.getElementById(`v${entry.verse}`);
        const text = verseEl ? verseEl.textContent.trim().toLowerCase() : '';
        const ref = formatRef(entry.chapterId, entry.verse).toLowerCase();
        return text.includes(filter) || ref.includes(filter);
      })
      .sort((a, b) => a.verse - b.verse);

    if (!entries.length) {
      showBookmarksEmpty(listEl, filter ? 'No matching bookmarks.' : undefined);
      return;
    }

    for (const entry of entries) {
      listEl.appendChild(buildBookmarkRow(entry, navigateFn));
    }
  } else {
    // Group by workId, sorted by manifest title
    const grouped = new Map();
    for (const ref of bookmarks) {
      const parsed = parseRef(ref);
      if (!parsed) continue;
      if (filter) {
        const fmtRef = formatRef(parsed.chapterId, parsed.verse).toLowerCase();
        if (!fmtRef.includes(filter) && !ref.toLowerCase().includes(filter)) continue;
      }
      if (!grouped.has(parsed.workId)) grouped.set(parsed.workId, []);
      grouped.get(parsed.workId).push({ ref, ...parsed });
    }

    // Sort groups by work title
    const sortedGroups = [...grouped.entries()].map(([wId, entries]) => {
      const manifest = getManifest(wId);
      return { wId, title: manifest ? manifest.title : wId, entries };
    }).sort((a, b) => a.title.localeCompare(b.title));

    if (!sortedGroups.length) {
      showBookmarksEmpty(listEl, filter ? 'No matching bookmarks.' : undefined);
      return;
    }

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

      listEl.appendChild(group);
    }
  }

  // Restore focus to search input after re-render
  if (_bookmarksFilter) {
    const searchInput = container.querySelector('.notes-search-input');
    requestAnimationFrame(() => {
      searchInput.focus();
      searchInput.selectionStart = searchInput.selectionEnd = searchInput.value.length;
    });
  }
}

function buildBookmarkRow(entry, navigateFn) {
  const row = document.createElement('div');
  row.className = 'bookmark-row';
  row.setAttribute('tabindex', '0');
  row.setAttribute('role', 'button');

  const icon = document.createElement('span');
  icon.className = 'bookmark-icon';
  icon.insertAdjacentHTML('afterbegin', _ICON.at('bookmarkFilled', 16));
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

function showBookmarksEmpty(container, msg) {
  const p = document.createElement('p');
  p.className = 'empty-state';
  p.textContent = msg || 'No bookmarks yet.';
  container.appendChild(p);
}

/* ── utilities ───────────────────────────────────────────────────── */

function autoResize(textarea) {
  requestAnimationFrame(() => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });
}

function showEmpty(container, msg) {
  const p = document.createElement('p');
  p.className = 'empty-state';
  p.textContent = msg || 'Click a verse number to add a note.';
  container.appendChild(p);
}
