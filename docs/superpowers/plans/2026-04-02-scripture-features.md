# Scripture Feature Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six independent features to the scripture reader: bookmark highlighting (yellow), rich markdown notes, enhanced notes sidebar, split-pane parallel reading, text-to-speech, and export/import.

**Architecture:** Each feature is an independent module. No test framework exists — verify each feature by serving locally (`python -m http.server` from repo root) and checking in-browser. All features are frontend-only vanilla JS with zero dependencies.

**Tech Stack:** Vanilla ES6 modules, CSS custom properties, browser SpeechSynthesis API, localStorage

**Key conventions:**
- Shared globals (`_toolbar`, `_forms`, `_haptics`, `showToast`, `debounce`, `escapeHtml`, `createSimTooltip`, `initShortcuts`, `initAboutPanel`, `initOverlayDismiss`, `trapFocus`) come from `shared-*.js` — they are window globals, NOT ES6 imports
- `_forms.bindModeGroup(container, dataAttr, onChange)` — binds `.mode-btn` children, swaps `.active` class
- No borders on panels/buttons — differentiate with background color only
- No resting shadows — shadows only on hover/active/focus
- DOM cache `$` is created in `main.js` and passed to all init functions

**Security note:** The codebase uses `escapeHtml()` (from `shared-utils.js`) for sanitizing user-provided content before DOM insertion. The markdown renderer in Task 2 applies `escapeHtml()` first, then replaces known-safe patterns. All other DOM construction uses `textContent` or safe DOM methods. `innerHTML` is only used for static developer-authored markup (icons, layout scaffolding) — never for user content.

---

### Task 1: Bookmark Verse Highlighting (Yellow)

**Files:**
- Modify: `styles.css:487-490` (bookmark styles)

The bookmark highlighting already works structurally — `reader.js:66` adds `.bookmarked` class to `.verse-row`, and `styles.css:487-490` applies a background tint. The only change is making the tint yellow instead of accent-colored.

- [ ] **Step 1: Update bookmark verse background to yellow**

In `styles.css`, change the `.verse-row.bookmarked .verse` rule from accent-based to yellow-based:

```css
/* Old: */
.verse-row.bookmarked .verse {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border-radius: var(--radius-sm, 2px);
}

/* New: */
.verse-row.bookmarked .verse {
    background: color-mix(in srgb, var(--ext-yellow, #e8c840) 12%, transparent);
    border-radius: var(--radius-sm, 2px);
}
```

This reuses the same `--ext-yellow` token already used by the bookmark icon and bookmark popover button, ensuring visual consistency.

- [ ] **Step 2: Verify in browser**

Run: `cd /Users/a9lim/Work/a9lim.github.io && python -m http.server`

Open `http://localhost:8000/scripture/`. Bookmark a verse via the popover. Confirm: the verse text gets a subtle yellow background tint in both light and dark themes.

- [ ] **Step 3: Commit**

```bash
git add scripture/styles.css
git commit -m "feat(scripture): yellow bookmark highlight on verse text"
```

---

### Task 2: Rich Notes (Markdown Rendering)

**Files:**
- Modify: `src/notes.js:136-198` (buildCard function)

Add markdown rendering to note cards: bold (`**text**`), italic (`*text*`), and verse reference auto-linking (`workId:chapterId:verse` becomes a clickable link).

- [ ] **Step 1: Add markdown render function to notes.js**

Add this function after the `noteKey` function (around line 44) in `src/notes.js`:

```js
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
```

Note: `escapeHtml()` is called first to sanitize user input. The subsequent replacements only produce known-safe HTML tags (`<strong>`, `<em>`, `<a>`) from patterns that cannot contain nested HTML because the input was already escaped.

- [ ] **Step 2: Add rendered display div and toggle behavior in buildCard**

Replace the textarea section in `buildCard` (the part that creates and wires the textarea) with a version that includes a rendered display div. The full `buildCard` function becomes:

```js
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
      location.hash = `${workId}/${chapterId}:${verse}`;
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
```

- [ ] **Step 3: Add CSS for rendered note display**

Add to the end of `styles.css`:

```css
/* ---------- Rich Note Display ---------- */

.note-body {
    flex: 1;
    min-width: 0;
}

.note-display {
    font-family: var(--font-body-serif);
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--text);
    cursor: text;
    padding: 0.2rem 0;
    min-height: 1.4em;
}

.note-display strong { font-weight: 600; }
.note-display em { font-style: italic; }

.note-ref-link {
    color: var(--accent);
    text-decoration: none;
    font-family: var(--font-mono);
    font-size: 0.8em;
    cursor: pointer;
}

.note-ref-link:hover {
    text-decoration: underline;
}
```

- [ ] **Step 4: Verify in browser**

Serve locally. Navigate to any chapter. Add a note with text: `This is **bold** and *italic* and see ot:gen-1:26 for reference`. Blur the textarea. Verify:
- Bold and italic render correctly
- `ot:gen-1:26` renders as a clickable link
- Clicking the link navigates to Genesis 1:26
- Clicking the rendered text re-enters edit mode with raw markdown

- [ ] **Step 5: Commit**

```bash
git add scripture/src/notes.js scripture/styles.css
git commit -m "feat(scripture): rich markdown notes with bold, italic, and verse ref links"
```

---

### Task 3: Enhanced Notes Sidebar

**Files:**
- Modify: `src/notes.js` (renderNotes, renderBookmarks — add scope toggle, global view, search)
- Modify: `styles.css` (notes search input styles)
- Modify: `main.js:211-215` (bookmarks tab click handler)

Three sub-features: scope toggle on both tabs, global notes view, notes search/filter.

- [ ] **Step 1: Add scope toggle and global view to renderNotes**

Replace the `renderNotes` function in `src/notes.js` with a version that supports chapter/all scope and search. Also add a module-level variable to track notes scope:

```js
let _notesScope = 'chapter';
let _notesFilter = '';

/**
 * Render note cards into the notes sidebar.
 * Supports chapter/all scope and text filtering.
 */
export function renderNotes($, workId, chapterId) {
  _$ = $;
  _workId = workId;
  _chapterId = chapterId;

  const container = $.notesContent;
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
  scopeRow.className = 'bookmark-scope';

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

  _forms.bindModeGroup(scopeRow, 'scope', (val) => {
    _notesScope = val;
    renderNotes($, _workId, _chapterId);
  });

  container.appendChild(scopeRow);

  // Debounced search
  const debouncedRender = debounce(() => {
    _notesFilter = searchInput.value;
    renderNotes($, _workId, _chapterId);
  }, 250);
  searchInput.addEventListener('input', debouncedRender);

  // Load notes
  const all = loadStore().notes;
  const filter = _notesFilter.toLowerCase();

  if (_notesScope === 'chapter') {
    renderNotesChapter(container, all, workId, chapterId, filter);
  } else {
    renderNotesAll(container, all, filter);
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
    if (filter) {
      const parsed = parseRef(key);
      const ref = formatRef(parsed.chapterId, parsed.verse);
      if (!text.toLowerCase().includes(filter) && !ref.toLowerCase().includes(filter) && !key.toLowerCase().includes(filter)) continue;
    }
    const parsed = parseRef(key);
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
        location.hash = `${entry.workId}/${entry.chapterId}:${entry.verse}`;
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
```

- [ ] **Step 2: Update showEmpty to accept custom message**

```js
function showEmpty(container, msg) {
  const p = document.createElement('p');
  p.className = 'empty-state';
  p.textContent = msg || 'Click a verse number to add a note.';
  container.appendChild(p);
}
```

- [ ] **Step 3: Add notes tab refresh listener in main.js**

In `main.js`, after the bookmarks tab listener (around line 215), add a notes tab listener:

```js
document.querySelector('.sidebar-tabs .tab-btn[data-tab="notes"]')
  ?.addEventListener('click', () => {
    renderNotes($, currentWork, currentChapter);
  });
```

- [ ] **Step 4: Add CSS for notes search input**

Add to `styles.css`:

```css
/* ---------- Notes Search ---------- */

.notes-search-input {
    width: 100%;
    margin-bottom: 0.5rem;
    font-size: 0.8rem;
    flex-shrink: 0;
}
```

- [ ] **Step 5: Verify in browser**

Serve locally. Add notes to verses in multiple chapters/works. Verify:
- Notes tab shows scope toggle ("This chapter" / "All") — same style as bookmarks
- "All" scope groups notes by work with formatted references
- Clicking a note row in "All" scope navigates to that verse
- Search input filters notes by text content and reference
- Empty states display correctly when no notes match

- [ ] **Step 6: Commit**

```bash
git add scripture/src/notes.js scripture/main.js scripture/styles.css
git commit -m "feat(scripture): enhanced notes sidebar with scope toggle, global view, and search"
```

---

### Task 4: Split-Pane Parallel Reading

**Files:**
- Create: `src/split.js`
- Modify: `main.js` (routing, toolbar button, split state)
- Modify: `index.html` (compare button in toolbar)
- Modify: `styles.css` (split-pane layout styles)

This is the largest task. The split-pane creates a second independent reading pane with its own nav dropdowns.

- [ ] **Step 1: Add Compare button to toolbar in index.html**

In `index.html`, add the compare button after the resume button (after line 135) and before the `tool-sep`:

```html
<button id="compare-btn" class="tool-btn compare-btn-desktop" title="Compare (Split Pane)" aria-label="Open split pane">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="12" y1="3" x2="12" y2="21"/>
    </svg>
</button>
```

Add `compareBtn` to the DOM cache in `main.js` (after `resumeBtn` in the `$` object):

```js
compareBtn:       document.getElementById('compare-btn'),
```

- [ ] **Step 2: Create src/split.js**

```js
/* ===================================================================
   split.js — Split-pane parallel reading.
   Opens a second independent reading pane beside the primary one.
   =================================================================== */

import { loadChapter, getAdjacentChapters, findBookForChapter, getWorkIds, getManifest, chapterIdAt, chapterNum, formatRef } from './chapters.js';
import { fillSelect } from './nav.js';
import { isBookmarked, toggleBookmark } from './notes.js';
import { initPopover } from './popover.js';
import { initConcordance } from './concordance.js';

let _pane = null;        // secondary pane DOM
let _workId = null;
let _chapterId = null;
let _$ = null;           // primary DOM cache
let _navigatePrimary = null;

/* ── public API ──────────────────────────────────────────────────── */

export function isSplitOpen() {
  return _pane !== null;
}

export function getSplitState() {
  if (!_pane) return null;
  return { workId: _workId, chapterId: _chapterId };
}

export function openSplit($, primaryNavigate, workId, chapterId, verse) {
  _$ = $;
  _navigatePrimary = primaryNavigate;

  if (!_pane) {
    _pane = buildPane($);
    $.appLayout.insertBefore(_pane, $.appLayout.querySelector('#reading-pane').nextSibling);
    $.appLayout.classList.add('split-active');
    $.compareBtn.classList.add('active');
  }

  navigateSecondary(workId || _workId || 'bom', chapterId || _chapterId || '1-ne-1', verse);
}

export function closeSplit($) {
  if (!_pane) return;
  _pane.remove();
  _pane = null;
  _workId = null;
  _chapterId = null;
  $.appLayout.classList.remove('split-active');
  $.compareBtn.classList.remove('active');
}

export function toggleSplit($, primaryNavigate) {
  if (_pane) closeSplit($);
  else openSplit($, primaryNavigate);
}

/* ── secondary pane construction ──────────────────────────────────── */

function buildPane($) {
  const pane = document.createElement('div');
  pane.className = 'split-pane';
  pane.id = 'split-pane';

  // Compact nav bar
  const nav = document.createElement('div');
  nav.className = 'split-nav';

  const workSel = document.createElement('select');
  workSel.className = 'sim-select split-select';
  workSel.setAttribute('aria-label', 'Work (split)');

  const bookSel = document.createElement('select');
  bookSel.className = 'sim-select split-select';
  bookSel.setAttribute('aria-label', 'Book (split)');

  const chSel = document.createElement('select');
  chSel.className = 'sim-select split-select';
  chSel.setAttribute('aria-label', 'Chapter (split)');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tool-btn';
  closeBtn.title = 'Close split pane';
  closeBtn.setAttribute('aria-label', 'Close split pane');
  const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  closeSvg.setAttribute('width', '16');
  closeSvg.setAttribute('height', '16');
  closeSvg.setAttribute('viewBox', '0 0 24 24');
  closeSvg.setAttribute('fill', 'none');
  closeSvg.setAttribute('stroke', 'currentColor');
  closeSvg.setAttribute('stroke-width', '2');
  closeSvg.setAttribute('stroke-linecap', 'round');
  closeSvg.setAttribute('stroke-linejoin', 'round');
  const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line1.setAttribute('x1', '18'); line1.setAttribute('y1', '6');
  line1.setAttribute('x2', '6'); line1.setAttribute('y2', '18');
  const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line2.setAttribute('x1', '6'); line2.setAttribute('y1', '6');
  line2.setAttribute('x2', '18'); line2.setAttribute('y2', '18');
  closeSvg.append(line1, line2);
  closeBtn.appendChild(closeSvg);
  closeBtn.addEventListener('click', () => closeSplit($));

  nav.append(workSel, bookSel, chSel, closeBtn);

  // Populate work select
  const works = getWorkIds().map(id => ({ id, manifest: getManifest(id) })).filter(x => x.manifest);
  fillSelect(workSel, works, x => x.id, x => x.manifest.title);

  // Wire nav changes
  workSel.addEventListener('change', () => {
    const wId = workSel.value;
    populateSplitBooks(bookSel, wId);
    populateSplitChapters(chSel, wId, bookSel.value);
    navigateSecondary(wId, chSel.value);
  });

  bookSel.addEventListener('change', () => {
    populateSplitChapters(chSel, workSel.value, bookSel.value);
    navigateSecondary(workSel.value, chSel.value);
  });

  chSel.addEventListener('change', () => {
    navigateSecondary(workSel.value, chSel.value);
  });

  // Reading area
  const reader = document.createElement('main');
  reader.className = 'split-reader scrollbar-thin';
  reader.setAttribute('tabindex', '-1');

  const header = document.createElement('div');
  header.className = 'split-chapter-header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'split-title';
  const subtitleEl = document.createElement('p');
  subtitleEl.className = 'split-subtitle';
  header.append(titleEl, subtitleEl);

  const intro = document.createElement('div');
  intro.className = 'split-intro hidden';

  const verses = document.createElement('div');
  verses.className = 'split-verses';

  const chapterNav = document.createElement('nav');
  chapterNav.className = 'split-chapter-nav';
  chapterNav.setAttribute('aria-label', 'Chapter navigation (split)');

  const prevLink = document.createElement('a');
  prevLink.className = 'ghost-btn split-prev';
  prevLink.href = '#';
  prevLink.textContent = '\u2190 Previous';

  const nextLink = document.createElement('a');
  nextLink.className = 'ghost-btn split-next';
  nextLink.href = '#';
  nextLink.textContent = 'Next \u2192';

  chapterNav.append(prevLink, nextLink);

  reader.append(header, intro, verses, chapterNav);
  pane.append(nav, reader);

  // Store refs for later
  pane._workSel = workSel;
  pane._bookSel = bookSel;
  pane._chSel = chSel;
  pane._title = titleEl;
  pane._subtitle = subtitleEl;
  pane._intro = intro;
  pane._verses = verses;
  pane._prev = prevLink;
  pane._next = nextLink;
  pane._reader = reader;

  // Prev/next click handlers
  prevLink.addEventListener('click', (e) => {
    e.preventDefault();
    const href = prevLink.getAttribute('href');
    if (href && href !== '#') {
      const parts = href.slice(1).split('/');
      navigateSecondary(parts[0], parts.slice(1).join('/'));
    }
  });

  nextLink.addEventListener('click', (e) => {
    e.preventDefault();
    const href = nextLink.getAttribute('href');
    if (href && href !== '#') {
      const parts = href.slice(1).split('/');
      navigateSecondary(parts[0], parts.slice(1).join('/'));
    }
  });

  // Popover for secondary pane verse actions
  const splitDom = {
    verses: verses,
    readingPane: reader,
    notesToggle: $.notesToggle,
    notesSidebar: $.notesSidebar,
    notesContent: $.notesContent,
    bookmarksContent: $.bookmarksContent
  };

  initPopover(splitDom, {
    onNote: (verse) => {
      // Note: openNote uses module-level _workId/_chapterId in notes.js.
      // We must temporarily update those before calling openNote, then restore.
      // For simplicity, navigate to the split pane's chapter in the primary pane first.
      // Or: just open a note via direct store manipulation.
      // Simplest: navigate primary to the split chapter, which updates notes.js state.
      _navigatePrimary(_workId, _chapterId, verse);
      import('./notes.js').then(m => m.openNote(verse));
    },
    onBookmark: (verse) => {
      toggleBookmark(_workId, _chapterId, verse);
      const row = verses.querySelector(`#sv${verse}`)?.closest('.verse-row');
      const num = row?.querySelector('.verse-num');
      if (row && num) {
        const on = isBookmarked(_workId, _chapterId, verse);
        row.classList.toggle('bookmarked', on);
        num.classList.toggle('bookmarked', on);
      }
    },
    onCopy: async (verse) => {
      const el = verses.querySelector(`#sv${verse}`);
      if (!el) return;
      const text = el.textContent.trim();
      const ref = formatRef(_chapterId, verse);
      await navigator.clipboard.writeText(`${text} \u2014 ${ref}`);
      showToast('Copied to clipboard');
    },
    onLink: async (verse) => {
      const url = `${location.origin}${location.pathname}#${_workId}/${_chapterId}:${verse}`;
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    },
    isBookmarked: (verse) => isBookmarked(_workId, _chapterId, verse)
  });

  // Concordance for secondary pane
  initConcordance(splitDom, (workId, chapterId, verse) => {
    navigateSecondary(workId, chapterId, verse);
  });

  return pane;
}

/* ── secondary navigation helpers ─────────────────────────────────── */

function populateSplitBooks(bookSel, workId) {
  const m = getManifest(workId);
  if (!m) { bookSel.replaceChildren(); return; }
  fillSelect(bookSel, m.books, b => b.id, b => b.name);
  bookSel.style.display = m.books.length <= 1 ? 'none' : '';
}

function populateSplitChapters(chSel, workId, bookId) {
  const m = getManifest(workId);
  if (!m) { chSel.replaceChildren(); return; }
  const book = m.books.find(b => b.id === bookId);
  if (!book) { chSel.replaceChildren(); return; }
  const start = book.start ?? 1;
  const items = Array.from({ length: book.chapters }, (_, i) => {
    const id = chapterIdAt(book.id, i, start);
    const num = start + i;
    const name = book.names?.[i];
    return { id, num, name };
  });
  fillSelect(chSel, items, ch => ch.id, ch => ch.name ? `${ch.num} (${ch.name})` : String(ch.num));
  chSel.style.display = book.chapters <= 1 ? 'none' : '';
}

async function navigateSecondary(workId, chapterId, verse) {
  _workId = workId;
  _chapterId = chapterId;

  // Sync dropdowns
  _pane._workSel.value = workId;
  if (_pane._bookSel.options.length <= 1 || _pane._workSel.value !== workId) {
    populateSplitBooks(_pane._bookSel, workId);
  }
  const bookId = findBookForChapter(workId, chapterId);
  if (bookId) {
    _pane._bookSel.value = bookId;
    populateSplitChapters(_pane._chSel, workId, bookId);
  }
  _pane._chSel.value = chapterId;

  try {
    const chapter = await loadChapter(workId, chapterId);

    // Render title
    let title;
    if (chapter.singleChapter) title = chapter.bookName;
    else if (chapter.bookCount === 1) title = `${chapter.workTitle} ${chapter.chapter}`;
    else title = `${chapter.bookName} ${chapter.chapter}`;
    _pane._title.textContent = title;

    const subtitle = chapter.name || '';
    _pane._subtitle.textContent = subtitle;
    _pane._subtitle.hidden = !subtitle;
    _pane._intro.textContent = chapter.intro || '';
    _pane._intro.classList.toggle('hidden', !chapter.intro);

    // Render verses
    const container = _pane._verses;
    container.replaceChildren();

    if (chapter.sections && chapter.sections.length) {
      const multiSection = chapter.sections.length > 1;
      for (let i = 0; i < chapter.sections.length; i++) {
        if (multiSection) {
          const heading = document.createElement('span');
          heading.className = 'section-heading';
          heading.setAttribute('role', 'heading');
          heading.setAttribute('aria-level', '3');
          heading.textContent = i + 1;
          container.appendChild(heading);
        }
        const sec = chapter.sections[i];
        for (let j = 0; j < sec.verses.length; j++) {
          appendSplitVerse(container, sec.verses[j], sec.startVerse + j);
        }
      }
    }

    // Prev/next
    const { prev, next } = getAdjacentChapters(workId, chapterId);
    if (prev) {
      _pane._prev.href = `#${workId}/${prev.id}`;
      _pane._prev.style.visibility = 'visible';
    } else {
      _pane._prev.href = '#';
      _pane._prev.style.visibility = 'hidden';
    }
    if (next) {
      _pane._next.href = `#${workId}/${next.id}`;
      _pane._next.style.visibility = 'visible';
    } else {
      _pane._next.href = '#';
      _pane._next.style.visibility = 'hidden';
    }

    _pane._reader.scrollTop = 0;

    // Update URL hash with split state
    updateSplitHash();

    if (verse) {
      requestAnimationFrame(() => {
        const el = container.querySelector(`#sv${verse}`);
        if (el) {
          el.classList.add('verse-highlight');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  } catch (err) {
    _pane._title.textContent = 'Error';
    _pane._subtitle.textContent = '';
    _pane._verses.replaceChildren();
    const msg = document.createElement('p');
    msg.className = 'empty-state';
    msg.textContent = `Failed to load: ${err.message}`;
    _pane._verses.appendChild(msg);
  }
}

function appendSplitVerse(container, text, verseNum) {
  const row = document.createElement('div');
  row.className = 'verse-row';

  const bookmarked = isBookmarked(_workId, _chapterId, verseNum);
  if (bookmarked) row.classList.add('bookmarked');

  const num = document.createElement('span');
  num.className = 'verse-num';
  if (bookmarked) num.classList.add('bookmarked');
  num.textContent = verseNum;
  num.dataset.verse = verseNum;
  num.setAttribute('role', 'button');
  num.setAttribute('tabindex', '0');
  num.setAttribute('aria-label', `Verse ${verseNum}`);
  row.appendChild(num);

  const span = document.createElement('span');
  span.className = 'verse';
  span.id = `sv${verseNum}`;
  span.dataset.verse = verseNum;
  const words = text.split(/(\s+)/);
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
  row.appendChild(span);
  container.appendChild(row);
}

function updateSplitHash() {
  if (_pane && _workId && _chapterId) {
    const hash = location.hash.slice(1);
    const plusIdx = hash.indexOf('+');
    const primary = plusIdx === -1 ? hash : hash.slice(0, plusIdx);
    const newHash = `${primary}+${_workId}/${_chapterId}`;
    if (location.hash !== `#${newHash}`) {
      history.replaceState(null, '', `#${newHash}`);
    }
  }
}
```

- [ ] **Step 3: Update hash routing in main.js to handle split URLs**

In `main.js`, update the `routeFromHash` function to parse `+` separated split URLs:

```js
function routeFromHash() {
  const hash = location.hash.slice(1);
  if (!hash) {
    const last = getLastPosition();
    if (last) { navigate(last.workId, last.chapterId); return; }
    const manifest = getManifest('bom');
    if (!manifest || !manifest.books.length) return;
    const firstBook = manifest.books[0];
    navigate('bom', chapterIdAt(firstBook.id, 0, firstBook.start));
    return;
  }

  // Check for split pane: hash contains '+'
  const plusIdx = hash.indexOf('+');
  let primaryHash, splitHash;
  if (plusIdx !== -1) {
    primaryHash = hash.slice(0, plusIdx);
    splitHash = hash.slice(plusIdx + 1);
  } else {
    primaryHash = hash;
    splitHash = null;
  }

  // Parse primary
  const slashIdx = primaryHash.indexOf('/');
  if (slashIdx === -1) return;

  const workId = primaryHash.slice(0, slashIdx);
  let rest = primaryHash.slice(slashIdx + 1);
  let verse = null;

  const colonIdx = rest.lastIndexOf(':');
  if (colonIdx !== -1) {
    const maybeVerse = parseInt(rest.slice(colonIdx + 1), 10);
    if (!isNaN(maybeVerse)) {
      verse = maybeVerse;
      rest = rest.slice(0, colonIdx);
    }
  }

  navigate(workId, rest, verse);

  // Handle split pane
  if (splitHash) {
    const sSlash = splitHash.indexOf('/');
    if (sSlash !== -1) {
      const sWorkId = splitHash.slice(0, sSlash);
      let sRest = splitHash.slice(sSlash + 1);
      let sVerse = null;
      const sColon = sRest.lastIndexOf(':');
      if (sColon !== -1) {
        const mv = parseInt(sRest.slice(sColon + 1), 10);
        if (!isNaN(mv)) { sVerse = mv; sRest = sRest.slice(0, sColon); }
      }
      requestAnimationFrame(() => {
        openSplit($, (w, c, v) => navigate(w, c, v), sWorkId, sRest, sVerse);
      });
    }
  } else if (isSplitOpen()) {
    closeSplit($);
  }
}
```

Add the split imports at the top of `main.js`:

```js
import { openSplit, closeSplit, toggleSplit, isSplitOpen, getSplitState } from './src/split.js';
```

- [ ] **Step 4: Wire the compare button in main.js init()**

In `main.js`, inside `init()`, after the download button listener (after line 321), add:

```js
// Split pane
$.compareBtn.addEventListener('click', () => toggleSplit($, (w, c, v) => navigate(w, c, v)));
```

- [ ] **Step 5: Add split-pane CSS**

Add to `styles.css`:

```css
/* ---------- Split Pane ---------- */

.split-active {
    gap: 0;
}

.split-active #reading-pane {
    flex: 1;
    max-width: none;
    margin: 0;
}

.split-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-elevated);
}

.split-nav {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    flex-shrink: 0;
    background: var(--bg);
}

.split-select {
    width: 120px;
    font-size: 0.8rem;
}

.split-reader {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 1.5rem 4rem 3.5rem;
    position: relative;
}

.split-chapter-header {
    text-align: center;
    margin-bottom: 1.5rem;
}

.split-title {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--text);
    margin: 0 0 0.25rem;
}

.split-subtitle {
    font-family: var(--font-body);
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 0;
}

.split-intro {
    font-family: var(--font-body-serif);
    font-size: 1rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 1rem;
    font-style: italic;
}

.split-chapter-nav {
    display: flex;
    justify-content: space-between;
    margin-top: 2rem;
    padding-top: 1rem;
}

/* Hide compare button on mobile */
@media (max-width: 900px) {
    .compare-btn-desktop { display: none; }
    .split-pane { display: none; }
}
```

- [ ] **Step 6: Verify in browser**

Serve locally. Click the Compare button (split rectangle icon). Verify:
- A second pane appears to the right with its own work/book/chapter dropdowns
- Navigate independently in each pane
- Closing via X button or toggling the compare button removes the pane
- URL updates to include `+secondWork/secondChapter`
- Deep-linking a split URL (e.g., `#ot/gen-1+bom/1-ne-1`) opens both panes
- On mobile (<= 900px), the compare button is hidden

- [ ] **Step 7: Commit**

```bash
git add scripture/src/split.js scripture/main.js scripture/index.html scripture/styles.css
git commit -m "feat(scripture): split-pane parallel reading with independent navigation"
```

---

### Task 5: Text-to-Speech

**Files:**
- Create: `src/tts.js`
- Modify: `index.html` (TTS button in toolbar)
- Modify: `main.js` (import and wire TTS)
- Modify: `src/popover.js` (add "Read aloud" action)
- Modify: `styles.css` (TTS control bar and active verse styles)

- [ ] **Step 1: Create src/tts.js**

```js
/* ===================================================================
   tts.js — Text-to-speech for chapter reading.
   Uses the browser's SpeechSynthesis API.
   =================================================================== */

let _synth = null;
let _utterances = [];
let _currentIdx = -1;
let _rate = 1.0;
let _voiceURI = '';
let _playing = false;
let _pane = null;
let _controlBar = null;

/* ── public API ──────────────────────────────────────────────────── */

export function initTTS($) {
  _synth = window.speechSynthesis;
  if (!_synth) return;

  _controlBar = buildControlBar($);
  $.toolbar.after(_controlBar);
  _controlBar.hidden = true;
}

/**
 * Start TTS from a specific verse, or from the beginning of the chapter.
 * @param {HTMLElement} versesContainer - The #verses or .split-verses element
 * @param {number} [startVerse] - Optional verse number to start from
 */
export function startTTS(versesContainer, startVerse) {
  if (!_synth) { showToast('Text-to-speech not supported'); return; }

  stopTTS();
  _pane = versesContainer;

  const rows = versesContainer.querySelectorAll('.verse-row');
  _utterances = [];
  let startIdx = 0;

  for (let i = 0; i < rows.length; i++) {
    const verseEl = rows[i].querySelector('.verse');
    const numEl = rows[i].querySelector('.verse-num');
    if (!verseEl || !numEl) continue;
    const num = parseInt(numEl.dataset.verse, 10);
    const text = verseEl.textContent.trim();
    if (!text) continue;
    _utterances.push({ num, text, row: rows[i] });
    if (startVerse && num === startVerse) startIdx = _utterances.length - 1;
  }

  if (!_utterances.length) return;

  _currentIdx = startIdx;
  _playing = true;
  _controlBar.hidden = false;
  updateControlState();
  speakCurrent();
}

export function stopTTS() {
  if (_synth) _synth.cancel();
  clearActiveHighlight();
  _playing = false;
  _currentIdx = -1;
  _utterances = [];
  if (_controlBar) _controlBar.hidden = true;
}

export function togglePauseTTS() {
  if (!_synth) return;
  if (_synth.paused) {
    _synth.resume();
    _playing = true;
  } else if (_synth.speaking) {
    _synth.pause();
    _playing = false;
  }
  updateControlState();
}

export function isTTSActive() {
  return _synth && (_synth.speaking || _synth.paused);
}

/* ── internal ─────────────────────────────────────────────────────── */

function speakCurrent() {
  if (_currentIdx < 0 || _currentIdx >= _utterances.length) {
    stopTTS();
    return;
  }

  const entry = _utterances[_currentIdx];
  const utt = new SpeechSynthesisUtterance(entry.text);
  utt.rate = _rate;

  if (_voiceURI) {
    const voices = _synth.getVoices();
    const voice = voices.find(v => v.voiceURI === _voiceURI);
    if (voice) utt.voice = voice;
  }

  clearActiveHighlight();
  entry.row.classList.add('tts-active');
  entry.row.querySelector('.verse')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  utt.onend = () => {
    _currentIdx++;
    if (_currentIdx < _utterances.length && _playing) {
      speakCurrent();
    } else {
      stopTTS();
    }
  };

  utt.onerror = () => stopTTS();

  _synth.speak(utt);
}

function clearActiveHighlight() {
  if (_pane) {
    const active = _pane.querySelector('.tts-active');
    if (active) active.classList.remove('tts-active');
  }
}

function updateControlState() {
  if (!_controlBar) return;
  const playBtn = _controlBar.querySelector('.tts-play');
  if (!playBtn) return;

  // Replace play/pause icon via DOM methods
  playBtn.replaceChildren();
  playBtn.setAttribute('aria-label', _playing ? 'Pause' : 'Play');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');

  if (_playing) {
    const r1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r1.setAttribute('x', '6'); r1.setAttribute('y', '4');
    r1.setAttribute('width', '4'); r1.setAttribute('height', '16');
    const r2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r2.setAttribute('x', '14'); r2.setAttribute('y', '4');
    r2.setAttribute('width', '4'); r2.setAttribute('height', '16');
    svg.append(r1, r2);
  } else {
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', '5 3 19 12 5 21 5 3');
    svg.appendChild(poly);
  }

  playBtn.appendChild(svg);
}

/* ── control bar ──────────────────────────────────────────────────── */

function buildControlBar($) {
  const bar = document.createElement('div');
  bar.className = 'tts-bar glass';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Text-to-speech controls');

  // Play/pause
  const playBtn = document.createElement('button');
  playBtn.className = 'tool-btn tts-play';
  playBtn.setAttribute('aria-label', 'Pause');
  playBtn.addEventListener('click', togglePauseTTS);

  // Stop
  const stopBtn = document.createElement('button');
  stopBtn.className = 'tool-btn tts-stop';
  stopBtn.setAttribute('aria-label', 'Stop');
  const stopSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  stopSvg.setAttribute('width', '16');
  stopSvg.setAttribute('height', '16');
  stopSvg.setAttribute('viewBox', '0 0 24 24');
  stopSvg.setAttribute('fill', 'currentColor');
  const stopRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  stopRect.setAttribute('x', '6'); stopRect.setAttribute('y', '6');
  stopRect.setAttribute('width', '12'); stopRect.setAttribute('height', '12');
  stopSvg.appendChild(stopRect);
  stopBtn.appendChild(stopSvg);
  stopBtn.addEventListener('click', stopTTS);

  // Speed
  const speedLabel = document.createElement('span');
  speedLabel.className = 'tts-label';
  speedLabel.textContent = 'Speed';

  const speedSlider = document.createElement('input');
  speedSlider.type = 'range';
  speedSlider.className = 'sim-slider tts-speed';
  speedSlider.min = '0.5';
  speedSlider.max = '2';
  speedSlider.step = '0.25';
  speedSlider.value = String(_rate);

  const speedVal = document.createElement('span');
  speedVal.className = 'tts-val';
  speedVal.textContent = `${_rate}x`;

  _forms.bindSlider(speedSlider, speedVal, (v) => {
    _rate = v;
  }, (v) => `${v}x`);

  // Voice select
  const voiceLabel = document.createElement('span');
  voiceLabel.className = 'tts-label';
  voiceLabel.textContent = 'Voice';

  const voiceSel = document.createElement('select');
  voiceSel.className = 'sim-select tts-voice-select';
  voiceSel.setAttribute('aria-label', 'Voice');

  function populateVoices() {
    const voices = _synth.getVoices();
    voiceSel.replaceChildren();
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Default';
    voiceSel.appendChild(defaultOpt);
    for (const v of voices) {
      if (!v.lang.startsWith('en')) continue;
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = v.name;
      voiceSel.appendChild(opt);
    }
    if (_voiceURI) voiceSel.value = _voiceURI;
  }

  populateVoices();
  if (_synth.onvoiceschanged !== undefined) {
    _synth.onvoiceschanged = populateVoices;
  }

  voiceSel.addEventListener('change', () => {
    _voiceURI = voiceSel.value;
  });

  bar.append(playBtn, stopBtn, speedLabel, speedSlider, speedVal, voiceLabel, voiceSel);

  // Set initial play icon
  updateControlState();

  return bar;
}
```

- [ ] **Step 2: Add TTS button to toolbar in index.html**

After the download button (line 123), add:

```html
<button id="tts-btn" class="tool-btn" title="Read Aloud" aria-label="Read chapter aloud">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
</button>
```

Add to the DOM cache in `main.js`:

```js
ttsBtn:           document.getElementById('tts-btn'),
```

- [ ] **Step 3: Wire TTS in main.js**

Add import at top of `main.js`:

```js
import { initTTS, startTTS, stopTTS, isTTSActive } from './src/tts.js';
```

In `init()`, after the display settings initialization, add:

```js
// Text-to-speech
initTTS($);
$.ttsBtn.addEventListener('click', () => {
  if (isTTSActive()) stopTTS();
  else startTTS($.verses);
});
```

- [ ] **Step 4: Add "Read aloud" action to popover**

In `src/popover.js`, add a speaker icon function after the existing icon functions:

```js
function makeSpeakerIcon() {
  return svgEl({ fill: 'none' }, [
    path({ d: 'M8.5 4L5 7H2v2h3l3.5 3V4z', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linejoin': 'round' }),
    path({ d: 'M12 5.5a4 4 0 0 1 0 5', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' })
  ]);
}
```

In `buildPopover()`, add the read-aloud button after `linkBtn`:

```js
const readBtn = makeBtn('vp-read', 'Read aloud from here');
readBtn.appendChild(makeSpeakerIcon());
el.append(noteBtn, bookmarkBtn, sep, copyBtn, linkBtn, readBtn);
return { el, noteBtn, bookmarkBtn, copyBtn, linkBtn, readBtn };
```

In `initPopover`, update the callbacks destructure and wire the button:

```js
const { onNote, onBookmark, onCopy, onLink, onRead, isBookmarked } = callbacks;
```

```js
readBtn.addEventListener('click', () => {
  const v = activeVerse;
  close();
  if (v !== null && onRead) onRead(v);
});
```

In `main.js`, add `onRead` to the popover callbacks object:

```js
onRead: (verse) => {
  startTTS($.verses, verse);
},
```

- [ ] **Step 5: Add TTS CSS**

Add to `styles.css`:

```css
/* ---------- Text-to-Speech ---------- */

.tts-bar {
    position: fixed;
    top: var(--toolbar-h);
    left: 0;
    right: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: var(--bg-panel);
    backdrop-filter: blur(20px) saturate(1.5);
}

.tts-bar .tool-btn {
    flex-shrink: 0;
}

.tts-label {
    font-family: var(--font-body);
    font-size: 0.7rem;
    color: var(--text-muted);
    flex-shrink: 0;
}

.tts-speed {
    width: 80px;
    flex-shrink: 0;
}

.tts-val {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-secondary);
    min-width: 28px;
    flex-shrink: 0;
}

.tts-voice-select {
    max-width: 200px;
    font-size: 0.75rem;
}

.tts-active .verse {
    background: color-mix(in srgb, var(--ext-blue, #6496ff) 12%, transparent);
    border-radius: var(--radius-sm, 2px);
}

/* Shift reading pane down when TTS bar is visible */
body:has(.tts-bar:not([hidden])) #app-layout {
    margin-top: calc(var(--toolbar-h) + 36px);
    height: calc(100vh - var(--toolbar-h) - 36px);
}

/* Read aloud button in popover */
.vp-read {
    color: var(--text-muted);
}

.vp-read:hover,
.vp-read:focus-visible {
    background: var(--bg-hover);
    color: var(--text);
}
```

- [ ] **Step 6: Verify in browser**

Serve locally. Click the speaker icon in the toolbar. Verify:
- TTS control bar appears below toolbar with play/pause, stop, speed, voice
- Verses are read aloud sequentially
- Currently-spoken verse gets a blue highlight and auto-scrolls into view
- Speed slider changes rate
- Stop resets everything
- "Read aloud" in verse popover starts from that specific verse

- [ ] **Step 7: Commit**

```bash
git add scripture/src/tts.js scripture/src/popover.js scripture/main.js scripture/index.html scripture/styles.css
git commit -m "feat(scripture): text-to-speech with SpeechSynthesis API"
```

---

### Task 6: Export/Import

**Files:**
- Create: `src/data-io.js`
- Modify: `main.js` (import and wire data-io)
- Modify: `index.html` (save/load buttons in toolbar, after about button)

- [ ] **Step 1: Create src/data-io.js**

```js
/* ===================================================================
   data-io.js — Export/import user data (notes, bookmarks, settings).
   =================================================================== */

const KEYS = ['scripture-user', 'scripture-display', 'scripture-history'];

/**
 * Export all user data as a JSON file download.
 */
export function exportData() {
  const data = {};
  for (const key of KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) data[key] = JSON.parse(raw);
    } catch { /* skip */ }
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scripture-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported');
}

/**
 * Import user data from a JSON file.
 * @param {boolean} replace - If true, replace all data. If false, merge.
 */
export function importData(replace) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);

        if (replace) {
          for (const key of KEYS) {
            if (data[key]) {
              localStorage.setItem(key, JSON.stringify(data[key]));
            } else {
              localStorage.removeItem(key);
            }
          }
          const u = data['scripture-user'];
          const notes = u ? Object.keys(u.notes || {}).length : 0;
          const bookmarks = u ? (u.bookmarks || []).length : 0;
          showToast(`Replaced: ${notes} notes, ${bookmarks} bookmarks`);
        } else {
          // Merge
          const imported = data['scripture-user'];
          if (imported) {
            let raw;
            try { raw = JSON.parse(localStorage.getItem('scripture-user')); } catch { /* */ }
            const current = raw || { notes: {}, bookmarks: [] };

            if (imported.notes) {
              Object.assign(current.notes, imported.notes);
            }

            if (imported.bookmarks) {
              const set = new Set(current.bookmarks);
              for (const ref of imported.bookmarks) set.add(ref);
              current.bookmarks = [...set];
            }

            localStorage.setItem('scripture-user', JSON.stringify(current));

            const newNotes = imported.notes ? Object.keys(imported.notes).length : 0;
            const newBookmarks = imported.bookmarks ? imported.bookmarks.length : 0;
            showToast(`Merged: ${newNotes} notes, ${newBookmarks} bookmarks`);
          }

          if (data['scripture-display']) {
            localStorage.setItem('scripture-display', JSON.stringify(data['scripture-display']));
          }
          if (data['scripture-history']) {
            localStorage.setItem('scripture-history', JSON.stringify(data['scripture-history']));
          }
        }

        location.reload();
      } catch (err) {
        showToast('Import failed: invalid file');
      }
    };
    reader.readAsText(file);
  });

  input.click();
}

/**
 * Show import dialog with merge/replace choice.
 */
export function promptImport() {
  const dialog = document.createElement('div');
  dialog.className = 'sim-overlay';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Import data');

  const panel = document.createElement('div');
  panel.className = 'sim-overlay-panel glass import-dialog';

  const heading = document.createElement('h2');
  heading.className = 'import-heading';
  heading.textContent = 'Import Data';
  panel.appendChild(heading);

  const desc = document.createElement('p');
  desc.className = 'import-desc';
  desc.textContent = 'Merge adds new data and overwrites conflicts. Replace removes all current data first.';
  panel.appendChild(desc);

  const actions = document.createElement('div');
  actions.className = 'import-actions';

  const mergeBtn = document.createElement('button');
  mergeBtn.className = 'ghost-btn';
  mergeBtn.textContent = 'Merge';
  mergeBtn.addEventListener('click', () => {
    dialog.remove();
    importData(false);
  });

  const replaceBtn = document.createElement('button');
  replaceBtn.className = 'ghost-btn import-replace-btn';
  replaceBtn.textContent = 'Replace All';
  replaceBtn.addEventListener('click', () => {
    if (confirm('This will replace all your notes, bookmarks, and settings. Continue?')) {
      dialog.remove();
      importData(true);
    }
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'ghost-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => dialog.remove());

  actions.append(mergeBtn, replaceBtn, cancelBtn);
  panel.appendChild(actions);
  dialog.appendChild(panel);

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });

  document.body.appendChild(dialog);
}
```

- [ ] **Step 2: Add save/load buttons to toolbar in index.html**

After the about button (line 153) and before the notes-toggle button, add:

```html
<button id="export-btn" class="tool-btn" title="Export Data" aria-label="Export data">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
</button>
<button id="import-btn" class="tool-btn" title="Import Data" aria-label="Import data">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
</button>
```

Add to DOM cache in `main.js`:

```js
exportBtn:        document.getElementById('export-btn'),
importBtn:        document.getElementById('import-btn'),
```

- [ ] **Step 3: Wire export/import in main.js**

Add import at top of `main.js`:

```js
import { exportData, promptImport } from './src/data-io.js';
```

In `init()`, add:

```js
// Export/Import
$.exportBtn.addEventListener('click', exportData);
$.importBtn.addEventListener('click', promptImport);
```

- [ ] **Step 4: Add import dialog CSS**

Add to `styles.css`:

```css
/* ---------- Import Dialog ---------- */

.import-dialog {
    max-width: 360px;
    padding: 1.5rem;
    text-align: center;
}

.import-heading {
    font-family: var(--font-body);
    font-size: 1rem;
    margin: 0 0 1rem;
    color: var(--text);
}

.import-desc {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0 0 1.25rem;
}

.import-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
}

.import-replace-btn {
    color: var(--ext-red, #e05555);
}
```

- [ ] **Step 5: Verify in browser**

Serve locally. Add some notes and bookmarks. Click the save (floppy disk) icon. Verify:
- A `scripture-backup-YYYY-MM-DD.json` file downloads
- Open the JSON — it contains `scripture-user`, `scripture-display`, `scripture-history`

Click the load (download arrow) icon. Verify:
- A dialog appears with Merge / Replace All / Cancel options
- Merge: selecting a previously exported file adds data without removing existing
- Replace: wipes and loads wholesale after confirmation
- Toast shows counts
- Page reloads to apply changes

- [ ] **Step 6: Commit**

```bash
git add scripture/src/data-io.js scripture/main.js scripture/index.html scripture/styles.css
git commit -m "feat(scripture): export/import user data with merge and replace options"
```

---

## Post-Implementation

- [ ] **Final verification:** Serve locally, test all six features end-to-end in both light and dark themes
- [ ] **Mobile check:** Verify on viewport <= 900px — compare button hidden, TTS works, notes scope toggle works
- [ ] **Final commit:** Any cleanup or fixes from verification
