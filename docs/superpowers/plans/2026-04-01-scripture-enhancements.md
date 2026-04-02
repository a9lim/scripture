# Scripture Reader Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verse actions, bookmarks, display settings, reading history, concordance, random verse, and related passages to the scripture reader.

**Architecture:** Hybrid interaction model — contextual popovers on verse elements, toolbar dropdowns for global features, inline content for related passages. All state persisted in localStorage under three keys. Two new Python scripts generate concordance and similarity data at build time.

**Tech Stack:** Vanilla ES6 modules, shared design system (`shared-*.js`), Python 3 for build scripts, scikit-learn for TF-IDF similarity.

---

### Task 1: Storage Migration and Unified User Data

**Files:**
- Modify: `src/notes.js`

This task migrates from the old `scripture-notes` localStorage key to the new unified `scripture-user` key and adds bookmark storage helpers. All subsequent tasks depend on this.

- [ ] **Step 1: Update storage constants and helpers in `src/notes.js`**

Replace the storage layer at the top of `src/notes.js`. The new format is `{ notes: { ref: text }, bookmarks: [ref] }`.

```js
const STORAGE_KEY = 'scripture-user';
const OLD_KEY = 'scripture-notes';

let _$  = null;
let _workId = null;
let _chapterId = null;

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
```

- [ ] **Step 2: Update all existing functions to use `loadStore()`/`saveStore()`**

In `renderNotes`:
```js
  const all = loadStore().notes;
```

In `buildCard` save handler:
```js
  const save = debounce(() => {
    const store = loadStore();
    const key = noteKey(_workId, _chapterId, verseNum);
    if (textarea.value.trim()) {
      store.notes[key] = textarea.value.trim();
      saveStore(store);
      showToast('Note saved');
    }
  }, 500);
```

In `buildCard` blur handler:
```js
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
    }
  });
```

- [ ] **Step 3: Add bookmark helpers**

Add these exports at the bottom of `src/notes.js`, before the utilities section:

```js
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
```

- [ ] **Step 4: Test manually in browser**

Open the app with existing notes in `scripture-notes`. Verify:
1. Notes migrate to `scripture-user` automatically
2. Old `scripture-notes` key is removed from localStorage
3. Existing notes display correctly
4. Adding/deleting notes works with the new storage format

- [ ] **Step 5: Commit**

```bash
git add src/notes.js
git commit -m "refactor: migrate notes to unified scripture-user storage with bookmark helpers"
```

---

### Task 2: Verse Action Popover

**Files:**
- Create: `src/popover.js`
- Modify: `main.js` (replace verse-click delegation)
- Modify: `styles.css` (popover styles)

- [ ] **Step 1: Create `src/popover.js`**

```js
const ICONS = {
  note: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  bookmark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>',
  copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
  link: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>'
};

let _el = null;
let _tooltip = null;
let _callbacks = null;
let _currentVerse = null;
let _leaveTimer = null;

function build() {
  const el = document.createElement('div');
  el.className = 'verse-popover';
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Verse actions');

  const btns = [
    { key: 'note',     label: 'Note',     cls: 'vp-note' },
    { key: 'bookmark', label: 'Bookmark', cls: 'vp-bookmark' },
    { key: 'copy',     label: 'Copy',     cls: 'vp-copy' },
    { key: 'link',     label: 'Link',     cls: 'vp-link' }
  ];

  for (let i = 0; i < btns.length; i++) {
    if (i === 2) {
      const sep = document.createElement('div');
      sep.className = 'vp-sep';
      el.appendChild(sep);
    }
    const btn = document.createElement('button');
    btn.className = `vp-btn ${btns[i].cls}`;
    btn.dataset.action = btns[i].key;
    btn.innerHTML = ICONS[btns[i].key];
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', btns[i].label);
    el.appendChild(btn);
  }

  return el;
}

function show(verseNum, anchorEl) {
  _currentVerse = verseNum;
  _el.hidden = false;

  const rect = anchorEl.getBoundingClientRect();
  const paneRect = anchorEl.closest('#reading-pane').getBoundingClientRect();
  _el.style.top = `${rect.bottom - paneRect.top + anchorEl.closest('#reading-pane').scrollTop + 4}px`;
  _el.style.left = `${rect.left - paneRect.left}px`;

  updateBookmarkIcon();
}

function hide() {
  _el.hidden = true;
  _currentVerse = null;
  clearTimeout(_leaveTimer);
}

function updateBookmarkIcon() {
  const svg = _el.querySelector('.vp-bookmark svg');
  if (!svg) return;
  const bookmarked = _callbacks.isBookmarked(_currentVerse);
  svg.setAttribute('fill', bookmarked ? 'currentColor' : 'none');
}

export function initPopover($, callbacks) {
  _callbacks = callbacks;
  _el = build();
  _el.hidden = true;
  _tooltip = createSimTooltip();

  $.readingPane.style.position = 'relative';
  $.readingPane.appendChild(_el);

  _el.addEventListener('click', (e) => {
    const btn = e.target.closest('.vp-btn');
    if (!btn || _currentVerse == null) return;
    const action = btn.dataset.action;
    if (action === 'note') callbacks.onNote(_currentVerse);
    else if (action === 'bookmark') {
      callbacks.onBookmark(_currentVerse);
      updateBookmarkIcon();
    }
    else if (action === 'copy') callbacks.onCopy(_currentVerse);
    else if (action === 'link') callbacks.onLink(_currentVerse);

    if (action !== 'note' && action !== 'bookmark') hide();
  });

  _el.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.vp-btn');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      _tooltip.show(rect.left + rect.width / 2, rect.bottom + 4, btn.getAttribute('aria-label'));
    }
  });
  _el.addEventListener('mouseout', (e) => {
    if (!e.target.closest('.vp-btn')) return;
    _tooltip.hide();
  });

  _el.addEventListener('mouseenter', () => clearTimeout(_leaveTimer));
  _el.addEventListener('mouseleave', () => {
    _leaveTimer = setTimeout(hide, 150);
  });

  $.verses.addEventListener('click', (e) => {
    const num = e.target.closest('.verse-num');
    if (!num) return;
    const verse = parseInt(num.dataset.verse, 10);
    if (_currentVerse === verse && !_el.hidden) {
      hide();
    } else {
      show(verse, num);
    }
  });
  $.verses.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const num = e.target.closest('.verse-num');
    if (!num) return;
    e.preventDefault();
    show(parseInt(num.dataset.verse, 10), num);
  });

  $.verses.addEventListener('mouseover', (e) => {
    const num = e.target.closest('.verse-num');
    if (num && parseInt(num.dataset.verse, 10) === _currentVerse) {
      clearTimeout(_leaveTimer);
    }
  });
  $.verses.addEventListener('mouseout', (e) => {
    const num = e.target.closest('.verse-num');
    if (num && parseInt(num.dataset.verse, 10) === _currentVerse) {
      _leaveTimer = setTimeout(hide, 150);
    }
  });

  document.addEventListener('click', (e) => {
    if (_el.hidden) return;
    if (e.target.closest('.verse-popover') || e.target.closest('.verse-num')) return;
    hide();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !_el.hidden) hide();
  });
}
```

- [ ] **Step 2: Add popover styles to `styles.css`**

Append before the responsive media queries:

```css
/* ---------- Verse Action Popover ---------- */

.verse-popover {
    position: absolute;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px;
    border-radius: var(--radius-md);
    background: var(--bg-panel);
    backdrop-filter: blur(12px) saturate(1.5);
}

.vp-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 10px;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-secondary);
    background: transparent;
    transition: background-color 0.15s, color 0.15s;
}

.vp-note     { color: var(--accent); }
.vp-note:hover { background: var(--accent-subtle); }

.vp-bookmark { color: var(--ext-yellow, #e8c840); }
.vp-bookmark:hover { background: color-mix(in srgb, var(--ext-yellow, #e8c840) 12%, transparent); }

.vp-copy     { color: var(--ext-green, #68c868); }
.vp-copy:hover { background: color-mix(in srgb, var(--ext-green, #68c868) 12%, transparent); }

.vp-link     { color: var(--ext-blue, #6496ff); }
.vp-link:hover { background: color-mix(in srgb, var(--ext-blue, #6496ff) 12%, transparent); }

.vp-sep {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 2px;
}
```

- [ ] **Step 3: Wire popover in `main.js`**

Add imports:
```js
import { initPopover } from './src/popover.js';
import { formatRef } from './src/refs.js';
```

Update the notes import to include bookmark helpers:
```js
import { initNotes, renderNotes, openNote, toggleBookmark, isBookmarked } from './src/notes.js';
```

In `init()`, replace the existing verse click delegation block (lines 186-196) with:

```js
  // Verse action popover
  initPopover($, {
    onNote: (verse) => openNote(verse),
    onBookmark: (verse) => {
      toggleBookmark(currentWork, currentChapter, verse);
    },
    onCopy: async (verse) => {
      const el = document.getElementById(`v${verse}`);
      if (!el) return;
      const text = el.textContent.trim();
      const ref = formatRef(currentChapter, verse);
      await navigator.clipboard.writeText(`${text} \u2014 ${ref}`);
      showToast('Copied to clipboard');
    },
    onLink: async (verse) => {
      const url = `${location.origin}${location.pathname}#${currentWork}/${currentChapter}:${verse}`;
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    },
    isBookmarked: (verse) => isBookmarked(currentWork, currentChapter, verse)
  });
```

- [ ] **Step 4: Test manually**

Verify: popover appears on verse-number click with 4 icons, tooltip on hover, persistent on hover, dismiss on leave/outside/escape, all 4 actions work.

- [ ] **Step 5: Commit**

```bash
git add src/popover.js main.js styles.css
git commit -m "feat: add verse action popover with note, bookmark, copy, link"
```

---

### Task 3: Sidebar Tabs (Notes + Bookmarks)

**Files:**
- Modify: `index.html` (tab markup in sidebar)
- Modify: `src/notes.js` (add `renderBookmarks`, tab switching)
- Modify: `main.js` (wire tab switching, add DOM cache entries)
- Modify: `styles.css` (tab and bookmark styles)

- [ ] **Step 1: Update sidebar markup in `index.html`**

Replace the notes sidebar (lines 164-176) with:

```html
    <aside id="notes-sidebar" class="sim-panel glass" role="complementary" aria-label="Notes and bookmarks">
        <div class="sheet-handle"></div>
        <div class="notes-header">
            <div class="sidebar-tabs" role="tablist" aria-label="Sidebar tabs">
                <button class="tab-btn active" data-tab="notes" role="tab" aria-selected="true">Notes</button>
                <button class="tab-btn" data-tab="bookmarks" role="tab" aria-selected="false">Bookmarks</button>
            </div>
            <button id="notes-close" class="tool-btn" title="Close panel" aria-label="Close panel">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div id="tab-notes" class="tab-panel active" role="tabpanel">
            <div id="notes-content" class="scrollbar-thin"></div>
        </div>
        <div id="tab-bookmarks" class="tab-panel" role="tabpanel">
            <div id="bookmarks-content" class="scrollbar-thin"></div>
        </div>
    </aside>
```

- [ ] **Step 2: Add `renderBookmarks` to `src/notes.js`**

Add imports at the top:
```js
import { parseRef, getManifest } from './chapters.js';
import { formatRef } from './refs.js';
```

Add the `renderBookmarks` export:

```js
export function renderBookmarks($, workId, chapterId, scope, navigateFn) {
  const container = $.bookmarksContent;
  if (!container) return;
  container.replaceChildren();

  const store = loadStore();
  const bookmarks = store.bookmarks;

  // Scope toggle
  const scopeRow = document.createElement('div');
  scopeRow.className = 'bookmark-scope';
  const btnChapter = document.createElement('button');
  btnChapter.className = `mode-btn${scope === 'chapter' ? ' active' : ''}`;
  btnChapter.textContent = 'This chapter';
  btnChapter.dataset.scope = 'chapter';
  const btnAll = document.createElement('button');
  btnAll.className = `mode-btn${scope === 'all' ? ' active' : ''}`;
  btnAll.textContent = 'All';
  btnAll.dataset.scope = 'all';
  scopeRow.appendChild(btnChapter);
  scopeRow.appendChild(btnAll);
  container.appendChild(scopeRow);

  _forms.bindModeGroup(scopeRow, 'scope', (val) => {
    renderBookmarks($, workId, chapterId, val, navigateFn);
  });

  if (!bookmarks.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No bookmarks yet. Click a verse number to bookmark.';
    container.appendChild(p);
    return;
  }

  const prefix = `${workId}:${chapterId}:`;
  const filtered = scope === 'chapter'
    ? bookmarks.filter(ref => ref.startsWith(prefix))
    : bookmarks;

  if (!filtered.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = scope === 'chapter'
      ? 'No bookmarks in this chapter.'
      : 'No bookmarks yet.';
    container.appendChild(p);
    return;
  }

  if (scope === 'all') {
    const groups = new Map();
    for (const ref of filtered) {
      const parsed = parseRef(ref);
      if (!groups.has(parsed.workId)) groups.set(parsed.workId, []);
      groups.get(parsed.workId).push({ ...parsed, ref });
    }

    const sortedGroups = [...groups.entries()].sort((a, b) => {
      const ma = getManifest(a[0]);
      const mb = getManifest(b[0]);
      return (ma?.title || a[0]).localeCompare(mb?.title || b[0]);
    });

    for (const [wId, entries] of sortedGroups) {
      const manifest = getManifest(wId);
      const groupEl = document.createElement('div');
      groupEl.className = 'bookmark-work-group';

      const heading = document.createElement('h3');
      heading.textContent = manifest ? manifest.title : wId;
      groupEl.appendChild(heading);

      for (const entry of entries) {
        groupEl.appendChild(buildBookmarkRow(entry, navigateFn));
      }
      container.appendChild(groupEl);
    }
  } else {
    const entries = filtered.map(ref => ({ ...parseRef(ref), ref }));
    entries.sort((a, b) => a.verse - b.verse);
    for (const entry of entries) {
      container.appendChild(buildBookmarkRow(entry, navigateFn));
    }
  }
}

function buildBookmarkRow(entry, navigateFn) {
  const row = document.createElement('div');
  row.className = 'bookmark-row';
  row.setAttribute('role', 'button');
  row.setAttribute('tabindex', '0');

  const icon = document.createElement('span');
  icon.className = 'bookmark-icon';
  icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>';
  row.appendChild(icon);

  const content = document.createElement('div');
  content.className = 'bookmark-content';

  const text = document.createElement('div');
  text.className = 'bookmark-text';
  const verseEl = document.getElementById(`v${entry.verse}`);
  text.textContent = verseEl ? verseEl.textContent.trim() : formatRef(entry.chapterId, entry.verse);
  content.appendChild(text);

  const ref = document.createElement('div');
  ref.className = 'bookmark-ref';
  ref.textContent = formatRef(entry.chapterId, entry.verse);
  content.appendChild(ref);

  row.appendChild(content);

  const nav = () => navigateFn(entry.workId, entry.chapterId, entry.verse);
  row.addEventListener('click', nav);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(); }
  });

  return row;
}
```

- [ ] **Step 3: Wire tab switching in `main.js` and add DOM cache entries**

Add to `$` cache:
```js
  bookmarksContent: document.getElementById('bookmarks-content'),
```

Add `renderBookmarks` to the notes import:
```js
import { initNotes, renderNotes, openNote, toggleBookmark, isBookmarked, renderBookmarks } from './src/notes.js';
```

In `init()`, after `initNotes` and `initSidebar`:

```js
  let bookmarkScope = 'chapter';
  const tabBookmarks = document.getElementById('tab-bookmarks');

  document.querySelectorAll('.sidebar-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.getElementById('tab-notes').classList.toggle('active', tab === 'notes');
      tabBookmarks.classList.toggle('active', tab === 'bookmarks');
      if (tab === 'bookmarks') {
        renderBookmarks($, currentWork, currentChapter, bookmarkScope, navigate);
      }
    });
  });
```

In `navigate()`, after `renderNotes`:
```js
    if (tabBookmarks && tabBookmarks.classList.contains('active')) {
      renderBookmarks($, workId, chapterId, bookmarkScope, navigate);
    }
```

- [ ] **Step 4: Update `reader.js` for bookmark indicators**

Update `renderChapter` signature:
```js
export function renderChapter($, chapter, isBookmarkedFn) {
```

Update `appendVerse` signature and add bookmark classes:
```js
function appendVerse(container, verse, isBookmarkedFn) {
  const row = document.createElement('div');
  row.className = 'verse-row';

  const bookmarked = isBookmarkedFn && isBookmarkedFn(verse.number);
  if (bookmarked) row.classList.add('bookmarked');

  const num = document.createElement('span');
  num.className = 'verse-num';
  if (bookmarked) num.classList.add('bookmarked');
  num.textContent = verse.number;
  num.dataset.verse = verse.number;
  num.setAttribute('role', 'button');
  num.setAttribute('tabindex', '0');
  num.setAttribute('aria-label', `Verse ${verse.number} \u2014 click for actions`);
  row.appendChild(num);

  const span = document.createElement('span');
  span.className = 'verse';
  span.id = `v${verse.number}`;
  span.dataset.verse = verse.number;
  span.textContent = verse.text + ' ';
  row.appendChild(span);

  container.appendChild(row);
}
```

Pass through `isBookmarkedFn` in the sections loop:
```js
      for (const v of chapter.sections[i].verses) {
        appendVerse(container, v, isBookmarkedFn);
      }
```

In `main.js`, update the `renderChapter` call:
```js
    renderChapter($, chapter, (verse) => isBookmarked(currentWork, currentChapter, verse));
```

- [ ] **Step 5: Add tab and bookmark styles to `styles.css`**

```css
/* ---------- Sidebar Tabs ---------- */

.sidebar-tabs {
    display: flex;
    gap: 0;
}

.sidebar-tabs .tab-btn {
    background: none;
    border: none;
    padding: 8px 16px;
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s;
}

.sidebar-tabs .tab-btn.active {
    color: var(--accent);
    box-shadow: inset 0 -2px 0 var(--accent);
}

.tab-panel {
    display: none;
    flex: 1;
    overflow-y: auto;
}

.tab-panel.active {
    display: flex;
    flex-direction: column;
}

/* ---------- Bookmarks ---------- */

.bookmark-scope {
    display: flex;
    gap: 4px;
    margin-bottom: 0.75rem;
    flex-shrink: 0;
}

.bookmark-scope .mode-btn {
    background: var(--bg-hover);
    border: none;
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    font-size: 0.7rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
}

.bookmark-scope .mode-btn.active {
    background: var(--accent-subtle);
    color: var(--accent);
}

.bookmark-work-group { margin-bottom: 1rem; }

.bookmark-work-group h3 {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin: 0 0 0.5rem;
}

.bookmark-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: var(--radius-md);
    background: var(--bg-elevated);
    margin-bottom: 6px;
    cursor: pointer;
    transition: background-color 0.15s;
}

.bookmark-row:hover { background: var(--bg-hover); }

.bookmark-icon { color: var(--ext-yellow, #e8c840); flex-shrink: 0; display: flex; }
.bookmark-content { flex: 1; min-width: 0; }

.bookmark-text {
    font-family: var(--font-body-serif);
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.bookmark-ref {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-top: 2px;
}

.verse-num.bookmarked::after {
    content: '';
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--ext-yellow, #e8c840);
    margin-left: 3px;
    vertical-align: super;
}

.verse-row.bookmarked .verse {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border-radius: var(--radius-sm, 2px);
}
```

- [ ] **Step 6: Test manually**

Verify: tabs switch, bookmarks show, scope toggle works, gold dots appear, verse background highlights.

- [ ] **Step 7: Commit**

```bash
git add index.html main.js src/notes.js src/reader.js styles.css
git commit -m "feat: add sidebar tabs with bookmarks, verse bookmark indicators"
```

---

### Task 4: Display Settings

**Files:**
- Create: `src/display.js`
- Modify: `index.html` (add toolbar buttons)
- Modify: `main.js` (import and init)
- Modify: `styles.css` (dropdown + CSS custom property usage)

- [ ] **Step 1: Update toolbar in `index.html`**

Replace the toolbar-right div with the full new button order:

```html
        <div class="toolbar-right sim-toolbar-actions">
            <button id="random-btn" class="tool-btn" title="Random Verse" aria-label="Random verse">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="1" width="22" height="22" rx="4"></rect>
                    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"></circle>
                    <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none"></circle>
                    <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none"></circle>
                    <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"></circle>
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"></circle>
                </svg>
            </button>
            <button id="download-btn" class="tool-btn" title="Download Text" aria-label="Download text file">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </button>
            <button id="search-btn" class="tool-btn" title="Search" aria-label="Open search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            </button>
            <button id="resume-btn" class="tool-btn" title="Resume Reading" aria-label="Resume reading">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            </button>
            <div class="tool-sep"></div>
            <button id="theme-btn" class="tool-btn" title="Toggle Theme" aria-label="Toggle theme">
                <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
            </button>
            <button id="display-btn" class="tool-btn" title="Display Settings" aria-label="Display settings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
                </svg>
            </button>
            <button id="about-btn" class="tool-btn" title="About" aria-label="About">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
            </button>
            <button id="notes-toggle" class="tool-btn" title="Toggle Notes" aria-label="Toggle notes panel" aria-expanded="false">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
        </div>
```

- [ ] **Step 2: Create `src/display.js`**

```js
const STORAGE_KEY = 'scripture-display';
const DEFAULTS = { fontSize: 18, lineHeight: 2.0, maxWidth: 800, font: 'serif' };

const FONTS = {
  serif:    'var(--font-body-serif)',
  sans:     'var(--font-body)',
  dyslexic: '"OpenDyslexic", var(--font-body)'
};

let _el = null;
let _dyslexicLink = null;
let _settings = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
}

function apply(pane) {
  pane.style.setProperty('--reader-font-size', `${_settings.fontSize}px`);
  pane.style.setProperty('--reader-line-height', `${_settings.lineHeight}`);
  pane.style.setProperty('--reader-max-width', `${_settings.maxWidth}px`);
  pane.style.setProperty('--reader-font-family', FONTS[_settings.font] || FONTS.serif);

  if (_settings.font === 'dyslexic' && !_dyslexicLink) {
    _dyslexicLink = document.createElement('link');
    _dyslexicLink.rel = 'stylesheet';
    _dyslexicLink.href = 'https://fonts.googleapis.com/css2?family=OpenDyslexic:ital,wght@0,400;0,700;1,400&display=swap';
    document.head.appendChild(_dyslexicLink);
  } else if (_settings.font !== 'dyslexic' && _dyslexicLink) {
    _dyslexicLink.remove();
    _dyslexicLink = null;
  }
}

function buildDropdown(pane) {
  const el = document.createElement('div');
  el.className = 'display-dropdown glass';
  el.hidden = true;

  el.innerHTML = `
    <div class="display-row">
      <label class="display-label">Font size</label>
      <input type="range" class="sim-slider" id="ds-fontsize" min="14" max="24" step="1" value="${_settings.fontSize}">
      <span class="display-val" id="ds-fontsize-val">${_settings.fontSize}px</span>
    </div>
    <div class="display-row">
      <label class="display-label">Line height</label>
      <input type="range" class="sim-slider" id="ds-lineheight" min="1.4" max="2.4" step="0.1" value="${_settings.lineHeight}">
      <span class="display-val" id="ds-lineheight-val">${_settings.lineHeight}</span>
    </div>
    <div class="display-row">
      <label class="display-label">Column width</label>
      <input type="range" class="sim-slider" id="ds-maxwidth" min="500" max="900" step="50" value="${_settings.maxWidth}">
      <span class="display-val" id="ds-maxwidth-val">${_settings.maxWidth}px</span>
    </div>
    <div class="display-row">
      <label class="display-label">Font</label>
      <div class="display-font-group" data-scope="font">
        <button class="mode-btn${_settings.font === 'serif' ? ' active' : ''}" data-font="serif">Serif</button>
        <button class="mode-btn${_settings.font === 'sans' ? ' active' : ''}" data-font="sans">Sans</button>
        <button class="mode-btn${_settings.font === 'dyslexic' ? ' active' : ''}" data-font="dyslexic">Dyslexic</button>
      </div>
    </div>
  `;

  _forms.bindSlider(el.querySelector('#ds-fontsize'), el.querySelector('#ds-fontsize-val'), (v) => {
    _settings.fontSize = v; save(); apply(pane);
  }, (v) => `${v}px`);

  _forms.bindSlider(el.querySelector('#ds-lineheight'), el.querySelector('#ds-lineheight-val'), (v) => {
    _settings.lineHeight = v; save(); apply(pane);
  }, (v) => `${v}`);

  _forms.bindSlider(el.querySelector('#ds-maxwidth'), el.querySelector('#ds-maxwidth-val'), (v) => {
    _settings.maxWidth = v; save(); apply(pane);
  }, (v) => `${v}px`);

  _forms.bindModeGroup(el.querySelector('.display-font-group'), 'font', (val) => {
    _settings.font = val; save(); apply(pane);
  });

  return el;
}

export function initDisplay($) {
  _settings = load();
  apply($.readingPane);

  _el = buildDropdown($.readingPane);
  document.body.appendChild(_el);

  const btn = document.getElementById('display-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    _el.hidden = !_el.hidden;
    if (!_el.hidden) {
      const rect = btn.getBoundingClientRect();
      _el.style.top = `${rect.bottom + 4}px`;
      _el.style.right = `${window.innerWidth - rect.right}px`;
    }
  });

  document.addEventListener('click', (e) => {
    if (_el.hidden) return;
    if (e.target.closest('.display-dropdown') || e.target.closest('#display-btn')) return;
    _el.hidden = true;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !_el.hidden) _el.hidden = true;
  });
}
```

- [ ] **Step 3: Add display styles and update reading pane to use CSS vars**

Update existing `#reading-pane` and `.verse` in `styles.css`:

```css
#reading-pane {
    flex: 1;
    max-width: var(--reader-max-width, 800px);
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem 3.5rem;
    overflow-y: auto;
    outline: none;
}

.verse {
    display: inline;
    font-family: var(--reader-font-family, var(--font-body-serif));
    font-size: var(--reader-font-size, 1.25rem);
    line-height: var(--reader-line-height, 2);
    color: var(--text);
}
```

Add new display dropdown styles:

```css
/* ---------- Display Settings Dropdown ---------- */

.display-dropdown {
    position: fixed;
    z-index: 100;
    width: 280px;
    padding: 1rem;
    border-radius: var(--radius-md);
    background: var(--bg-panel);
    backdrop-filter: blur(20px) saturate(1.5);
}

.display-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}

.display-row:last-child { margin-bottom: 0; }

.display-label {
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--text-muted);
    min-width: 80px;
    flex-shrink: 0;
}

.display-val {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-secondary);
    min-width: 40px;
    text-align: right;
}

.display-row .sim-slider { flex: 1; }

.display-font-group { display: flex; gap: 4px; }

.display-font-group .mode-btn {
    background: var(--bg-hover);
    border: none;
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    font-size: 0.7rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
}

.display-font-group .mode-btn.active {
    background: var(--accent-subtle);
    color: var(--accent);
}
```

- [ ] **Step 4: Wire in `main.js`**

Add import and DOM cache entries:
```js
import { initDisplay } from './src/display.js';
```

Add to `$` cache:
```js
  randomBtn:  document.getElementById('random-btn'),
  resumeBtn:  document.getElementById('resume-btn'),
```

In `init()`, after theme setup:
```js
  initDisplay($);
```

- [ ] **Step 5: Test and commit**

```bash
git add src/display.js index.html main.js styles.css
git commit -m "feat: add display settings with font, size, spacing, width controls"
```

---

### Task 5: Reading History and Progress

**Files:**
- Create: `src/history.js`
- Modify: `index.html` (progress bar in chapter-nav)
- Modify: `main.js` (wire history, update default route)
- Modify: `styles.css` (progress bar, resume dropdown)

- [ ] **Step 1: Add progress bar markup to `index.html`**

Update `#chapter-nav`:

```html
            <nav id="chapter-nav" aria-label="Chapter navigation">
                <a id="prev-chapter" class="ghost-btn" href="#">&larr; Previous</a>
                <div id="progress-container">
                    <div id="progress-bar"><div id="progress-fill"></div></div>
                    <span id="progress-label"></span>
                </div>
                <a id="next-chapter" class="ghost-btn" href="#">Next &rarr;</a>
            </nav>
```

- [ ] **Step 2: Create `src/history.js`**

```js
import { getManifest, findBookForChapter, loadSearchIndex, parseRef } from './chapters.js';
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
```

- [ ] **Step 3: Add styles**

```css
/* ---------- Progress Bar ---------- */

#progress-container { flex: 1; max-width: 200px; margin: 0 16px; text-align: center; }

#progress-bar {
    background: var(--bg-hover);
    border-radius: var(--radius-sm);
    height: 4px;
    overflow: hidden;
    margin-bottom: 4px;
}

#progress-fill {
    background: var(--accent);
    height: 100%;
    border-radius: var(--radius-sm);
    transition: width 0.3s var(--ease-out);
}

#progress-label { font-family: var(--font-body); font-size: 0.7rem; color: var(--text-muted); }

/* ---------- Resume Dropdown ---------- */

.resume-dropdown {
    position: fixed;
    z-index: 100;
    width: 320px;
    padding: 12px;
    border-radius: var(--radius-md);
    background: var(--bg-panel);
    backdrop-filter: blur(20px) saturate(1.5);
    max-height: 400px;
    overflow-y: auto;
}

.resume-heading {
    font-family: var(--font-body);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 8px;
}

.resume-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color 0.15s;
}

.resume-row:hover { background: var(--bg-hover); }

.resume-ref {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--accent);
    min-width: 80px;
    flex-shrink: 0;
}

.resume-text {
    font-family: var(--font-body-serif);
    font-size: 0.75rem;
    color: var(--text-secondary);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
```

- [ ] **Step 4: Wire in `main.js`**

Add import:
```js
import { savePosition, getLastPosition, renderProgress, initResume } from './src/history.js';
```

In `navigate()`, after `renderNotes`:
```js
    savePosition(workId, chapterId);
    renderProgress($, workId, chapterId);
```

Update `routeFromHash` default:
```js
  if (!hash) {
    const last = getLastPosition();
    if (last) { navigate(last.workId, last.chapterId); return; }
    const manifest = getManifest('bom');
    if (!manifest || !manifest.books.length) return;
    navigate('bom', manifest.books[0].chapters[0].id);
    return;
  }
```

In `init()`:
```js
  initResume($, navigate);
```

- [ ] **Step 5: Test and commit**

```bash
git add src/history.js index.html main.js styles.css
git commit -m "feat: add reading history, resume dropdown, and progress bar"
```

---

### Task 6: Random Verse

**Files:**
- Modify: `main.js`
- Modify: `styles.css`

- [ ] **Step 1: Add random verse logic to `main.js`**

Update chapters.js import to include needed exports:
```js
import { loadManifests, getManifest, loadChapter, getAdjacentChapters, loadSearchIndex, parseRef, getWorkIds } from './src/chapters.js';
```

In `init()`, after search setup:

```js
  // Random verse
  let randomDropdown = null;

  async function goRandom(filterWork) {
    const index = await loadSearchIndex();
    if (!index.length) return;
    if (!index[0]._workId) {
      for (const entry of index) {
        const p = parseRef(entry.ref);
        entry._workId = p.workId;
        entry._chapterId = p.chapterId;
      }
    }
    let pool = filterWork ? index.filter(e => e._workId === filterWork) : index;
    if (!pool.length) return;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    const p = parseRef(entry.ref);
    navigate(p.workId, p.chapterId, p.verse);
    if (randomDropdown) randomDropdown.hidden = true;
  }

  $.randomBtn.addEventListener('click', (e) => {
    if (e.shiftKey) showRandomFilter();
    else goRandom(null);
  });

  let pressTimer = null;
  $.randomBtn.addEventListener('pointerdown', () => {
    pressTimer = setTimeout(() => showRandomFilter(), 500);
  });
  $.randomBtn.addEventListener('pointerup', () => clearTimeout(pressTimer));
  $.randomBtn.addEventListener('pointerleave', () => clearTimeout(pressTimer));

  function showRandomFilter() {
    if (!randomDropdown) {
      randomDropdown = document.createElement('div');
      randomDropdown.className = 'random-dropdown glass';
      document.body.appendChild(randomDropdown);
      document.addEventListener('click', (e) => {
        if (randomDropdown.hidden) return;
        if (e.target.closest('.random-dropdown') || e.target.closest('#random-btn')) return;
        randomDropdown.hidden = true;
      });
    }
    randomDropdown.replaceChildren();
    for (const id of getWorkIds()) {
      const m = getManifest(id);
      if (!m) continue;
      const row = document.createElement('div');
      row.className = 'random-work-row';
      row.textContent = m.title;
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.addEventListener('click', () => goRandom(id));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goRandom(id); }
      });
      randomDropdown.appendChild(row);
    }
    const rect = $.randomBtn.getBoundingClientRect();
    randomDropdown.style.top = `${rect.bottom + 4}px`;
    randomDropdown.style.left = `${rect.left}px`;
    randomDropdown.hidden = false;
  }
```

Add `r` to shortcuts and about panel config.

- [ ] **Step 2: Add random dropdown styles**

```css
/* ---------- Random Verse Dropdown ---------- */

.random-dropdown {
    position: fixed;
    z-index: 100;
    width: 220px;
    padding: 6px;
    border-radius: var(--radius-md);
    background: var(--bg-panel);
    backdrop-filter: blur(20px) saturate(1.5);
    max-height: 400px;
    overflow-y: auto;
}

.random-work-row {
    padding: 8px 12px;
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color 0.15s;
}

.random-work-row:hover { background: var(--bg-hover); color: var(--text); }
```

- [ ] **Step 3: Test and commit**

```bash
git add main.js styles.css
git commit -m "feat: add random verse button with work filter"
```

---

### Task 7: Concordance Build Script

**Files:**
- Create: `extract/concordance.py`
- Modify: `extract/run.sh`

- [ ] **Step 1: Create `extract/concordance.py`**

```python
#!/usr/bin/env python3
"""Build a concordance index from extracted scripture data.

Usage::

    python3 concordance.py <data_dir>

Writes ``<data_dir>/concordance.json``.
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict

STOPWORDS = frozenset("""
a about above after again against all am an and any are as at be because
been before being below between both but by can could did do does doing
down during each few for from further get got had has have having he her
here hers herself him himself his how i if in into is it its itself let
me more most my myself no nor not of off on once only or other our ours
ourselves out over own same she should so some such than that the their
theirs them themselves then there these they this those through to too
under until up upon us very was we were what when where which while who
whom why will with would ye you your yours yourself yourselves shall also
unto thee thou thy thine hath doth art wilt shalt saith thereof therein
whereby wherefore wherein even thus therefore now yet said may might came
went forth upon every neither toward whether like one two three four five
six seven eight nine ten first second third been being his
""".split())

TOKEN_RE = re.compile(r"[a-z]+(?:'[a-z]+)?")


def build_concordance(data_dir: str) -> None:
    works_path = os.path.join(data_dir, "works.json")
    if not os.path.isfile(works_path):
        print(f"Error: {works_path} not found.", file=sys.stderr)
        sys.exit(1)

    with open(works_path, "r", encoding="utf-8") as f:
        work_order = json.load(f)

    concordance: dict[str, list[str]] = defaultdict(list)

    for work_id in work_order:
        chapters_dir = os.path.join(data_dir, work_id, "chapters")
        if not os.path.isdir(chapters_dir):
            continue

        for chapter_file in sorted(os.listdir(chapters_dir)):
            if not chapter_file.endswith(".json"):
                continue

            with open(os.path.join(chapters_dir, chapter_file), "r", encoding="utf-8") as f:
                chapter = json.load(f)

            chapter_id = chapter["id"]
            for section in chapter.get("sections", []):
                for verse in section.get("verses", []):
                    ref = f"{work_id}:{chapter_id}:{verse['number']}"
                    words = set(TOKEN_RE.findall(verse["text"].lower()))
                    for word in words:
                        if word not in STOPWORDS and len(word) > 1:
                            concordance[word].append(ref)

    sorted_conc = dict(sorted(concordance.items()))

    with open(os.path.join(data_dir, "concordance.json"), "w", encoding="utf-8") as f:
        json.dump(sorted_conc, f, ensure_ascii=False)

    total_refs = sum(len(v) for v in sorted_conc.values())
    print(f"Concordance: {len(sorted_conc)} words, {total_refs} total references.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build concordance index.")
    parser.add_argument("data_dir", help="Root data directory")
    args = parser.parse_args()
    if not os.path.isdir(args.data_dir):
        print(f"Error: not found: {args.data_dir}", file=sys.stderr)
        sys.exit(1)
    build_concordance(args.data_dir)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Update `extract/run.sh`**

Add before the `*` catch-all case:

```bash
concordance)
    echo "Building concordance index"
    python3 concordance.py "$DATA"
    ;;

similarity)
    echo "Building similarity index"
    python3 similarity.py "$DATA"
    ;;

enrich)
    echo "Building concordance index"
    python3 concordance.py "$DATA"
    echo "Building similarity index"
    python3 similarity.py "$DATA"
    ;;
```

Update the usage line and update `txt2json` to call enrich after reindex.

- [ ] **Step 3: Run and verify**

```bash
cd extract && python3 concordance.py ../data
```

- [ ] **Step 4: Commit**

```bash
git add extract/concordance.py extract/run.sh
git commit -m "feat: add concordance build script"
```

---

### Task 8: Concordance Frontend

**Files:**
- Create: `src/concordance.js`
- Modify: `index.html` (concordance overlay)
- Modify: `src/reader.js` (word wrapping)
- Modify: `main.js` (import and init)
- Modify: `styles.css`

- [ ] **Step 1: Add word wrapping to `reader.js`**

In `appendVerse`, replace `span.textContent = verse.text + ' ';` with:

```js
  const words = verse.text.split(/(\s+)/);
  for (const w of words) {
    if (/^\s+$/.test(w)) {
      span.appendChild(document.createTextNode(w));
    } else {
      const ws = document.createElement('span');
      ws.className = 'word';
      ws.textContent = w;
      span.appendChild(ws);
    }
  }
  span.appendChild(document.createTextNode(' '));
```

- [ ] **Step 2: Add concordance overlay to `index.html`**

After the search overlay:

```html
    <div id="concordance-overlay" class="sim-overlay hidden" role="dialog" aria-modal="true" aria-label="Concordance">
        <div class="sim-overlay-panel glass">
            <div class="overlay-header">
                <input id="concordance-input" type="search" class="sim-select" placeholder="Look up a word..." aria-label="Concordance word lookup">
                <button id="concordance-close" class="tool-btn" title="Close" aria-label="Close concordance">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div id="concordance-results" class="sim-overlay-body"></div>
        </div>
    </div>
```

- [ ] **Step 3: Create `src/concordance.js`**

```js
import { loadSearchIndex, parseRef, getManifest, getWorkIds } from './chapters.js';
import { formatRef } from './refs.js';

let _concordance = null;
let _searchIndex = null;
let _popover = null;

async function loadConcordance() {
  if (_concordance) return _concordance;
  const res = await fetch('data/concordance.json');
  if (!res.ok) throw new Error(`concordance: ${res.status}`);
  _concordance = await res.json();
  return _concordance;
}

async function ensureSearchIndex() {
  if (_searchIndex) return _searchIndex;
  _searchIndex = await loadSearchIndex();
  return _searchIndex;
}

function getVerseText(ref) {
  if (!_searchIndex) return null;
  const entry = _searchIndex.find(e => e.ref === ref);
  return entry ? entry.text : null;
}

function showPopover(word, anchorEl, pane, navigateFn) {
  const clean = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!clean || !_concordance || !_concordance[clean]) {
    _popover.hidden = true;
    return;
  }

  const refs = _concordance[clean];
  _popover.replaceChildren();
  _popover.hidden = false;

  const rect = anchorEl.getBoundingClientRect();
  const paneRect = pane.getBoundingClientRect();
  _popover.style.top = `${rect.bottom - paneRect.top + pane.scrollTop + 4}px`;
  _popover.style.left = `${rect.left - paneRect.left}px`;

  const header = document.createElement('div');
  header.className = 'conc-pop-header';
  header.innerHTML = `<strong>${escapeHtml(clean)}</strong> <span class="conc-pop-count">${refs.length} occurrence${refs.length !== 1 ? 's' : ''}</span>`;
  _popover.appendChild(header);

  for (const ref of refs.slice(0, 5)) {
    const parsed = parseRef(ref);
    const row = document.createElement('div');
    row.className = 'conc-pop-row';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    const refEl = document.createElement('span');
    refEl.className = 'conc-pop-ref';
    refEl.textContent = formatRef(parsed.chapterId, parsed.verse);
    row.appendChild(refEl);

    const text = getVerseText(ref);
    if (text) {
      const textEl = document.createElement('span');
      textEl.className = 'conc-pop-text';
      textEl.textContent = text;
      row.appendChild(textEl);
    }

    const nav = () => { navigateFn(parsed.workId, parsed.chapterId, parsed.verse); _popover.hidden = true; };
    row.addEventListener('click', nav);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(); }
    });
    _popover.appendChild(row);
  }

  if (refs.length > 5) {
    const seeAll = document.createElement('div');
    seeAll.className = 'conc-pop-seeall';
    seeAll.textContent = `See all ${refs.length} occurrences`;
    seeAll.setAttribute('role', 'button');
    seeAll.setAttribute('tabindex', '0');
    seeAll.addEventListener('click', () => { _popover.hidden = true; openOverlay(clean, navigateFn); });
    _popover.appendChild(seeAll);
  }
}

function openOverlay(word, navigateFn) {
  const overlay = document.getElementById('concordance-overlay');
  const input = document.getElementById('concordance-input');
  const results = document.getElementById('concordance-results');

  overlay.classList.remove('hidden');
  input.value = word || '';
  const trapCleanup = trapFocus(overlay);

  if (word) renderOverlayResults(word, results, navigateFn);

  const doSearch = debounce(() => {
    renderOverlayResults(input.value.trim().toLowerCase().replace(/[^a-z']/g, ''), results, navigateFn);
  }, 250);
  input.addEventListener('input', doSearch);
  input.focus();

  const close = () => { overlay.classList.add('hidden'); if (trapCleanup) trapCleanup(); };
  const closeBtn = document.getElementById('concordance-close');
  closeBtn.addEventListener('click', close, { once: true });
  initOverlayDismiss(overlay, closeBtn, close);
}

function renderOverlayResults(word, container, navigateFn) {
  container.replaceChildren();
  if (!word || !_concordance || !_concordance[word]) {
    if (word) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'No occurrences found.';
      container.appendChild(p);
    }
    return;
  }

  const refs = _concordance[word];
  const groups = new Map();
  for (const ref of refs) {
    const parsed = parseRef(ref);
    if (!groups.has(parsed.workId)) groups.set(parsed.workId, []);
    groups.get(parsed.workId).push(parsed);
  }

  for (const wId of getWorkIds()) {
    if (!groups.has(wId)) continue;
    const manifest = getManifest(wId);
    const groupEl = document.createElement('div');
    groupEl.className = 'search-work-group';

    const heading = document.createElement('h3');
    heading.textContent = manifest ? manifest.title : wId;
    groupEl.appendChild(heading);

    for (const parsed of groups.get(wId)) {
      const row = document.createElement('div');
      row.className = 'search-result';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');

      const refLabel = document.createElement('div');
      refLabel.className = 'search-ref-label';
      refLabel.textContent = formatRef(parsed.chapterId, parsed.verse);
      row.appendChild(refLabel);

      const text = getVerseText(`${parsed.workId}:${parsed.chapterId}:${parsed.verse}`);
      if (text) {
        const textEl = document.createElement('div');
        highlightWord(textEl, text, word);
        row.appendChild(textEl);
      }

      const nav = () => navigateFn(parsed.workId, parsed.chapterId, parsed.verse);
      row.addEventListener('click', nav);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(); }
      });
      groupEl.appendChild(row);
    }
    container.appendChild(groupEl);
  }
}

function highlightWord(el, text, word) {
  const re = new RegExp(`\\b${word}\\b`, 'gi');
  let lastIdx = 0, match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) el.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(match.index, match.index + word.length);
    el.appendChild(mark);
    lastIdx = match.index + word.length;
  }
  if (lastIdx < text.length) el.appendChild(document.createTextNode(text.slice(lastIdx)));
  if (lastIdx === 0) el.textContent = text;
}

export function initConcordance($, navigateFn) {
  _popover = document.createElement('div');
  _popover.className = 'conc-popover';
  _popover.hidden = true;
  $.readingPane.appendChild(_popover);

  $.verses.addEventListener('click', async (e) => {
    const wordEl = e.target.closest('.word');
    if (!wordEl || e.target.closest('.verse-num')) return;
    try {
      await loadConcordance();
      await ensureSearchIndex();
      showPopover(wordEl.textContent, wordEl, $.readingPane, navigateFn);
    } catch { showToast('Failed to load concordance'); }
  });

  document.addEventListener('click', (e) => {
    if (_popover.hidden) return;
    if (e.target.closest('.conc-popover') || e.target.closest('.word')) return;
    _popover.hidden = true;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !_popover.hidden) _popover.hidden = true;
  });
}
```

- [ ] **Step 4: Add concordance styles**

```css
.word { cursor: pointer; border-radius: 2px; transition: background-color 0.1s; }
.word:hover { background: var(--bg-hover); }

.conc-popover {
    position: absolute;
    z-index: 20;
    width: 320px;
    padding: 10px;
    border-radius: var(--radius-md);
    background: var(--bg-panel);
    backdrop-filter: blur(12px) saturate(1.5);
    max-height: 300px;
    overflow-y: auto;
}

.conc-pop-header { font-size: 0.85rem; color: var(--text); margin-bottom: 8px; }
.conc-pop-count { font-size: 0.7rem; color: var(--text-muted); margin-left: 4px; }

.conc-pop-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 4px 0;
    font-size: 0.8rem;
    cursor: pointer;
    color: var(--text-secondary);
}

.conc-pop-row:hover { color: var(--text); }
.conc-pop-ref { font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent); flex-shrink: 0; min-width: 70px; }
.conc-pop-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.conc-pop-seeall {
    margin-top: 6px;
    padding-top: 6px;
    font-size: 0.75rem;
    color: var(--accent);
    cursor: pointer;
}

.conc-pop-seeall:hover { text-decoration: underline; }
```

- [ ] **Step 5: Wire in `main.js`**

```js
import { initConcordance } from './src/concordance.js';
```

In `init()`:
```js
  initConcordance($, (workId, chapterId, verse) => navigate(workId, chapterId, verse));
```

- [ ] **Step 6: Test and commit**

```bash
git add src/concordance.js src/reader.js index.html main.js styles.css
git commit -m "feat: add concordance with word-click popover and full overlay"
```

---

### Task 9: Similarity Build Script

**Files:**
- Create: `extract/similarity.py`

- [ ] **Step 1: Create `extract/similarity.py`**

```python
#!/usr/bin/env python3
"""Build chapter similarity index using TF-IDF cosine similarity.

Usage::

    python3 similarity.py <data_dir>

Requires scikit-learn: ``pip install scikit-learn``
Writes ``<data_dir>/similarity.json``.
"""

import argparse
import json
import os
import sys

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print("Error: scikit-learn required. pip install scikit-learn", file=sys.stderr)
    sys.exit(1)

MIN_SCORE = 0.1
TOP_N = 5


def build_similarity(data_dir: str) -> None:
    works_path = os.path.join(data_dir, "works.json")
    if not os.path.isfile(works_path):
        print(f"Error: {works_path} not found.", file=sys.stderr)
        sys.exit(1)

    with open(works_path, "r", encoding="utf-8") as f:
        work_order = json.load(f)

    chapters = []

    for work_id in work_order:
        work_dir = os.path.join(data_dir, work_id)
        manifest_path = os.path.join(work_dir, "manifest.json")
        if not os.path.isfile(manifest_path):
            continue

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        chapter_to_book = {}
        for book in manifest.get("books", []):
            for ch in book.get("chapters", []):
                chapter_to_book[ch["id"]] = book["id"]

        chapters_dir = os.path.join(work_dir, "chapters")
        if not os.path.isdir(chapters_dir):
            continue

        for chapter_file in sorted(os.listdir(chapters_dir)):
            if not chapter_file.endswith(".json"):
                continue

            with open(os.path.join(chapters_dir, chapter_file), "r", encoding="utf-8") as f:
                chapter = json.load(f)

            chapter_id = chapter["id"]
            parts = []
            for section in chapter.get("sections", []):
                for verse in section.get("verses", []):
                    parts.append(verse["text"])

            text = " ".join(parts)
            if text.strip():
                chapters.append({
                    "workId": work_id,
                    "chapterId": chapter_id,
                    "bookId": chapter_to_book.get(chapter_id, ""),
                    "text": text,
                })

    if not chapters:
        print("No chapters found.")
        return

    print(f"Computing similarity for {len(chapters)} chapters...")

    texts = [ch["text"] for ch in chapters]
    vectorizer = TfidfVectorizer(stop_words="english", max_features=20000)
    tfidf = vectorizer.fit_transform(texts)
    sim_matrix = cosine_similarity(tfidf)

    result = {}
    for i, ch in enumerate(chapters):
        scores = []
        for j, other in enumerate(chapters):
            if i == j:
                continue
            if ch["bookId"] == other["bookId"] and ch["workId"] == other["workId"]:
                continue
            score = float(sim_matrix[i, j])
            if score >= MIN_SCORE:
                scores.append({"ref": f"{other['workId']}:{other['chapterId']}", "score": round(score, 3)})

        scores.sort(key=lambda x: x["score"], reverse=True)
        if scores:
            result[ch["chapterId"]] = scores[:TOP_N]

    with open(os.path.join(data_dir, "similarity.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)

    print(f"Similarity: {len(result)} chapters with matches.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build chapter similarity index.")
    parser.add_argument("data_dir", help="Root data directory")
    args = parser.parse_args()
    if not os.path.isdir(args.data_dir):
        print(f"Error: not found: {args.data_dir}", file=sys.stderr)
        sys.exit(1)
    build_similarity(args.data_dir)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run and verify**

```bash
cd extract && python3 similarity.py ../data
```

- [ ] **Step 3: Commit**

```bash
git add extract/similarity.py
git commit -m "feat: add TF-IDF similarity build script"
```

---

### Task 10: Related Passages Frontend

**Files:**
- Create: `src/related.js`
- Modify: `index.html`
- Modify: `main.js`
- Modify: `styles.css`

- [ ] **Step 1: Add related passages container to `index.html`**

Between `#verses` and `#chapter-nav`:

```html
            <div id="related-container" class="hidden">
                <button id="related-toggle" class="ghost-btn related-toggle">Related Passages</button>
                <div id="related-list" class="related-list hidden"></div>
            </div>
```

- [ ] **Step 2: Create `src/related.js`**

```js
import { getManifest, chapterNum, findBookForChapter } from './chapters.js';

let _similarity = null;

async function loadSimilarity() {
  if (_similarity) return _similarity;
  const res = await fetch('data/similarity.json');
  if (!res.ok) throw new Error(`similarity: ${res.status}`);
  _similarity = await res.json();
  return _similarity;
}

function getChapterTitle(workId, chapterId) {
  const manifest = getManifest(workId);
  if (!manifest) return chapterId;
  const bookId = findBookForChapter(workId, chapterId);
  if (!bookId) return chapterId;
  const book = manifest.books.find(b => b.id === bookId);
  if (!book) return chapterId;
  if (book.chapters.length === 1) return book.name;
  if (manifest.books.length === 1) return `${manifest.title} ${chapterNum(chapterId)}`;
  return `${book.name} ${chapterNum(chapterId)}`;
}

export function renderRelated($, workId, chapterId, navigateFn) {
  const container = document.getElementById('related-container');
  const toggle = document.getElementById('related-toggle');
  const list = document.getElementById('related-list');
  if (!container || !toggle || !list) return;

  container.classList.add('hidden');
  list.classList.add('hidden');
  list.replaceChildren();

  loadSimilarity().then(sim => {
    const matches = sim[chapterId];
    if (!matches || !matches.length) return;

    container.classList.remove('hidden');

    const newToggle = toggle.cloneNode(true);
    toggle.replaceWith(newToggle);

    newToggle.addEventListener('click', () => {
      const wasHidden = list.classList.contains('hidden');
      list.classList.toggle('hidden');
      newToggle.classList.toggle('expanded', wasHidden);
      if (wasHidden && !list.children.length) renderList(list, matches, navigateFn);
    });
  }).catch(() => { /* graceful no-op */ });
}

function renderList(list, matches, navigateFn) {
  const groups = new Map();
  for (const match of matches) {
    const [workId, chapterId] = match.ref.split(':');
    if (!groups.has(workId)) groups.set(workId, []);
    groups.get(workId).push({ workId, chapterId, score: match.score });
  }

  const sorted = [...groups.entries()].sort((a, b) => {
    const ma = getManifest(a[0]);
    const mb = getManifest(b[0]);
    return (ma?.title || a[0]).localeCompare(mb?.title || b[0]);
  });

  for (const [wId, entries] of sorted) {
    const manifest = getManifest(wId);
    const groupEl = document.createElement('div');
    groupEl.className = 'related-work-group';

    const heading = document.createElement('h4');
    heading.textContent = manifest ? manifest.title : wId;
    groupEl.appendChild(heading);

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'related-row';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.style.opacity = 0.5 + entry.score * 0.5;

      const title = document.createElement('span');
      title.textContent = getChapterTitle(entry.workId, entry.chapterId);
      row.appendChild(title);

      const nav = () => navigateFn(entry.workId, entry.chapterId);
      row.addEventListener('click', nav);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(); }
      });
      groupEl.appendChild(row);
    }
    list.appendChild(groupEl);
  }
}
```

- [ ] **Step 3: Add related styles**

```css
/* ---------- Related Passages ---------- */

#related-container { margin-top: 2rem; }

.related-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    width: 100%;
    justify-content: center;
}

.related-toggle::before { content: '\25B6'; font-size: 0.6rem; transition: transform 0.2s; }
.related-toggle.expanded::before { transform: rotate(90deg); }

.related-list { margin-top: 1rem; }
.related-work-group { margin-bottom: 1rem; }

.related-work-group h4 {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin: 0 0 0.5rem;
}

.related-row {
    padding: 6px 0;
    cursor: pointer;
    color: var(--text-secondary);
    font-family: var(--font-body-serif);
    font-size: 0.9rem;
    transition: color 0.15s;
}

.related-row:hover { color: var(--text); }
```

- [ ] **Step 4: Wire in `main.js`**

```js
import { renderRelated } from './src/related.js';
```

In `navigate()`, after `renderProgress`:
```js
    renderRelated($, workId, chapterId, navigate);
```

- [ ] **Step 5: Test and commit**

```bash
git add src/related.js index.html main.js styles.css
git commit -m "feat: add related passages section with TF-IDF similarity"
```

---

### Task 11: Generate Data, Update Docs, Final Polish

**Files:**
- Data: `data/concordance.json`, `data/similarity.json`
- Modify: `main.js` (about panel update)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Generate data files**

```bash
cd extract && python3 concordance.py ../data && python3 similarity.py ../data
```

- [ ] **Step 2: Update about panel in `main.js`**

```js
    controls: [
      { label: 'Work / Book / Chapter', value: 'Toolbar dropdowns to navigate' },
      { label: 'Verse actions', value: 'Click verse number for note, bookmark, copy, link' },
      { label: 'Concordance', value: 'Click any word to see all occurrences' },
      { label: 'Display', value: 'Adjust font, size, spacing, and width' },
      { label: 'Download', value: 'Download current work as text file' }
    ],
    shortcuts: [
      { key: '/', label: 'Open search', group: 'Navigation' },
      { key: 'r', label: 'Random verse', group: 'Navigation' },
      { key: '?', label: 'About / help', group: 'Navigation' },
      { key: 'ArrowLeft', label: 'Previous chapter', group: 'Navigation' },
      { key: 'ArrowRight', label: 'Next chapter', group: 'Navigation' },
      { key: 'Escape', label: 'Close overlay', group: 'Navigation' }
    ],
```

- [ ] **Step 3: Update CLAUDE.md with new features, data files, scripts, localStorage keys, toolbar layout**

- [ ] **Step 4: Commit**

```bash
git add data/concordance.json data/similarity.json main.js CLAUDE.md
git commit -m "feat: generate concordance/similarity data, update docs and about panel"
```

---

### Task 12: Final Integration Test

- [ ] **Step 1: Full manual test**

Serve from repo root: `python -m http.server`

Verify all features:
1. Verse popover: 4 icons, tooltips, persistent hover, dismiss
2. Bookmark: toggle, gold dot, highlight, sidebar tab
3. Copy/Link: clipboard, toast
4. Sidebar tabs: Notes/Bookmarks switch, scope toggle
5. Display settings: all 4 controls work and persist
6. OpenDyslexic: loads on demand
7. Reading history: auto-save, resume dropdown, default route
8. Progress bar: correct position within book
9. Random verse: click, shift-click filter, `r` shortcut
10. Concordance: word click popover, "see all" overlay, manual lookup
11. Related passages: button, expand, grouped by work, navigate
12. Mobile: test at 600px and 375px widths
13. Theme toggle: all new elements respect light/dark
14. No console errors
15. Storage migration: old `scripture-notes` migrates correctly

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Final commit if needed**
