/* ===================================================================
   reader.js — Chapter rendering for the reading pane.
   Renders section-based chapters with verse numbers.
   =================================================================== */

/**
 * Render a chapter into the reading pane.
 *
 * @param {object}   $              DOM cache
 * @param {object}   chapter        Chapter data from loadChapter()
 * @param {Function} isBookmarkedFn Optional fn(verseNum) → boolean
 */
export function renderChapter($, chapter, isBookmarkedFn) {
  // --- Header: construct title from book/work context ---
  let title;
  if (chapter.singleChapter) {
    title = chapter.bookName;
  } else if (chapter.bookCount === 1) {
    title = `${chapter.workTitle} ${chapter.chapter}`;
  } else {
    title = `${chapter.bookName} ${chapter.chapter}`;
  }
  $.chapterTitle.textContent = title;

  // Subtitle: optional descriptive name (e.g. "Opening", "Preface")
  const subtitle = chapter.name || '';
  $.chapterSubtitle.textContent = subtitle;
  $.chapterSubtitle.hidden = !subtitle;
  $.chapterIntro.textContent = chapter.intro || '';
  $.chapterIntro.classList.toggle('hidden', !chapter.intro);

  // --- Build verse list, interleaving section headings ---
  const container = $.verses;
  container.replaceChildren();
  _activeVerse = null;

  if (chapter.sections && chapter.sections.length) {
    const multiSection = chapter.sections.length > 1;
    for (let i = 0; i < chapter.sections.length; i++) {
      if (multiSection) {
        const heading = document.createElement('span');
        heading.className = 'section-heading';
        heading.setAttribute('role', 'heading');
        heading.setAttribute('aria-level', '2');
        heading.textContent = i + 1;
        container.appendChild(heading);
      }
      for (const v of chapter.sections[i].verses) {
        appendVerse(container, v, isBookmarkedFn);
      }
    }
  }

  $.readingPane.scrollTop = 0;
}

/**
 * Append a single verse span (with clickable verse number) to the container.
 */
function appendVerse(container, verse, isBookmarkedFn) {
  const row = document.createElement('div');
  row.className = 'verse-row';

  const bookmarked = isBookmarkedFn && isBookmarkedFn(verse.number);
  if (bookmarked) row.classList.add('bookmarked');

  const num = document.createElement('span');
  num.className = 'verse-num';
  if (bookmarked) num.classList.add('bookmarked');
  num.textContent = verse.number;
  num.dataset.verse = verse.number;
  num.setAttribute('role', 'button');
  num.setAttribute('tabindex', '0');
  num.setAttribute('aria-label', `Verse ${verse.number} \u2014 click for actions`);
  row.appendChild(num);

  const span = document.createElement('span');
  span.className = 'verse';
  span.id = `v${verse.number}`;
  span.dataset.verse = verse.number;
  // Wrap each word in a span for concordance click
  const words = verse.text.split(/(\s+)/);
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

let _activeVerse = null;

/**
 * Highlight a verse by adding .verse-highlight and scrolling it into view.
 */
export function highlightVerse(verseNum) {
  if (_activeVerse) _activeVerse.classList.remove('verse-highlight');
  const el = document.getElementById(`v${verseNum}`);
  if (!el) { _activeVerse = null; return; }
  el.classList.add('verse-highlight');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  _activeVerse = el;
}
