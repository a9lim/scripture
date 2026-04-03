/* ===================================================================
   split.js — Split-pane parallel reading with independent navigation.
   Opens a second reading pane beside the primary one.
   =================================================================== */

import { loadChapter, getAdjacentChapters, findBookForChapter, getWorkIds, getManifest, chapterIdAt, chapterNum, formatRef } from './chapters.js';
import { fillSelect } from './nav.js';
import { isBookmarked, toggleBookmark } from './notes.js';
import { initPopover } from './popover.js';
import { initConcordance } from './concordance.js';

/* ── state ──────────────────────────────────────────────────────── */

let _pane = null;
let _workId = null;
let _chapterId = null;
let _navigatePrimary = null;

/* ── public API ─────────────────────────────────────────────────── */

export function isSplitOpen() {
  return _pane !== null && !_pane.hidden;
}

export function getSplitState() {
  if (!isSplitOpen()) return null;
  return { workId: _workId, chapterId: _chapterId };
}

export function toggleSplit($, primaryNavigate) {
  if (isSplitOpen()) {
    closeSplit($);
  } else {
    openSplit($, primaryNavigate, _workId || 'bom', _chapterId || '1-ne-1');
  }
}

export function closeSplit($) {
  if (!_pane) return;
  _pane.hidden = true;
  $.appLayout.classList.remove('split-active');

  // Remove split portion from hash
  const hash = location.hash.slice(1);
  const plusIdx = hash.indexOf('+');
  if (plusIdx !== -1) {
    history.replaceState(null, '', `#${hash.slice(0, plusIdx)}`);
  }
}

export async function openSplit($, primaryNavigate, workId, chapterId, verse) {
  _navigatePrimary = primaryNavigate;

  if (!_pane) {
    _pane = buildPane($);
  }
  _pane.hidden = false;
  $.appLayout.classList.add('split-active');

  _workId = workId;
  _chapterId = chapterId;

  syncSplitNav(workId, chapterId);
  await renderSplitChapter(verse);
  updateHash($);
}

/* ── DOM construction ───────────────────────────────────────────── */

let _els = null; // cached internal element references

function buildPane($) {
  const pane = document.createElement('div');
  pane.className = 'split-pane';

  // --- Nav bar ---
  const nav = document.createElement('div');
  nav.className = 'split-nav';

  const workSel = document.createElement('select');
  workSel.className = 'sim-select split-select';
  workSel.setAttribute('aria-label', 'Split work');

  const bookSel = document.createElement('select');
  bookSel.className = 'sim-select split-select';
  bookSel.setAttribute('aria-label', 'Split book');

  const chapterSel = document.createElement('select');
  chapterSel.className = 'sim-select split-select';
  chapterSel.setAttribute('aria-label', 'Split chapter');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tool-btn';
  closeBtn.type = 'button';
  closeBtn.title = 'Close split pane';
  closeBtn.setAttribute('aria-label', 'Close split pane');

  const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  closeSvg.setAttribute('width', '16');
  closeSvg.setAttribute('height', '16');
  closeSvg.setAttribute('viewBox', '0 0 24 24');
  closeSvg.setAttribute('fill', 'none');
  closeSvg.setAttribute('stroke', 'currentColor');
  closeSvg.setAttribute('stroke-width', '2');
  closeSvg.setAttribute('stroke-linecap', 'round');
  closeSvg.setAttribute('stroke-linejoin', 'round');
  const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line1.setAttribute('x1', '18'); line1.setAttribute('y1', '6');
  line1.setAttribute('x2', '6'); line1.setAttribute('y2', '18');
  const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line2.setAttribute('x1', '6'); line2.setAttribute('y1', '6');
  line2.setAttribute('x2', '18'); line2.setAttribute('y2', '18');
  closeSvg.appendChild(line1);
  closeSvg.appendChild(line2);
  closeBtn.appendChild(closeSvg);

  nav.append(workSel, bookSel, chapterSel, closeBtn);

  // --- Reader area ---
  const reader = document.createElement('div');
  reader.className = 'split-reader scrollbar-thin';

  const header = document.createElement('div');
  header.className = 'split-chapter-header';

  const title = document.createElement('h2');
  title.className = 'split-title';

  const subtitle = document.createElement('p');
  subtitle.className = 'split-subtitle';

  header.append(title, subtitle);

  const intro = document.createElement('div');
  intro.className = 'split-intro hidden';

  const verses = document.createElement('div');
  verses.className = 'split-verses';

  const chapterNav = document.createElement('nav');
  chapterNav.className = 'split-chapter-nav';
  chapterNav.setAttribute('aria-label', 'Split chapter navigation');

  const prevBtn = document.createElement('a');
  prevBtn.className = 'ghost-btn';
  prevBtn.href = '#';
  prevBtn.textContent = '\u2190 Previous';

  const nextBtn = document.createElement('a');
  nextBtn.className = 'ghost-btn';
  nextBtn.href = '#';
  nextBtn.textContent = 'Next \u2192';

  chapterNav.append(prevBtn, nextBtn);

  reader.append(header, intro, verses, chapterNav);
  pane.append(nav, reader);

  // Insert after #reading-pane
  $.appLayout.appendChild(pane);

  _els = { workSel, bookSel, chapterSel, closeBtn, reader, title, subtitle, intro, verses, prevBtn, nextBtn };

  // --- Wire events ---
  closeBtn.addEventListener('click', () => closeSplit($));

  // Populate works
  const workItems = getWorkIds().map(id => ({ id, manifest: getManifest(id) })).filter(x => x.manifest);
  fillSelect(workSel, workItems, x => x.id, x => x.manifest.title);

  workSel.addEventListener('change', () => {
    const wId = workSel.value;
    populateSplitBooks(wId);
    const bId = bookSel.value;
    populateSplitChapters(wId, bId);
    const cId = chapterSel.value;
    if (cId) splitNavigate($, wId, cId);
  });

  bookSel.addEventListener('change', () => {
    const wId = workSel.value;
    const bId = bookSel.value;
    populateSplitChapters(wId, bId);
    const cId = chapterSel.value;
    if (cId) splitNavigate($, wId, cId);
  });

  chapterSel.addEventListener('change', () => {
    const wId = workSel.value;
    const cId = chapterSel.value;
    if (cId) splitNavigate($, wId, cId);
  });

  // Prev/next
  prevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const { prev } = getAdjacentChapters(_workId, _chapterId);
    if (prev) splitNavigate($, _workId, prev.id);
  });

  nextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const { next } = getAdjacentChapters(_workId, _chapterId);
    if (next) splitNavigate($, _workId, next.id);
  });

  // Wire popover and concordance for the split pane's verses
  const split$ = { verses, readingPane: reader };
  initPopover(split$, {
    onNote: (verse) => {
      _navigatePrimary(_workId, _chapterId, verse);
      import('./notes.js').then(m => m.openNote(verse));
    },
    onBookmark: (verse) => {
      toggleBookmark(_workId, _chapterId, verse);
      const row = document.getElementById(`sv${verse}`)?.closest('.verse-row');
      const num = row?.querySelector('.verse-num');
      if (row && num) {
        const on = isBookmarked(_workId, _chapterId, verse);
        row.classList.toggle('bookmarked', on);
        num.classList.toggle('bookmarked', on);
      }
    },
    onCopy: async (verse) => {
      const el = document.getElementById(`sv${verse}`);
      if (!el) return;
      const text = el.textContent.trim();
      const ref = formatRef(_chapterId, verse);
      await navigator.clipboard.writeText(`${text} \u2014 ${ref}`);
      showToast('Copied to clipboard');
    },
    onLink: async (verse) => {
      const url = `${location.origin}${location.pathname}#${_workId}/${_chapterId}:${verse}`;
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    },
    onRead: (verse) => {
      import('./tts.js').then(m => m.startTTS(_els.verses, verse));
    },
    isBookmarked: (verse) => isBookmarked(_workId, _chapterId, verse)
  });

  initConcordance(split$, (wId, cId, v) => {
    splitNavigate($, wId, cId, v);
  });

  return pane;
}

/* ── navigation helpers ─────────────────────────────────────────── */

async function splitNavigate($, workId, chapterId, verse) {
  _workId = workId;
  _chapterId = chapterId;
  syncSplitNav(workId, chapterId);
  await renderSplitChapter(verse);
  updateHash($);
}

function syncSplitNav(workId, chapterId) {
  if (!_els) return;
  const { workSel, bookSel, chapterSel } = _els;

  const workChanged = workSel.value !== workId;
  workSel.value = workId;

  if (workChanged || bookSel.options.length <= 1) {
    populateSplitBooks(workId);
  }

  const bookId = findBookForChapter(workId, chapterId);
  if (bookId && bookSel.value !== bookId) {
    bookSel.value = bookId;
    populateSplitChapters(workId, bookId);
  } else if (workChanged || bookSel.options.length <= 1) {
    populateSplitChapters(workId, bookId || bookSel.value);
  }
  chapterSel.value = chapterId;
}

function populateSplitBooks(workId) {
  if (!_els) return;
  const m = getManifest(workId);
  if (!m) { _els.bookSel.replaceChildren(); return; }
  fillSelect(_els.bookSel, m.books, b => b.id, b => b.name);
  _els.bookSel.style.display = m.books.length <= 1 ? 'none' : '';
}

function populateSplitChapters(workId, bookId) {
  if (!_els) return;
  const m = getManifest(workId);
  if (!m) { _els.chapterSel.replaceChildren(); return; }
  const book = m.books.find(b => b.id === bookId);
  if (!book) { _els.chapterSel.replaceChildren(); return; }
  const start = book.start ?? 1;
  const items = Array.from({ length: book.chapters }, (_, i) => {
    const id = chapterIdAt(book.id, i, start);
    const num = start + i;
    const name = book.names?.[i];
    return { id, num, name };
  });
  fillSelect(_els.chapterSel, items,
    ch => ch.id,
    ch => ch.name ? `${ch.num} (${ch.name})` : String(ch.num)
  );
  _els.chapterSel.style.display = book.chapters <= 1 ? 'none' : '';
}

/* ── rendering ──────────────────────────────────────────────────── */

async function renderSplitChapter(verse) {
  if (!_els) return;
  const { title, subtitle, intro, verses, prevBtn, nextBtn, reader } = _els;

  try {
    const chapter = await loadChapter(_workId, _chapterId);

    // Title
    let titleText;
    if (chapter.singleChapter) {
      titleText = chapter.bookName;
    } else if (chapter.bookCount === 1) {
      titleText = `${chapter.workTitle} ${chapter.chapter}`;
    } else {
      titleText = `${chapter.bookName} ${chapter.chapter}`;
    }
    title.textContent = titleText;

    const sub = chapter.name || '';
    subtitle.textContent = sub;
    subtitle.hidden = !sub;

    intro.textContent = chapter.intro || '';
    intro.classList.toggle('hidden', !chapter.intro);

    // Verses
    verses.replaceChildren();

    if (chapter.sections && chapter.sections.length) {
      const multiSection = chapter.sections.length > 1;
      for (let i = 0; i < chapter.sections.length; i++) {
        if (multiSection) {
          const heading = document.createElement('span');
          heading.className = 'section-heading';
          heading.setAttribute('role', 'heading');
          heading.setAttribute('aria-level', '2');
          heading.textContent = i + 1;
          verses.appendChild(heading);
        }
        const sec = chapter.sections[i];
        for (let j = 0; j < sec.verses.length; j++) {
          appendSplitVerse(verses, sec.verses[j], sec.startVerse + j);
        }
      }
    }

    // Prev/next
    const { prev, next } = getAdjacentChapters(_workId, _chapterId);
    prevBtn.style.visibility = prev ? 'visible' : 'hidden';
    nextBtn.style.visibility = next ? 'visible' : 'hidden';

    reader.scrollTop = 0;

    // Highlight verse if specified
    if (verse) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`sv${verse}`);
        if (el) {
          el.classList.add('verse-highlight');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  } catch (err) {
    title.textContent = 'Error';
    subtitle.textContent = '';
    intro.textContent = '';
    intro.classList.add('hidden');
    verses.replaceChildren();
    const msg = document.createElement('p');
    msg.className = 'empty-state';
    msg.textContent = `Failed to load chapter: ${err.message}`;
    verses.appendChild(msg);
  }
}

function appendSplitVerse(container, text, verseNum) {
  const row = document.createElement('div');
  row.className = 'verse-row';

  const bookmarked = isBookmarked(_workId, _chapterId, verseNum);
  if (bookmarked) row.classList.add('bookmarked');

  const num = document.createElement('span');
  num.className = 'verse-num';
  if (bookmarked) num.classList.add('bookmarked');
  num.textContent = verseNum;
  num.dataset.verse = verseNum;
  num.setAttribute('role', 'button');
  num.setAttribute('tabindex', '0');
  num.setAttribute('aria-label', `Verse ${verseNum} \u2014 click for actions`);
  row.appendChild(num);

  const span = document.createElement('span');
  span.className = 'verse';
  span.id = `sv${verseNum}`;
  span.dataset.verse = verseNum;

  const words = text.split(/(\s+)/);
  for (const w of words) {
    if (/^\s+$/.test(w)) {
      span.appendChild(document.createTextNode(w));
    } else {
      const ws = document.createElement('span');
      ws.className = 'word';
      ws.textContent = w;
      span.appendChild(ws);
    }
  }
  span.appendChild(document.createTextNode(' '));
  row.appendChild(span);
  container.appendChild(row);
}

/* ── hash ───────────────────────────────────────────────────────── */

function updateHash($) {
  const hash = location.hash.slice(1);
  const plusIdx = hash.indexOf('+');
  const primary = plusIdx !== -1 ? hash.slice(0, plusIdx) : hash;
  const newHash = `${primary}+${_workId}/${_chapterId}`;
  if (location.hash !== `#${newHash}`) {
    history.replaceState(null, '', `#${newHash}`);
  }
}
