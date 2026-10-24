# Scripture

A browser reader for sixteen public-domain sacred works. Read chapter by
chapter, search everything at once, follow a word through the whole corpus,
and keep notes and bookmarks on individual verses.

By [a9lim](https://a9l.im). It used to live at a9l.im/scripture and is moving to its own domain.

## What's in it

The corpus is 121 books, 2,724 chapters, and 63,141 verse records. In poetry
and prose works a record can be a line or paragraph rather than a numbered
verse.

| Work | Edition / translator |
|------|----------------------|
| Old Testament, New Testament | King James text |
| Apocrypha | King James Version (1769) |
| Book of Mormon, Doctrine and Covenants, Pearl of Great Price | Latter-day Saint standard works |
| Quran | Marmaduke Pickthall (1930), with Arabic names and terms rendered as English, biblical, or coined Hebrew-style equivalents ([tables](docs/quran-arabic-phrases.md)) |
| The Four Books, Tao Te Ching, Book of Poetry | James Legge |
| Kojiki | Basil Hall Chamberlain |
| Bundahishn | Edward William West |
| Lotus Sutra | Hendrik Kern |
| Arda Viraf | Martin Haug and Edward William West |
| Kalevala | John Martin Crawford |
| Poetic Edda | Henry Adams Bellows |

- Work, book, and chapter pickers, previous/next chapter, and a permanent URL
  for every chapter and verse (`/ot/gen-1:26`)
- Full-text search across all works, filterable by work, book, and chapter
- An exact-word concordance: click a word to see its occurrences, or open the
  full list grouped by work
- Related passages: the closest chapters in other books by TF-IDF vocabulary
  similarity, a lexical aid rather than a claim of equivalence
- Markdown notes and bookmarks on any verse, filterable in the sidebar
- Read-aloud through the browser's speech synthesis, following the current verse
- Reading history with resume and a progress bar; random verse
- Display settings for font (serif, sans, OpenDyslexic), size, line height,
  and width
- JSON export and import of notes, bookmarks, settings, and history
- A plaintext download of each work

Notes, bookmarks, settings, and history stay in the browser's localStorage;
there is no account, and the reader sends none of it to a server.

## Controls

| Input | Action |
|-------|--------|
| Click a verse number | Note, bookmark, copy, copy link, read aloud from here |
| Click a word | Concordance |
| `/` | Search |
| `←` / `→` | Previous / next chapter |
| `r` | Random verse (shift-click or long-press the dice button to pick a work) |
| `?` | About and help |
| `Esc` | Close search, popovers, and dropdowns |

## Running locally

Node 22 or newer.

    npm install
    npm run dev        # build, then serve at http://localhost:8787

`npm run build` stages the deploy tree in `dist/`, and `npm run deploy` builds
and deploys it as a Cloudflare Worker with static assets. The public origin is
set once, in `site.config.mjs`.

## How it's built

Vanilla ES modules: `main.js` routes and wires the modules in `src/`, which
cover the data layer, rendering, search, concordance, notes, and speech. The
corpus is static JSON in `data/`, generated from source PDFs and plaintext by
the Python pipeline in `extract/` (`extract/run.sh pipeline`), along with the
search, concordance, and similarity indexes and the downloads in `text/`. A
Cloudflare Worker (`worker/`) serves every page and renders crawlable chapter
HTML and structured data before the client takes over. `shared/` is a copy of
a9l.im's design layer. [AGENTS.md](AGENTS.md) has the detailed map.

## License

Application source: [AGPL-3.0](LICENSE). The text downloads and the structured
arrangement of the corpus: [CC BY-SA 4.0](text/LICENSE); the underlying historic
source texts are treated as public domain.
