# Scripture

A static scripture reader for sixteen sacred texts. It has full-text search, concordance, verse-linked notes and bookmarks, split-pane parallel reading, text-to-speech, related passages, reading history, and text download. Vanilla ES6 modules with no dependencies.

**Try it:** [a9l.im/scripture](https://a9l.im/scripture)

## Included Texts

| Work | Translation | Source |
|------|------------|--------|
| Old Testament | King James Version | [churchofjesuschrist.org](https://www.churchofjesuschrist.org) |
| New Testament | King James Version | [churchofjesuschrist.org](https://www.churchofjesuschrist.org) |
| Apocrypha | King James Version | [Project Gutenberg](https://www.gutenberg.org) |
| Book of Mormon | | [churchofjesuschrist.org](https://www.churchofjesuschrist.org) |
| Doctrine and Covenants | | [churchofjesuschrist.org](https://www.churchofjesuschrist.org) |
| Pearl of Great Price | | [churchofjesuschrist.org](https://www.churchofjesuschrist.org) |
| Quran | Pickthall | [sacred-texts.com](https://sacred-texts.com) |
| Four Books | Legge | [sacred-texts.com](https://sacred-texts.com) |
| Tao Te Ching | Legge | [sacred-texts.com](https://sacred-texts.com) |
| Kojiki | Chamberlain | [sacred-texts.com](https://sacred-texts.com) |
| Bundahis | West | [sacred-texts.com](https://sacred-texts.com) |
| Lotus Sutra | Kern | [sacred-texts.com](https://sacred-texts.com) |
| Arda Viraf | Haug & West | [sacred-texts.com](https://sacred-texts.com) |
| Book of Poetry | Legge | [sacred-texts.com](https://sacred-texts.com) |
| Kalevala | Crawford | [sacred-texts.com](https://sacred-texts.com) |
| Poetic Edda | Bellows | [sacred-texts.com](https://sacred-texts.com) |

## Features

- **Search**: full-text search across all works with grouped results
- **Concordance**: click any word to see every occurrence across all texts
- **Notes and bookmarks**: verse-linked markdown notes stored in the browser
- **Split pane**: read two passages side by side
- **Text-to-speech**: read aloud with verse tracking
- **Related passages**: TF-IDF similarity suggestions for each chapter
- **Reading history**: resume where you left off
- **Display settings**: font, size, spacing, and width controls
- **Data export and import**: back up notes, bookmarks, and settings as JSON
- **Deep linking**: share links to any chapter and verse (e.g. `/scripture/ot/gen-1:3`)
- **Text download**: download any work as plaintext

## Running Locally

Serve from the repo root (shared files load via absolute paths):

```bash
cd path/to/a9lim.github.io && python -m http.server
```

## License

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html)
