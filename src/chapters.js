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

let searchIndex   = null;          // array, loaded once
let workIds       = null;          // string[], loaded once

/* ── helpers ─────────────────────────────────────────────────────── */

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return res.json();
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
  manifests.forEach(m => manifestCache.set(m.id, m));
}

/** Array of work ID strings (e.g. ["bom","dc","ot","nt","quran","apoc"]). */
export function getWorkIds() {
  return workIds || [];
}

/** Cached manifest for a single work, or null. */
export function getManifest(workId) {
  return manifestCache.get(workId) ?? null;
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
  const manifest = manifestCache.get(workId);
  if (manifest) {
    chapter.workTitle = manifest.title;
    chapter.bookCount = manifest.books.length;
    const bookId = findBookForChapter(workId, chapterId);
    if (bookId) {
      const book = manifest.books.find(b => b.id === bookId);
      if (book) {
        chapter.bookName = book.name;
        if (book.chapters.length === 1) chapter.singleChapter = true;
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
 *
 * @param  {string} workId
 * @param  {string} chapterId  e.g. "gen-3"
 * @return {{ prev: object|null, next: object|null }}
 */
export function getAdjacentChapters(workId, chapterId) {
  const manifest = manifestCache.get(workId);
  if (!manifest) return { prev: null, next: null };

  if (!flatChapterCache.has(workId)) {
    const flat = [];
    for (const book of manifest.books) {
      for (const ch of book.chapters) {
        flat.push({ id: ch.id, bookId: book.id, bookName: book.name });
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
 * Find the bookId that owns a chapterId within a work manifest.
 */
export function findBookForChapter(workId, chapterId) {
  const m = manifestCache.get(workId);
  if (!m) return null;
  for (const book of m.books) {
    if (book.chapters.some(ch => ch.id === chapterId)) return book.id;
  }
  return m.books[0]?.id ?? null;
}

/**
 * Extract the trailing chapter number from a chapter ID.
 * e.g. "gen-1" → "1", "1-ne-3" → "3"
 */
export function chapterNum(chapterId) {
  const m = chapterId.match(/\d+$/);
  return m ? m[0] : chapterId;
}
