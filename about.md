---
name: Scripture
title: Scripture — Sacred Text Reader
description: Read, search, annotate, compare, and listen to sixteen sacred works with chapter and verse deep links, concordance, and related passages.
updated: 2026-07-17
---

# Scripture — Sacred Text Reader

Scripture is a browser reader for sixteen sacred works spanning Abrahamic,
East Asian, Zoroastrian, Buddhist, Finnish, and Norse traditions. It provides
chapter navigation, permanent chapter/verse URLs, full-text search, an
exact-word concordance, TF-IDF related passages, verse-linked notes and
bookmarks, text-to-speech, reading history, and plaintext downloads.

The committed corpus contains 121 books, 2,724 chapter files, and 63,141 verse
records. “Verse record” is the reader’s common storage unit; in poetry and
prose works it can represent a line or paragraph rather than a canonically
numbered scriptural verse.

## Corpus inventory

These counts are derived from `data/works.json`, each work manifest, and the
committed chapter JSON.

| Work (`id`) | Edition / translator | Chapters | Verse records |
|-------------|----------------------|---------:|--------------:|
| Old Testament (`ot`) | King James text | 929 | 23,145 |
| Apocrypha (`apoc`) | King James Version (1769 metadata) | 173 | 5,720 |
| New Testament (`nt`) | King James text | 260 | 7,957 |
| Quran (`quran`) | Marmaduke Pickthall (1930) | 114 | 6,236 |
| Book of Mormon (`bom`) | project PDF extraction | 239 | 6,604 |
| Doctrine and Covenants (`dc`) | 138 sections + 2 Official Declarations | 140 | 3,656 |
| Pearl of Great Price (`pgp`) | five constituent books | 16 | 635 |
| The Four Books (`fourbooks`) | James Legge (1861 metadata) | 50 | 1,984 |
| Kojiki (`kj`) | Basil Hall Chamberlain (1919) | 173 | 308 |
| Tao Te Ching (`ttc`) | James Legge (1891) | 81 | 236 |
| Bundahishn (`bund`) | Edward William West (1897 metadata) | 34 | 597 |
| Lotus Sutra (`lotus`) | Hendrik Kern | 27 | 1,265 |
| Book of Poetry (`bop`) | James Legge (1876) | 301 | 1,140 |
| Kalevala (`kv`) | John Martin Crawford (1888), including proem record | 51 | 1,393 |
| Poetic Edda (`poe`) | Henry Adams Bellows (1936 metadata) | 35 | 1,959 |
| Arda Viraf (`viraf`) | Martin Haug & Edward William West (1872) | 101 | 306 |

## Search, concordance, and related passages

Full-text search loads a prebuilt global index and can filter results by work,
book, and chapter. Matching substrings are highlighted in their record text.

The concordance is a separate exact-word index. Clicking an indexed word in
the reading pane opens its occurrence count and linked references; the full
overlay groups every matching record by work. It does not use TF-IDF.

Related Passages uses a precomputed TF-IDF cosine-similarity index. It compares
chapter vocabulary after English stop-word removal, excludes the current
chapter and other chapters from the same book, and stores up to five matches
above the configured similarity threshold. This is a lexical discovery aid,
not a claim of historical, theological, or semantic equivalence.

## Notes, bookmarks, and listening

Click a verse number to add a markdown note, toggle a bookmark, copy text,
copy a permanent link, or start reading aloud. Notes and bookmarks can be
filtered in the sidebar. Browser SpeechSynthesis provides sequential
text-to-speech with active-record highlighting.

Notes, bookmarks, display preferences, and reading history live in browser
`localStorage`. JSON export/import supports backup, merge, and replacement.
The reader has no user account or application database. The parent hosting
Worker records aggregate page-view metadata, but the reader code does not send
personal notes, bookmarks, or reading history to it.

## Data and delivery

Chapter content is committed as static JSON and fetched on demand. Search,
concordance, and related-passage indexes are precomputed by the extraction
pipeline. Production deep routes are served through the parent Cloudflare
Worker, which injects crawlable work/chapter/verse HTML and route-specific
JSON-LD before the client application takes over.

Every chapter is addressable as `/scripture/{workId}/{chapterId}`. Append
`:{verse}` for a record-level link. Examples:

- Genesis 1: `/scripture/ot/gen-1`
- Genesis 1:26: `/scripture/ot/gen-1:26`
- Surah 19: `/scripture/quran/quran-19`
- 1 Nephi 3: `/scripture/bom/1-ne-3`
- Tao Te Ching 42: `/scripture/ttc/ttc-42`

## Accessibility

The reader has a skip-to-content link, keyboard-reachable controls,
previous/next chapter shortcuts, focus-trapped search and concordance dialogs,
ARIA labels, live regions for dynamic results, and light/dark themes. Verse
actions can be opened from the keyboard, and text-to-speech can be paused or
stopped. There is no flashing content.

## Licensing

The application source is AGPL-3.0. Generated text downloads and their
structured arrangement are licensed CC BY-SA 4.0; see `text/LICENSE`. The
underlying historic source texts are treated as public-domain inputs. The
structured corpus should therefore be described with its CC BY-SA license,
not the Public Domain Mark.
