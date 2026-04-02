# Scripture Reader Overhaul

Strip the reader down to its core — reading, searching, annotating, downloading — and remove all unused features (translations, glossary, cross-references, footnotes).

## Scope

### Remove Entirely
- **Translation system**: compare button, compare pane, translation select dropdown, `compare.js`, translation change listener in `nav.js`, `resolveWorkAlias` in `chapters.js`, translation alias registration in `loadManifests`
- **Glossary**: glossary button, glossary overlay HTML, `glossary.js`, `loadGlossary` in `chapters.js`, all `data/*/glossary.json` files
- **Cross-references**: `cross-refs.json`, `loadCrossRefs`/`getCrossRefs` in `chapters.js`, `notemap.js` (entire file), cross-ref parsing in `refs.js` (`parseCrossRefs`, `parseJst`, all helper functions)
- **Footnotes**: footnote markers in `reader.js`, footnote-related fields in chapter JSON (`footnotes` dict, verse `footnotes` arrays), footnote handling in all parsers, footnote round-tripping in `txt_to_json.py` and `json_to_txt.py`, footnote verification in `verify_data.py`
- **JST appendix**: `loadJstAppendix` in `chapters.js`, `getJstText` callback in `main.js` (no `jst-appendix.json` exists on disk)

### Keep (Simplified)
- `refs.js`: retain only `BOOKS` map and `formatRef` — delete everything else (300+ lines of cross-ref parsing)
- `chapters.js`: retain manifest loading, chapter loading, search index, `parseRef`, `getAdjacentChapters` — remove `getDefaultTranslation`, `resolveDataDir`, alias resolution, cross-refs, glossary, JST
- `notes.js`: full rewrite — becomes user notes with localStorage
- `reader.js`: simplify — verses render as clean text, no footnote markers

### Add
- **Download button**: replaces glossary button in toolbar; fetches `text/${workId}.txt` (relative path, same as `data/` fetches)
- **User notes**: localStorage-backed per-verse annotations in the notes sidebar

---

## Frontend Changes

### index.html

Remove:
- `#translation-select` from `.nav-dropdowns`
- `#compare-btn` and `#compare-pane` (entire compare infrastructure)
- `#glossary-btn`, `#glossary-overlay` (entire glossary infrastructure)

Add:
- Download button in place of glossary button (arrow-down SVG icon)

Update:
- `<meta name="description">` and `<meta property="og:description">` to match new feature set

### main.js

Remove imports: `initCompare`, `destroyCompare`, `initGlossary`, `buildNoteMap`, `loadCrossRefs`, `getCrossRefs`, `loadJstAppendix`, `resolveWorkAlias`

Remove from DOM cache: `translationSelect`, `compareBtn`, `comparePane`, `compareVerses`, `glossaryBtn`, `glossaryOverlay`, `glossaryFilter`, `glossaryClose`, `glossaryContent`

Add to DOM cache: `downloadBtn`

Simplify `navigate()`:
- Remove `translationId` parameter entirely
- Remove `resolveWorkAlias` call
- Remove `getCrossRefs` / `buildNoteMap` — just load chapter and render
- Call `renderChapter($, chapter)` (no noteMap params)
- Call `renderNotes($, workId, chapterId)` to load user notes for this chapter

Remove: `onRefClick`, `onRefHover`, `onCardClick`, `getJstText`, `toggleCompare`

Remove from `init()`:
- `loadCrossRefs()` from the `Promise.all`
- `initGlossary` call
- Compare button listener
- Glossary escape-key handling

Add to `init()`:
- Download button click handler
- Pass `navigate` info to notes module so it knows current chapter

Update `initAboutPanel` config:
- Description: `'Read and annotate sacred texts from six traditions, with full-text search and personal notes.'`
- Controls: `[{ label: 'Work / Book / Chapter', value: 'Toolbar dropdowns to navigate' }, { label: 'Verse notes', value: 'Click verse number to add a note' }, { label: 'Download', value: 'Download current work as text file' }]`
- Remove cross-ref/footnote/glossary mentions

Update `routeFromHash`: remove translationId handling.

### src/nav.js

Remove `populateTranslations` function.
Remove translation-select change listener from `initNav`.
Remove `getDefaultTranslation` import.
Simplify `navigateFn` calls — 2 args `(workId, chapterId)` instead of 3.
Remove translation syncing from `syncNav`.

### src/reader.js

Simplify `renderChapter($, chapter)` — remove `byKey` and `extraFootnotes` parameters.

Simplify `appendVerse` — remove footnote marker rendering. Each verse row is just: verse number + verse text. No marker buttons.

### src/notes.js — Full Rewrite

**Purpose**: Render and manage user notes stored in localStorage.

**Storage format**: Key = `scripture-notes`, value = JSON object `{ "workId:chapterId:verseNum": "note text", ... }`. Single key for all notes to keep localStorage tidy and enable future export.

**Exports**:
- `initNotes($, onVerseClick)` — wire sidebar; `onVerseClick` receives verse number from reading pane clicks (delegated on `.verse-num`)
- `renderNotes($, workId, chapterId, allVerses)` — display notes for current chapter; `allVerses` is the flat array of `{number, text}` from all sections, used to know which verse numbers exist
- `openNote(verseNum)` — open sidebar if closed, create card if needed, focus textarea
- `highlightNote(verseNum)` — scroll to and highlight a note card in the sidebar

**Storage**: single localStorage key `scripture-notes` holding `{ "workId:chapterId:verseNum": "text", ... }`. No max length enforced (browser localStorage limit ~5MB is sufficient for text notes).

**UI structure** in `#notes-content`:
- List of note cards for verses that have notes, ordered by verse number
- Each card: verse number label + auto-expanding textarea
- Empty state: "Click a verse number to add a note."

**Verse click interaction**:
- Clicking a `.verse-num` in the reading pane: opens sidebar (if closed), creates card if needed, focuses the textarea. Does NOT toggle sidebar closed on second click — only opens/focuses.
- Sidebar auto-scrolls to the focused card.
- `debounce` (from shared utils) auto-saves on textarea input after 500ms
- Clearing a textarea and blurring removes the card immediately and deletes from localStorage
- `showToast` (shared utils) confirms save/delete
- On download failure: `showToast('Download failed')`, no other error handling needed

### src/refs.js — Gut

Keep only:
- `BOOKS` map (lines 13-144) — still the source of truth for book→work mapping
- `formatRef` function (lines 150-158) — used by search.js

Delete everything else: `ABBREV`, `ABBREV_KEYS`, `matchAbbrev`, `DROP_RE`, `JST_RE`, `parseCrossRefs`, `scanEntries`, `startsEntry`, `parseOneRef`, `parseJst`

### src/search.js

Remove `resolveWorkAlias` import — no longer exists.
Remove the translation-name display logic in `runSearch` (the `resolved` variable and translation name appending).

### src/chapters.js

Remove:
- `resolveWorkAlias` function and export
- `loadGlossary`, `glossaryCache`
- `loadCrossRefs`, `getCrossRefs`, `crossRefs` cache
- `loadJstAppendix`, `jstAppendix` cache
- `workIdSet` (only used by `resolveWorkAlias`)
- Translation alias registration in `loadManifests` (the inner loop over `m.translations`)

Keep:
- `loadManifests`, `getWorkIds`, `getManifest` — core navigation
- `loadChapter` — simplified, no translationId param needed but keep `resolveDataDir` dormant or remove (since translations are gone, always loads from `workId` dir)
- `getDefaultTranslation` — can remove since nav.js no longer calls it
- `loadSearchIndex`, `parseRef`, `getAdjacentChapters`

Actually remove `getDefaultTranslation` and `resolveDataDir` too — translations are fully gone. `loadChapter(workId, chapterId)` just fetches `data/{workId}/chapters/{chapterId}.json`.

### styles.css

Remove: `.glossary-*` styles, `#compare-pane` / `.compare-active` styles, `.fn-marker*` styles, `.note-ref-link` / `.note-tooltip` / `.note-jst*` styles.

Update `.note-card` styles for user notes (textarea-based cards instead of footnote cards).

Add: `.note-textarea` auto-expanding textarea style, `.verse-num` clickable hover state, download button styling (if needed beyond `.tool-btn`).

### Download Feature

On download button click:
1. Read `currentWork` from module state
2. `fetch(`text/${currentWork}.txt`)`
3. Create `Blob`, generate object URL, trigger download via temporary `<a>` element
4. `showToast('Downloaded ${workId}.txt')`

---

## Pipeline Changes

### extract/base_parser.py

- Remove `_strip_chapter()` footnote cleanup (lines 51-57)
- Remove glossary.json writing from `write_output()` (line 97-98)
- Chapters written should have no `footnotes` field

### extract/pdf_parser.py

- Remove `extract_glossary()` abstract method
- Remove footnote documentation from `extract_chapters()` docstring
- Remove `translations` from `build_manifest()` docstring
- Simplify: chapters return `sections[].verses[].{number, text}` only

### extract/parsers/quad.py

- Remove `_FN_MARKER_FLAGS` constant
- Remove `extract_glossary()` method
- Remove footnote marker detection and footnote collection from verse extraction
- Remove `translations` parameter from `_work()` helper
- Output clean verse text only

### extract/txt_to_json.py

- Remove `_FN_RE` regex and footnote parsing from verse lines
- Remove footnote merging from existing chapter JSON
- Remove glossary loading from data directory
- Remove `copy_ancillary_data()` (copies jst-appendix.json, cross-refs.json)
- Simplify verse output: `{number, text}` only

### extract/json_to_txt.py

- Remove footnote suffix reconstruction (`{fn-id}` in text output)
- Remove translation metadata export (`TRANSLATION:` lines)

### extract/verify_data.py

- Remove footnote reference validation (lines 311-324)
- Remove orphan footnote detection

### extract/search_index.py

No changes needed — already only indexes verse text.

---

## Data Changes

### Delete files
- `data/cross-refs.json`
- `data/*/glossary.json` (all 11 files)
- (no `jst-appendix.json` — does not exist on disk)

### Delete modules
- `src/glossary.js`
- `src/compare.js`
- `src/notemap.js`

### Regenerate
After parser changes, run full pipeline rebuild:
```bash
cd extract && ./run.sh txt2json && ./run.sh verify && ./run.sh reindex
```
This regenerates all chapter JSON (now without footnotes) and the search index.

Note: manifest.json files will retain their `translations` arrays from the text files. This is harmless (dormant data) but could be cleaned by removing `TRANSLATION:` lines from text files. Not required for this overhaul.

**Precondition**: The `.txt` source files may still contain `{fn-id}` footnote references from a previous `json2txt` export. After removing footnote parsing from `txt_to_json.py`, these will be treated as literal text in verses. Run `json2txt` first (old code, which strips footnotes from output) to get clean text files, THEN apply parser changes, THEN run `txt2json`.

---

## CLAUDE.md Updates

After implementation:
- Remove references to cross-references, glossary, footnotes, JST, translations, compare
- Update architecture diagram (remove deleted modules, simplify remaining)
- Update data format docs (no footnotes field)
- Update text format docs (remove footnote `{}` syntax)
- Update "Adding a new scripture" workflow (simpler — no cross-refs step)
- Add user notes feature description
- Add download feature description
