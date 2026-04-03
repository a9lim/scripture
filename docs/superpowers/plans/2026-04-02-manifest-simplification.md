# Manifest Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate stored chapter IDs from manifests, remove `refs.js`, clean dead code, and update the pipeline — making chapter IDs a derived convention.

**Architecture:** Manifests shrink from arrays of `{id, verses, name}` objects to an integer `chapters` count per book, with optional `start`, `names`, and new `abbrev` fields. `chapters.js` builds a `bookMap` at load time to replace the hardcoded `refs.js` BOOKS map. Pipeline tools derive chapter IDs from position + start.

**Tech Stack:** Vanilla ES6 modules (frontend), Python 3 (pipeline)

---

### Task 1: Write a migration script to convert manifests + strip chapter names

This script converts all 12 manifests to the new format and removes `name` from chapter JSON files. We run it once, verify, then delete it.

**Files:**
- Create: `extract/migrate_manifests.py`
- Modify: all `data/*/manifest.json` (12 files)
- Modify: all `data/*/chapters/*.json` that have `name` field (294 files)

- [ ] **Step 1: Write the migration script**

```python
#!/usr/bin/env python3
"""One-time migration: convert manifests to simplified format.

- chapters array → integer count
- Add abbrev per book (from refs.js BOOKS map)
- Add start per book (when first chapter number != 1)
- Add names array per book (when any chapter has a name)
- Remove name field from chapter JSON files
- Remove verses count from manifest chapter entries
"""

import json
import os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')

# Abbreviations from refs.js BOOKS map — single source during migration
ABBREVS = {
    'gen': 'Gen.', 'ex': 'Ex.', 'lev': 'Lev.', 'num': 'Num.',
    'deut': 'Deut.', 'josh': 'Josh.', 'judg': 'Judg.', 'ruth': 'Ruth',
    '1-sam': '1 Sam.', '2-sam': '2 Sam.', '1-kgs': '1 Kgs.', '2-kgs': '2 Kgs.',
    '1-chr': '1 Chr.', '2-chr': '2 Chr.', 'ezra': 'Ezra', 'neh': 'Neh.',
    'esth': 'Esth.', 'job': 'Job', 'ps': 'Ps.', 'prov': 'Prov.',
    'eccl': 'Eccl.', 'song': 'Song', 'isa': 'Isa.', 'jer': 'Jer.',
    'lam': 'Lam.', 'ezek': 'Ezek.', 'dan': 'Dan.', 'hosea': 'Hosea',
    'joel': 'Joel', 'amos': 'Amos', 'obad': 'Obad.', 'jonah': 'Jonah',
    'micah': 'Micah', 'nahum': 'Nahum', 'hab': 'Hab.', 'zeph': 'Zeph.',
    'hag': 'Hag.', 'zech': 'Zech.', 'mal': 'Mal.',
    'matt': 'Matt.', 'mark': 'Mark', 'luke': 'Luke', 'john': 'John',
    'acts': 'Acts', 'rom': 'Rom.', '1-cor': '1 Cor.', '2-cor': '2 Cor.',
    'gal': 'Gal.', 'eph': 'Eph.', 'philip': 'Philip.', 'col': 'Col.',
    '1-thes': '1 Thes.', '2-thes': '2 Thes.', '1-tim': '1 Tim.',
    '2-tim': '2 Tim.', 'titus': 'Titus', 'philem': 'Philem.',
    'heb': 'Heb.', 'james': 'James', '1-pet': '1 Pet.', '2-pet': '2 Pet.',
    '1-jn': '1 Jn.', '2-jn': '2 Jn.', '3-jn': '3 Jn.', 'jude': 'Jude',
    'rev': 'Rev.',
    '1-ne': '1 Ne.', '2-ne': '2 Ne.', 'jacob': 'Jacob', 'enos': 'Enos',
    'jarom': 'Jarom', 'omni': 'Omni', 'w-of-m': 'W of M',
    'mosiah': 'Mosiah', 'alma': 'Alma', 'hel': 'Hel.', '3-ne': '3 Ne.',
    '4-ne': '4 Ne.', 'morm': 'Morm.', 'ether': 'Ether', 'moro': 'Moro.',
    'dc': 'D&C', 'od': 'OD',
    'moses': 'Moses', 'abr': 'Abr.', 'js-m': 'JS\u2014M',
    'js-h': 'JS\u2014H', 'a-of-f': 'A of F',
    'quran': 'Quran',
    'tobit': 'Tobit', 'judith': 'Judith', 'add-esth': 'Add. Esth.',
    'wis': 'Wis.', 'sir': 'Sir.', 'bar': 'Bar.', 'pr-azar': 'Pr. Azar.',
    'sus': 'Sus.', 'bel': 'Bel', '1-macc': '1 Macc.', '2-macc': '2 Macc.',
    '1-esd': '1 Esd.', 'pr-man': 'Pr. Man.', '2-esd': '2 Esd.',
    'gl': 'G.L.', 'dom': 'D.M.', 'analects': 'Analects', 'mencius': 'Mencius',
    'ttc': 'T.T.C.',
    'kjk': 'Kami.', 'kjn': 'Naka.', 'kjs': 'Shimo.',
    'bund': 'Bund.',
    'lotus': 'Lotus',
}


def migrate():
    works = json.load(open(os.path.join(DATA, 'works.json')))

    for work_id in works:
        work_dir = os.path.join(DATA, work_id)
        manifest_path = os.path.join(work_dir, 'manifest.json')
        manifest = json.load(open(manifest_path))

        new_books = []
        for book in manifest['books']:
            book_id = book['id']
            old_chapters = book['chapters']
            count = len(old_chapters)

            new_book = {
                'id': book_id,
                'name': book['name'],
                'abbrev': ABBREVS.get(book_id, book['name']),
                'chapters': count,
            }

            # Detect start (first chapter number)
            if old_chapters:
                first_id = old_chapters[0]['id']
                first_num = int(first_id.rsplit('-', 1)[-1])
                if first_num != 1:
                    new_book['start'] = first_num

            # Collect names
            names = [ch.get('name') for ch in old_chapters]
            if any(n is not None for n in names):
                new_book['names'] = names

            new_books.append(new_book)

            # Strip name from chapter JSON files
            chapters_dir = os.path.join(work_dir, 'chapters')
            for ch_meta in old_chapters:
                ch_path = os.path.join(chapters_dir, f"{ch_meta['id']}.json")
                if not os.path.exists(ch_path):
                    continue
                ch = json.load(open(ch_path))
                if 'name' in ch:
                    del ch['name']
                    with open(ch_path, 'w', encoding='utf-8') as f:
                        json.dump(ch, f, ensure_ascii=False, indent=2)

        manifest['books'] = new_books
        # Remove translations if empty
        if 'translations' in manifest and not manifest['translations']:
            del manifest['translations']

        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        print(f"  {work_id}: {sum(b['chapters'] for b in new_books)} chapters")

    print("Done.")


if __name__ == '__main__':
    migrate()
```

- [ ] **Step 2: Run the migration**

Run: `cd extract && python3 migrate_manifests.py`
Expected: prints each work with chapter counts, "Done."

- [ ] **Step 3: Verify the migration manually**

Run:
```bash
python3 -c "
import json
m = json.load(open('data/ot/manifest.json'))
b = m['books'][0]
print(b)
assert isinstance(b['chapters'], int)
assert b['abbrev'] == 'Gen.'
assert 'start' not in b
print('OT OK')

m = json.load(open('data/kj/manifest.json'))
b = m['books'][0]
print(b)
assert b['start'] == 0
assert b['names'][0] == 'Preface'
print('Kojiki OK')

m = json.load(open('data/quran/manifest.json'))
b = m['books'][0]
assert len(b['names']) == 114
assert b['names'][0] == 'Opening'
print('Quran OK')

m = json.load(open('data/apoc/manifest.json'))
b = next(x for x in m['books'] if x['id'] == 'add-esth')
assert b['start'] == 10
print('Add-Esth OK')

ch = json.load(open('data/quran/chapters/quran-1.json'))
assert 'name' not in ch
print('Chapter name removed OK')
"
```
Expected: All assertions pass.

- [ ] **Step 4: Commit**

```bash
git add data/ extract/migrate_manifests.py
git commit -m "refactor: simplify manifests — chapters as count, add abbrev/start/names, strip chapter names from JSON"
```

---

### Task 2: Update `chapters.js` — build bookMap, add helpers, move formatRef

Replace the `refs.js` dependency with manifest-derived data. This is the core change that all other frontend files depend on.

**Files:**
- Modify: `src/chapters.js`
- Delete: `src/refs.js`

- [ ] **Step 1: Rewrite `chapters.js`**

Replace the entire file with:

```javascript
/* ===================================================================
   chapters.js — data layer for scripture manifests, chapters, and
   search index.  All fetches are cached; call loadManifests() once
   at startup to prime the manifest cache.
   =================================================================== */

const DATA_BASE = 'data';

/* ── caches ──────────────────────────────────────────────────────── */
const manifestCache = new Map();      // workId  -> manifest object
const chapterCache  = new Map();      // "workId/chapterId" -> chapter object
const flatChapterCache = new Map();   // workId -> [{ id, bookId, bookName }]
const bookMap = new Map();            // bookId -> { workId, abbrev, name }

let searchIndex   = null;          // array, loaded once
let workIds       = null;          // string[], loaded once

/* ── helpers ─────────────────────────────────────────────────────── */

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return res.json();
}

/**
 * Derive chapter ID from book ID and 0-based index.
 * e.g. chapterIdAt("gen", 0) → "gen-1"
 *      chapterIdAt("kjk", 0, 0) → "kjk-0"
 */
export function chapterIdAt(bookId, index, start) {
  return `${bookId}-${(start ?? 1) + index}`;
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
  manifests.forEach(m => {
    manifestCache.set(m.id, m);
    for (const book of m.books) {
      bookMap.set(book.id, { workId: m.id, abbrev: book.abbrev, name: book.name });
    }
  });
}

/** Array of work ID strings. */
export function getWorkIds() {
  return workIds || [];
}

/** Cached manifest for a single work, or null. */
export function getManifest(workId) {
  return manifestCache.get(workId) ?? null;
}

/** Book info from bookMap: { workId, abbrev, name } or null. */
export function getBookInfo(bookId) {
  return bookMap.get(bookId) ?? null;
}

/**
 * Fetch and cache a single chapter.
 * @param {string} workId     e.g. "ot"
 * @param {string} chapterId  e.g. "gen-1"
 */
export async function loadChapter(workId, chapterId) {
  const key = `${workId}/${chapterId}`;
  if (chapterCache.has(key)) return chapterCache.get(key);
  const chapter = await fetchJSON(
    `${DATA_BASE}/${workId}/chapters/${chapterId}.json`
  );
  // Attach context from the manifest for title construction
  chapter.chapter = chapterNum(chapterId);
  const manifest = manifestCache.get(workId);
  if (manifest) {
    chapter.workTitle = manifest.title;
    chapter.bookCount = manifest.books.length;
    const bookId = findBookForChapter(workId, chapterId);
    if (bookId) {
      const book = manifest.books.find(b => b.id === bookId);
      if (book) {
        chapter.bookName = book.name;
        if (book.chapters === 1) chapter.singleChapter = true;
        // Attach chapter name from manifest names array
        const start = book.start ?? 1;
        const num = parseInt(chapterNum(chapterId), 10);
        const idx = num - start;
        if (book.names && book.names[idx]) {
          chapter.name = book.names[idx];
        }
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
 *
 * @param  {string} ref  e.g. "quran:quran-1:3"
 * @return {{ workId: string, chapterId: string, verse: number }}
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
 * Return prev/next chapter entries relative to the given chapter,
 * flattening all books in the manifest into a single ordered list.
 *
 * Each returned entry is { id, bookId, bookName } or null.
 */
export function getAdjacentChapters(workId, chapterId) {
  const manifest = manifestCache.get(workId);
  if (!manifest) return { prev: null, next: null };

  if (!flatChapterCache.has(workId)) {
    const flat = [];
    for (const book of manifest.books) {
      const start = book.start ?? 1;
      for (let i = 0; i < book.chapters; i++) {
        flat.push({ id: chapterIdAt(book.id, i, start), bookId: book.id, bookName: book.name });
      }
    }
    flatChapterCache.set(workId, flat);
  }
  const flat = flatChapterCache.get(workId);

  const idx = flat.findIndex(e => e.id === chapterId);
  return {
    prev: idx > 0                ? flat[idx - 1] : null,
    next: idx < flat.length - 1  ? flat[idx + 1] : null
  };
}

/**
 * Find the bookId that owns a chapterId within a work.
 * Parses bookId from the chapter ID string (everything before trailing -N).
 */
export function findBookForChapter(workId, chapterId) {
  const i = chapterId.lastIndexOf('-');
  if (i > 0) {
    const bookId = chapterId.slice(0, i);
    if (bookMap.has(bookId)) return bookId;
  }
  // Fallback: first book in manifest
  const m = manifestCache.get(workId);
  return m?.books[0]?.id ?? null;
}

/**
 * Extract the trailing chapter number from a chapter ID.
 * e.g. "gen-1" → "1", "1-ne-3" → "3"
 */
export function chapterNum(chapterId) {
  const m = chapterId.match(/\d+$/);
  return m ? m[0] : chapterId;
}

/**
 * Format a chapter reference for display.
 * e.g. formatRef('gen-1', 26) → 'Gen. 1:26'
 */
export function formatRef(chapterId, verse) {
  const i = chapterId.lastIndexOf('-');
  if (i > 0) {
    const bookId = chapterId.slice(0, i);
    const chNum = chapterId.slice(i + 1);
    const info = bookMap.get(bookId);
    if (info) return `${info.abbrev} ${chNum}:${verse}`;
  }
  return `${chapterId}:${verse}`;
}
```

- [ ] **Step 2: Delete `src/refs.js`**

```bash
rm src/refs.js
```

- [ ] **Step 3: Commit**

```bash
git add src/chapters.js
git rm src/refs.js
git commit -m "refactor: replace refs.js with manifest-derived bookMap in chapters.js"
```

---

### Task 3: Update all frontend consumers of refs.js and manifest chapters

Every file that imports from `refs.js` or accesses `book.chapters` as an array needs updating.

**Files:**
- Modify: `main.js:6,12,57,135`
- Modify: `src/nav.js:5,53-57`
- Modify: `src/search.js:6,67,72-73,172`
- Modify: `src/notes.js:7`
- Modify: `src/history.js:2,47-48`
- Modify: `src/concordance.js:2`
- Modify: `src/related.js:1,20`
- Modify: `src/reader.js:26`

- [ ] **Step 1: Update `main.js`**

Change line 12 import:
```javascript
// OLD
import { formatRef } from './src/refs.js';
// NEW (delete this line — formatRef now from chapters.js)
```

Change line 6 import to add `formatRef, chapterIdAt`:
```javascript
import { loadManifests, getManifest, loadChapter, getAdjacentChapters, loadSearchIndex, parseRef, getWorkIds, formatRef, chapterIdAt } from './src/chapters.js';
```

Remove dead `bookmarkScope` on line 57:
```javascript
// OLD
let bookmarkScope = 'chapter';
// DELETE THIS LINE
```

Fix the `bookmarkScope` reference on line 224 (it reads from the active button anyway):
```javascript
// OLD (line 224)
        renderBookmarks($, currentWork, currentChapter, bookmarkScope, navigate);
// NEW
        renderBookmarks($, currentWork, currentChapter, 'chapter', navigate);
```

Fix the default route fallback on line 135:
```javascript
// OLD
    navigate('bom', manifest.books[0].chapters[0].id);
// NEW
    const firstBook = manifest.books[0];
    navigate('bom', chapterIdAt(firstBook.id, 0, firstBook.start));
```

- [ ] **Step 2: Update `src/nav.js`**

Change line 5 import:
```javascript
import { getWorkIds, getManifest, findBookForChapter, chapterNum, chapterIdAt } from './chapters.js';
```

Replace `populateChapters` function (lines 48-58):
```javascript
function populateChapters($, workId, bookId) {
  const m = getManifest(workId);
  if (!m) { $.chapterSelect.replaceChildren(); return; }
  const book = m.books.find(b => b.id === bookId);
  if (!book) { $.chapterSelect.replaceChildren(); return; }
  const start = book.start ?? 1;
  const items = Array.from({ length: book.chapters }, (_, i) => {
    const id = chapterIdAt(book.id, i, start);
    const num = start + i;
    const name = book.names?.[i];
    return { id, num, name };
  });
  fillSelect($.chapterSelect, items,
    ch => ch.id,
    ch => ch.name ? `${ch.num} (${ch.name})` : String(ch.num)
  );
  $.chapterSelect.style.display = book.chapters <= 1 ? 'none' : '';
}
```

Also fix line 42 — `m.books.length` is fine (books is still an array), but line 57's `book.chapters.length` is now just `book.chapters`.

- [ ] **Step 3: Update `src/search.js`**

Change line 6 import:
```javascript
// OLD
import { formatRef } from './refs.js';
// NEW — delete this line, add formatRef to chapters.js import
```

Change line 5:
```javascript
import { loadSearchIndex, parseRef, getManifest, getWorkIds, findBookForChapter, chapterNum, formatRef, chapterIdAt } from './chapters.js';
```

Replace `populateChapterFilter` function (lines 58-75):
```javascript
function populateChapterFilter($, workId, bookId) {
  if (!workId || !bookId) {
    $.searchChapter.replaceChildren();
    $.searchChapter.style.display = 'none';
    return;
  }
  const m = getManifest(workId);
  if (!m) return;
  const book = m.books.find(b => b.id === bookId);
  if (!book || book.chapters <= 1) {
    $.searchChapter.replaceChildren();
    $.searchChapter.style.display = 'none';
    return;
  }
  const start = book.start ?? 1;
  const items = Array.from({ length: book.chapters }, (_, i) => {
    const id = chapterIdAt(book.id, i, start);
    const num = start + i;
    const name = book.names?.[i];
    return { id, num, name };
  });
  fillSelect($.searchChapter, items, ch => ch.id,
    ch => ch.name ? `${ch.num} (${ch.name})` : String(ch.num), 'All chapters');
  $.searchChapter.style.display = '';
}
```

Fix line 67 (`book.chapters.length` → `book.chapters`):
Already handled in the rewrite above.

Fix line 172 (bookChapterIds set):
```javascript
// OLD
      if (book) bookChapterIds = new Set(book.chapters.map(ch => ch.id));
// NEW
      if (book) {
        const start = book.start ?? 1;
        bookChapterIds = new Set(
          Array.from({ length: book.chapters }, (_, i) => chapterIdAt(book.id, i, start))
        );
      }
```

- [ ] **Step 4: Update `src/notes.js`**

Change line 7 import:
```javascript
// OLD
import { formatRef } from './refs.js';
// NEW — delete this line, add formatRef to chapters.js import
```

Change line 6:
```javascript
import { parseRef, getManifest, formatRef } from './chapters.js';
```

- [ ] **Step 5: Update `src/history.js`**

Change line 2 import:
```javascript
// OLD
import { formatRef } from './refs.js';
// NEW — delete this line, add formatRef + chapterIdAt to chapters.js import
```

Change line 1:
```javascript
import { getManifest, findBookForChapter, loadSearchIndex, formatRef, chapterIdAt } from './chapters.js';
```

Fix `renderProgress` function (lines 47-48):
```javascript
// OLD
  const total = book.chapters.length;
  const idx = book.chapters.findIndex(ch => ch.id === chapterId);
// NEW
  const total = book.chapters;
  const start = book.start ?? 1;
  const num = parseInt(chapterId.match(/\d+$/)?.[0], 10);
  const idx = num - start;
```

- [ ] **Step 6: Update `src/concordance.js`**

Change line 2 import:
```javascript
// OLD
import { formatRef } from './refs.js';
// NEW — delete this line, add formatRef to chapters.js import
```

Change line 1:
```javascript
import { loadSearchIndex, parseRef, getManifest, getWorkIds, formatRef } from './chapters.js';
```

- [ ] **Step 7: Update `src/related.js`**

Change line 1 import — remove `findBookForChapter` (use it from chapters.js, already imported), fix `book.chapters.length`:
```javascript
import { getManifest, chapterNum, findBookForChapter } from './chapters.js';
```

Fix line 20:
```javascript
// OLD
  if (book.chapters.length === 1) return book.name;
// NEW
  if (book.chapters === 1) return book.name;
```

- [ ] **Step 8: Update `src/reader.js`**

No import changes needed — `reader.js` doesn't import from `refs.js` and doesn't access manifest `book.chapters`. It reads `chapter.name` which is now attached by `loadChapter()` from the manifest `names` array. No changes needed.

- [ ] **Step 9: Commit**

```bash
git add main.js src/nav.js src/search.js src/notes.js src/history.js src/concordance.js src/related.js
git commit -m "refactor: update all frontend consumers for new manifest format and formatRef from chapters.js"
```

---

### Task 4: Fix related.js clone anti-pattern and concordance debounce

**Files:**
- Modify: `src/related.js:43-45`
- Modify: `src/concordance.js:214`

- [ ] **Step 1: Fix related.js clone anti-pattern**

Replace lines 43-52 in `renderRelated`:
```javascript
// OLD
    // Clone toggle to remove old listeners
    const newToggle = toggle.cloneNode(true);
    toggle.replaceWith(newToggle);

    newToggle.addEventListener('click', () => {
      const wasHidden = list.classList.contains('hidden');
      list.classList.toggle('hidden');
      newToggle.classList.toggle('expanded', wasHidden);
      if (wasHidden && !list.children.length) renderList(list, matches, navigateFn);
    });
```

Replace with event delegation using a stored handler:
```javascript
    // Remove previous listener if any, then add new one
    if (toggle._relatedHandler) toggle.removeEventListener('click', toggle._relatedHandler);
    toggle._relatedHandler = () => {
      const wasHidden = list.classList.contains('hidden');
      list.classList.toggle('hidden');
      toggle.classList.toggle('expanded', wasHidden);
      if (wasHidden && !list.children.length) renderList(list, matches, navigateFn);
    };
    toggle.addEventListener('click', toggle._relatedHandler);
```

- [ ] **Step 2: Debounce concordance markWords**

In `concordance.js`, replace line 214:
```javascript
// OLD
    new MutationObserver(() => markWords(conc)).observe($.verses, { childList: true });
// NEW
    let markTimer;
    new MutationObserver(() => {
      clearTimeout(markTimer);
      markTimer = setTimeout(() => markWords(conc), 50);
    }).observe($.verses, { childList: true });
```

- [ ] **Step 3: Commit**

```bash
git add src/related.js src/concordance.js
git commit -m "fix: replace clone anti-pattern in related.js, debounce concordance markWords"
```

---

### Task 5: Update `txt_to_json.py` for new manifest format

The text-to-JSON converter needs to produce the new manifest format with integer `chapters`, `abbrev`, `start`, and `names`.

**Files:**
- Modify: `extract/txt_to_json.py:141-178`

- [ ] **Step 1: Add ABBREVS constant and update `_flush_chapter` + `parse_txt`**

The text format doesn't store abbreviations — they come from the manifest. Since `txt_to_json` creates manifests from scratch, we need the ABBREVS dict here too. Add it at the top after imports, same as the migration script.

Replace `_flush_chapter` function (lines 152-177):
```python
def _flush_chapter(current_chapter, current_section, chapters, current_book):
    """Finalize a chapter dict and append to chapters list + book metadata."""
    ch_id = current_chapter['_id']

    sections = current_chapter['_sections']

    ch_name = current_chapter.get('name')

    chapter = {'_id': ch_id}
    if current_chapter.get('intro'):
        chapter['intro'] = current_chapter['intro']
    chapter['sections'] = sections

    chapters.append(chapter)

    # Track chapter metadata for manifest
    current_book['_count'] = current_book.get('_count', 0) + 1
    if ch_name:
        if '_names' not in current_book:
            current_book['_names'] = []
        # Pad with None for unnamed chapters
        while len(current_book['_names']) < current_book['_count'] - 1:
            current_book['_names'].append(None)
        current_book['_names'].append(ch_name)

    del current_chapter['_sections']
    current_chapter.pop('_next_verse', None)
```

Update manifest building in `parse_txt` (replace lines 140-149):
```python
    # Flush last chapter
    if current_chapter is not None:
        _flush_chapter(current_chapter, current_section, chapters, current_book)

    # Build manifest with new format
    manifest = {'id': work_id, 'title': work_title}
    if translations:
        manifest['translations'] = translations

    new_books = []
    for book in books:
        new_book = {
            'id': book['id'],
            'name': book['name'],
            'abbrev': ABBREVS.get(book['id'], book['name']),
            'chapters': book.get('_count', 0),
        }
        # Detect start from first chapter ID
        if chapters:
            # Find first chapter belonging to this book
            for ch in chapters:
                if ch['_id'].startswith(book['id'] + '-'):
                    first_num = int(ch['_id'].rsplit('-', 1)[-1])
                    if first_num != 1:
                        new_book['start'] = first_num
                    break
        # Add names if any exist
        names = book.get('_names')
        if names:
            # Pad to full length
            while len(names) < new_book['chapters']:
                names.append(None)
            new_book['names'] = names
        new_books.append(new_book)

    manifest['books'] = new_books

    return [{
        'manifest': manifest,
        'chapters': chapters,
    }]
```

Also add the ABBREVS dict after imports (same dict as in Task 1).

And update the book header parsing (line 79) to not create a `chapters` list:
```python
            current_book = {'id': m.group(1), 'name': m.group(2)}
```

- [ ] **Step 2: Verify round-trip**

Run:
```bash
cd extract
python3 txt_to_json.py ../text/quran.txt --output ../data
python3 -c "
import json
m = json.load(open('../data/quran/manifest.json'))
b = m['books'][0]
assert isinstance(b['chapters'], int), f'chapters should be int, got {type(b[\"chapters\"])}'
assert b['chapters'] == 114
assert b['abbrev'] == 'Quran'
assert len(b['names']) == 114
assert b['names'][0] == 'Opening'
print('OK')
"
```
Expected: "OK"

- [ ] **Step 3: Commit**

```bash
git add extract/txt_to_json.py
git commit -m "refactor: txt_to_json produces new manifest format with integer chapters"
```

---

### Task 6: Update `json_to_txt.py` for new manifest format

This script reads manifests to find chapter files. It needs to derive chapter IDs from the new format.

**Files:**
- Modify: `extract/json_to_txt.py:38-52`

- [ ] **Step 1: Update the chapter iteration loop**

Replace lines 38-51:
```python
        for book in manifest['books']:
            lines.append(f'BOOK: {book["id"]} | {book["name"]}')

            start = book.get('start', 1)
            for i in range(book['chapters']):
                ch_id = f"{book['id']}-{start + i}"
                ch_path = os.path.join(work_dir, 'chapters', f'{ch_id}.json')
                with open(ch_path) as f:
                    ch = json.load(f)

                # Chapter header — name from manifest names array
                header = 'CHAPTER:'
                ch_name = book.get('names', [None] * (i + 1))[i] if book.get('names') else None
                if ch_name:
                    header += f' {ch_name}'
                lines.append(header)
```

The rest of the function (intro, sections, verses) remains the same since it reads from the chapter JSON file which hasn't changed its sections format.

- [ ] **Step 2: Verify round-trip**

Run:
```bash
cd extract
python3 json_to_txt.py ../data ../text
diff <(head -5 ../text/quran.txt) <(echo "WORK: quran | Quran
BOOK: quran | Quran
CHAPTER: Opening
In the name of God, the Beneficent, the Merciful.
Praise be to God, Lord of the Worlds,")
```
Expected: no diff (or minor whitespace).

- [ ] **Step 3: Commit**

```bash
git add extract/json_to_txt.py
git commit -m "refactor: json_to_txt derives chapter IDs from new manifest format"
```

---

### Task 7: Update `base_parser.py` for new manifest format

The base parser's `_strip_manifest` method and `write_output` need to handle the new format.

**Files:**
- Modify: `extract/base_parser.py:59-70,74-98`

- [ ] **Step 1: Update `_strip_manifest`**

Replace lines 59-70:
```python
    @classmethod
    def _strip_manifest(cls, manifest):
        out = dict(manifest)
        out['books'] = []
        for book in manifest.get('books', []):
            b = {k: v for k, v in book.items() if not k.startswith('_') and v is not None}
            out['books'].append(b)
        return out
```

This simpler version just strips internal `_` prefixed keys and None values. The old version iterated through chapter arrays per book — no longer needed since chapters is now an integer.

- [ ] **Step 2: Commit**

```bash
git add extract/base_parser.py
git commit -m "refactor: simplify base_parser manifest stripping for new format"
```

---

### Task 8: Update `search_index.py`, `concordance.py`, `similarity.py`

These tools scan chapter files by directory listing — they derive chapter IDs from filenames, not from manifest chapter arrays. The main change is `similarity.py` which reads manifest chapter arrays to build `chapter_to_book`. The others just need a sanity check.

**Files:**
- Modify: `extract/similarity.py:48-51`

- [ ] **Step 1: Update similarity.py chapter-to-book mapping**

Replace lines 48-51:
```python
        chapter_to_book = {}
        for book in manifest.get("books", []):
            start = book.get("start", 1)
            for i in range(book.get("chapters", 0)):
                ch_id = f"{book['id']}-{start + i}"
                chapter_to_book[ch_id] = book["id"]
```

- [ ] **Step 2: Verify search_index.py and concordance.py**

These two derive chapter IDs from filenames (`chapter_file[:-5]`), not manifests. Verify they still work:

Run:
```bash
cd extract
python3 search_index.py ../data
python3 concordance.py ../data
```
Expected: both print summary stats without errors.

- [ ] **Step 3: Commit**

```bash
git add extract/similarity.py
git commit -m "refactor: update similarity.py to derive chapter IDs from new manifest format"
```

---

### Task 9: Update `verify_data.py` for new manifest format

The verifier reads manifest chapter metadata extensively. It needs to work with integer counts + derived IDs.

**Files:**
- Modify: `extract/verify_data.py:204-265`

- [ ] **Step 1: Rewrite `check_book` and `check_chapter`**

Replace `check_book` (lines 204-231):
```python
    def check_book(self, work_id, book):
        book_id = book["id"]
        count = book["chapters"]
        start = book.get("start", 1)
        expected = EXPECTED.get(book_id)

        if expected is not None:
            if count != len(expected):
                self.error(
                    f"[{work_id}/{book_id}] Expected {len(expected)} chapters, "
                    f"got {count}"
                )

        # Check chapter numbering — derive from start + index
        for i in range(count):
            self.stats["chapters"] += 1
            ch_id = f"{book_id}-{start + i}"
            expected_verses = expected[i] if (expected and i < len(expected)) else None
            self.check_chapter(work_id, book_id, ch_id, expected_verses)
```

Replace `check_chapter` (lines 233-272):
```python
    def check_chapter(self, work_id, book_id, ch_id, expected_verses):
        # Check chapter file exists
        ch_path = self.data_dir / work_id / "chapters" / f"{ch_id}.json"
        if not ch_path.exists():
            self.error(f"[{ch_id}] Chapter file missing: {ch_path}")
            return

        ch_data = self.load_json(ch_path)

        # Collect all verses from sections
        all_verses = []
        for sec in ch_data.get("sections", []):
            all_verses.extend(sec.get("verses", []))

        actual_count = len(all_verses)
        self.stats["verses"] += actual_count

        # Check against canonical expected
        if expected_verses is not None and actual_count != expected_verses:
            self.error(
                f"[{ch_id}] Expected {expected_verses} verses (canonical), "
                f"got {actual_count}"
            )

        # Check for empty verse text
        for sec in ch_data.get("sections", []):
            for i, text in enumerate(sec.get("verses", [])):
                if not text or not text.strip():
                    verse_num = sec.get("startVerse", 1) + i
                    self.error(f"[{ch_id}:{verse_num}] Empty verse text")
```

- [ ] **Step 2: Run verification**

Run: `cd extract && python3 verify_data.py ../data`
Expected: "All checks passed!" (no errors)

- [ ] **Step 3: Commit**

```bash
git add extract/verify_data.py
git commit -m "refactor: update verify_data.py for new manifest format"
```

---

### Task 10: Update parsers to include `abbrev` in output

Each parser needs to add `abbrev` to book dicts so that `extract-raw` produces correct manifests.

**Files:**
- Modify: `extract/parsers/quad.py` (manifest building section)
- Modify: `extract/parsers/quran.py`
- Modify: `extract/parsers/kjv_vpl.py`
- Modify: `extract/parsers/fourbooks.py`
- Modify: `extract/parsers/ttc.py`
- Modify: `extract/parsers/kojiki.py`
- Modify: `extract/parsers/bundahis.py`
- Modify: `extract/parse_scraped.py`

- [ ] **Step 1: Update quad.py**

In the `build_manifest()` method, when creating book dicts, add `abbrev`. The book IDs are already in `_BOOK_IDS`. Add an `_ABBREVS` dict mapping book_id → abbreviation (same values as in refs.js), then for each book dict add `'abbrev': _ABBREVS[book_id]`.

Also change the manifest chapter format — currently builds `{"id": ch_id, "verses": count}` per chapter. Change to integer count per book, plus optional `names` and `start`.

This parser creates 5 works (bom, dc, pgp, ot, nt). None of these have chapter names or non-1 starts, so the book dict is just:
```python
{"id": book_id, "name": book_name, "abbrev": _ABBREVS[book_id], "chapters": len(chapters_for_book)}
```

- [ ] **Step 2: Update quran.py**

The manifest building produces one book with chapter names. Change to:
```python
{
    "id": "quran",
    "name": "Quran",
    "abbrev": "Quran",
    "chapters": len(chapters),
    "names": [ch.get("name") for ch in chapters],
}
```

- [ ] **Step 3: Update kjv_vpl.py**

Similar to quad.py — add abbrev per book. The `_BOOK_IDS` mapping already exists. Add corresponding `_ABBREVS` dict. Change chapter metadata from array to count. For `add-esth`, include `"start": 10`.

- [ ] **Step 4: Update fourbooks.py**

Add abbrev to each book dict. No chapter names or non-standard starts.

- [ ] **Step 5: Update ttc.py**

Single book: `{"id": "ttc", "name": "Tao Te Ching", "abbrev": "T.T.C.", "chapters": 81}`.

- [ ] **Step 6: Update kojiki.py**

Three books with continuous numbering and chapter names:
```python
{
    "id": "kjk", "name": "Kamitsumaki", "abbrev": "Kami.",
    "chapters": 40, "start": 0,
    "names": [ch.get("name") for ch in kjk_chapters],
}
```

- [ ] **Step 7: Update bundahis.py**

Single book with sparse chapter names:
```python
{
    "id": "bund", "name": "Bundahishn", "abbrev": "Bund.",
    "chapters": 34,
    "names": [ch.get("name") for ch in chapters],  # mostly None
}
```

- [ ] **Step 8: Update parse_scraped.py**

Add ABBREVS dict. When building `book_meta`, use new format:
```python
book_meta = {
    "id": args.book_id,
    "name": args.book_name,
    "abbrev": ABBREVS.get(args.book_id, args.book_name),
    "chapters": len(chapters),
}
```

When loading existing manifests, the manifest is already in the new format (post-migration), so no special handling needed.

- [ ] **Step 9: Commit**

```bash
git add extract/parsers/ extract/parse_scraped.py
git commit -m "refactor: all parsers produce new manifest format with abbrev, integer chapters"
```

---

### Task 11: Full pipeline verification

Run the complete pipeline to verify everything works end-to-end.

**Files:** none (verification only)

- [ ] **Step 1: Run txt2json for all works**

```bash
cd extract
for f in ../text/*.txt; do
    work=$(basename "$f" .txt)
    echo "  $work"
    python3 txt_to_json.py "$f" --output ../data
done
```
Expected: all 12 works convert without errors.

- [ ] **Step 2: Rebuild indices**

```bash
python3 search_index.py ../data
python3 concordance.py ../data
```
Expected: prints summary stats.

- [ ] **Step 3: Run verification**

```bash
python3 verify_data.py ../data
```
Expected: "All checks passed!"

- [ ] **Step 4: Serve and smoke test**

```bash
cd ../.. && python -m http.server &
# Open http://localhost:8000/scripture/ in browser
# Test: navigate between works/books/chapters
# Test: search works
# Test: concordance word click
# Test: bookmark a verse, check display
# Test: random verse
# Test: related passages
# Test: resume dropdown
# Kill server
```

- [ ] **Step 5: Delete migration script**

```bash
rm extract/migrate_manifests.py
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "refactor: complete manifest simplification — verify pipeline and clean up"
```

---

### Task 12: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update data format section**

Update the "Data Format" section to reflect:
- `chapters` is now an integer count per book
- `abbrev` field per book
- Optional `start` and `names` fields
- Chapter IDs are derived: `{bookId}-{(start ?? 1) + index}`
- Chapter JSON files no longer have a `name` field
- `refs.js` no longer exists — `formatRef` is in `chapters.js`

- [ ] **Step 2: Update ID System section**

Update to explain that chapter IDs are derived, not stored.

- [ ] **Step 3: Update Frontend Architecture section**

Remove `refs.js` from the tree. Note that `formatRef`, `chapterIdAt`, `getBookInfo` are now in `chapters.js`.

- [ ] **Step 4: Update Gotchas**

Remove the `BOOKS is module-private` gotcha. Add note that `book.chapters` is an integer, not an array.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for manifest simplification"
```
