# Scripture

Static scripture reader for sacred texts from eleven traditions. Full-text search, verse-linked notes, chapter navigation, and text download. Zero dependencies, vanilla ES6 modules.

**Live:** [a9l.im/scripture](https://a9l.im/scripture)

## Works

| Work | Translation | Source |
|------|------------|--------|
| Old Testament (KJV) | King James Version | [churchofjesuschrist.org](https://www.churchofjesuschrist.org) |
| New Testament (KJV) | King James Version | [churchofjesuschrist.org](https://www.churchofjesuschrist.org) |
| Apocrypha (KJV) | King James Version | [Project Gutenberg](https://www.gutenberg.org) |
| Book of Mormon | — | [churchofjesuschrist.org](https://www.churchofjesuschrist.org) |
| Doctrine & Covenants | — | [churchofjesuschrist.org](https://www.churchofjesuschrist.org) |
| Pearl of Great Price | — | [churchofjesuschrist.org](https://www.churchofjesuschrist.org) |
| Quran | Pickthall | [sacred-texts.com](https://sacred-texts.com) |
| Four Books | Legge | [sacred-texts.com](https://sacred-texts.com) |
| Tao Te Ching | Legge | [sacred-texts.com](https://sacred-texts.com) |
| Kojiki | Chamberlain | [sacred-texts.com](https://sacred-texts.com) |
| Bundahis | West | [sacred-texts.com](https://sacred-texts.com) |

## Running Locally

Serve from the repo root (shared files load via absolute paths):

```bash
cd path/to/a9lim.github.io && python -m http.server
```

## Project Structure

```
main.js                 Entry point, DOM cache, hash routing
src/
  chapters.js           Data layer: manifest/chapter caching, parseRef
  refs.js               Book ID registry (BOOKS map), formatRef()
  nav.js                Toolbar dropdowns: work/book/chapter selects
  reader.js             Verse rendering, section headers, highlighting
  notes.js              Verse-linked notes (localStorage)
  search.js             Full-text search overlay with lazy index loading
data/
  works.json            Work ID list
  search-index.json     Pre-built search index
  {workId}/
    manifest.json       Books, chapters, verse counts
    chapters/*.json     Chapter content (sections → verses)
text/
  {workId}.txt          Human-editable plaintext source per work
extract/
  txt_to_json.py        Text → JSON + data pipeline
  json_to_txt.py        JSON → text (round-trip)
  search_index.py       Rebuild search index
  verify_data.py        Validate verse counts
  extract.py            Raw source → JSON (PDF/plaintext parsers)
  run.sh                All-in-one helper script
```

## Editing Text

Edit the plaintext source, then regenerate JSON and the search index:

```bash
# edit text/{workId}.txt, then:
cd extract
python3 txt_to_json.py ../text/{workId}.txt --output ../data
python3 search_index.py ../data
```

Or use the helper script:

```bash
cd extract && ./run.sh txt2json
```

## Text Format

```
WORK: id | Title
BOOK: id | Name
CHAPTER: id [| name]
@ N                     (set verse numbering to N)
verse text
~                       (section break, numbering continues)
~ @                     (section break, reset numbering to 1)
~ @ N                   (section break, start numbering at N)
```

## URL Routing

Hash-based: `#workId/chapterId` with optional `:verseNum` for deep-linking.

Examples: `#bom/1-ne-1`, `#ot/gen-1:3`, `#quran/quran-19`

## License

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html)
