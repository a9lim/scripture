# AGENTS.md

Part of the **a9l.im** portfolio. See root `AGENTS.md` for shared design system, CSS conventions, and shared code policy. Sibling projects: `geon`, `shoals`, `gerry`, `cyano`.

## Rules

- Prefer shared modules (`shared-*.js`, `shared-base.css`) over project-specific reimplementations.
- No work-specific code in the frontend. Adding a new scripture never requires JS changes.
- Raw source files (PDFs, scraped text) live in `raw/` (gitignored). Extracted JSON in `data/` and text in `text/` are committed.
- **Always re-extract from raw sources** (`./run.sh extract-raw`) rather than round-tripping through the text format. Extraction is fast, cheap, and avoids drift. The text files are a download artifact for users, not an editing workflow.

## Running Locally

```bash
cd path/to/a9lim.github.io && python -m http.server
```

Serve from repo root — shared files load via absolute paths. No build step, test framework, or linter.

## Overview

Static scripture reader with verse actions, bookmarks, concordance, display settings, reading history, full-text search, related passages, text download, text-to-speech, rich markdown notes, and data export/import. Sixteen works: Book of Mormon, D&C, Pearl of Great Price, OT (KJV), NT (KJV), Apocrypha (KJV), Quran (Pickthall), Four Books (Legge), Tao Te Ching (Legge), Kojiki (Chamberlain), Bundahishn (West), Lotus Sutra (Kern), Arda Viraf (Haug & West), Book of Poetry (Legge), Kalevala (Crawford), Poetic Edda (Bellows). Zero dependencies, vanilla ES6 modules.

## Frontend Architecture

```
main.js               Entry point. $ DOM cache, hash routing, navigate(), random verse
├─ src/chapters.js     Data layer: caching, parseRef, formatRef, chapterIdAt, bookMap
├─ src/nav.js          Toolbar dropdowns: fillSelect() (shared), work/book/chapter selects
├─ src/reader.js       Verse rendering: sections, verse highlighting, word wrapping
├─ src/notes.js        Notes + bookmarks: markdown rendering, scope toggle, global view, search
├─ src/search.js       Search overlay: lazy index load, debounced filter, grouped results
├─ src/popover.js      Verse action popover: note, bookmark, copy, link, read aloud
├─ src/display.js      Display settings dropdown: font, size, spacing, width
├─ src/history.js      Reading history, resume dropdown, progress bar
├─ src/concordance.js  Concordance: word-click popover + full overlay
├─ src/related.js      Related passages: TF-IDF similarity, collapsible section
├─ src/tts.js          Text-to-speech: SpeechSynthesis API, verse tracking, control bar
└─ src/data-io.js      Export/import: JSON backup with merge/replace
```

State lives in `main.js`: `currentWork`, `currentChapter`.

Import graph: `search.js → nav.js → chapters.js` (acyclic). `notes.js → chapters.js`. `fillSelect` is exported from `nav.js` and shared by `search.js`.

## ID System

Book metadata (workId, abbreviation) lives in each manifest and is indexed into a `bookMap` by `chapters.js` at load time. Chapter IDs are never stored — they are derived.

- **Work IDs**: `bom`, `dc`, `pgp`, `ot`, `nt`, `quran`, `apoc`, `fourbooks`, `ttc`, `kj`, `bund`, `lotus`, `viraf`, `bop`, `kv`, `poe`
- **Chapter IDs**: `{bookId}-{(start ?? 1) + index}` where index is 0-based — e.g. `gen-1`, `1-ne-3`, `quran-19`, `kjk-0`
- **Reference format**: `workId:chapterId:verse` — e.g. `ot:gen-1:26`
- **Chapter numbers**: extracted via `chapterNum()` (trailing digits of chapter ID)

## Data Format

```
data/
  works.json                     ["ot", "apoc", ..., "lotus"]
  search-index.json              [{ ref, text }]
  concordance.json               { word: [ref, ...] }
  similarity.json                { chapterId: [{ ref, score }] }
  {workId}/
    manifest.json                { id, title, books }
    chapters/{chapterId}.json    { sections }
```

**Manifest books**: `{ id, name, abbrev, chapters }` — `chapters` is an integer count. Optional `start` (default 1) sets first chapter number; optional `names` is a string array of per-chapter subtitles (null for unnamed). Chapter IDs are derived from these fields.

**Chapter JSON**: `{ sections: [{ startVerse, verses: [string] }] }` with optional `intro`. No `name` field — chapter names live in manifest `names` only.

**Chapter titles**: constructed by the renderer: `bookName` for single-chapter books, `workTitle N` for single-book works, `bookName N` otherwise.

## Text Format

```
text/{workId}.txt    One file per work, for user download
```

```
WORK: id | Title
BOOK: id | Name
START: N                       (first chapter number, default 1)
CHAPTER: [name]
@ N                            (set verse numbering to N)
verse text
SECTION:                       (section break — numbering continues)
SECTION: @                     (section break — reset numbering to 1)
SECTION: @ N                   (section break — start numbering at N)
```

Text files are a generated download artifact. Do not edit them as a primary workflow — re-extract from raw sources instead.

## Extraction Pipeline

```
extract/
  extract.py           python3 extract.py <source> --parser <name> --output <dir>
  txt_to_json.py       python3 txt_to_json.py <text_file> --output <dir>
  json_to_txt.py       python3 json_to_txt.py [data_dir] [output_dir]
  base_parser.py       BaseParser: slugify, clean_text, make_section, write_output
  pdf_parser.py        PdfParser(BaseParser): ABC for PDF parsers (fitz)
  search_index.py      python3 search_index.py <data_dir> → works.json + search-index.json
  concordance.py       python3 concordance.py <data_dir> → concordance.json
  similarity.py        python3 similarity.py <data_dir> → similarity.json (requires scikit-learn)
  verify_data.py       python3 verify_data.py [data_dir] — checks canonical verse counts
  parsers/             quad.py, quran.py, kjv_vpl.py, fourbooks.py, ttc.py, kojiki.py, bundahis.py, viraf.py, bop.py, kalevala.py, edda.py
  scrape_sacred_texts.py   Scrape sacred-texts.com → raw file
  parse_scraped.py         Parse scraped plaintext → JSON (used for Mencius, Lotus Sutra)
  run.sh                   All-in-one helper
```

All parsers return `[{ manifest, chapters }]` with verses as plain strings.

### Rebuilding everything

```bash
cd extract && ./run.sh extract-raw   # re-extract all works from raw/ + reindex
./run.sh json2txt                    # regenerate text downloads
./run.sh enrich                      # rebuild concordance + similarity
./run.sh verify                      # check verse counts
```

### Adding a new scripture

1. Write a parser or scrape source to `raw/`
2. Add extraction step to `run.sh extract-raw`
3. Register abbreviation in parser and in `ABBREVS` in `txt_to_json.py`
4. Run `./run.sh extract-raw && ./run.sh json2txt && ./run.sh enrich`
5. Commit `data/`, `text/`, index files

## URL Routing

Path-based: `/scripture/workId/chapterId` with optional `:verseNum` for deep-linking (e.g. `/scripture/bom/1-ne-1:26`). The root `_worker.js` handles SPA routing for all `/scripture/*` paths, serving `scripture/index.html`. Default: last reading position from history, fallback `/scripture/bom/1-ne-1`.

## User Data (localStorage)

| Key | Format | Purpose |
|-----|--------|---------|
| `scripture-user` | `{ notes: { ref: text }, bookmarks: [ref] }` | Notes and bookmarks |
| `scripture-display` | `{ fontSize, lineHeight, maxWidth, font }` | Display preferences |
| `scripture-history` | `{ recent: [{ workId, chapterId, ts }] }` | Reading history (max 10) |

## Layout & Scrolling

`#app-layout` is a fixed-height flex container (`height: calc(100vh - var(--toolbar-h))`, `overflow: hidden`). Reading pane and notes sidebar scroll independently.

- **`#reading-pane`** — `overflow-y: auto`, left padding (3.5rem) for verse number gutter.
- **`#notes-content`** — `overflow-y: auto`, flex child inside `.sim-panel`.

Verse numbers: fixed-width inline-block (`width: 2em`), pulled into gutter via negative margin (`margin-left: -2.5em`).

## Gotchas

- **`initOverlayDismiss(overlayEl, closeBtn, hideFn)`** — all 3 args required.
- **Shared globals** (`escapeHtml`, `debounce`, `trapFocus`, `initOverlayDismiss`, `initShortcuts`, `initAboutPanel`, `showToast`, `_toolbar`, `_forms`, `_settings`, `_haptics`, `createSimTooltip`) are window globals from `shared-*.js`, not ES6 imports. Verify `<script>` tags in `index.html`.
- **`_PALETTE`/`_FONT` frozen** by `colors.js` — do not mutate.
- **`scripture-user` localStorage key** — changing it loses all user notes and bookmarks.
- **`book.chapters` is an integer** count, not an array. Chapter IDs are derived, not stored.
- **Verse number gutter** — `#reading-pane` left padding must be ≥ 3.5rem (≥ 3rem on mobile).
- **`#reading-pane` has `position: relative`** — required for popover positioning.
- **Concordance data** — `concordance.json` (~15MB). Lazy-loaded on first word click.
- **TTS control bar** uses `body:has(.tts-bar:not([hidden]))` to push `#app-layout` down — requires modern browser.
- **Notes markdown** — `renderMarkdown()` calls `escapeHtml()` first, then applies regex. Safe because input is always escaped before HTML tag insertion.
- **Export/import** uses three localStorage keys: `scripture-user`, `scripture-display`, `scripture-history`. Import reloads the page.
