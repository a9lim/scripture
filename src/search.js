/* ===================================================================
   search.js — Full-text search overlay with debounced filtering.
   =================================================================== */

import { loadSearchIndex, parseRef, getManifest, getWorkIds, findBookForChapter, chapterNum, formatRef, chapterIdAt } from './chapters.js';
import { fillSelect } from './nav.js';

const MAX_RESULTS = 100;
const DEBOUNCE_MS = 250;

/**
 * Populate the work filter from loaded manifests.
 */
function populateWorkFilter($) {
  const items = getWorkIds().map(id => ({ id, manifest: getManifest(id) })).filter(x => x.manifest);
  fillSelect($.searchWork, items, x => x.id, x => x.manifest.title, 'All works');
  $.searchBook.replaceChildren();
  $.searchBook.style.display = 'none';
  $.searchChapter.replaceChildren();
  $.searchChapter.style.display = 'none';
}

/**
 * Populate the book filter for a given work.
 * For single-book works (e.g. Quran), skips book and shows chapters directly.
 */
function populateBookFilter($, workId) {
  if (!workId) {
    $.searchBook.replaceChildren();
    $.searchBook.style.display = 'none';
    $.searchChapter.replaceChildren();
    $.searchChapter.style.display = 'none';
    return;
  }
  const m = getManifest(workId);
  if (!m || m.books.length <= 1) {
    $.searchBook.replaceChildren();
    $.searchBook.style.display = 'none';
    // Single-book work — show chapters directly
    if (m && m.books.length === 1) {
      populateChapterFilter($, workId, m.books[0].id);
    } else {
      $.searchChapter.replaceChildren();
      $.searchChapter.style.display = 'none';
    }
  } else {
    fillSelect($.searchBook, m.books, b => b.id, b => b.name, 'All books');
    $.searchBook.style.display = '';
    $.searchChapter.replaceChildren();
    $.searchChapter.style.display = 'none';
  }
}

/**
 * Populate the chapter filter for a given book within a work.
 */
function populateChapterFilter($, workId, bookId) {
  if (!workId || !bookId) {
    $.searchChapter.replaceChildren();
    $.searchChapter.style.display = 'none';
    return;
  }
  const m = getManifest(workId);
  if (!m) return;
  const book = m.books.find(b => b.id === bookId);
  if (!book || book.chapters <= 1) {
    $.searchChapter.replaceChildren();
    $.searchChapter.style.display = 'none';
    return;
  }
  const start = book.start ?? 1;
  const items = Array.from({ length: book.chapters }, (_, i) => {
    const id = chapterIdAt(book.id, i, start);
    const num = start + i;
    const name = book.names?.[i];
    return { id, num, name };
  });
  fillSelect($.searchChapter, items, ch => ch.id,
    ch => ch.name ? `${ch.num} (${ch.name})` : String(ch.num), 'All chapters');
  $.searchChapter.style.display = '';
}

/**
 * Initialize search: wire button, overlay, input, filters.
 *
 * @param {object}   $           DOM cache
 * @param {Function} onNavigate  (workId, chapterId, verse) => void
 */
export function initSearch($, onNavigate) {
  let index = null;
  let trapCleanup = null;

  async function open() {
    $.searchOverlay.classList.remove('hidden');
    $.searchInput.value = '';
    clearResults();
    populateWorkFilter($);
    $.searchInput.focus();
    trapCleanup = trapFocus($.searchOverlay);
    if (!index) {
      try {
        index = await loadSearchIndex();
        for (const entry of index) {
          entry._lower = entry.text.toLowerCase();
          const parsed = parseRef(entry.ref);
          entry._workId = parsed.workId;
          entry._chapterId = parsed.chapterId;
        }
      } catch (e) {
        const p = document.createElement('p');
        p.className = 'empty-state';
        p.textContent = 'Failed to load search index.';
        $.searchResults.appendChild(p);
      }
    }
  }

  function close() {
    $.searchOverlay.classList.add('hidden');
    if (trapCleanup) {
      trapCleanup();
      trapCleanup = null;
    }
    $.searchBtn.focus();
  }

  function clearResults() {
    const el = $.searchResults;
    el.replaceChildren();
  }

  const doSearch = debounce(() => runSearch($, onNavigate, index), DEBOUNCE_MS);

  // Wire open/close
  $.searchBtn.addEventListener('click', open);
  $.searchClose.addEventListener('click', close);

  // initOverlayDismiss: click outside overlay-content closes
  initOverlayDismiss($.searchOverlay, $.searchClose, close);

  // Debounced search on input
  $.searchInput.addEventListener('input', doSearch);

  // Filter cascading
  $.searchWork.addEventListener('change', () => {
    populateBookFilter($, $.searchWork.value);
    doSearch();
  });
  $.searchBook.addEventListener('change', () => {
    populateChapterFilter($, $.searchWork.value, $.searchBook.value);
    doSearch();
  });
  $.searchChapter.addEventListener('change', doSearch);

  return { open, close };
}

/**
 * Run a search against the loaded index and render results.
 */
function runSearch($, onNavigate, index) {
  const container = $.searchResults;
  container.replaceChildren();

  const query = $.searchInput.value.trim().toLowerCase();
  if (!query || !index) return;

  const filterWork = $.searchWork.value;
  const filterBook = $.searchBook.value;
  const filterChapter = $.searchChapter.value;

  // Build set of chapter IDs for book filter
  let bookChapterIds = null;
  if (filterWork && filterBook) {
    const m = getManifest(filterWork);
    if (m) {
      const book = m.books.find(b => b.id === filterBook);
      if (book) {
        const start = book.start ?? 1;
        bookChapterIds = new Set(
          Array.from({ length: book.chapters }, (_, i) => chapterIdAt(book.id, i, start))
        );
      }
    }
  }

  // Filter matching entries
  const matches = [];
  for (let i = 0; i < index.length && matches.length < MAX_RESULTS; i++) {
    const entry = index[i];
    if (filterWork && entry._workId !== filterWork) continue;
    if (filterChapter && entry._chapterId !== filterChapter) continue;
    if (bookChapterIds && !bookChapterIds.has(entry._chapterId)) continue;
    if (entry._lower.includes(query)) {
      matches.push(entry);
    }
  }

  if (matches.length === 0) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No results found.';
    container.appendChild(p);
    return;
  }

  // Group by work
  const groups = new Map();
  for (const m of matches) {
    const workId = m._workId;
    if (!groups.has(workId)) groups.set(workId, []);
    groups.get(workId).push(m);
  }

  // Render grouped results
  for (const [workId, items] of groups) {
    const manifest = getManifest(workId);
    const groupEl = document.createElement('div');
    groupEl.className = 'search-work-group';

    const heading = document.createElement('h3');
    heading.textContent = manifest ? manifest.title : workId;
    groupEl.appendChild(heading);

    for (const entry of items) {
      const parsed = parseRef(entry.ref);
      const result = document.createElement('div');
      result.className = 'search-result';
      result.setAttribute('role', 'button');
      result.setAttribute('tabindex', '0');

      const refLabel = document.createElement('div');
      refLabel.className = 'search-ref-label';
      refLabel.textContent = formatRef(parsed.chapterId, parsed.verse);
      result.appendChild(refLabel);

      const textEl = document.createElement('div');
      highlightMatch(textEl, entry.text, query);
      result.appendChild(textEl);

      const nav = () => onNavigate(parsed.workId, parsed.chapterId, parsed.verse);
      result.addEventListener('click', nav);
      result.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(); }
      });

      groupEl.appendChild(result);
    }

    container.appendChild(groupEl);
  }
}

/**
 * Set text content with <mark> highlights around matching substrings.
 */
function highlightMatch(el, text, query) {
  const lower = text.toLowerCase();
  let lastIdx = 0;
  let pos = lower.indexOf(query);

  if (pos === -1) {
    el.textContent = text;
    return;
  }

  while (pos !== -1 && lastIdx < text.length) {
    // Text before match
    if (pos > lastIdx) {
      el.appendChild(document.createTextNode(text.slice(lastIdx, pos)));
    }
    // Highlighted match
    const mark = document.createElement('mark');
    mark.textContent = text.slice(pos, pos + query.length);
    el.appendChild(mark);

    lastIdx = pos + query.length;
    pos = lower.indexOf(query, lastIdx);
  }

  // Remaining text
  if (lastIdx < text.length) {
    el.appendChild(document.createTextNode(text.slice(lastIdx)));
  }
}
