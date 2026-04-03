# Manifest Simplification & Dead Code Removal

Date: 2026-04-02

## Summary

Eliminate stored chapter IDs from manifests, remove the redundant `refs.js` BOOKS map, clean up dead code, and update the extraction pipeline to match. Chapter IDs become a derived convention (`{bookId}-{(start ?? 1) + index}`) rather than stored data.

## Manifest Format

### Before (per book)

```json
{
  "id": "gen", "name": "Genesis",
  "chapters": [
    { "id": "gen-1", "verses": 31 },
    { "id": "gen-2", "verses": 25 }
  ]
}
```

### After (per book)

```json
{ "id": "gen", "name": "Genesis", "abbrev": "Gen.", "chapters": 50 }
```

Fields:
- `id` — book slug, also the chapter ID prefix
- `name` — full display name
- `abbrev` — display abbreviation (moved from `refs.js` BOOKS map)
- `chapters` — integer count
- `start` (optional) — first chapter number, defaults to 1. Used by Additions to Esther (`start: 10`), Kojiki books (`start: 0`, `40`, `114`)
- `names` (optional) — array of chapter names, length must equal `chapters`. Used by Quran (114 surah names), Kojiki (173 section names), Bundahis (7 named chapters out of 34)

### Chapter ID Derivation

```
chapterId = bookId + "-" + ((start ?? 1) + index)
```

Where `index` is the 0-based position within the book's chapter list.

### Works with `start`

| Book | start | Range |
|------|-------|-------|
| `add-esth` (Additions to Esther) | 10 | add-esth-10 through add-esth-16 |
| `kjk` (Kamitsumaki) | 0 | kjk-0 through kjk-39 |
| `kjn` (Nakatsumaki) | 40 | kjn-40 through kjn-113 |
| `kjs` (Shimotsumaki) | 114 | kjs-114 through kjs-172 |

### Works with `names`

For Bundahis, only 7 of 34 chapters have names. The `names` array uses `null` for unnamed chapters:
```json
{ "names": ["Creation", null, null, "Assault", ...] }
```

## Chapter JSON Files

Remove the `name` field (single source of truth is now manifest `names` array). Files become:

```json
{ "sections": [{ "startVerse": 1, "verses": ["...", "..."] }] }
```

The optional `intro` field is retained where it exists.

## Frontend Changes

### Delete `refs.js`

The entire file is removed. Its two responsibilities move to `chapters.js`:

1. **BOOKS map** — replaced by `bookMap` built at manifest load time: `bookId -> { workId, abbrev, name }`
2. **`formatRef(chapterId, verse)`** — moved to `chapters.js`, reads from `bookMap`

### `chapters.js`

- `loadManifests()`: after loading manifests, build `bookMap` (bookId -> { workId, abbrev, name }) and precompute `flatChapters` per work
- New: `chapterIdAt(bookId, index, start)` -> derived chapter ID
- New: `getBookInfo(bookId)` -> { workId, abbrev, name } from bookMap
- `findBookForChapter(workId, chapterId)`: parse bookId from string (slice before last `-`), validate against bookMap. O(1) instead of O(n) manifest scan
- `getAdjacentChapters()`: use prebuilt flat list (same logic, just built eagerly)
- `loadChapter()`: attach context from `bookMap` instead of manifest scan
- `chapterNum()`: unchanged (extracts trailing digits from chapter ID)

### `nav.js`

- `populateChapters()`: iterate `0..book.chapters-1`, derive ID via helper, show name from `book.names[i]` if present
- Import `chapterIdAt` (or equivalent) from `chapters.js`
- No longer reads `ch.id` from manifest chapter objects (they don't exist)

### `search.js`

- Chapter filter dropdown: same pattern as `nav.js`, derive IDs from book metadata

### `main.js`

- Remove dead `bookmarkScope` variable
- Update import: `formatRef` now from `chapters.js` instead of `refs.js`

### `related.js`

- Replace clone-to-remove-listeners anti-pattern with `removeEventListener` or event delegation

### `concordance.js`

- Debounce `markWords` in MutationObserver callback

### `index.html`

- Remove `<script>` or `<link>` for `refs.js` if present (it's an ES module import, so just removing the file and updating imports suffices)

## Pipeline Changes

### `base_parser.py`

`build_manifest()` produces the new format:
- `chapters`: integer count per book
- `abbrev`: set by each parser per book
- `start`: included when non-1
- `names`: included when any chapter has a name

### `txt_to_json.py`

- Derives chapter IDs from book position + start when writing chapter JSON files
- Reads text format (unchanged — text format already derives IDs from sequential counting)
- Produces new manifest format

### `json_to_txt.py`

- Derives chapter IDs from new manifest structure when reading chapter files
- Iterate `0..book.chapters-1`, compute `chapterIdAt(bookId, i, start)`

### `search_index.py`

- Derive chapter IDs from manifest structure when building refs

### `concordance.py`

- Same: derive chapter IDs from manifest

### `similarity.py`

- Same: derive chapter IDs from manifest

### `verify_data.py`

- Validate new manifest format: `chapters` is int, `start` is int when present, `names` length matches `chapters` when present
- Derive expected chapter filenames from manifest structure

### Individual parsers

Each parser sets `abbrev` per book in its output. The abbreviations come from the current `refs.js` BOOKS map:

- `quad.py`: OT, NT, BOM, D&C, PGP books
- `kjv_vpl.py`: Apocrypha books
- `quran.py`: single book
- `fourbooks.py`, `ttc.py`, `kojiki.py`, `bundahis.py`: their respective books
- Lotus Sutra parser (whichever handles it)

## Text Format

No changes. The text format doesn't store chapter IDs — they're derived from `BOOK:` headers and sequential counting. It already works the way the new JSON format will.

## URL Routing & localStorage

No changes. URLs still use `#workId/chapterId`, history stores `{ workId, chapterId }`. The IDs themselves don't change, just how they're derived.

## What's Removed

- `refs.js` (entire file)
- `verses` count from manifest chapter entries
- `id` field from manifest chapter entries
- `name` field from chapter JSON files
- `bookmarkScope` variable from `main.js`
- Chapter arrays from manifests (replaced by integer counts)

## What's Added

- `abbrev` field per book in manifests
- `start` field per book in manifests (where non-1)
- `names` array per book in manifests (where chapters have names)
- `bookMap` lookup in `chapters.js`
- `chapterIdAt()` helper in `chapters.js`
