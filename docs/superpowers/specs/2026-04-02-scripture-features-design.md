# Scripture Reader — Feature Enhancement Design

**Date:** 2026-04-02
**Approach:** Progressive Depth — independent features with optional future project wrapper
**Audience:** Serious students (primary), casual readers (accommodated)

---

## 1. Bookmark Verse Highlighting

Bookmarked verses receive a yellow background tint on the verse text, not just an indicator on the verse number.

**Rendering:** When `reader.js` renders verses, check if the verse ref exists in the bookmarks array. If so, apply a CSS class (e.g., `.verse-bookmarked`) that sets a subtle yellow background via a dedicated `--bookmark-bg` CSS custom property (a semi-transparent yellow that works in both light and dark themes). The existing bookmark indicator on the verse number remains.

**No data model changes.** Uses the existing `bookmarks: [ref]` array in `scripture-user`.

---

## 2. Rich Notes (Markdown)

Upgrade the note textarea to support basic inline markdown.

**Supported syntax:**
- `**bold**` and `*italic*`
- Verse references as auto-links: text matching the `workId:chapterId:verse` pattern (e.g., `ot:gen-1:26`) renders as a clickable link that navigates to that verse

**Behavior:**
- When the note textarea is focused: raw markdown is shown, user edits directly
- When the note textarea is blurred: content renders as HTML (bold, italic, clickable verse links)
- Rendering is a simple regex pass, not a full markdown parser — only the two features above

**No data model changes.** Notes remain plain strings in `scripture-user.notes`. The markdown is rendered on display, not stored as HTML.

---

## 3. Enhanced Notes Sidebar

### 3a. Scope Toggle

Replace the current bookmark scope buttons ("This chapter" / "All") with a shared toggle from `_forms` (the same toggle component used elsewhere in the design system). Add an identical toggle to the Notes tab. Both tabs now have chapter/global views.

### 3b. Global Notes View

When the Notes tab toggle is set to "All":
- Notes are grouped by work, then by chapter within each work (same grouping pattern as the "All bookmarks" view)
- Each note row shows: formatted verse reference, truncated note preview (max 2 lines), clickable to navigate

### 3c. Notes Search/Filter

A search input at the top of the Notes tab (visible in both chapter and global scope):
- Filters notes by matching against both the note text content and the formatted verse reference
- Debounced input (250ms, same as search overlay)
- Empty state when no notes match the filter

---

## 4. Split-Pane Parallel Reading

### 4a. Entry Point

A "Compare" button in the toolbar. Clicking it opens a second reading pane. The button toggles — clicking again closes the secondary pane and returns to single-pane.

### 4b. Layout

`#app-layout` splits horizontally into two flex children, each containing an independent reader:
- Each pane has compact inline work/book/chapter dropdowns at the top
- Each pane scrolls independently
- The notes sidebar, if open, sits to the right of all panes
- A vertical divider separates the panes (background color differentiation, no border — per design system)

### 4c. Pane Behavior

- Each pane navigates independently (prev/next, dropdown selection)
- Verse actions (bookmark, note, copy, link) work from either pane, writing to the same shared `scripture-user` data
- The primary (left) pane is the "main" reader — its chapter drives reading history updates
- TTS, if active, reads from whichever pane it was started in

### 4d. URL Routing

- Split-pane URL: `#workId/chapterId+workId/chapterId` (e.g., `#ot/gen-1+bom/1-ne-5`)
- Optional verse anchors: `#ot/gen-1:3+bom/1-ne-5:12`
- Single-pane URLs remain unchanged
- Deep-linking a split URL opens both panes

### 4e. Mobile

Split-pane is disabled on viewports <= 900px. The compare button is hidden.

### 4f. No Persistence

Split-pane is a view mode. Closing the tab or navigating away returns to single-pane on next visit.

---

## 5. Text-to-Speech

### 5a. Entry Point

A play button in the toolbar (speaker icon). Clicking it begins reading the current chapter aloud.

### 5b. API

Uses the browser's built-in `SpeechSynthesis` API. No external dependencies or audio files.

### 5c. Controls

When TTS is active, a small control bar appears (below toolbar or inline):
- Play/pause toggle
- Stop (resets to beginning)
- Speed slider (0.5x–2x, default 1x)
- Voice selection dropdown (populated from `speechSynthesis.getVoices()`)

### 5d. Visual Tracking

The currently-spoken verse receives a highlight (distinct from bookmark highlight — e.g., a subtle outline or different background tint). The reading pane auto-scrolls to keep the active verse in view. Uses `SpeechSynthesisUtterance` boundary events to track position.

### 5e. Scope

- Reads verse text only — skips section headings and intro text
- Reads sequentially from current verse (or chapter start) through end of chapter
- "Read aloud" action in verse popover starts TTS from that specific verse

### 5f. Limitations

`SpeechSynthesis` quality varies by browser/OS. Archaic English and transliterated names may sound awkward. This is acceptable — convenience feature, not audiobook quality.

### 5g. Persistence

TTS settings (speed, voice) optionally saved to `scripture-display` for convenience. Not required for v1.

---

## 6. Export/Import

### 6a. Location

Two buttons in the about panel (or a "Data" section in display settings): Save (export) and Load (import). Icons reuse geon's existing SVGs:

**Save icon (floppy disk):**
```html
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
</svg>
```

**Load icon (download arrow):**
```html
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
</svg>
```

### 6b. Export

Downloads a JSON file containing:
- `scripture-user` (notes, bookmarks)
- `scripture-display` (font, size, spacing, width)
- `scripture-history` (recent reading positions)

Filename: `scripture-backup-YYYY-MM-DD.json`

### 6c. Import

File input accepts `.json`. On file selection:
1. Parse and validate structure
2. Default: **merge** — new notes/bookmarks are added, conflicts (same ref) are overwritten by the import
3. Option: **Replace all** — confirmation dialog ("This will replace all your notes, bookmarks, and settings. Continue?"), then wipes and loads wholesale
4. Toast notification on completion: "Imported 12 notes, 8 bookmarks" (or similar counts)

---

## Architecture Notes

**Module boundaries:**
- Bookmark highlighting: change in `reader.js` only (rendering logic)
- Rich notes: change in `notes.js` only (display/edit toggle, markdown→HTML render function)
- Enhanced notes sidebar: changes in `notes.js` (toggle, global view, search) + minor HTML additions
- Split-pane: new module `src/split.js` + changes to `main.js` (routing), `nav.js` (per-pane dropdowns), `reader.js` (multi-pane rendering)
- TTS: new module `src/tts.js` + toolbar button in HTML + verse popover action in `popover.js`
- Export/import: new module `src/data-io.js` + buttons in about panel HTML

**No changes to data pipeline.** All features are frontend-only.

**No new dependencies.** SpeechSynthesis and markdown rendering are vanilla JS.

**localStorage schema evolution:** Only addition is potential TTS settings in `scripture-display`. All other features use existing data structures with rendering-only changes.
