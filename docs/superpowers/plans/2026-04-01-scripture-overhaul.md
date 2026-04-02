# Scripture Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the scripture reader to its core (read, search, annotate, download) by removing translations, glossary, cross-references, and footnotes, then adding user notes and a text download button.

**Architecture:** Delete 4 JS modules (glossary, compare, notemap, refs cross-ref parsing). Gut chapters.js and reader.js. Rewrite notes.js for localStorage-backed user annotations. Simplify all Python parsers to output clean `{number, text}` verses. Regenerate all data.

**Tech Stack:** Vanilla ES6 modules, localStorage, no dependencies. Python 3 extraction pipeline.

---

## File Map

### Delete
- `src/glossary.js`
- `src/compare.js`
- `src/notemap.js`
- `data/cross-refs.json`
- `data/*/glossary.json` (11 files)

### Rewrite
- `src/notes.js` — user notes with localStorage (full rewrite)

### Simplify (major edits)
- `src/refs.js` — keep only `BOOKS` + `formatRef`, delete 250+ lines
- `src/reader.js` — remove footnote marker rendering
- `src/chapters.js` — remove alias resolution, cross-refs, glossary, JST, translations
- `src/nav.js` — remove translation dropdown
- `src/search.js` — remove alias resolution, translation display
- `main.js` — remove 6 imports, simplify navigate(), add download + notes wiring
- `index.html` — remove translation select, compare pane, glossary overlay; add download btn
- `styles.css` — remove glossary/compare/footnote styles, add note textarea styles

### Pipeline (simplify)
- `extract/base_parser.py` — remove glossary writing, footnote cleanup
- `extract/pdf_parser.py` — remove `extract_glossary` abstract method, footnote docs
- `extract/parsers/quad.py` — remove `extract_glossary`, `_FN_MARKER_FLAGS`, translations from manifest
- `extract/txt_to_json.py` — remove footnote parsing, glossary loading, ancillary copy
- `extract/json_to_txt.py` — remove footnote suffix, translation export
- `extract/verify_data.py` — remove footnote verification

---

## Task 1: Delete Dead Modules and Data Files

**Files:**
- Delete: `src/glossary.js`, `src/compare.js`, `src/notemap.js`
- Delete: `data/cross-refs.json`
- Delete: `data/bom/glossary.json`, `data/dc/glossary.json`, `data/pgp/glossary.json`, `data/ot/glossary.json`, `data/nt/glossary.json`, `data/quran/glossary.json`, `data/apoc/glossary.json`, `data/fourbooks/glossary.json`, `data/ttc/glossary.json`, `data/kj/glossary.json`, `data/bund/glossary.json`

- [ ] **Step 1: Delete files**

```bash
rm src/glossary.js src/compare.js src/notemap.js
rm data/cross-refs.json
rm data/bom/glossary.json data/dc/glossary.json data/pgp/glossary.json \
   data/ot/glossary.json data/nt/glossary.json data/quran/glossary.json \
   data/apoc/glossary.json data/fourbooks/glossary.json data/ttc/glossary.json \
   data/kj/glossary.json data/bund/glossary.json
```

- [ ] **Step 2: Commit**

```bash
git add -u
git commit -m "chore: delete glossary, compare, notemap, cross-refs"
```

---

## Task 2: Gut refs.js

**Files:**
- Modify: `src/refs.js`

Keep only `BOOKS` (lines 13-144) and `formatRef` (lines 150-158). Delete everything else: `ABBREV`, `ABBREV_KEYS`, `matchAbbrev`, `DROP_RE`, `JST_RE`, `parseCrossRefs`, `scanEntries`, `startsEntry`, `parseOneRef`, `parseJst`.

- [ ] **Step 1: Replace refs.js with minimal version**

```js
/* ===================================================================
   refs.js — Book ID registry and reference formatting.
   Single source of truth for bookId → {workId, display abbreviation}.
   =================================================================== */

/**
 * bookId → { work: workId, abbrev: display abbreviation }
 */
export const BOOKS = {
  // Old Testament
  'gen':   { work: 'ot', abbrev: 'Gen.' },
  'ex':    { work: 'ot', abbrev: 'Ex.' },
  'lev':   { work: 'ot', abbrev: 'Lev.' },
  'num':   { work: 'ot', abbrev: 'Num.' },
  'deut':  { work: 'ot', abbrev: 'Deut.' },
  'josh':  { work: 'ot', abbrev: 'Josh.' },
  'judg':  { work: 'ot', abbrev: 'Judg.' },
  'ruth':  { work: 'ot', abbrev: 'Ruth' },
  '1-sam': { work: 'ot', abbrev: '1 Sam.' },
  '2-sam': { work: 'ot', abbrev: '2 Sam.' },
  '1-kgs': { work: 'ot', abbrev: '1 Kgs.' },
  '2-kgs': { work: 'ot', abbrev: '2 Kgs.' },
  '1-chr': { work: 'ot', abbrev: '1 Chr.' },
  '2-chr': { work: 'ot', abbrev: '2 Chr.' },
  'ezra':  { work: 'ot', abbrev: 'Ezra' },
  'neh':   { work: 'ot', abbrev: 'Neh.' },
  'esth':  { work: 'ot', abbrev: 'Esth.' },
  'job':   { work: 'ot', abbrev: 'Job' },
  'ps':    { work: 'ot', abbrev: 'Ps.' },
  'prov':  { work: 'ot', abbrev: 'Prov.' },
  'eccl':  { work: 'ot', abbrev: 'Eccl.' },
  'song':  { work: 'ot', abbrev: 'Song' },
  'isa':   { work: 'ot', abbrev: 'Isa.' },
  'jer':   { work: 'ot', abbrev: 'Jer.' },
  'lam':   { work: 'ot', abbrev: 'Lam.' },
  'ezek':  { work: 'ot', abbrev: 'Ezek.' },
  'dan':   { work: 'ot', abbrev: 'Dan.' },
  'hosea': { work: 'ot', abbrev: 'Hosea' },
  'joel':  { work: 'ot', abbrev: 'Joel' },
  'amos':  { work: 'ot', abbrev: 'Amos' },
  'obad':  { work: 'ot', abbrev: 'Obad.' },
  'jonah': { work: 'ot', abbrev: 'Jonah' },
  'micah': { work: 'ot', abbrev: 'Micah' },
  'nahum': { work: 'ot', abbrev: 'Nahum' },
  'hab':   { work: 'ot', abbrev: 'Hab.' },
  'zeph':  { work: 'ot', abbrev: 'Zeph.' },
  'hag':   { work: 'ot', abbrev: 'Hag.' },
  'zech':  { work: 'ot', abbrev: 'Zech.' },
  'mal':   { work: 'ot', abbrev: 'Mal.' },

  // New Testament
  'matt':   { work: 'nt', abbrev: 'Matt.' },
  'mark':   { work: 'nt', abbrev: 'Mark' },
  'luke':   { work: 'nt', abbrev: 'Luke' },
  'john':   { work: 'nt', abbrev: 'John' },
  'acts':   { work: 'nt', abbrev: 'Acts' },
  'rom':    { work: 'nt', abbrev: 'Rom.' },
  '1-cor':  { work: 'nt', abbrev: '1 Cor.' },
  '2-cor':  { work: 'nt', abbrev: '2 Cor.' },
  'gal':    { work: 'nt', abbrev: 'Gal.' },
  'eph':    { work: 'nt', abbrev: 'Eph.' },
  'philip': { work: 'nt', abbrev: 'Philip.' },
  'col':    { work: 'nt', abbrev: 'Col.' },
  '1-thes': { work: 'nt', abbrev: '1 Thes.' },
  '2-thes': { work: 'nt', abbrev: '2 Thes.' },
  '1-tim':  { work: 'nt', abbrev: '1 Tim.' },
  '2-tim':  { work: 'nt', abbrev: '2 Tim.' },
  'titus':  { work: 'nt', abbrev: 'Titus' },
  'philem': { work: 'nt', abbrev: 'Philem.' },
  'heb':    { work: 'nt', abbrev: 'Heb.' },
  'james':  { work: 'nt', abbrev: 'James' },
  '1-pet':  { work: 'nt', abbrev: '1 Pet.' },
  '2-pet':  { work: 'nt', abbrev: '2 Pet.' },
  '1-jn':   { work: 'nt', abbrev: '1 Jn.' },
  '2-jn':   { work: 'nt', abbrev: '2 Jn.' },
  '3-jn':   { work: 'nt', abbrev: '3 Jn.' },
  'jude':   { work: 'nt', abbrev: 'Jude' },
  'rev':    { work: 'nt', abbrev: 'Rev.' },

  // Book of Mormon
  '1-ne':   { work: 'bom', abbrev: '1 Ne.' },
  '2-ne':   { work: 'bom', abbrev: '2 Ne.' },
  'jacob':  { work: 'bom', abbrev: 'Jacob' },
  'enos':   { work: 'bom', abbrev: 'Enos' },
  'jarom':  { work: 'bom', abbrev: 'Jarom' },
  'omni':   { work: 'bom', abbrev: 'Omni' },
  'w-of-m': { work: 'bom', abbrev: 'W of M' },
  'mosiah': { work: 'bom', abbrev: 'Mosiah' },
  'alma':   { work: 'bom', abbrev: 'Alma' },
  'hel':    { work: 'bom', abbrev: 'Hel.' },
  '3-ne':   { work: 'bom', abbrev: '3 Ne.' },
  '4-ne':   { work: 'bom', abbrev: '4 Ne.' },
  'morm':   { work: 'bom', abbrev: 'Morm.' },
  'ether':  { work: 'bom', abbrev: 'Ether' },
  'moro':   { work: 'bom', abbrev: 'Moro.' },

  // Doctrine and Covenants
  'dc': { work: 'dc', abbrev: 'D&C' },
  'od': { work: 'dc', abbrev: 'OD' },

  // Pearl of Great Price
  'moses': { work: 'pgp', abbrev: 'Moses' },
  'abr':   { work: 'pgp', abbrev: 'Abr.' },
  'js-m':  { work: 'pgp', abbrev: 'JS\u2014M' },
  'js-h':  { work: 'pgp', abbrev: 'JS\u2014H' },
  'a-of-f': { work: 'pgp', abbrev: 'A of F' },

  // Quran
  'quran': { work: 'quran', abbrev: 'Quran' },

  // Apocrypha
  'tobit':    { work: 'apoc', abbrev: 'Tobit' },
  'judith':   { work: 'apoc', abbrev: 'Judith' },
  'add-esth': { work: 'apoc', abbrev: 'Add. Esth.' },
  'wis':      { work: 'apoc', abbrev: 'Wis.' },
  'sir':      { work: 'apoc', abbrev: 'Sir.' },
  'bar':      { work: 'apoc', abbrev: 'Bar.' },
  'pr-azar':  { work: 'apoc', abbrev: 'Pr. Azar.' },
  'sus':      { work: 'apoc', abbrev: 'Sus.' },
  'bel':      { work: 'apoc', abbrev: 'Bel' },
  '1-macc':   { work: 'apoc', abbrev: '1 Macc.' },
  '2-macc':   { work: 'apoc', abbrev: '2 Macc.' },
  '1-esd':    { work: 'apoc', abbrev: '1 Esd.' },
  'pr-man':   { work: 'apoc', abbrev: 'Pr. Man.' },
  '2-esd':    { work: 'apoc', abbrev: '2 Esd.' },

  // The Four Books
  'gl':       { work: 'fourbooks', abbrev: 'G.L.' },
  'dom':      { work: 'fourbooks', abbrev: 'D.M.' },
  'analects': { work: 'fourbooks', abbrev: 'Analects' },
  'mencius':  { work: 'fourbooks', abbrev: 'Mencius' },

  // Tao Te Ching
  'ttc': { work: 'ttc', abbrev: 'T.T.C.' },

  // Kojiki
  'kj1': { work: 'kj', abbrev: 'Kojiki I' },
  'kj2': { work: 'kj', abbrev: 'Kojiki II' },
  'kj3': { work: 'kj', abbrev: 'Kojiki III' },

  // Bundahis
  'bund': { work: 'bund', abbrev: 'Bund.' }
};

/**
 * Format a chapter reference for display.
 * e.g. formatRef('gen-1', 26) → 'Gen. 1:26'
 */
export function formatRef(chapterId, verse) {
  const i = chapterId.lastIndexOf('-');
  if (i > 0) {
    const bookId = chapterId.slice(0, i);
    const chNum = chapterId.slice(i + 1);
    if (BOOKS[bookId]) return `${BOOKS[bookId].abbrev} ${chNum}:${verse}`;
  }
  return `${chapterId}:${verse}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/refs.js
git commit -m "refactor: gut refs.js — keep only BOOKS map and formatRef"
```

---

## Task 3: Simplify chapters.js

**Files:**
- Modify: `src/chapters.js`

Remove: `resolveWorkAlias`, `resolveDataDir`, `getDefaultTranslation`, `loadGlossary`, `glossaryCache`, `loadCrossRefs`, `getCrossRefs`, `crossRefs`, `loadJstAppendix`, `jstAppendix`, `workIdSet`, translation alias registration in `loadManifests`.

Simplify `loadChapter` to always load from `data/{workId}/chapters/`.

- [ ] **Step 1: Replace chapters.js**

```js
/* ===================================================================
   chapters.js — data layer for scripture manifests, chapters,
   and search index.  All fetches are cached; call loadManifests() once
   at startup to prime the manifest cache.
   =================================================================== */

const DATA_BASE = 'data';

/* ── caches ──────────────────────────────────────────────────────── */
const manifestCache = new Map();   // workId  -> manifest object
const chapterCache  = new Map();   // "workId/chapterId" -> chapter object

let searchIndex   = null;          // array, loaded once
let workIds       = null;          // string[], loaded once

/* ── helpers ─────────────────────────────────────────────────────── */

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return res.json();
}

/* ── public API ──────────────────────────────────────────────────── */

/**
 * Fetch works.json, then all manifests in parallel.  Safe to call
 * multiple times — returns immediately if already loaded.
 */
export async function loadManifests() {
  if (workIds) return;
  workIds = await fetchJSON(`${DATA_BASE}/works.json`);
  const manifests = await Promise.all(
    workIds.map(id => fetchJSON(`${DATA_BASE}/${id}/manifest.json`))
  );
  manifests.forEach(m => manifestCache.set(m.id, m));
}

/** Array of work ID strings. */
export function getWorkIds() {
  return workIds || [];
}

/** Cached manifest for a single work, or null. */
export function getManifest(workId) {
  return manifestCache.get(workId) ?? null;
}

/**
 * Fetch and cache a single chapter.
 * @param {string} workId      e.g. "ot"
 * @param {string} chapterId   e.g. "gen-1"
 */
export async function loadChapter(workId, chapterId) {
  const key = `${workId}/${chapterId}`;
  if (chapterCache.has(key)) return chapterCache.get(key);
  const chapter = await fetchJSON(
    `${DATA_BASE}/${workId}/chapters/${chapterId}.json`
  );
  // Attach context from the manifest for title construction
  const manifest = manifestCache.get(workId);
  if (manifest) {
    chapter.workTitle = manifest.title;
    chapter.bookCount = manifest.books.length;
    for (const book of manifest.books) {
      if (book.chapters.some(ch => ch.id === chapterId)) {
        chapter.bookName = book.name;
        if (book.chapters.length === 1) chapter.singleChapter = true;
        break;
      }
    }
  }
  chapterCache.set(key, chapter);
  return chapter;
}

/**
 * Fetch the global search index (once).
 */
export async function loadSearchIndex() {
  if (searchIndex) return searchIndex;
  searchIndex = await fetchJSON(`${DATA_BASE}/search-index.json`);
  return searchIndex;
}

/**
 * Parse a canonical reference string.
 * Format: "workId:chapterId:verse"
 */
export function parseRef(ref) {
  const first = ref.indexOf(':');
  const last  = ref.lastIndexOf(':');
  return {
    workId:    ref.slice(0, first),
    chapterId: ref.slice(first + 1, last),
    verse:     Number(ref.slice(last + 1))
  };
}

/**
 * Return prev/next chapter entries relative to the given chapter.
 */
export function getAdjacentChapters(workId, chapterId) {
  const manifest = manifestCache.get(workId);
  if (!manifest) return { prev: null, next: null };

  const flat = [];
  for (const book of manifest.books) {
    for (const ch of book.chapters) {
      flat.push({ id: ch.id, bookId: book.id, bookName: book.name });
    }
  }

  const idx = flat.findIndex(e => e.id === chapterId);
  return {
    prev: idx > 0                ? flat[idx - 1] : null,
    next: idx < flat.length - 1  ? flat[idx + 1] : null
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/chapters.js
git commit -m "refactor: simplify chapters.js — remove translations, cross-refs, glossary, JST"
```

---

## Task 4: Simplify reader.js

**Files:**
- Modify: `src/reader.js`

Remove `byKey` and `extraFootnotes` parameters. Remove footnote marker rendering from `appendVerse`. Verses become clean: number + text only.

- [ ] **Step 1: Replace reader.js**

```js
/* ===================================================================
   reader.js — Chapter rendering for the reading pane.
   Renders section-based chapters with verse numbers.
   =================================================================== */

/**
 * Render a chapter into the reading pane.
 *
 * @param {object} $         DOM cache
 * @param {object} chapter   Chapter data from loadChapter()
 */
export function renderChapter($, chapter) {
  // --- Header: construct title from book/work context ---
  let title;
  if (chapter.singleChapter) {
    title = chapter.bookName;
  } else if (chapter.bookCount === 1) {
    title = `${chapter.workTitle} ${chapter.chapter}`;
  } else {
    title = `${chapter.bookName} ${chapter.chapter}`;
  }
  $.chapterTitle.textContent = title;

  const subtitle = chapter.name || '';
  $.chapterSubtitle.textContent = subtitle;
  $.chapterSubtitle.hidden = !subtitle;
  $.chapterIntro.textContent = chapter.intro || '';
  $.chapterIntro.classList.toggle('hidden', !chapter.intro);

  // --- Build verse list, interleaving section headings ---
  const container = $.verses;
  container.replaceChildren();
  _activeVerse = null;

  if (chapter.sections && chapter.sections.length) {
    const multiSection = chapter.sections.length > 1;
    for (let i = 0; i < chapter.sections.length; i++) {
      if (multiSection) {
        const heading = document.createElement('span');
        heading.className = 'section-heading';
        heading.setAttribute('role', 'heading');
        heading.setAttribute('aria-level', '2');
        heading.textContent = i + 1;
        container.appendChild(heading);
      }
      for (const v of chapter.sections[i].verses) {
        const row = document.createElement('div');
        row.className = 'verse-row';

        const num = document.createElement('span');
        num.className = 'verse-num';
        num.textContent = v.number;
        num.dataset.verse = v.number;
        num.setAttribute('role', 'button');
        num.setAttribute('tabindex', '0');
        num.setAttribute('aria-label', `Verse ${v.number} — click to add note`);
        row.appendChild(num);

        const span = document.createElement('span');
        span.className = 'verse';
        span.id = `v${v.number}`;
        span.dataset.verse = v.number;
        span.textContent = v.text;
        row.appendChild(span);

        container.appendChild(row);
      }
    }
  }

  $.readingPane.scrollTop = 0;
}

let _activeVerse = null;

/**
 * Highlight a verse by adding .verse-highlight and scrolling it into view.
 */
export function highlightVerse(verseNum) {
  if (_activeVerse) _activeVerse.classList.remove('verse-highlight');
  const el = document.getElementById(`v${verseNum}`);
  if (!el) { _activeVerse = null; return; }
  el.classList.add('verse-highlight');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  _activeVerse = el;
}
```

Note: `.verse-num` now has `role="button"`, `tabindex="0"`, and `data-verse` for the notes click handler (wired in main.js, Task 7).

- [ ] **Step 2: Commit**

```bash
git add src/reader.js
git commit -m "refactor: simplify reader.js — remove footnote markers, add clickable verse numbers"
```

---

## Task 5: Rewrite notes.js for User Notes

**Files:**
- Rewrite: `src/notes.js`

localStorage-backed per-verse notes. Single storage key `scripture-notes`. Sidebar shows note cards with auto-expanding textareas. Clicking a verse number opens/focuses a note.

- [ ] **Step 1: Write notes.js**

```js
/* ===================================================================
   notes.js — User notes sidebar with localStorage persistence.
   =================================================================== */

const STORAGE_KEY = 'scripture-notes';

let _allNotes = null;   // full notes object from localStorage
let _currentWork = null;
let _currentChapter = null;
let _$ = null;

function loadNotes() {
  if (_allNotes) return _allNotes;
  try {
    _allNotes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    _allNotes = {};
  }
  return _allNotes;
}

function saveNotes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_allNotes));
  } catch {
    // localStorage full — silently fail
  }
}

function noteKey(workId, chapterId, verseNum) {
  return `${workId}:${chapterId}:${verseNum}`;
}

/**
 * Initialize notes module. Call once at startup.
 * @param {object} $ DOM cache
 */
export function initNotes($) {
  _$ = $;
}

/**
 * Render notes for the current chapter.
 * @param {object} $          DOM cache
 * @param {string} workId     Current work
 * @param {string} chapterId  Current chapter
 */
export function renderNotes($, workId, chapterId) {
  _currentWork = workId;
  _currentChapter = chapterId;
  const container = $.notesContent;
  container.replaceChildren();

  const notes = loadNotes();
  const prefix = `${workId}:${chapterId}:`;

  // Collect existing notes for this chapter, sorted by verse number
  const chapterNotes = [];
  for (const [key, text] of Object.entries(notes)) {
    if (key.startsWith(prefix) && text) {
      const verseNum = parseInt(key.slice(prefix.length), 10);
      chapterNotes.push({ verseNum, text, key });
    }
  }
  chapterNotes.sort((a, b) => a.verseNum - b.verseNum);

  if (chapterNotes.length === 0) {
    showEmpty(container);
    return;
  }

  for (const note of chapterNotes) {
    container.appendChild(buildNoteCard(note.verseNum, note.text));
  }
}

/**
 * Open a note for a specific verse — create card if needed, focus textarea.
 */
export function openNote(verseNum) {
  if (!_$ || !_currentWork || !_currentChapter) return;

  // Open sidebar if closed
  const sidebar = _$.notesSidebar;
  if (!sidebar.classList.contains('open')) {
    _toolbar.toggleSidebar(_$.notesToggle, sidebar);
  }

  const container = _$.notesContent;
  const existingId = `user-note-${verseNum}`;
  let card = document.getElementById(existingId);

  if (card) {
    // Focus existing
    const ta = card.querySelector('textarea');
    if (ta) ta.focus();
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  // Remove empty state if present
  const empty = container.querySelector('.empty-state');
  if (empty) empty.remove();

  // Create new card in sorted position
  card = buildNoteCard(verseNum, '');
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

  const ta = card.querySelector('textarea');
  if (ta) ta.focus();
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function buildNoteCard(verseNum, text) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.id = `user-note-${verseNum}`;
  card.dataset.verse = verseNum;

  const label = document.createElement('div');
  label.className = 'note-label';

  const numBtn = document.createElement('button');
  numBtn.className = 'note-verse-btn ghost-btn';
  numBtn.textContent = `v${verseNum}`;
  numBtn.setAttribute('type', 'button');
  numBtn.setAttribute('aria-label', `Scroll to verse ${verseNum}`);
  numBtn.addEventListener('click', () => {
    const el = document.getElementById(`v${verseNum}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  label.appendChild(numBtn);
  card.appendChild(label);

  const ta = document.createElement('textarea');
  ta.className = 'note-textarea';
  ta.placeholder = 'Write a note...';
  ta.value = text;
  ta.rows = 1;
  autoExpand(ta);

  const save = debounce(() => {
    const val = ta.value.trim();
    const key = noteKey(_currentWork, _currentChapter, verseNum);
    const notes = loadNotes();
    if (val) {
      notes[key] = val;
      saveNotes();
      showToast('Note saved');
    }
  }, 500);

  ta.addEventListener('input', () => {
    autoExpand(ta);
    save();
  });

  ta.addEventListener('blur', () => {
    const val = ta.value.trim();
    const key = noteKey(_currentWork, _currentChapter, verseNum);
    const notes = loadNotes();
    if (!val) {
      if (notes[key]) {
        delete notes[key];
        saveNotes();
        showToast('Note deleted');
      }
      card.remove();
      // Show empty state if no cards remain
      const container = _$.notesContent;
      if (!container.querySelector('.note-card')) {
        showEmpty(container);
      }
    }
  });

  card.appendChild(ta);
  return card;
}

function autoExpand(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function showEmpty(container) {
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = 'Click a verse number to add a note.';
  container.appendChild(empty);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/notes.js
git commit -m "feat: rewrite notes.js — localStorage-backed user notes per verse"
```

---

## Task 6: Simplify nav.js and search.js

**Files:**
- Modify: `src/nav.js`
- Modify: `src/search.js`

### nav.js
Remove `populateTranslations`, translation change listener, `getDefaultTranslation` import. Simplify `navigateFn` to 2 args. Remove translation syncing from `syncNav`.

### search.js
Remove `resolveWorkAlias` import. Remove translation-name display from `runSearch`.

- [ ] **Step 1: Replace nav.js**

```js
/* ===================================================================
   nav.js — Toolbar dropdown population and navigation wiring.
   =================================================================== */

import { getWorkIds, getManifest } from './chapters.js';

/**
 * Replace all options in a <select> element.
 */
function fillSelect(sel, items, valueFn, textFn) {
  sel.replaceChildren();
  for (const item of items) {
    const opt = document.createElement('option');
    opt.value = valueFn(item);
    opt.textContent = textFn(item);
    sel.appendChild(opt);
  }
}

function populateWorks($) {
  const items = getWorkIds().map(id => ({ id, manifest: getManifest(id) })).filter(x => x.manifest);
  fillSelect($.workSelect, items, x => x.id, x => x.manifest.title);
}

function populateBooks($, workId) {
  const m = getManifest(workId);
  if (!m) { $.bookSelect.replaceChildren(); return; }
  fillSelect($.bookSelect, m.books, b => b.id, b => b.name);
  $.bookSelect.style.display = m.books.length <= 1 ? 'none' : '';
}

function populateChapters($, workId, bookId) {
  const m = getManifest(workId);
  if (!m) { $.chapterSelect.replaceChildren(); return; }
  const book = m.books.find(b => b.id === bookId);
  if (!book) { $.chapterSelect.replaceChildren(); return; }
  fillSelect($.chapterSelect, book.chapters,
    ch => ch.id,
    ch => ch.name ? `${ch.id.match(/\d+$/)[0]} (${ch.name})` : ch.id.match(/\d+$/)[0]
  );
  $.chapterSelect.style.display = book.chapters.length <= 1 ? 'none' : '';
}

function findBookForChapter(workId, chapterId) {
  const m = getManifest(workId);
  if (!m) return null;
  for (const book of m.books) {
    if (book.chapters.some(ch => ch.id === chapterId)) return book.id;
  }
  return m.books[0]?.id ?? null;
}

/**
 * Wire change listeners on work/book/chapter selects.
 * @param {object} $          DOM cache
 * @param {Function} navigateFn  (workId, chapterId) => void
 */
export function initNav($, navigateFn) {
  populateWorks($);

  $.workSelect.addEventListener('change', () => {
    const workId = $.workSelect.value;
    populateBooks($, workId);
    const firstBookId = $.bookSelect.value;
    populateChapters($, workId, firstBookId);
    const firstChapterId = $.chapterSelect.value;
    if (firstChapterId) navigateFn(workId, firstChapterId);
  });

  $.bookSelect.addEventListener('change', () => {
    const workId = $.workSelect.value;
    const bookId = $.bookSelect.value;
    populateChapters($, workId, bookId);
    const firstChapterId = $.chapterSelect.value;
    if (firstChapterId) navigateFn(workId, firstChapterId);
  });

  $.chapterSelect.addEventListener('change', () => {
    const workId = $.workSelect.value;
    const chapterId = $.chapterSelect.value;
    if (chapterId) navigateFn(workId, chapterId);
  });
}

/**
 * Set dropdown values to match the current navigation state.
 */
export function syncNav($, workId, chapterId) {
  const workChanged = $.workSelect.value !== workId;
  $.workSelect.value = workId;

  if (workChanged || $.bookSelect.options.length <= 1) {
    populateBooks($, workId);
  }

  const bookId = findBookForChapter(workId, chapterId);
  if (bookId && $.bookSelect.value !== bookId) {
    $.bookSelect.value = bookId;
    populateChapters($, workId, bookId);
  } else if (workChanged || $.bookSelect.options.length <= 1) {
    populateChapters($, workId, bookId || $.bookSelect.value);
  }
  $.chapterSelect.value = chapterId;
}
```

- [ ] **Step 2: Replace search.js**

Replace the import line and remove translation display from `runSearch`. The full file with changes:

In `search.js`, make these specific edits:

1. Change import line from:
   ```js
   import { loadSearchIndex, parseRef, getManifest, getWorkIds, resolveWorkAlias } from './chapters.js';
   ```
   to:
   ```js
   import { loadSearchIndex, parseRef, getManifest, getWorkIds } from './chapters.js';
   ```

2. In `runSearch`, replace the block that builds group headings (lines 238-249) — remove the `resolveWorkAlias` call and translation name appending:
   ```js
   // Render grouped results
   for (const [workId, items] of groups) {
     const manifest = getManifest(workId);
     const groupEl = document.createElement('div');
     groupEl.className = 'search-work-group';

     const heading = document.createElement('h3');
     heading.textContent = manifest ? manifest.title : workId;
     groupEl.appendChild(heading);
   ```

- [ ] **Step 3: Commit**

```bash
git add src/nav.js src/search.js
git commit -m "refactor: simplify nav.js and search.js — remove translations and alias resolution"
```

---

## Task 7: Rewrite main.js and index.html

**Files:**
- Modify: `main.js`
- Modify: `index.html`

Remove all glossary/compare/cross-ref/translation/notemap/JST imports and wiring. Add download button handler and notes wiring. Update about panel.

- [ ] **Step 1: Replace index.html**

Key changes to `index.html`:

1. Update meta descriptions:
   ```html
   <meta name="description" content="Read and annotate sacred texts from six traditions, with full-text search and personal notes.">
   <meta property="og:description" content="Read and annotate sacred texts from six traditions, with full-text search and personal notes.">
   ```

2. Remove `#translation-select` from `.nav-dropdowns`

3. Replace `#compare-btn` with nothing (just remove it)

4. Replace `#glossary-btn` with download button:
   ```html
   <button id="download-btn" class="tool-btn" title="Download Text" aria-label="Download text file">
       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
           <polyline points="7 10 12 15 17 10"></polyline>
           <line x1="12" y1="15" x2="12" y2="3"></line>
       </svg>
   </button>
   ```

5. Remove `#compare-pane` div entirely

6. Remove `#glossary-overlay` div entirely

- [ ] **Step 2: Replace main.js**

```js
/* ===================================================================
   main.js — Scripture reader entry point.
   DOM cache, routing, module initialization.
   =================================================================== */

import { loadManifests, getManifest, loadChapter, getAdjacentChapters } from './src/chapters.js';
import { initNav, syncNav } from './src/nav.js';
import { renderChapter, highlightVerse } from './src/reader.js';
import { initNotes, renderNotes, openNote } from './src/notes.js';
import { initSearch } from './src/search.js';

/* ── DOM cache ─────────────────────────────────────────────────────── */

const $ = {
  toolbar:         document.getElementById('toolbar'),
  workSelect:      document.getElementById('work-select'),
  bookSelect:      document.getElementById('book-select'),
  chapterSelect:   document.getElementById('chapter-select'),
  readingPane:     document.getElementById('reading-pane'),
  chapterTitle:    document.getElementById('chapter-title'),
  chapterSubtitle: document.getElementById('chapter-subtitle'),
  chapterIntro:    document.getElementById('chapter-intro'),
  verses:          document.getElementById('verses'),
  prevChapter:     document.getElementById('prev-chapter'),
  nextChapter:     document.getElementById('next-chapter'),
  notesToggle:     document.getElementById('notes-toggle'),
  notesSidebar:    document.getElementById('notes-sidebar'),
  notesClose:      document.getElementById('notes-close'),
  notesContent:    document.getElementById('notes-content'),
  downloadBtn:     document.getElementById('download-btn'),
  searchBtn:       document.getElementById('search-btn'),
  searchOverlay:   document.getElementById('search-overlay'),
  searchInput:     document.getElementById('search-input'),
  searchClose:     document.getElementById('search-close'),
  searchResults:   document.getElementById('search-results'),
  searchWork:      document.getElementById('search-work'),
  searchBook:      document.getElementById('search-book'),
  searchChapter:   document.getElementById('search-chapter'),
  themeBtn:        document.getElementById('theme-btn'),
  aboutBtn:        document.getElementById('about-btn'),
  appLayout:       document.getElementById('app-layout')
};

/* ── state ─────────────────────────────────────────────────────────── */

let currentWork = null;
let currentChapter = null;

/* ── navigation ────────────────────────────────────────────────────── */

async function navigate(workId, chapterId, verse) {
  const hash = verse ? `${workId}/${chapterId}:${verse}` : `${workId}/${chapterId}`;
  if (location.hash !== `#${hash}`) {
    history.replaceState(null, '', `#${hash}`);
  }

  currentWork = workId;
  currentChapter = chapterId;
  syncNav($, workId, chapterId);

  try {
    const chapter = await loadChapter(workId, chapterId);
    renderChapter($, chapter);
    renderNotes($, workId, chapterId);

    const { prev, next } = getAdjacentChapters(workId, chapterId);
    updateNavLink($.prevChapter, workId, prev);
    updateNavLink($.nextChapter, workId, next);

    if (verse) {
      requestAnimationFrame(() => highlightVerse(verse));
    }
  } catch (err) {
    $.chapterTitle.textContent = 'Error';
    $.chapterSubtitle.textContent = '';
    $.chapterIntro.textContent = '';
    $.chapterIntro.classList.add('hidden');
    const container = $.verses;
    container.replaceChildren();
    const msg = document.createElement('p');
    msg.className = 'empty-state';
    msg.textContent = `Failed to load chapter: ${err.message}`;
    container.appendChild(msg);
  }
}

function updateNavLink(el, workId, adjacent) {
  if (adjacent) {
    el.href = `#${workId}/${adjacent.id}`;
    el.style.visibility = 'visible';
  } else {
    el.href = '#';
    el.style.visibility = 'hidden';
  }
}

/* ── hash routing ──────────────────────────────────────────────────── */

function routeFromHash() {
  const hash = location.hash.slice(1);
  if (!hash) {
    const manifest = getManifest('bom');
    if (!manifest || !manifest.books.length) return;
    const book = manifest.books[0];
    navigate('bom', book.chapters[0].id);
    return;
  }

  const slashIdx = hash.indexOf('/');
  if (slashIdx === -1) return;

  const workId = hash.slice(0, slashIdx);
  let rest = hash.slice(slashIdx + 1);
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
}

/* ── download ──────────────────────────────────────────────────────── */

async function downloadText() {
  if (!currentWork) return;
  try {
    const res = await fetch(`text/${currentWork}.txt`);
    if (!res.ok) throw new Error(res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentWork}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${currentWork}.txt`);
  } catch {
    showToast('Download failed');
  }
}

/* ── initialization ────────────────────────────────────────────────── */

async function init() {
  _toolbar.initTheme('scripture-theme');
  $.themeBtn.addEventListener('click', () => _toolbar.toggleTheme('scripture-theme'));

  await loadManifests();

  initNav($, (workId, chapterId) => navigate(workId, chapterId));

  window.addEventListener('hashchange', routeFromHash);
  routeFromHash();

  const search = initSearch($, (workId, chapterId, verse) => {
    $.searchOverlay.classList.add('hidden');
    navigate(workId, chapterId, verse);
  });

  // Notes sidebar
  initNotes($);
  _toolbar.initSidebar($.notesToggle, $.notesSidebar, $.notesClose);

  // Verse number click → open note
  $.verses.addEventListener('click', (e) => {
    const num = e.target.closest('.verse-num');
    if (num) openNote(parseInt(num.dataset.verse, 10));
  });
  $.verses.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const num = e.target.closest('.verse-num');
    if (!num) return;
    e.preventDefault();
    openNote(parseInt(num.dataset.verse, 10));
  });

  // Download
  $.downloadBtn.addEventListener('click', downloadText);

  // Keyboard shortcuts
  initShortcuts([
    { key: '/', label: 'Open search', group: 'Navigation', action: () => search.open() },
    {
      key: 'Escape', label: 'Close overlay', group: 'Navigation',
      action: () => {
        if (!$.searchOverlay.classList.contains('hidden')) search.close();
      }
    },
    {
      key: 'ArrowLeft', label: 'Previous chapter', group: 'Navigation',
      action: () => {
        if ($.prevChapter.style.visibility !== 'hidden') {
          location.hash = $.prevChapter.getAttribute('href').slice(1);
        }
      },
      when: () => {
        const el = document.activeElement;
        return !el || (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA');
      }
    },
    {
      key: 'ArrowRight', label: 'Next chapter', group: 'Navigation',
      action: () => {
        if ($.nextChapter.style.visibility !== 'hidden') {
          location.hash = $.nextChapter.getAttribute('href').slice(1);
        }
      },
      when: () => {
        const el = document.activeElement;
        return !el || (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA');
      }
    }
  ]);

  // About panel
  initAboutPanel({
    title: 'Scripture',
    description: 'Read and annotate sacred texts from six traditions, with full-text search and personal notes.',
    controls: [
      { label: 'Work / Book / Chapter', value: 'Toolbar dropdowns to navigate' },
      { label: 'Verse notes', value: 'Click verse number to add a note' },
      { label: 'Download', value: 'Download current work as text file' }
    ],
    shortcuts: [
      { key: '/', label: 'Open search', group: 'Navigation' },
      { key: '?', label: 'About / help', group: 'Navigation' },
      { key: 'ArrowLeft', label: 'Previous chapter', group: 'Navigation' },
      { key: 'ArrowRight', label: 'Next chapter', group: 'Navigation' },
      { key: 'Escape', label: 'Close overlay', group: 'Navigation' }
    ],
    repo: 'https://github.com/a9lim/a9lim.github.io'
  });

  document.body.classList.add('app-ready');
}

init();
```

- [ ] **Step 3: Commit**

```bash
git add main.js index.html
git commit -m "feat: overhaul main.js and index.html — download button, user notes, remove dead features"
```

---

## Task 8: Update styles.css

**Files:**
- Modify: `styles.css`

Remove: `.glossary-*`, `#compare-pane`, `.compare-active`, `.fn-marker*`, `.note-ref-link`, `.note-tooltip`, `.note-jst*` styles.

Update `.note-card` for user notes. Add `.note-textarea`, `.note-verse-btn`, clickable `.verse-num` hover state.

- [ ] **Step 1: Edit styles.css**

Remove these style blocks entirely:
- `.fn-marker` and all variants (`.fn-marker[data-type=...]`, `.fn-marker:hover`, `.fn-marker-flash`, `@keyframes fn-flash`)
- `.note-ref-link`, `.note-ref-link:hover`
- `.note-tooltip`
- `.note-jst-ref`, `.note-jst`
- `#compare-pane`, `#compare-header`, `.compare-active #reading-pane`
- `.glossary-entry`, `.glossary-term`, `.glossary-definition`
- The `.compare-active #app-layout` rule in the 900px media query

Update `.note-card`:
```css
.note-card {
    padding: 0.75rem;
    margin-bottom: 0.75rem;
    border-radius: var(--radius-md);
    background-color: var(--bg-elevated);
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--text-secondary);
}
```

Remove the data-type variants on `.note-card` (commentary, cross-ref, glossary, jst). Remove `.note-type` badge.

Add new styles:
```css
/* ---------- Clickable Verse Numbers ---------- */

.verse-num {
    cursor: pointer;
    transition: color 0.15s;
}

.verse-num:hover,
.verse-num:focus-visible {
    color: var(--text);
}

/* ---------- User Note Cards ---------- */

.note-verse-btn {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--accent);
    cursor: pointer;
}

.note-textarea {
    display: block;
    width: 100%;
    min-height: 2.5em;
    padding: 0.5rem;
    border: none;
    border-radius: var(--radius-sm, 4px);
    background: var(--bg-hover);
    color: var(--text);
    font-family: var(--font-body-serif);
    font-size: 0.95rem;
    line-height: 1.5;
    resize: none;
    overflow: hidden;
}

.note-textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
}

.note-textarea::placeholder {
    color: var(--text-muted);
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "refactor: update styles — remove dead styles, add user note styles"
```

---

## Task 9: Simplify Python Pipeline

**Files:**
- Modify: `extract/base_parser.py`
- Modify: `extract/pdf_parser.py`
- Modify: `extract/parsers/quad.py`
- Modify: `extract/txt_to_json.py`
- Modify: `extract/json_to_txt.py`
- Modify: `extract/verify_data.py`

- [ ] **Step 1: Simplify base_parser.py**

Replace `_strip_chapter`:
```python
@staticmethod
def _strip_chapter(chapter: dict) -> dict:
    """Remove redundant/null fields from chapter data before writing."""
    out = {}
    for k, v in chapter.items():
        if k == '_book':
            continue
        if v is None and k in ('name', 'intro'):
            continue
        out[k] = v
    return out
```

Replace `_strip_manifest`:
```python
@staticmethod
def _strip_manifest(manifest: dict) -> dict:
    """Remove redundant fields from manifest before writing."""
    out = dict(manifest)
    out['books'] = [
        {**book, 'chapters': [
            {k: v for k, v in ch.items() if not (k == 'name' and v is None)}
            for ch in book.get('chapters', [])
        ]}
        for book in out.get('books', [])
    ]
    return out
```

Replace `write_output` to remove glossary writing:
```python
def write_output(self, works: list[dict], output_dir: str) -> None:
    """Write extracted works to *output_dir*.

    Creates per work::

        <output_dir>/<work_id>/manifest.json
        <output_dir>/<work_id>/chapters/<chapter-id>.json
    """
    for work in works:
        work_dir = os.path.join(output_dir, work["manifest"]["id"])
        os.makedirs(work_dir, exist_ok=True)
        chapters_dir = os.path.join(work_dir, "chapters")
        os.makedirs(chapters_dir, exist_ok=True)

        with open(os.path.join(work_dir, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(self._strip_manifest(work["manifest"]), f, ensure_ascii=False, indent=2)

        for chapter in work["chapters"]:
            stripped = self._strip_chapter(chapter)
            chapter_path = os.path.join(chapters_dir, f"{stripped['id']}.json")
            with open(chapter_path, "w", encoding="utf-8") as f:
                json.dump(stripped, f, ensure_ascii=False, indent=2)
```

Update class docstring to remove glossary mention:
```python
class BaseParser:
    """Base class with shared helpers for all scripture parsers.

    Subclasses override ``parse()`` to produce a list of work dicts, each
    with keys ``manifest`` and ``chapters``.  The shared
    ``write_output()`` method serialises them to disk.
    """
```

- [ ] **Step 2: Simplify pdf_parser.py**

Remove `extract_glossary` abstract method. Remove footnote docs from `extract_chapters`. Remove `translations` from `build_manifest` docs. Remove glossary from `parse()`.

```python
"""Abstract base class for PDF-based scripture parsers."""

from abc import ABC, abstractmethod

import fitz

from base_parser import BaseParser


class PdfParser(BaseParser, ABC):
    """Base class for parsers that extract from PDF via PyMuPDF.

    Subclasses implement ``extract_chapters()`` and ``build_manifest()``
    for their specific PDF layout.
    """

    @abstractmethod
    def extract_chapters(self, doc: fitz.Document) -> list[dict]:
        """Return a list of chapter dicts.

        Each dict follows this schema::

            {
                "chapter": <int>,
                "id": "<slug>",
                "name": "<descriptive name or None>",
                "intro": "<chapter intro text or None>",
                "sections": [
                    {
                        "title": "<section heading or None>",
                        "verses": [
                            {
                                "number": <int>,
                                "text": "<verse body>"
                            },
                            ...
                        ]
                    },
                    ...
                ]
            }
        """

    @abstractmethod
    def build_manifest(self, chapters: list[dict]) -> dict:
        """Return a work manifest dict.

        Expected shape::

            {
                "id": "<work-id>",
                "title": "<display title>",
                "books": [
                    {
                        "id": "<book-slug>",
                        "name": "<book name>",
                        "chapters": [<chapter-number>, ...]
                    },
                    ...
                ]
            }
        """

    def parse(self, pdf_path: str) -> list[dict]:
        """Open *pdf_path* with PyMuPDF and run the full extraction pipeline.

        Returns a list of work dicts, each with keys
        ``manifest`` and ``chapters``.
        """
        doc = fitz.open(pdf_path)
        try:
            chapters = self.extract_chapters(doc)
            manifests = self.build_manifest(chapters)
        finally:
            doc.close()

        # Normalize single manifest → list
        if isinstance(manifests, dict):
            manifests = [manifests]

        works = []
        for manifest in manifests:
            chapter_ids = manifest.pop("_chapter_ids", None)
            if chapter_ids is not None:
                work_chapters = [ch for ch in chapters if ch["id"] in chapter_ids]
            else:
                work_chapters = chapters
            works.append({
                "manifest": manifest,
                "chapters": work_chapters,
            })

        return works
```

- [ ] **Step 3: Simplify quad.py**

Three changes:

1. Remove `_FN_MARKER_FLAGS` constant (line 27):
   Delete `_FN_MARKER_FLAGS = {22, 23}`

2. Remove `extract_glossary` method (line 311-312):
   Delete the entire method.

3. Remove `translations` from `_work` helper and manifest construction (lines 358-377).
   Replace with:
   ```python
   def _work(work_id, title, key):
       book_map, order, ids = groups[key]
       return {
           "id": work_id,
           "title": title,
           "books": [book_map[b] for b in order],
           "_chapter_ids": ids,
       }

   return [
       _work("bom", "Book of Mormon", "bom"),
       _work("dc", "Doctrine and Covenants", "dc"),
       _work("pgp", "Pearl of Great Price", "pgp"),
       _work("ot", "Old Testament", "ot"),
       _work("nt", "New Testament", "nt"),
   ]
   ```

4. In `_process_verse_span` (line 496-498), remove footnote marker skip:
   Replace:
   ```python
   # Footnote markers (superscript letters) and footnote area at page bottom
   if s <= _FN_MARKER_SIZE_MAX and f in _FN_MARKER_FLAGS and len(t) <= 2:
       return
   ```
   With:
   ```python
   # Skip footnote area at page bottom (small text below verse area)
   if s <= _FN_MARKER_SIZE_MAX and len(t) <= 2:
       return
   ```

5. Remove `_cur_fns` from `_new_chapter` and `_process_verse_span` (it's set but never read, so just remove the assignments).

- [ ] **Step 4: Simplify txt_to_json.py**

Remove `_FN_RE`, footnote parsing from verse lines, `merge_existing_data`, `copy_ancillary_data`, `--data` arg. Remove glossary from work dict.

Key changes:

1. Remove `_FN_RE = re.compile(r'\s+\{([^}]+)\}$')` (line 40)

2. In verse parsing (lines 138-155), simplify to:
   ```python
   # Verse line
   if current_chapter is not None:
       if current_section is None:
           current_section = {'verses': []}
           current_chapter['_sections'].append(current_section)

       verse_num = current_chapter.get('_next_verse', 1)
       current_chapter['_next_verse'] = verse_num + 1

       current_section['verses'].append({
           'number': verse_num,
           'text': line,
       })
   ```

3. In `parse_txt` return, remove `'glossary': []`:
   ```python
   return [{
       'manifest': manifest,
       'chapters': chapters,
   }]
   ```

4. Remove `merge_existing_data` function entirely (lines 174-195)
5. Remove `copy_ancillary_data` function entirely (lines 198-206)

6. In `main()`, remove:
   - `--data` argument
   - `merge_existing_data(works, data_dir)` call
   - `copy_ancillary_data(data_dir, args.output)` call
   - `n_gl = len(work['glossary'])` and its print
   - `data_dir = args.data or args.output` line

7. Update docstring to remove footnote/glossary/JST/cross-ref mentions.

- [ ] **Step 5: Simplify json_to_txt.py**

Remove footnote suffix and translation export.

1. Remove translation export (lines 39-40):
   Delete the `for tr in manifest.get('translations', []):` block.

2. Remove footnote suffix (lines 77-80):
   Replace:
   ```python
   for verse in section['verses']:
       fn_part = ''
       if verse.get('footnotes'):
           fn_part = ' {' + ','.join(verse['footnotes']) + '}'
       lines.append(f'{verse["text"]}{fn_part}')
   ```
   With:
   ```python
   for verse in section['verses']:
       lines.append(verse['text'])
   ```

3. Update docstring to remove footnote/glossary mentions.

- [ ] **Step 6: Simplify verify_data.py**

Remove footnote verification (lines 311-324). Delete these blocks from `check_chapter`:
```python
# Check footnote references exist
ch_footnotes = ch_data.get("footnotes", {})
for v in all_verses:
    for fn_key in v.get("footnotes", []):
        if fn_key not in ch_footnotes:
            self.error(f"[{ch_id}:{v['number']}] Footnote '{fn_key}' referenced but not defined")

# Check no orphan footnotes (defined but never referenced)
all_fn_refs = set()
for v in all_verses:
    all_fn_refs.update(v.get("footnotes", []))
for fn_key in ch_footnotes:
    if fn_key not in all_fn_refs:
        self.warn(f"[{ch_id}] Orphan footnote '{fn_key}' defined but never referenced")
```

- [ ] **Step 7: Commit**

```bash
git add extract/base_parser.py extract/pdf_parser.py extract/parsers/quad.py \
       extract/txt_to_json.py extract/json_to_txt.py extract/verify_data.py
git commit -m "refactor: simplify pipeline — remove footnotes, glossary, translations"
```

---

## Task 10: Regenerate Data and Verify

**Files:**
- All `data/*/chapters/*.json` (regenerated)
- `data/works.json`, `data/search-index.json` (regenerated)

- [ ] **Step 1: Export clean text files (strip footnotes from existing JSON)**

Run the OLD json_to_txt first — wait, we already simplified it. But the text files may already have `{fn-id}` suffixes from previous exports. Let's check and strip them:

```bash
cd /Users/a9lim/Work/a9lim.github.io/scripture/extract
grep -l '{fn-' ../text/*.txt
```

If any files have footnote references, they need to be stripped. The simplified `txt_to_json.py` now treats `{fn-id}` as literal verse text, so we need to remove them first:

```bash
cd /Users/a9lim/Work/a9lim.github.io/scripture/extract
# Strip footnote references from text files
for f in ../text/*.txt; do
  sed -i '' 's/ {[^}]*}$//g' "$f"
done
```

- [ ] **Step 2: Rebuild all JSON from text files**

```bash
cd /Users/a9lim/Work/a9lim.github.io/scripture/extract
./run.sh txt2json
```

Expected: all works rebuild without errors.

- [ ] **Step 3: Verify data**

```bash
cd /Users/a9lim/Work/a9lim.github.io/scripture/extract
./run.sh verify
```

Expected: "All checks passed!" with no footnote-related warnings.

- [ ] **Step 4: Rebuild search index**

```bash
cd /Users/a9lim/Work/a9lim.github.io/scripture/extract
./run.sh reindex
```

- [ ] **Step 5: Commit regenerated data**

```bash
cd /Users/a9lim/Work/a9lim.github.io/scripture
git add data/ text/
git commit -m "chore: regenerate data — clean verses without footnotes"
```

---

## Task 11: Manual Smoke Test

No automated test framework exists. Verify by serving locally.

- [ ] **Step 1: Start local server**

```bash
cd /Users/a9lim/Work/a9lim.github.io && python -m http.server
```

- [ ] **Step 2: Test checklist**

Open `http://localhost:8000/scripture/` and verify:

1. Default page loads (Book of Mormon, 1 Nephi 1) — no console errors
2. Work/Book/Chapter dropdowns navigate correctly
3. No translation dropdown visible
4. No compare button, no glossary button
5. Download button present — click it, verify `.txt` file downloads
6. Click a verse number — sidebar opens, note textarea appears
7. Type a note, wait 500ms — toast "Note saved" appears
8. Reload page, navigate back — note persists
9. Clear note text, click away — toast "Note deleted", card removed
10. Search (/) works — results navigate correctly
11. Arrow keys navigate chapters
12. Theme toggle works
13. About panel (?) shows updated description
14. Mobile: sidebar works as bottom sheet

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit if needed**

---

## Task 12: Update CLAUDE.md

**Files:**
- Modify: `/Users/a9lim/Work/a9lim.github.io/scripture/CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Key updates:
- Overview: Remove "multi-translation support" and "cross-references, glossary". Add "personal verse notes" and "text download".
- Architecture: Remove `notemap.js`, `notes.js` old description, `compare.js`, `glossary.js` from the tree. Update `notes.js` description. Update `refs.js` description.
- Remove "Cross-References" section.
- Update Data Format: Remove `glossary.json`, `cross-refs.json` from the tree. Remove `footnotes` from chapter schema. Remove `translations` from manifest description.
- Update Text Format: Remove `{fn-id}` from verse line format.
- Remove "Adding a translation" workflow.
- Update "Adding a new scripture" workflow: remove cross-refs step.
- Update Gotchas: Remove translation/cross-ref/glossary/footnote-related items.
- Add notes about user notes feature (localStorage key, verse click interaction).

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for overhaul — remove dead features, add notes/download"
```
