# CLAUDE.md

Part of the **a9l.im** portfolio. See root `CLAUDE.md` for shared design system, CSS conventions, and shared code policy. Sibling projects: `geon`, `shoals`, `gerry`, `cyano`.

## Rules

- Prefer shared modules (`shared-*.js`, `shared-base.css`) over project-specific reimplementations.
- No work-specific code in the frontend. Adding a new scripture never requires JS changes.
- Raw source files (PDFs, scraped text) live in `raw/` (gitignored). Extracted JSON in `data/` and text in `text/` are committed.

## Running Locally

```bash
cd path/to/a9lim.github.io && python -m http.server
```

Serve from repo root — shared files load via absolute paths. No build step, test framework, or linter.

## Overview

Static scripture reader with verse actions, bookmarks, concordance, display settings, reading history, full-text search, related passages, and text download. Twelve works: Book of Mormon, D&C, Pearl of Great Price, OT (KJV), NT (KJV), Apocrypha (KJV), Quran (Pickthall), Four Books (Legge), Tao Te Ching (Legge), Kojiki (Chamberlain), Bundahis (West), Lotus Sutra (Kern). Zero dependencies, vanilla ES6 modules.

## Frontend Architecture

```
main.js               Entry point. $ DOM cache, hash routing, navigate(), random verse
├─ src/chapters.js     Data layer: caching, parseRef, findBookForChapter, chapterNum
├─ src/refs.js         Book ID registry: BOOKS map (module-private), formatRef()
├─ src/nav.js          Toolbar dropdowns: fillSelect() (shared), work/book/chapter selects
├─ src/reader.js       Verse rendering: sections, verse highlighting, word wrapping
├─ src/notes.js        Notes + bookmarks: localStorage persistence, sidebar tabs, toggleBookmark
├─ src/search.js       Search overlay: lazy index load, debounced filter, grouped results
├─ src/popover.js      Verse action popover: note, bookmark, copy, link (hover to open)
├─ src/display.js      Display settings dropdown: font, size, spacing, width
├─ src/history.js      Reading history, resume dropdown, progress bar
├─ src/concordance.js  Concordance: word-click popover + full overlay
└─ src/related.js      Related passages: TF-IDF similarity, collapsible section
```

State lives in `main.js`: `currentWork`, `currentChapter`.

Import graph: `search.js → nav.js → chapters.js` (acyclic). `notes.js → chapters.js, refs.js`. `fillSelect` is exported from `nav.js` and shared by `search.js`.

## ID System

`BOOKS` in `refs.js` is the single source of truth for bookId→{workId, abbreviation}.

- **Work IDs**: `bom`, `dc`, `pgp`, `ot`, `nt`, `quran`, `apoc`, `fourbooks`, `ttc`, `kj`, `bund`, `lotus`
- **Chapter IDs**: `{bookId}-{num}` — e.g. `gen-1`, `1-ne-3`, `dc-76`, `quran-19`, `kjk-1`, `lotus-1`
- **Reference format**: `workId:chapterId:verse` (search index). No alternate formats.
- **Chapter numbers**: extracted via `chapterNum()` in `chapters.js` (trailing digits of chapter ID).

## Data Format

```
data/
  works.json                     ["ot", "apoc", "nt", "quran", "bom", "dc", "pgp", "fourbooks", "kj", "ttc", "bund", "lotus"]
  search-index.json              [{ ref, text }]
  concordance.json               { "word": ["workId:chapterId:verseNum", ...] }
  similarity.json                { "chapterId": [{ ref, score }] }
  {workId}/
    manifest.json                { id, title, books: [{ id, name, chapters: [{ id, name?, verses }] }] }
    chapters/{chapterId}.json    { name?, sections }
```

Chapters use `sections[].verses[]` where each verse is a plain string and each section has `startVerse`. Verse numbers are derived from `startVerse + index`. The chapter number is derived from the chapter ID (trailing digits). The renderer auto-numbers sections when multiple exist per chapter. The `name` field is a descriptive subtitle only (e.g. "Opening", "Preface") — omit when non-descriptive.

**Chapter titles**: constructed by the renderer from context: `bookName` for single-chapter books, `workTitle N` for single-book works, `bookName N` for multi-book works.

## Text Format

```
text/{workId}.txt    One file per work
```

```
WORK: id | Title
BOOK: id | Name
CHAPTER: [name]
@ N                            (set verse numbering to N)
verse text
SECTION:                       (section break — numbering continues)
SECTION: @                     (section break — reset numbering to 1)
SECTION: @ N                   (section break — start numbering at N)
```

Chapter IDs are derived from `{bookId}-{N}` (sequential per book). Verse numbers auto-increment from 1. Use `@` / `SECTION: @` only for non-standard starts.

## Extraction Pipeline

```
extract/
  extract.py           python3 extract.py <source> --parser <name> --output <dir>
  txt_to_json.py       python3 txt_to_json.py <text_file> --output <dir>
  json_to_txt.py       python3 json_to_txt.py [data_dir] [output_dir]
  base_parser.py       BaseParser: slugify, clean_text, make_section, normalize_divine_names, write_output
  pdf_parser.py        PdfParser(BaseParser): ABC for PDF parsers (fitz pipeline)
  search_index.py      python3 search_index.py <data_dir> → works.json + search-index.json
  concordance.py       python3 concordance.py <data_dir> → concordance.json
  similarity.py        python3 similarity.py <data_dir> → similarity.json (requires scikit-learn)
  verify_data.py       python3 verify_data.py [data_dir] — checks verses against canonical counts
  parsers/
    quad.py            QuadParser(PdfParser) — LDS Quad PDF → 5 works
    quran.py           QuranParser(BaseParser) — Pickthall plaintext → quran
    kjv_vpl.py         KjvVplParser(BaseParser) — KJV verse-per-line → apoc
    fourbooks.py       FourBooksParser(BaseParser) — Legge Four Books → fourbooks
    ttc.py             TtcParser(BaseParser) — Legge Tao Te Ching → ttc
    kojiki.py          KojikiParser(BaseParser) — Chamberlain Kojiki → kj
    bundahis.py        BundahisParser(BaseParser) — West Bundahis → bund
    _surah_names.py    Quran surah name mapping
  scrape_sacred_texts.py   Scrape sacred-texts.com to raw file
  parse_scraped.py         Parse scraped plaintext → JSON
  run.sh                   Helper: scrape, extract-raw, json2txt, txt2json, verify, reindex, concordance, similarity, enrich
```

All parsers return `[{ "manifest": {...}, "chapters": [...] }]` with verses as plain strings. Chapter dicts use `_id` internally (stripped on write).

## URL Routing

Hash-based: `#workId/chapterId` with optional `:verseNum` for deep-linking. Default: last reading position from history, fallback `#bom/1-ne-1`.

## User Data (localStorage)

| Key | Format | Purpose |
|-----|--------|---------|
| `scripture-user` | `{ notes: { ref: text }, bookmarks: [ref] }` | Notes and bookmarks (migrates from old `scripture-notes`) |
| `scripture-display` | `{ fontSize, lineHeight, maxWidth, font }` | Display preferences |
| `scripture-history` | `{ recent: [{ workId, chapterId, ts }] }` | Reading history (max 10) |

Verse number hover opens an action popover (note, bookmark, copy, link). Bookmarked verses show a gold dot and subtle background highlight.

## Common Workflows

### Helper script

```bash
cd extract
./run.sh scrape <sacred-texts-index-url>   # scrape to raw/{slug}_raw.txt
./run.sh extract-raw                        # re-extract all works + reindex
./run.sh json2txt                           # JSON → text
./run.sh txt2json                           # text → JSON + reindex + enrich
./run.sh verify                             # check verse counts
./run.sh reindex                            # rebuild works.json + search-index.json
./run.sh concordance                        # rebuild concordance.json
./run.sh similarity                         # rebuild similarity.json (requires scikit-learn)
./run.sh enrich                             # concordance + similarity
```

### Editing verse text

Edit `text/{workId}.txt`, then: `cd extract && python3 txt_to_json.py ../text/{workId}.txt --output ../data && python3 search_index.py ../data`

### Adding a new scripture

1. Create `text/{workId}.txt`
2. Add book entries to `BOOKS` in `refs.js`
3. Run `txt_to_json.py`, `search_index.py`, and `./run.sh enrich`
4. Commit text, data, `works.json`, `search-index.json`, `concordance.json`, `similarity.json`

## Layout & Scrolling

`#app-layout` is a fixed-height flex container (`height: calc(100vh - var(--toolbar-h))`, `overflow: hidden`). Both the reading pane and notes sidebar scroll independently within their own containers:

- **`#reading-pane`** — `overflow-y: auto`, `scrollbar-thin` class. Left padding (3.5rem) provides gutter space for verse numbers.
- **`#notes-content`** — `overflow-y: auto`, `scrollbar-thin` class. Flex child inside the `.sim-panel`.

Verse numbers use a fixed-width inline-block (`width: 2em`) pulled into the left gutter via negative margin (`margin-left: -2.5em`), right-aligned so 1–3 digit numbers stay flush against the verse text.

## Gotchas

- **`initOverlayDismiss(overlayEl, closeBtn, hideFn)`** — all 3 args required.
- **Shared globals** (`escapeHtml`, `debounce`, `trapFocus`, `initOverlayDismiss`, `initShortcuts`, `initAboutPanel`, `showToast`, `_toolbar`, `_forms`, `_haptics`, `createSimTooltip`) are window globals from `shared-*.js`, not ES6 imports. Verify `<script>` tags exist in `index.html` when adding new shared dependencies.
- **`_PALETTE`/`_FONT` frozen** by `colors.js` — do not mutate.
- **`scripture-user` localStorage key** — changing it loses all user notes and bookmarks. Migrated from old `scripture-notes` key automatically.
- **`BOOKS` is module-private** in `refs.js` — use `formatRef()` to format references externally.
- **Verse number gutter** — `#reading-pane` left padding must be ≥ 3.5rem (≥ 3rem on mobile) to avoid clipping verse numbers pulled via negative margin.
- **`#reading-pane` has `position: relative`** — required for verse popover and concordance popover absolute positioning.
- **Concordance data** — `concordance.json` can be large (~15MB). Lazy-loaded on first word click. Words are marked with `.conc-word` class after load via MutationObserver.
