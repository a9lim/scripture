# Scripture

A dependency-free browser reader for sixteen sacred works. It combines
chapter and verse navigation with full-text search, exact-word concordance,
TF-IDF related passages, verse-linked notes and bookmarks, text-to-speech,
reading history, plaintext downloads, and local data export/import.

**[Read Scripture](https://a9l.im/scripture/)**

## Corpus

The committed corpus currently contains 121 books, 2,724 chapter files, and
63,141 verse records. Counts below come from the manifests and chapter JSON,
not external estimates.

| Work | Edition / translator | Chapters | Verse records |
|------|----------------------|---------:|--------------:|
| Old Testament | King James text | 929 | 23,145 |
| Apocrypha | King James Version (1769 metadata) | 173 | 5,720 |
| New Testament | King James text | 260 | 7,957 |
| Quran | Marmaduke Pickthall (1930) | 114 | 6,236 |
| Book of Mormon | project PDF extraction | 239 | 6,604 |
| Doctrine and Covenants | 138 sections + 2 Official Declarations | 140 | 3,656 |
| Pearl of Great Price | five constituent books | 16 | 635 |
| The Four Books | James Legge (1861 metadata) | 50 | 1,984 |
| Kojiki | Basil Hall Chamberlain (1919) | 173 | 308 |
| Tao Te Ching | James Legge (1891) | 81 | 236 |
| Bundahishn | Edward William West (1897 metadata) | 34 | 597 |
| Lotus Sutra | Hendrik Kern | 27 | 1,265 |
| Book of Poetry | James Legge (1876) | 301 | 1,140 |
| Kalevala | John Martin Crawford (1888), including proem record | 51 | 1,393 |
| Poetic Edda | Henry Adams Bellows (1936 metadata) | 35 | 1,959 |
| Arda Viraf | Martin Haug & Edward William West (1872) | 101 | 306 |

“Verse record” is the application’s uniform storage unit. In poetry and prose
works it may represent a line or paragraph rather than a canonically numbered
scriptural verse.

## Features

- Full-text search across all works, filterable by work, book, and chapter
- Exact-word concordance with occurrence links back to individual records
- Top related chapters from a precomputed TF-IDF cosine-similarity index
- Markdown notes and bookmarks tied to chapter/verse references
- Sequential browser text-to-speech with active-record tracking
- Reading history, resume, progress, and previous/next chapter navigation
- Font, size, line-height, and reading-width controls
- JSON export/import for notes, bookmarks, display preferences, and history
- Permanent chapter and record links such as `/scripture/ot/gen-1:3`
- Generated plaintext downloads for every work

The reader stores personal state in browser `localStorage`. Production routing
and crawlable deep-route HTML come from the parent repository’s Cloudflare
Worker; the reader itself has no application database or account system.

## Data pipeline

Raw PDFs and scraped/plaintext inputs live in the gitignored `raw/` directory.
Canonical committed data lives in `data/`; the files in `text/` are generated
download artifacts, not an editing surface.

```bash
cd extract
./run.sh extract-raw   # parse raw inputs and rebuild works/search indexes
./run.sh verify        # validate manifests, chapter files, and known counts
./run.sh json2txt      # regenerate downloadable text files
./run.sh enrich        # rebuild concordance and TF-IDF similarity indexes
```

Use `./run.sh pipeline` to run those stages in dependency order. Similarity
generation requires scikit-learn; extraction dependencies are listed in
`extract/requirements.txt`.

## Running locally

Build from the parent repository root and serve `dist/` because Scripture imports shared assets by absolute URL:

```bash
cd path/to/a9lim.github.io
npm run build
python -m http.server --directory dist
# http://localhost:8000/scripture/
```

Use the parent `./dev.sh` instead when testing Worker routing, deep-route SSR,
security headers, or production CSP behavior.

## Licensing

Application source is [AGPL-3.0](LICENSE). The structured text downloads and
their arrangement are [CC BY-SA 4.0](text/LICENSE); the underlying historic
source texts are treated as public-domain inputs. Keep those layers distinct
in metadata and redistribution notices.
