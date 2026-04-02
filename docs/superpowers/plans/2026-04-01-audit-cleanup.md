# Scripture Audit Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 23 audit findings — delete dead files/code, consolidate duplicates, fix bugs, and improve performance.

**Architecture:** Changes span three layers: (1) delete orphaned data files and dead Python code, (2) deduplicate shared JS functions into `chapters.js`, (3) performance improvements in `chapters.js`, `notes.js`, and `search.js`. No new files created. No API changes to module exports.

**Tech Stack:** Vanilla JS (ES6 modules), Python 3, CSS. No build step, no test framework, no dependencies.

**Verification:** Serve from repo root with `python -m http.server`, navigate all 11 works, test search, test notes, and run `cd extract && ./run.sh verify`. No automated tests exist — all verification is manual.

---

### Task 1: Delete orphaned footnotes.json files (#1)

**Files:**
- Delete: `data/bom/footnotes.json`
- Delete: `data/dc/footnotes.json`
- Delete: `data/nt/footnotes.json`
- Delete: `data/ot/footnotes.json`
- Delete: `data/pgp/footnotes.json`

- [ ] **Step 1: Delete the five files**

```bash
rm data/bom/footnotes.json data/dc/footnotes.json data/nt/footnotes.json data/ot/footnotes.json data/pgp/footnotes.json
```

- [ ] **Step 2: Verify no references remain**

```bash
grep -r "footnotes" data/
```

Expected: No output (no remaining references).

- [ ] **Step 3: Commit**

```bash
git add -u data/
git commit -m "chore: delete orphaned footnotes.json files (~2.1 MB dead data)"
```

---

### Task 2: Remove glossary vestiges from Python pipeline (#3, #7)

**Files:**
- Modify: `extract/extract.py:58-62` — remove glossary count line
- Modify: `extract/parsers/fourbooks.py:70` — remove `"glossary": []`
- Modify: `extract/parsers/ttc.py:69` — remove `"glossary": []`
- Modify: `extract/parsers/kojiki.py:163` — remove `"glossary": []`
- Modify: `extract/parsers/quran.py:250` — remove `"glossary": []`
- Modify: `extract/parsers/kjv_vpl.py:92` — remove `"glossary": []`
- Modify: `extract/parsers/bundahis.py:83` — remove `"glossary": []`
- Modify: `extract/parse_scraped.py:233` — remove `"glossary": []`

Also fixes #7 (footnotes fields in kjv_vpl.py):
- Modify: `extract/parsers/kjv_vpl.py:65` — remove `"footnotes": []` from verse dicts
- Modify: `extract/parsers/kjv_vpl.py:75` — remove `"footnotes": {}` from chapter dicts

- [ ] **Step 1: Remove glossary from extract.py**

In `extract/extract.py`, delete lines 61-62 (the `n_gl` line and its use in the print). Change the summary print on line 62 from:

```python
        n_gl = len(work["glossary"])
        print(f"  {wid}: {n_ch} chapters, {n_gl} glossary entries")
```

to:

```python
        print(f"  {wid}: {n_ch} chapters")
```

- [ ] **Step 2: Remove `"glossary": []` from all 7 parsers**

In each file, remove the `"glossary": [],` line from the return dict:
- `extract/parsers/fourbooks.py:70`
- `extract/parsers/ttc.py:69`
- `extract/parsers/kojiki.py:163`
- `extract/parsers/quran.py:250`
- `extract/parsers/kjv_vpl.py:92`
- `extract/parsers/bundahis.py:83`
- `extract/parse_scraped.py:233`

- [ ] **Step 3: Remove footnotes from kjv_vpl.py**

In `extract/parsers/kjv_vpl.py`, remove `"footnotes": []` from the verse dict (line 65) and `"footnotes": {}` from the chapter dict (line 75).

Line 64-66 changes from:
```python
                verses = [
                    {"number": vs, "text": BaseParser.clean_text(BaseParser.normalize_divine_names(txt)), "footnotes": []}
                    for vs, txt in sorted(verses_raw)
                ]
```
to:
```python
                verses = [
                    {"number": vs, "text": BaseParser.clean_text(BaseParser.normalize_divine_names(txt))}
                    for vs, txt in sorted(verses_raw)
                ]
```

Line 68-76 changes from:
```python
                chapters.append({
                    "chapter": ch_num,
                    "id": ch_id,
                    "sections": [{
                        "startVerse": verses[0]["number"] if verses else 1,
                        "verses": verses,
                    }],
                    "footnotes": {},
                })
```
to:
```python
                chapters.append({
                    "chapter": ch_num,
                    "id": ch_id,
                    "sections": [{
                        "startVerse": verses[0]["number"] if verses else 1,
                        "verses": verses,
                    }],
                })
```

- [ ] **Step 4: Verify parsers still run**

```bash
cd extract && python3 -c "from parsers import PARSERS; print(sorted(PARSERS.keys()))"
```

Expected: prints the parser name list without errors.

- [ ] **Step 5: Commit**

```bash
git add extract/
git commit -m "chore: remove dead glossary and footnotes fields from pipeline"
```

---

### Task 3: Fix resource leaks in json_to_txt.py (#22)

**Files:**
- Modify: `extract/json_to_txt.py:25,29,42`

- [ ] **Step 1: Replace bare `open()` calls with context managers**

Replace line 25:
```python
    works = json.load(open(os.path.join(data_dir, 'works.json')))
```
with:
```python
    with open(os.path.join(data_dir, 'works.json')) as f:
        works = json.load(f)
```

Replace line 29:
```python
        manifest = json.load(open(os.path.join(work_dir, 'manifest.json')))
```
with:
```python
        with open(os.path.join(work_dir, 'manifest.json')) as f:
            manifest = json.load(f)
```

Replace line 42:
```python
                ch = json.load(open(ch_path))
```
with:
```python
                with open(ch_path) as f:
                    ch = json.load(f)
```

- [ ] **Step 2: Run json_to_txt to verify**

```bash
cd extract && python3 json_to_txt.py ../data ../text
```

Expected: prints file paths for all 11 works without errors.

- [ ] **Step 3: Commit**

```bash
git add extract/json_to_txt.py
git commit -m "fix: use context managers for file handles in json_to_txt.py"
```

---

### Task 4: Remove dead code from Python pipeline (#5, #6)

**Files:**
- Modify: `extract/verify_data.py:172` — remove unused `warn()` method
- Modify: `extract/verify_data.py:326-331` — remove warnings print block
- Modify: `extract/parsers/quad.py:13` — remove unused `import os`

- [ ] **Step 1: Remove `warn()` method and warnings output**

In `extract/verify_data.py`, delete the `warn()` method (line 172-173):
```python
    def warn(self, msg):
        self.warnings.append(msg)
```

Also delete the `self.warnings = []` initialization at line 166.

Also delete the warnings print block (lines 326-331):
```python
        if self.warnings:
            print(f"WARNINGS ({len(self.warnings)}):")
            for w in sorted(self.warnings[:50]):
                print(f"  ⚠ {w}")
            if len(self.warnings) > 50:
                print(f"  ... and {len(self.warnings) - 50} more")
            print()
```

- [ ] **Step 2: Remove unused `import os` from quad.py**

In `extract/parsers/quad.py`, delete line 13:
```python
import os
```

- [ ] **Step 3: Verify**

```bash
cd extract && ./run.sh verify
```

Expected: verification passes with no errors.

- [ ] **Step 4: Commit**

```bash
git add extract/verify_data.py extract/parsers/quad.py
git commit -m "chore: remove dead warn() method and unused import"
```

---

### Task 5: Consolidate `_make_section()` into BaseParser (#10)

**Files:**
- Modify: `extract/base_parser.py` — add `make_section()` static method
- Modify: `extract/parsers/fourbooks.py:101-108` — delete local `_make_section`, use `BaseParser.make_section`
- Modify: `extract/parsers/ttc.py:99-106` — delete local `_make_section`, use `BaseParser.make_section`
- Modify: `extract/parsers/kojiki.py:220-227` — delete local `_make_section`, use `BaseParser.make_section`

- [ ] **Step 1: Add `make_section()` to BaseParser**

In `extract/base_parser.py`, add after the `clean_text` method (after line 38):

```python
    @staticmethod
    def make_section(verses, start=1, clean=True):
        """Build a section dict from a list of verse text strings."""
        return {
            "startVerse": start,
            "verses": [
                {"number": start + i, "text": BaseParser.clean_text(v) if clean else v}
                for i, v in enumerate(verses)
            ],
        }
```

The `clean` parameter handles the difference: fourbooks.py and ttc.py call `clean_text` inside `_make_section`, while kojiki.py does not (it cleans earlier in its pipeline).

- [ ] **Step 2: Update fourbooks.py**

Delete the `_make_section` static method (lines 101-108). Replace all calls from `self._make_section(...)` to `BaseParser.make_section(...)`. Search the file for all usages first:

```bash
grep -n "_make_section" extract/parsers/fourbooks.py
```

Update each call site.

- [ ] **Step 3: Update ttc.py**

Delete the `_make_section` static method (lines 99-106). Replace `self._make_section(...)` calls with `BaseParser.make_section(...)`.

```bash
grep -n "_make_section" extract/parsers/ttc.py
```

Update each call site.

- [ ] **Step 4: Update kojiki.py**

Delete the `_make_section` static method (lines 220-227). Replace `self._make_section(...)` calls with `BaseParser.make_section(..., clean=False)` since kojiki's version does NOT call `clean_text`.

```bash
grep -n "_make_section" extract/parsers/kojiki.py
```

Update each call site, adding `clean=False`.

- [ ] **Step 5: Verify parsers import correctly**

```bash
cd extract && python3 -c "from parsers import PARSERS; print(sorted(PARSERS.keys()))"
```

- [ ] **Step 6: Commit**

```bash
git add extract/base_parser.py extract/parsers/fourbooks.py extract/parsers/ttc.py extract/parsers/kojiki.py
git commit -m "refactor: consolidate _make_section() into BaseParser"
```

---

### Task 6: Unify `_strip_manifest` and `_strip_chapter` (#11)

**Files:**
- Modify: `extract/base_parser.py:42-65`

- [ ] **Step 1: Replace both methods with a single `_strip_none_names`**

Both methods do the same thing: filter out `name: None` from dicts. Replace lines 42-65 in `extract/base_parser.py`:

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

with:

```python
    @staticmethod
    def _strip_none(d, skip=frozenset()):
        """Remove None-valued optional fields and internal keys from a dict."""
        return {k: v for k, v in d.items()
                if k not in skip and not (v is None and k in ('name', 'intro'))}

    @classmethod
    def _strip_chapter(cls, chapter):
        return cls._strip_none(chapter, skip={'_book'})

    @classmethod
    def _strip_manifest(cls, manifest):
        out = dict(manifest)
        out['books'] = [
            {**book, 'chapters': [cls._strip_none(ch) for ch in book.get('chapters', [])]}
            for book in out.get('books', [])
        ]
        return out
```

- [ ] **Step 2: Run txt2json + verify to confirm output is unchanged**

```bash
cd extract && ./run.sh txt2json && ./run.sh verify
```

Expected: all works convert and verification passes.

- [ ] **Step 3: Commit**

```bash
git add extract/base_parser.py
git commit -m "refactor: unify _strip_manifest/_strip_chapter via shared _strip_none"
```

---

### Task 7: Remove `BOOKS` export from refs.js (#4)

**Files:**
- Modify: `src/refs.js:13`

- [ ] **Step 1: Remove the `export` keyword**

Change line 13 from:
```javascript
export const BOOKS = {
```
to:
```javascript
const BOOKS = {
```

- [ ] **Step 2: Verify no imports of BOOKS exist**

```bash
grep -r "BOOKS" scripture/src/ scripture/main.js
```

Expected: only `refs.js` itself references `BOOKS`. No other file imports it.

- [ ] **Step 3: Serve and test**

Open in browser, navigate to any work, confirm verse references display correctly (the `formatRef` function that uses `BOOKS` internally still works).

- [ ] **Step 4: Commit**

```bash
git add src/refs.js
git commit -m "chore: make BOOKS map module-private in refs.js"
```

---

### Task 8: Extract `findBookForChapter` and `chapterNum` into chapters.js (#8, #20)

**Files:**
- Modify: `src/chapters.js` — add `findBookForChapter()` and `chapterNum()` exports
- Modify: `src/nav.js:5,47-64` — import shared functions, delete local duplicate
- Modify: `src/search.js:5,88-89,176-183` — import shared functions, delete local duplicate

- [ ] **Step 1: Add `findBookForChapter()` and `chapterNum()` to chapters.js**

Add at the end of `src/chapters.js`:

```javascript
/**
 * Find the bookId that owns a chapterId within a work manifest.
 */
export function findBookForChapter(workId, chapterId) {
  const m = manifestCache.get(workId);
  if (!m) return null;
  for (const book of m.books) {
    if (book.chapters.some(ch => ch.id === chapterId)) return book.id;
  }
  return m.books[0]?.id ?? null;
}

/**
 * Extract the trailing chapter number from a chapter ID.
 * e.g. "gen-1" → "1", "1-ne-3" → "3"
 */
export function chapterNum(chapterId) {
  const m = chapterId.match(/\d+$/);
  return m ? m[0] : chapterId;
}
```

- [ ] **Step 2: Update nav.js**

Update the import line (line 5):
```javascript
import { getWorkIds, getManifest, findBookForChapter, chapterNum } from './chapters.js';
```

Delete the local `findBookForChapter` function (lines 57-64).

Replace line 49 (inside `populateChapters`):
```javascript
    ch => ch.name ? `${ch.id.match(/\d+$/)[0]} (${ch.name})` : ch.id.match(/\d+$/)[0]
```
with:
```javascript
    ch => ch.name ? `${chapterNum(ch.id)} (${ch.name})` : chapterNum(ch.id)
```

- [ ] **Step 3: Update search.js**

Update the import line (line 5):
```javascript
import { loadSearchIndex, parseRef, getManifest, getWorkIds, findBookForChapter, chapterNum } from './chapters.js';
```

Delete the local `findBookForChapter` function (lines 176-183).

Replace line 89 (inside `populateChapterFilter`):
```javascript
    ch => ch.name ? `${ch.id.match(/\d+$/)[0]} (${ch.name})` : ch.id.match(/\d+$/)[0], 'All chapters');
```
with:
```javascript
    ch => ch.name ? `${chapterNum(ch.id)} (${ch.name})` : chapterNum(ch.id), 'All chapters');
```

Note: `findBookForChapter` in search.js (line 182) returns `null` for no-match (no fallback), while nav.js (line 63) returns `m.books[0]?.id ?? null`. The shared version in chapters.js uses the nav.js behavior (fallback to first book). This is fine — search only uses it for grouping display and the fallback is harmless.

- [ ] **Step 4: Serve and test**

Navigate works, change books/chapters. Open search, filter by work/book. Confirm everything works.

- [ ] **Step 5: Commit**

```bash
git add src/chapters.js src/nav.js src/search.js
git commit -m "refactor: deduplicate findBookForChapter and chapterNum into chapters.js"
```

---

### Task 9: Consolidate `fillSelect` and `fillFilter` (#9)

**Files:**
- Modify: `src/nav.js:10-18` — add optional `allLabel` parameter to `fillSelect`, export it
- Modify: `src/search.js:5,14-26` — import `fillSelect` from nav.js, delete `fillFilter`

- [ ] **Step 1: Update `fillSelect` in nav.js to support optional "All" default**

Replace lines 10-18 in `src/nav.js`:

```javascript
function fillSelect(sel, items, valueFn, textFn) {
  sel.replaceChildren();
  for (const item of items) {
    const opt = document.createElement('option');
    opt.value = valueFn(item);
    opt.textContent = textFn(item);
    sel.appendChild(opt);
  }
}
```

with:

```javascript
export function fillSelect(sel, items, valueFn, textFn, allLabel) {
  sel.replaceChildren();
  if (allLabel) {
    const all = document.createElement('option');
    all.value = '';
    all.textContent = allLabel;
    sel.appendChild(all);
  }
  for (const item of items) {
    const opt = document.createElement('option');
    opt.value = valueFn(item);
    opt.textContent = textFn(item);
    sel.appendChild(opt);
  }
}
```

Existing callers in nav.js don't pass `allLabel`, so they get the old behavior (no "All" option).

- [ ] **Step 2: Update search.js to import and use `fillSelect`**

Add to the import line (line 5 or wherever nav imports are):
```javascript
import { fillSelect } from './nav.js';
```

Delete the entire `fillFilter` function (lines 14-26).

Replace all `fillFilter(` calls with `fillSelect(` in search.js. The call signatures are already identical — `fillFilter(sel, items, valueFn, textFn, allLabel)` matches the new `fillSelect` signature.

- [ ] **Step 3: Serve and test**

Open search, change work/book/chapter filters. Confirm "All works", "All books", "All chapters" default options appear.

- [ ] **Step 4: Commit**

```bash
git add src/nav.js src/search.js
git commit -m "refactor: consolidate fillFilter into fillSelect with optional allLabel"
```

---

### Task 10: Unify search index lazy-load into `open()` (#23)

**Files:**
- Modify: `src/search.js:103-108,149-168`

- [ ] **Step 1: Move lazy-load logic into open()**

Replace lines 103-108 (the `open()` function):

```javascript
  function open() {
    $.searchOverlay.classList.remove('hidden');
    $.searchInput.value = '';
    clearResults();
    populateWorkFilter($);
    $.searchInput.focus();
    trapCleanup = trapFocus($.searchOverlay);
  }
```

with:

```javascript
  async function open() {
    $.searchOverlay.classList.remove('hidden');
    $.searchInput.value = '';
    clearResults();
    populateWorkFilter($);
    $.searchInput.focus();
    trapCleanup = trapFocus($.searchOverlay);
    if (!index) {
      try {
        index = await loadSearchIndex();
        for (const entry of index) {
          entry._lower = entry.text.toLowerCase();
          const parsed = parseRef(entry.ref);
          entry._workId = parsed.workId;
          entry._chapterId = parsed.chapterId;
        }
      } catch (e) {
        const p = document.createElement('p');
        p.className = 'empty-state';
        p.textContent = 'Failed to load search index.';
        $.searchResults.appendChild(p);
      }
    }
  }
```

Then delete the separate `{ once: true }` listener (lines 149-168):

```javascript
  // Lazy-load index on first open
  $.searchBtn.addEventListener('click', async () => {
    if (!index) {
      try {
        index = await loadSearchIndex();
        for (const entry of index) {
          entry._lower = entry.text.toLowerCase();
          const parsed = parseRef(entry.ref);
          entry._workId = parsed.workId;
          entry._chapterId = parsed.chapterId;
        }
      } catch (e) {
        const el = $.searchResults;
        const p = document.createElement('p');
        p.className = 'empty-state';
        p.textContent = 'Failed to load search index.';
        el.appendChild(p);
      }
    }
  }, { once: true });
```

- [ ] **Step 2: Serve and test**

Open search, type a query. Confirm results appear. Close and reopen search — confirm no duplicate behavior.

- [ ] **Step 3: Commit**

```bash
git add src/search.js
git commit -m "refactor: unify search index lazy-load into open() function"
```

---

### Task 11: Cache flat chapter list in `getAdjacentChapters` (#15)

**Files:**
- Modify: `src/chapters.js:113-130`

- [ ] **Step 1: Add a flat-chapter cache and use it**

Add a module-level cache near the top of `chapters.js` (after line 11):

```javascript
const flatChapterCache = new Map();  // workId -> [{ id, bookId, bookName }]
```

Replace `getAdjacentChapters` (lines 113-130):

```javascript
export function getAdjacentChapters(workId, chapterId) {
  const manifest = manifestCache.get(workId);
  if (!manifest) return { prev: null, next: null };

  // Flatten all chapters across all books into an ordered list.
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

with:

```javascript
export function getAdjacentChapters(workId, chapterId) {
  const manifest = manifestCache.get(workId);
  if (!manifest) return { prev: null, next: null };

  if (!flatChapterCache.has(workId)) {
    const flat = [];
    for (const book of manifest.books) {
      for (const ch of book.chapters) {
        flat.push({ id: ch.id, bookId: book.id, bookName: book.name });
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
```

- [ ] **Step 2: Serve and test**

Navigate chapters with prev/next arrows. Cross book boundaries (e.g. end of Genesis to start of Exodus). Confirm correct behavior.

- [ ] **Step 3: Commit**

```bash
git add src/chapters.js
git commit -m "perf: cache flat chapter list in getAdjacentChapters"
```

---

### Task 12: Use `findBookForChapter` in `loadChapter` (#18)

**Files:**
- Modify: `src/chapters.js:60-71`

- [ ] **Step 1: Replace inline book lookup with `findBookForChapter`**

The `loadChapter` function (lines 60-71) has an inline loop to find the book:

```javascript
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
```

Replace with (using `findBookForChapter` which was added in Task 8):

```javascript
    if (manifest) {
      chapter.workTitle = manifest.title;
      chapter.bookCount = manifest.books.length;
      const bookId = findBookForChapter(workId, chapterId);
      if (bookId) {
        const book = manifest.books.find(b => b.id === bookId);
        if (book) {
          chapter.bookName = book.name;
          if (book.chapters.length === 1) chapter.singleChapter = true;
        }
      }
    }
```

Note: `findBookForChapter` is defined in the same module (added in Task 8), so no import needed — just call it directly. Since it's not exported yet at this point in the file, ensure the function definition appears before `loadChapter` or that it's hoisted (it will be, since it's a `function` declaration if exported with `export function`). Actually, since Task 8 adds it at the end of the file, we need to either move it above `loadChapter` or rely on the fact that `export function` declarations are hoisted. Function declarations ARE hoisted in JS modules, so calling it before its textual position is fine.

- [ ] **Step 2: Serve and test**

Navigate to multi-book works (OT, NT, BOM). Confirm chapter title shows correct book name. Navigate single-chapter books (Enos, Obadiah). Confirm title shows book name only (no chapter number).

- [ ] **Step 3: Commit**

```bash
git add src/chapters.js
git commit -m "refactor: use findBookForChapter in loadChapter instead of inline loop"
```

---

### Task 13: Fix textarea autoResize layout thrashing (#16)

**Files:**
- Modify: `src/notes.js:154-157,184-187`

- [ ] **Step 1: Batch autoResize with requestAnimationFrame**

Replace the `autoResize` function (lines 184-187):

```javascript
function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}
```

with:

```javascript
function autoResize(textarea) {
  requestAnimationFrame(() => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });
}
```

This batches the read/write into a single animation frame, avoiding forced synchronous reflow during the input event handler.

- [ ] **Step 2: Serve and test**

Add a note to a verse, type several lines. Confirm textarea grows correctly. Delete text, confirm it shrinks.

- [ ] **Step 3: Commit**

```bash
git add src/notes.js
git commit -m "perf: batch autoResize in requestAnimationFrame to avoid layout thrashing"
```

---

### Task 14: Consolidate `.verse-num` CSS and remove deprecated properties (#12, #13, #14)

**Files:**
- Modify: `styles.css:121-128,225-228,291,314-322`

- [ ] **Step 1: Merge `.verse-num` rules**

Replace lines 121-128:

```css
.verse-num {
    font-family: var(--font-mono);
    font-size: 0.7em;
    vertical-align: super;
    color: var(--accent);
    margin-right: 0.15em;
    user-select: none;
}
```

with:

```css
.verse-num {
    font-family: var(--font-mono);
    font-size: 0.7em;
    vertical-align: super;
    color: var(--accent);
    margin-right: 0.15em;
    user-select: none;
    cursor: pointer;
    transition: color 0.15s;
}
```

Then delete lines 312-322 (the second `.verse-num` block and its hover rule). Keep the hover rule immediately after the consolidated block:

```css
.verse-num:hover,
.verse-num:focus-visible {
    color: var(--text);
}
```

The `/* ---------- Clickable Verse Numbers ---------- */` comment and the duplicate `.verse-num` block are removed. The hover rule moves to follow the consolidated `.verse-num` in the Verses section.

- [ ] **Step 2: Remove `-webkit-overflow-scrolling: touch`**

Delete line 291:
```css
        -webkit-overflow-scrolling: touch;
```

- [ ] **Step 3: Remove `::-webkit-search-cancel-button` rule**

Delete lines 225-228:
```css
.overlay-header input[type="search"]::-webkit-search-cancel-button {
    -webkit-appearance: none;
    display: none;
}
```

- [ ] **Step 4: Serve and test**

Verify verse numbers are styled correctly, have hover effect, and are clickable. Verify search input looks correct. Verify nav dropdowns scroll on mobile (or narrow window).

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "style: consolidate .verse-num, remove deprecated webkit properties"
```

---

### Task 15: Batch search filter cascade (#21)

**Files:**
- Modify: `src/search.js:139-147`

- [ ] **Step 1: Suppress redundant search during filter cascade**

The issue: changing the work filter calls `populateBookFilter` (which resets the book/chapter filters) then immediately calls `doSearch()`. But `doSearch` is already debounced at 250ms, so the real fix is to not call `doSearch()` separately when the book/chapter filters are being reset programmatically — only when the user finishes selecting.

Replace lines 139-147:

```javascript
  $.searchWork.addEventListener('change', () => {
    populateBookFilter($, $.searchWork.value);
    doSearch();
  });
  $.searchBook.addEventListener('change', () => {
    populateChapterFilter($, $.searchWork.value, $.searchBook.value);
    doSearch();
  });
  $.searchChapter.addEventListener('change', doSearch);
```

Since `doSearch` is already debounced, and the filter populators fire synchronously, the cascade is actually fine — but we can avoid the redundant intermediate search by wrapping in a single debounced call:

```javascript
  $.searchWork.addEventListener('change', () => {
    populateBookFilter($, $.searchWork.value);
    doSearch();
  });
  $.searchBook.addEventListener('change', () => {
    populateChapterFilter($, $.searchWork.value, $.searchBook.value);
    doSearch();
  });
  $.searchChapter.addEventListener('change', doSearch);
```

Actually, the debounce already handles this correctly — the 250ms window means only the last `doSearch()` call fires. The current code is acceptable. **Skip this step — the debounce already coalesces the calls.**

Mark this task as no-op — the existing debounce handles it. Move on.

---

### Task 16: Final verification

- [ ] **Step 1: Serve the site and do full manual smoke test**

```bash
cd /Users/a9lim/Work/a9lim.github.io && python -m http.server
```

Test checklist:
1. Navigate to `localhost:8000/scripture/` — default (BOM, 1 Nephi 1) loads
2. Change work to Old Testament — Genesis 1 loads, book/chapter dropdowns populate
3. Change work to Quran — book dropdown hides, chapter dropdown shows with surah names
4. Click prev/next chapter arrows — crosses book boundaries correctly
5. Click a verse number — notes sidebar opens, textarea focused
6. Type a note, blur — "Note saved" toast appears
7. Clear note text, blur — "Note deleted" toast, card removed
8. Open search (click or `/` key) — overlay opens
9. Type "faith" — results grouped by work appear
10. Filter by work, then by book — filters cascade correctly
11. Click a result — navigates to verse, overlay closes
12. Arrow keys navigate chapters (when not in input)
13. Download button works
14. Resize to mobile width — layout adapts

- [ ] **Step 2: Run pipeline verification**

```bash
cd extract && ./run.sh verify
```

Expected: all works pass verification.

- [ ] **Step 3: Check for regressions in git diff**

```bash
git diff --stat HEAD~14
```

Review the summary to ensure only expected files changed.
