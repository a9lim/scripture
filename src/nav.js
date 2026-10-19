/* ===================================================================
   nav.js — Toolbar dropdown population and navigation wiring.
   =================================================================== */

import { getWorkIds, getManifest, findBookForChapter, chapterNum, chapterIdAt } from './chapters.js';

// True while syncNav is writing select values, so the change events it fires
// (to refresh the shared dropdown triggers) don't re-enter navigation.
let _syncing = false;

/**
 * Show or hide a <select> together with its shared dropdown wrapper
 * (shared/dropdown.js), so a hidden select leaves no empty trigger behind.
 */
export function setSelectVisible(sel, visible) {
  sel.style.display = visible ? '' : 'none';
  const wrap = sel.closest('.sim-dropdown');
  if (wrap) wrap.style.display = visible ? '' : 'none';
}

/**
 * Replace all options in a <select> element.
 */
export function fillSelect(sel, items, valueFn, textFn, allLabel) {
  sel.replaceChildren();
  if (allLabel) {
    const all = document.createElement('option');
    all.value = '';
    all.textContent = allLabel;
    sel.appendChild(all);
  }
  for (const item of items) {
    const opt = document.createElement('option');
    opt.value = valueFn(item);
    opt.textContent = textFn(item);
    sel.appendChild(opt);
  }
}

/**
 * Fill the work-select dropdown from loaded manifests.
 */
function populateWorks($) {
  const items = getWorkIds().map(id => ({ id, manifest: getManifest(id) })).filter(x => x.manifest);
  fillSelect($.workSelect, items, x => x.id, x => x.manifest.title);
}

/**
 * Fill the book-select dropdown for a given work.
 * Hides the dropdown when the work has only one book (e.g. Quran).
 */
function populateBooks($, workId) {
  const m = getManifest(workId);
  if (!m) { $.bookSelect.replaceChildren(); return; }
  fillSelect($.bookSelect, m.books, b => b.id, b => b.name);
  setSelectVisible($.bookSelect, m.books.length > 1);
}

/**
 * Fill the chapter-select dropdown for a given book within a work.
 */
function populateChapters($, workId, bookId) {
  const m = getManifest(workId);
  if (!m) { $.chapterSelect.replaceChildren(); return; }
  const book = m.books.find(b => b.id === bookId);
  if (!book) { $.chapterSelect.replaceChildren(); return; }
  const start = book.start ?? 1;
  const items = Array.from({ length: book.chapters }, (_, i) => {
    const id = chapterIdAt(book.id, i, start);
    const num = start + i;
    const name = book.names?.[i];
    return { id, num, name };
  });
  fillSelect($.chapterSelect, items,
    ch => ch.id,
    ch => ch.name ? `${ch.num} (${ch.name})` : String(ch.num)
  );
  setSelectVisible($.chapterSelect, book.chapters > 1);
}

/**
 * Wire change listeners on work/book/chapter select elements.
 * @param {object} $          DOM cache
 * @param {Function} navigateFn  (workId, chapterId) => void
 */
export function initNav($, navigateFn) {
  populateWorks($);

  $.workSelect.addEventListener('change', () => {
    if (_syncing) return;
    const workId = $.workSelect.value;
    populateBooks($, workId);
    const firstBookId = $.bookSelect.value;
    populateChapters($, workId, firstBookId);
    const firstChapterId = $.chapterSelect.value;
    if (firstChapterId) navigateFn(workId, firstChapterId);
  });

  $.bookSelect.addEventListener('change', () => {
    if (_syncing) return;
    const workId = $.workSelect.value;
    const bookId = $.bookSelect.value;
    populateChapters($, workId, bookId);
    const firstChapterId = $.chapterSelect.value;
    if (firstChapterId) navigateFn(workId, firstChapterId);
  });

  $.chapterSelect.addEventListener('change', () => {
    if (_syncing) return;
    const workId = $.workSelect.value;
    const chapterId = $.chapterSelect.value;
    if (chapterId) navigateFn(workId, chapterId);
  });
}

/**
 * Set dropdown values to match the current navigation state.
 * A programmatic `.value` write raises no event, so the shared dropdown
 * triggers (shared/dropdown.js) would keep showing the previous label; a
 * guarded change event on each select refreshes them.
 */
export function syncNav($, workId, chapterId) {
  _syncing = true;
  try {
    const workChanged = $.workSelect.value !== workId;
    $.workSelect.value = workId;

    const booksFilled = workChanged || $.bookSelect.options.length <= 1;
    if (booksFilled) populateBooks($, workId);

    // The chapter list follows the book: refill it whenever the books were just
    // filled (the first load lands in the first work's first book, where the
    // book value never changes), the book changed, or it is still empty.
    const bookId = findBookForChapter(workId, chapterId);
    const bookChanged = !!bookId && $.bookSelect.value !== bookId;
    if (bookChanged) $.bookSelect.value = bookId;
    if (booksFilled || bookChanged || $.chapterSelect.options.length <= 1) {
      populateChapters($, workId, bookId || $.bookSelect.value);
    }
    $.chapterSelect.value = chapterId;

    for (const sel of [$.workSelect, $.bookSelect, $.chapterSelect]) {
      sel.dispatchEvent(new Event('change'));
    }
  } finally {
    _syncing = false;
  }
}
