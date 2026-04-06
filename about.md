# Scripture — Sacred Text Reader

Scripture is a browser-based reader for sixteen sacred texts from multiple religious traditions. It provides chapter-by-chapter navigation, full-text search, concordance analysis, and verse-linked notes.

## Works

The reader includes: King James Version Old Testament and New Testament, KJV Apocrypha, Quran (Pickthall translation), Book of Mormon, Doctrine and Covenants, Pearl of Great Price, the Four Books of Confucianism (Legge translation), Tao Te Ching (Legge), Kojiki (Chamberlain translation), Bundahishn (West translation), Lotus Sutra (Kern translation), Arda Viraf (Haug & West), Book of Poetry (Legge), Kalevala (Crawford translation), and the Poetic Edda (Bellows translation).

## Features

- **Full-text search** across all sixteen works with highlighted results and context snippets
- **Concordance** showing word frequency and distribution across works using TF-IDF for related passage discovery
- **Verse-linked notes** for personal annotation tied to specific verses
- **Text-to-speech** for listening to passages
- **Data export** for notes and search results
- **Deep linking** to any chapter via URL (e.g., `/scripture/ot/gen-1` for Genesis 1)

## Data

All text data is stored as static JSON files, loaded on demand per chapter. No server-side processing or database — the entire application runs client-side. Scripture data totals approximately 50 MB across all sixteen works.

## Educational Use

Designed for comparative religious studies. Students can read texts side by side, search for shared themes across traditions, and use the concordance to trace how specific terms are used differently in different canons.

## Works by Tradition

### Christian

| Work | Translator | Year | Approx. Chapters | Approx. Verses |
|------|-----------|------|-------------------|----------------|
| Old Testament (`ot`) | King James Version | 1611 | 929 | 23,145 |
| New Testament (`nt`) | King James Version | 1611 | 260 | 7,957 |
| Apocrypha (`apoc`) | King James Version | 1611 | 183 | 6,081 |

### Islamic

| Work | Translator | Year | Approx. Chapters | Approx. Verses |
|------|-----------|------|-------------------|----------------|
| Quran (`quran`) | Marmaduke Pickthall | 1930 | 114 | 6,236 |

### Latter-day Saint

| Work | Translator | Year | Approx. Chapters | Approx. Verses |
|------|-----------|------|-------------------|----------------|
| Book of Mormon (`bom`) | Joseph Smith | 1830 | 239 | 6,604 |
| Doctrine and Covenants (`dc`) | — | 1835 | 138 | 3,654 |
| Pearl of Great Price (`pgp`) | — | 1851 | 9 | 337 |

### Confucian

| Work | Translator | Year | Approx. Chapters | Approx. Verses |
|------|-----------|------|-------------------|----------------|
| The Four Books (`fourbooks`) | James Legge | 1893 | 58 | ~2,500 |
| Book of Poetry (`bop`) | James Legge | 1876 | 305 | ~3,000 |

### Taoist

| Work | Translator | Year | Approx. Chapters | Approx. Verses |
|------|-----------|------|-------------------|----------------|
| Tao Te Ching (`ttc`) | James Legge | 1891 | 81 | ~81 |

### Shinto / Japanese

| Work | Translator | Year | Approx. Chapters | Approx. Verses |
|------|-----------|------|-------------------|----------------|
| Kojiki (`kj`) | Basil Hall Chamberlain | 1919 | ~180 | ~1,500 |

### Zoroastrian

| Work | Translator | Year | Approx. Chapters | Approx. Verses |
|------|-----------|------|-------------------|----------------|
| Bundahishn (`bund`) | Edward William West | 1880 | 34 | ~700 |
| Arda Viraf (`viraf`) | Martin Haug & E.W. West | 1872 | 101 | ~400 |

### Buddhist

| Work | Translator | Year | Approx. Chapters | Approx. Verses |
|------|-----------|------|-------------------|----------------|
| Lotus Sutra (`lotus`) | Hendrik Kern | 1884 | 27 | ~1,200 |

### Finnish

| Work | Translator | Year | Approx. Chapters | Approx. Verses |
|------|-----------|------|-------------------|----------------|
| Kalevala (`kv`) | John Martin Crawford | 1888 | 50 | ~22,800 |

### Norse

| Work | Translator | Year | Approx. Chapters | Approx. Verses |
|------|-----------|------|-------------------|----------------|
| Poetic Edda (`poe`) | Henry Adams Bellows | 1923 | ~35 | ~2,500 |

## Deep Linking

Every chapter is addressable by URL. The pattern is `/scripture/{workId}/{chapterId}`. Append `:{verse}` to link directly to a specific verse.

**Example URLs:**

- Genesis 1: `/scripture/ot/gen-1`
- Genesis 1:26: `/scripture/ot/gen-1:26`
- Surah 19 (Maryam): `/scripture/quran/quran-19`
- 1 Nephi 3: `/scripture/bom/1-ne-3`
- Tao Te Ching 42: `/scripture/ttc/ttc-42`
- D&C 76: `/scripture/dc/dc-76`
- Kalevala Runo 1: `/scripture/kv/kv-1`
- Poetic Edda, Voluspa: `/scripture/poe/vol-1`
- Lotus Sutra Chapter 2: `/scripture/lotus/lotus-2`

## TF-IDF Concordance

The concordance uses TF-IDF (term frequency–inverse document frequency) to surface related passages across works. When you click a word in the reader, the concordance shows where that word appears with the highest relative frequency, not just the highest raw count. This means a word that appears ten times in a short chapter ranks higher than one that appears twenty times in a long chapter, and a word common to only a few works is weighted more heavily than one spread evenly across all sixteen.

The precomputed similarity index (`similarity.json`) stores the top related chapters for each chapter, enabling instant "Related Passages" suggestions without runtime computation.

## Accessibility

Scripture supports keyboard navigation throughout: Tab moves between controls, Enter activates verse actions, and arrow keys navigate chapters. The reading pane has a skip-to-content link. All overlays (search, concordance) are focus-trapped ARIA dialogs. Dynamic content regions use aria-live for screen reader announcements. High-contrast mode is available via the theme toggle. No flashing content or motion hazards.

## Public Domain Status

All sixteen texts are in the public domain. The King James Version (1611), the Legge translations (1876–1893), the Chamberlain Kojiki (1919), the West Bundahishn (1880), the Haug & West Arda Viraf (1872), the Kern Lotus Sutra (1884), the Crawford Kalevala (1888), the Bellows Poetic Edda (1923), the Pickthall Quran (1930), the Book of Mormon (1830), Doctrine and Covenants (1835), and Pearl of Great Price (1851) are all past copyright expiration in the United States and most jurisdictions worldwide.
