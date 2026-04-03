/* ===================================================================
   chapters.js — data layer for scripture manifests, chapters, and
   search index.  All fetches are cached; call loadManifests() once
   at startup to prime the manifest cache.
   =================================================================== */

const DATA_BASE = 'data';

/* ── caches ──────────────────────────────────────────────────────── */
const manifestCache = new Map();      // workId  -> manifest object
const chapterCache  = new Map();      // "workId/chapterId" -> chapter object
const flatChapterCache = new Map();   // workId -> [{ id, bookId, bookName }]
const bookMap = new Map();            // bookId -> { workId, abbrev, name }

let searchIndex   = null;          // array, loaded once
let workIds       = null;          // string[], loaded once

/* ── helpers ─────────────────────────────────────────────────────── */

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return res.json();
}

/**
 * Derive chapter ID from book ID and 0-based index.
 * e.g. chapterIdAt("gen", 0) → "gen-1"
 *      chapterIdAt("kjk", 0, 0) → "kjk-0"
 */
export function chapterIdAt(bookId, index, start) {
  return `${bookId}-${(start ?? 1) + index}`;
}

/* ── public API ──────────────────────────────────────────────────── */

/**
 * Fetch works.json, then all manifests in parallel.  Safe to call
 * multiple times — returns immediately if already loaded.
 */
export async function loadManifests() {
  if (workIds) return;
  workIds = await fetchJSON(`${DATA_BASE}/works.json`);
  const manifests = await Promise.all(
    workIds.map(id => fetchJSON(`${DATA_BASE}/${id}/manifest.json`))
  );
  manifests.forEach(m => {
    manifestCache.set(m.id, m);
    for (const book of m.books) {
      bookMap.set(book.id, { workId: m.id, abbrev: book.abbrev, name: book.name });
    }
  });
}

/** Array of work ID strings. */
export function getWorkIds() {
  return workIds || [];
}

/** Cached manifest for a single work, or null. */
export function getManifest(workId) {
  return manifestCache.get(workId) ?? null;
}

/** Book info from bookMap: { workId, abbrev, name } or null. */
export function getBookInfo(bookId) {
  return bookMap.get(bookId) ?? null;
}

/**
 * Fetch and cache a single chapter.
 * @param {string} workId     e.g. "ot"
 * @param {string} chapterId  e.g. "gen-1"
 */
export async function loadChapter(workId, chapterId) {
  const key = `${workId}/${chapterId}`;
  if (chapterCache.has(key)) return chapterCache.get(key);
  const chapter = await fetchJSON(
    `${DATA_BASE}/${workId}/chapters/${chapterId}.json`
  );
  // Attach context from the manifest for title construction
  chapter.chapter = chapterNum(chapterId);
  const manifest = manifestCache.get(workId);
  if (manifest) {
    chapter.workTitle = manifest.title;
    chapter.bookCount = manifest.books.length;
    const bookId = findBookForChapter(workId, chapterId);
    if (bookId) {
      const book = manifest.books.find(b => b.id === bookId);
      if (book) {
        chapter.bookName = book.name;
        if (book.chapters === 1) chapter.singleChapter = true;
        // Attach chapter name from manifest names array
        const start = book.start ?? 1;
        const num = parseInt(chapterNum(chapterId), 10);
        const idx = num - start;
        if (book.names && book.names[idx]) {
          chapter.name = book.names[idx];
        }
      }
    }
  }
  chapterCache.set(key, chapter);
  return chapter;
}

/**
 * Fetch the global search index (once).
 */
export async function loadSearchIndex() {
  if (searchIndex) return searchIndex;
  searchIndex = await fetchJSON(`${DATA_BASE}/search-index.json`);
  return searchIndex;
}

/**
 * Parse a canonical reference string.
 * Format: "workId:chapterId:verse"
 *
 * @param  {string} ref  e.g. "quran:quran-1:3"
 * @return {{ workId: string, chapterId: string, verse: number }}
 */
export function parseRef(ref) {
  const first = ref.indexOf(':');
  const last  = ref.lastIndexOf(':');
  return {
    workId:    ref.slice(0, first),
    chapterId: ref.slice(first + 1, last),
    verse:     Number(ref.slice(last + 1))
  };
}

/**
 * Return prev/next chapter entries relative to the given chapter,
 * flattening all books in the manifest into a single ordered list.
 *
 * Each returned entry is { id, bookId, bookName } or null.
 */
export function getAdjacentChapters(workId, chapterId) {
  const manifest = manifestCache.get(workId);
  if (!manifest) return { prev: null, next: null };

  if (!flatChapterCache.has(workId)) {
    const flat = [];
    for (const book of manifest.books) {
      const start = book.start ?? 1;
      for (let i = 0; i < book.chapters; i++) {
        flat.push({ id: chapterIdAt(book.id, i, start), bookId: book.id, bookName: book.name });
      }
    }
    flatChapterCache.set(workId, flat);
  }
  const flat = flatChapterCache.get(workId);

  const idx = flat.findIndex(e => e.id === chapterId);
  return {
    prev: idx > 0                ? flat[idx - 1] : null,
    next: idx < flat.length - 1  ? flat[idx + 1] : null
  };
}

/**
 * Find the bookId that owns a chapterId within a work.
 * Parses bookId from the chapter ID string (everything before trailing -N).
 */
export function findBookForChapter(workId, chapterId) {
  const i = chapterId.lastIndexOf('-');
  if (i > 0) {
    const bookId = chapterId.slice(0, i);
    if (bookMap.has(bookId)) return bookId;
  }
  // Fallback: first book in manifest
  const m = manifestCache.get(workId);
  return m?.books[0]?.id ?? null;
}

/**
 * Extract the trailing chapter number from a chapter ID.
 * e.g. "gen-1" → "1", "1-ne-3" → "3"
 */
export function chapterNum(chapterId) {
  const m = chapterId.match(/\d+$/);
  return m ? m[0] : chapterId;
}

/**
 * Format a chapter reference for display.
 * e.g. formatRef('gen-1', 26) → 'Gen. 1:26'
 */
export function formatRef(chapterId, verse) {
  const i = chapterId.lastIndexOf('-');
  if (i > 0) {
    const bookId = chapterId.slice(0, i);
    const chNum = chapterId.slice(i + 1);
    const info = bookMap.get(bookId);
    if (info) return `${info.abbrev} ${chNum}:${verse}`;
  }
  return `${chapterId}:${verse}`;
}
