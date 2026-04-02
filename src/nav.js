/* ===================================================================
   nav.js — Toolbar dropdown population and navigation wiring.
   =================================================================== */

import { getWorkIds, getManifest, findBookForChapter, chapterNum } from './chapters.js';

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
  $.bookSelect.style.display = m.books.length <= 1 ? 'none' : '';
}

/**
 * Fill the chapter-select dropdown for a given book within a work.
 */
function populateChapters($, workId, bookId) {
  const m = getManifest(workId);
  if (!m) { $.chapterSelect.replaceChildren(); return; }
  const book = m.books.find(b => b.id === bookId);
  if (!book) { $.chapterSelect.replaceChildren(); return; }
  fillSelect($.chapterSelect, book.chapters,
    ch => ch.id,
    ch => ch.name ? `${chapterNum(ch.id)} (${ch.name})` : chapterNum(ch.id)
  );
  $.chapterSelect.style.display = book.chapters.length <= 1 ? 'none' : '';
}

/**
 * Wire change listeners on work/book/chapter select elements.
 * @param {object} $          DOM cache
 * @param {Function} navigateFn  (workId, chapterId) => void
 */
export function initNav($, navigateFn) {
  populateWorks($);

  $.workSelect.addEventListener('change', () => {
    const workId = $.workSelect.value;
    populateBooks($, workId);
    const firstBookId = $.bookSelect.value;
    populateChapters($, workId, firstBookId);
    const firstChapterId = $.chapterSelect.value;
    if (firstChapterId) navigateFn(workId, firstChapterId);
  });

  $.bookSelect.addEventListener('change', () => {
    const workId = $.workSelect.value;
    const bookId = $.bookSelect.value;
    populateChapters($, workId, bookId);
    const firstChapterId = $.chapterSelect.value;
    if (firstChapterId) navigateFn(workId, firstChapterId);
  });

  $.chapterSelect.addEventListener('change', () => {
    const workId = $.workSelect.value;
    const chapterId = $.chapterSelect.value;
    if (chapterId) navigateFn(workId, chapterId);
  });
}

/**
 * Set dropdown values to match the current navigation state.
 */
export function syncNav($, workId, chapterId) {
  const workChanged = $.workSelect.value !== workId;
  $.workSelect.value = workId;

  if (workChanged || $.bookSelect.options.length <= 1) {
    populateBooks($, workId);
  }

  const bookId = findBookForChapter(workId, chapterId);
  if (bookId && $.bookSelect.value !== bookId) {
    $.bookSelect.value = bookId;
    populateChapters($, workId, bookId);
  } else if (workChanged || $.bookSelect.options.length <= 1) {
    populateChapters($, workId, bookId || $.bookSelect.value);
  }
  $.chapterSelect.value = chapterId;
}
