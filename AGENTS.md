# AGENTS.md

Part of the **a9l.im** portfolio. See root `AGENTS.md` for the shared design
system, CSS conventions, Worker routing/SSR, and shared code policy. Sibling
projects: `geon`, `shoals`, `gerry`, `cyano`, `miasma`, `pile`, and `plasma`.

## Rules

- Prefer shared modules (`shared-*.js`, `shared/base.css`) over project-specific reimplementations.
- No work-specific code in the frontend. Adding a new scripture never requires JS changes.
- Raw source files (PDFs, scraped text) live in `raw/` (gitignored). Extracted JSON in `data/` and generated text downloads in `text/` are committed.
- **Always re-extract from raw sources** (`./run.sh extract-raw`) rather than round-tripping through the text format. Extraction is fast, cheap, and avoids drift. The text files are a download artifact for users, not an editing workflow.

## Running Locally

```bash
cd path/to/a9lim.github.io && npm run build && python -m http.server --directory dist
```

Build from the parent repository root and serve `dist/` — shared files load via absolute paths.
There is no frontend build step or JavaScript linter. The extraction pipeline
has a committed data verifier (`cd extract && ./run.sh verify`).

## Overview

Static scripture reader with verse actions, bookmarks, concordance, display
settings, reading history, full-text search, related passages, text download,
text-to-speech, rich markdown notes, and data export/import. The committed
corpus contains 16 works, 121 books, 2,724 chapter files, and 63,141 verse
records. Zero runtime dependencies; vanilla ES6 modules.

## Frontend Architecture

```
main.js               Entry point. $ DOM cache, path routing, navigate(), random verse
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
  search-index.json              [{ ref, text }] — one row per verse record
  concordance.json               { word: [ref, ...] } — exact occurrence refs
  similarity.json                { chapterId: [{ ref, score }] } — top TF-IDF chapter matches
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
Their structured arrangement is licensed CC BY-SA 4.0; see `text/LICENSE`.
The application source is AGPL-3.0. Do not label the generated corpus itself
with the Public Domain Mark: that would conflict with the committed download
license even though the underlying historic source texts are treated as
public-domain inputs.

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

Path-based: `/scripture/workId/chapterId` with optional `:verseNum` for deep-linking (e.g. `/scripture/bom/1-ne-1:26`). Parent `worker/index.js` handles SPA routing for all `/scripture/*` paths, serving the staged `/scripture/index.html`. Default: last reading position from history, fallback `/scripture/bom/1-ne-1`.

The interactive reader is client-side, but production delivery is not purely
static: the parent Worker SSRs work/chapter/verse HTML and JSON-LD for crawlers,
adds security/cache headers, and logs aggregate page-view metadata through its
Analytics Engine binding. Personal notes, bookmarks, display settings, and
reading history remain in browser `localStorage` and are not sent by the
reader code.

## SEO and discovery contract

- `about.md` is the canonical long-form SEO summary. The parent build copies
  its `title`, `description`, and `updated` fields into staged discovery files
  and `dist/scripture/` metadata mirrors without editing this submodule.
- `index.html` owns the base route's head metadata, FAQ/LearningResource/
  Dataset JSON-LD, and crawlable educational content. The parent Worker adds
  route-specific `CollectionPage`, `Book`, `Chapter`, `Quotation`, and
  breadcrumb schema for deep routes.
- The structured data arrangement/download license is CC BY-SA 4.0. The web
  application code is AGPL-3.0.
- Wikidata QIDs and external identifiers must be live-verified before being
  added or changed. Never infer them from names.
- After changing `about.md`, run `npm run build` from the parent repository so root SEO,
  sitemap, and LLM discovery mirrors advance with the submodule source.

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
- **Concordance data** — `concordance.json` (~14 MB). Lazy-loaded on first word click.
- **TTS control bar** uses `body:has(.tts-bar:not([hidden]))` to push `#app-layout` down — requires modern browser.
- **Notes markdown** — `renderMarkdown()` calls `escapeHtml()` first, then applies regex. Safe because input is always escaped before HTML tag insertion.
- **Export/import** uses three localStorage keys: `scripture-user`, `scripture-display`, `scripture-history`. Import reloads the page.
