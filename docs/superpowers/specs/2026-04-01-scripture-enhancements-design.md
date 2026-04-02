# Scripture Reader Enhancements

Improve the reading experience, add scholarly tools, and light discovery features to the scripture reader. All new features use shared design system components. No manual curation — everything automatable.

## Scope

### 1. Verse Action Popover

Replace the current "click verse number → open note" with a compact icon-only popover.

**Icons (left to right):**
- Note (pen icon, accent color) — opens sidebar with textarea for that verse (preserves current behavior)
- Bookmark (bookmark icon, gold) — toggles bookmark; highlights verse in reading pane, adds to bookmarks list
- Copy (copy icon, green) — copies `"verse text — Ref"` to clipboard, shows toast
- Link (link icon, blue) — copies deep link URL (`#workId/chapterId:verse`) to clipboard, shows toast

**Behavior:**
- Popover appears on verse-number click, positioned near the verse number
- Stays open while cursor is over the popover or the verse number (persistent on hover)
- Dismisses on: mouse-leave (with ~150ms grace period), click outside, or Escape
- Each icon button shows a tooltip label on hover via `createSimTooltip` from shared-tooltip.js
- Mobile: opens on tap, stays open until tap-outside; long-press on individual icons shows tooltip
- Bookmark icon fills solid when active (stroke → fill); bookmarked verses show a small gold dot on the verse number
- Bookmarked verses get a subtle background highlight (`color-mix(in srgb, var(--accent) 10%, transparent)`)
- `_haptics.trigger('selection')` on bookmark toggle

**Implementation:**
- New module `src/popover.js` — exports `initPopover($, callbacks)` where callbacks include `{ onNote, onBookmark, onCopy, onLink }`
- Popover built as a single reusable DOM element, repositioned on each open (like `createSimTooltip` pattern)
- Click handler delegated on `#verses` container, targeting `.verse-num` elements
- Replaces the current direct `openNote()` call in `main.js` verse-click delegation

### 2. Bookmarks + Sidebar Tabs

Extend the notes sidebar with a tab bar for Notes and Bookmarks.

**Tab bar:**
- Two tabs: Notes, Bookmarks
- Uses shared-tabs.js for automatic ARIA roving tabindex
- Tab bar replaces the current "Notes" h2 header
- Active tab underline uses the existing shared-tabs pattern

**Notes tab (unchanged):**
- Shows notes for the current chapter only
- Existing note card UI preserved exactly

**Bookmarks tab:**
- Scope toggle (mode group via `_forms.bindModeGroup`): "This chapter" (default) / "All"
- Each bookmark row: filled bookmark icon, verse text preview (2-line clamp), formatted ref (monospace), clickable to navigate
- "This chapter" shows bookmarks for current chapter sorted by verse number
- "All" shows all bookmarks grouped by work title (alphabetical), then sorted by chapter/verse order within each work
- Empty state: "No bookmarks yet. Click a verse number to bookmark."

**Storage:**
- Unified localStorage key `scripture-user`: `{ notes: { "workId:chapterId:verseNum": "text" }, bookmarks: ["workId:chapterId:verseNum", ...] }`
- Migration on first load: if `scripture-notes` key exists, read it into `scripture-user.notes` and delete old key
- Bookmark entries store the full ref string; verse text looked up on demand from chapter data or search index

**Implementation:**
- Refactor `src/notes.js` → handles both notes and bookmarks
- Add tab markup to `#notes-sidebar` in `index.html` (two `.tab-btn` elements, two `.tab-panel` elements)
- `renderNotes()` and `renderBookmarks()` called on tab switch and on navigation
- `toggleBookmark(workId, chapterId, verseNum)` exported for use by the popover

### 3. Display Settings

Toolbar dropdown for reading display preferences.

**Controls:**
- Font size — slider via `_forms.bindSlider`, 14px–24px, default 18px
- Line height — slider, 1.4–2.4, default 2.0
- Column width — slider, 500px–900px, default 800px
- Font — 3-way mode group via `_forms.bindModeGroup`: Serif (Crimson Pro) / Sans (`--font-body`) / Dyslexic (OpenDyslexic)

**Behavior:**
- Gear icon button in toolbar (right side, immediately right of theme toggle)
- Click opens a small glass dropdown panel, positioned below the button
- Dismiss on outside click or Escape
- All settings applied via CSS custom properties on `#reading-pane`: `--reader-font-size`, `--reader-line-height`, `--reader-max-width`, `--reader-font-family`
- Persisted to `scripture-display` localStorage key
- OpenDyslexic loaded on demand — add `<link>` to Google Fonts stylesheet only when Dyslexic mode is selected (remove when deselected)

**Implementation:**
- New module `src/display.js` — exports `initDisplay($)`
- Dropdown markup built in JS (like `initAboutPanel` pattern), not in index.html
- Slider display labels show current values (e.g., "18px", "2.0", "800px")

### 4. Reading History & Progress

Track reading position and show progress within books.

**Auto-save:**
- On every `navigate()` call, save `{ workId, chapterId, ts }` to history
- Keep last 10 entries (deduplicated by workId+chapterId, most recent wins)
- Stored in `scripture-history` localStorage key: `{ recent: [{ workId, chapterId, ts }] }`

**Default route:**
- When no hash is present, navigate to the most recent history entry instead of hardcoded `#bom/1-ne-1`
- If no history exists, fall back to `#bom/1-ne-1`

**Resume dropdown:**
- Toolbar button (eye/resume icon), positioned right of search button
- Click opens a glass dropdown showing recent reading positions
- Each row: formatted ref (monospace, accent color), verse text preview (truncated), clickable to navigate
- Dismiss on outside click, Escape, or selection

**Progress bar:**
- Thin accent-colored bar in the `#chapter-nav` footer, between prev/next buttons
- Shows position within the current book: filled width = chapterIndex / totalChapters
- Label below bar: "BookName — N of M"
- For single-chapter books, bar is full and label shows just the book name

**Implementation:**
- New module `src/history.js` — exports `initHistory($, navigateFn)`, `savePosition(workId, chapterId)`, `getLastPosition()`, `renderProgress($, workId, chapterId)`
- Progress bar markup added to `#chapter-nav` in `index.html` (a container div between prev/next)
- `renderProgress()` called on every navigation alongside `renderChapter()`

### 5. Concordance

Word frequency index with click-to-explore interaction.

**Build-time script (`extract/concordance.py`):**
- Scan all chapter JSONs across all works
- Tokenize each verse: lowercase, strip punctuation, split on whitespace
- Filter out English stopwords (~200 common words)
- Output `data/concordance.json`: `{ "word": ["workId:chapterId:verseNum", ...] }` — refs only, no preview text
- Refs sorted by canonical work order (matching `works.json`)
- Script is idempotent — safe to re-run after adding works

**Frontend — word click popover:**
- Verses rendered with each word wrapped in `<span class="word">` (done in `reader.js`)
- Click a word → small popover appears showing:
  - The word in bold
  - Occurrence count across all works
  - First 5 results with formatted ref and verse preview (looked up from search index)
  - "See all N occurrences" link if more than 5
- Popover dismisses on outside click, Escape, or clicking another word
- Mobile: tap to open, tap-outside to dismiss

**Frontend — full concordance overlay:**
- "See all" link (or manual lookup) opens a full overlay (same glass panel pattern as search)
- Text input at top for manual word search
- Results grouped by work, sorted by canonical work order
- Each result row: formatted ref, verse text with the word `<mark>`-highlighted
- Lazy-loads `concordance.json` on first use

**Implementation:**
- New module `src/concordance.js` — exports `initConcordance($)`
- Word wrapping added to `renderChapter()` in `reader.js`
- Concordance overlay markup in `index.html` (hidden by default, same pattern as search overlay)
- Popover is a single reusable DOM element (like verse action popover)

### 6. Random Verse

Quick discovery via random verse navigation.

**Toolbar button:**
- Dice icon, positioned left of download button in toolbar right
- Click: pick random entry from search index, navigate to that verse with highlight
- Shift-click or long-press: open a small dropdown to filter by work first, then pick random within that work
- Keyboard shortcut: `r` (registered via `initShortcuts`)

**Implementation:**
- Logic lives in `main.js` (simple enough — no separate module needed)
- Uses `loadSearchIndex()` from `chapters.js` (lazy-loaded on first use)
- Random selection: `Math.floor(Math.random() * index.length)`
- Work-filtered: filter index by `_workId` field (set during search preprocessing), then random from filtered set
- Filter dropdown built in JS, positioned below button, lists all works from `works.json`

### 7. Related Passages

Automated textual similarity per chapter, shown below chapter content.

**Build-time script (`extract/similarity.py`):**
- Load all chapter JSONs, concatenate verse text per chapter
- Build TF-IDF matrix (scikit-learn `TfidfVectorizer` with English stopwords)
- Compute pairwise cosine similarity
- For each chapter, select top 5 most similar chapters (excluding same-book chapters to prioritize cross-work discovery)
- Output `data/similarity.json`: `{ "chapterId": [{ "ref": "workId:chapterId", "score": 0.83 }] }`
- Minimum similarity threshold: 0.1 (skip chapters with no meaningful matches)
- Script is idempotent

**Frontend:**
- "Related Passages" button below the verses, before the `#chapter-nav` footer
- Collapsed by default; click to expand/collapse (toggle with slide animation)
- Expanded view: results grouped by work title (alphabetical), each row shows chapter title and similarity score as subtle opacity
- Clicking a row navigates to that chapter
- Graceful no-op if no similarity data exists for the chapter (button hidden)
- Lazy-loads `similarity.json` on first expand

**Implementation:**
- New module `src/related.js` — exports `renderRelated($, workId, chapterId)`
- Button + collapsible container added to `index.html` between `#verses` and `#chapter-nav`
- `renderRelated()` called on every navigation (hides button if no data)

### 8. Data Pipeline Updates

New scripts and `run.sh` subcommands.

**New scripts:**
- `extract/concordance.py` — generates `data/concordance.json`
- `extract/similarity.py` — generates `data/similarity.json` (requires `scikit-learn`)

**run.sh updates:**
- `concordance` subcommand: runs `concordance.py`
- `similarity` subcommand: runs `similarity.py`
- `enrich` subcommand: runs both concordance and similarity
- Update `extract-raw` and `txt2json` flows to call `enrich` after `reindex`

**Pipeline order:** text → JSON → search index → concordance → similarity

---

## Toolbar Layout

**Left:** Home logo | "Scripture" | separator | Work select | Book select | Chapter select

**Right:** Random (dice) | Download (arrow-down) | Search (magnifier) | Resume (eye) | separator | Theme (sun/moon) | Display (gear) | About (?) | Notes toggle (lines)

---

## New Files

| File | Type | Purpose |
|------|------|---------|
| `src/popover.js` | ES6 module | Verse action popover |
| `src/display.js` | ES6 module | Display settings dropdown |
| `src/history.js` | ES6 module | Reading history, resume, progress bar |
| `src/concordance.js` | ES6 module | Concordance popover + overlay |
| `src/related.js` | ES6 module | Related passages section |
| `extract/concordance.py` | Python script | Build concordance index |
| `extract/similarity.py` | Python script | Build similarity index |

## Modified Files

| File | Changes |
|------|---------|
| `index.html` | Sidebar tab markup, concordance overlay, progress bar container, related passages container, new toolbar buttons (random, resume, display), display settings dropdown anchor |
| `main.js` | Import new modules, wire popover callbacks, wire random verse, wire resume, call `savePosition`/`renderProgress`/`renderRelated` on navigate, update default route logic, register new keyboard shortcuts (`r`) |
| `src/reader.js` | Wrap verse words in `<span class="word">`, apply bookmark highlights on render |
| `src/notes.js` | Refactor to support tabs (notes + bookmarks), unified storage with migration, export `toggleBookmark` |
| `src/nav.js` | No changes expected |
| `src/search.js` | No changes expected |
| `src/refs.js` | No changes expected |
| `src/chapters.js` | No changes expected (search index already lazy-loaded) |
| `styles.css` | Popover styles, display settings dropdown, bookmark indicators, concordance overlay, word hover states, progress bar, related passages section, tab styles for sidebar |
| `extract/run.sh` | Add `concordance`, `similarity`, `enrich` subcommands |

## localStorage Keys

| Key | Format | Purpose |
|-----|--------|---------|
| `scripture-user` | `{ notes: { ref: text }, bookmarks: [ref] }` | User annotations (migrates from `scripture-notes`) |
| `scripture-display` | `{ fontSize, lineHeight, maxWidth, font }` | Display preferences |
| `scripture-history` | `{ recent: [{ workId, chapterId, ts }] }` | Reading history (max 10) |

## Dependencies

- **scikit-learn** — required by `similarity.py` for TF-IDF + cosine similarity. Install via `pip install scikit-learn`.
- **OpenDyslexic** — Google Fonts, loaded on demand via dynamic `<link>` element. No build-time dependency.
- All frontend code remains zero-dependency vanilla ES6.
