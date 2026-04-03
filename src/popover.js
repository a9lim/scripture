/* ===================================================================
   popover.js - Verse action popover (Note, Bookmark, Copy, Link).
   Shows on verse-num click, repositioned per verse.
   =================================================================== */

const GRACE_MS = 150;

const SVG_NS = 'http://www.w3.org/2000/svg';

/* -- SVG helpers ----------------------------------------------------- */

function svgEl(attrs, children) {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('width', '16');
  el.setAttribute('height', '16');
  el.setAttribute('viewBox', '0 0 16 16');
  el.setAttribute('aria-hidden', 'true');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.appendChild(c);
  return el;
}

function path(attrs) {
  const el = document.createElementNS(SVG_NS, 'path');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function rect(attrs) {
  const el = document.createElementNS(SVG_NS, 'rect');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/* -- Icons ----------------------------------------------------------- */

function makeNoteIcon() {
  return svgEl({ fill: 'none' }, [
    path({ d: 'M11 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5l-3-3z', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linejoin': 'round' }),
    path({ d: 'M11 2v3h3', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linejoin': 'round' }),
    path({ d: 'M5 9h6M5 11.5h4', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' })
  ]);
}

function makeBookmarkIcon(filled) {
  return svgEl({}, [
    path({ d: 'M4 2h8a1 1 0 0 1 1 1v10l-5-3-5 3V3a1 1 0 0 1 1-1z', fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linejoin': 'round' })
  ]);
}

function makeCopyIcon() {
  return svgEl({ fill: 'none' }, [
    rect({ x: '5', y: '5', width: '8', height: '9', rx: '1', stroke: 'currentColor', 'stroke-width': '1.5' }),
    path({ d: 'M3 11V3a1 1 0 0 1 1-1h6', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  ]);
}

function makeLinkIcon() {
  return svgEl({ fill: 'none' }, [
    path({ d: 'M6.5 9.5a3.536 3.536 0 0 0 5 0l2-2a3.536 3.536 0 0 0-5-5L7 4', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' }),
    path({ d: 'M9.5 6.5a3.536 3.536 0 0 0-5 0l-2 2a3.536 3.536 0 0 0 5 5L9 12', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' })
  ]);
}

function makeSpeakerIcon() {
  return svgEl({ fill: 'none' }, [
    path({ d: 'M8.5 4L5 7H2v2h3l3.5 3V4z', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linejoin': 'round' }),
    path({ d: 'M12 5.5a4 4 0 0 1 0 5', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' })
  ]);
}

/* -- Popover DOM ----------------------------------------------------- */

function makeBtn(className, label) {
  const btn = document.createElement('button');
  btn.className = `vp-btn ${className}`;
  btn.type = 'button';
  btn.setAttribute('aria-label', label);
  return btn;
}

function buildPopover() {
  const el = document.createElement('div');
  el.className = 'verse-popover hidden';
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Verse actions');

  const noteBtn     = makeBtn('vp-note',     'Add note');
  const bookmarkBtn = makeBtn('vp-bookmark', 'Bookmark');
  const sep         = document.createElement('div');
  sep.className     = 'vp-sep';
  const copyBtn     = makeBtn('vp-copy',     'Copy verse');
  const linkBtn     = makeBtn('vp-link',     'Copy link');
  const readBtn     = makeBtn('vp-read',     'Read aloud from here');

  noteBtn.appendChild(makeNoteIcon());
  bookmarkBtn.appendChild(makeBookmarkIcon(false));
  copyBtn.appendChild(makeCopyIcon());
  linkBtn.appendChild(makeLinkIcon());
  readBtn.appendChild(makeSpeakerIcon());

  el.append(noteBtn, bookmarkBtn, sep, copyBtn, linkBtn, readBtn);

  return { el, noteBtn, bookmarkBtn, copyBtn, linkBtn, readBtn };
}

function setBookmarkIcon(btn, filled) {
  btn.replaceChildren(makeBookmarkIcon(filled));
}

/* -- Main export ----------------------------------------------------- */

export function initPopover($, callbacks) {
  const { onNote, onBookmark, onCopy, onLink, onRead, isBookmarked } = callbacks;
  const { el, noteBtn, bookmarkBtn, copyBtn, linkBtn, readBtn } = buildPopover();

  document.body.appendChild(el);

  let activeVerse = null;
  let hideTimer   = null;

  /* tooltips */
  const tooltip = createSimTooltip();

  el.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.vp-btn');
    if (btn) {
      const r = btn.getBoundingClientRect();
      tooltip.show(r.left + r.width / 2, r.bottom + 4, btn.getAttribute('aria-label'));
    }
  });
  el.addEventListener('mouseout', (e) => {
    if (e.target.closest('.vp-btn')) tooltip.hide();
  });

  /* -- open / close ------------------------------------------------- */

  function open(verseNum, numEl) {
    clearTimeout(hideTimer);
    activeVerse = verseNum;

    setBookmarkIcon(bookmarkBtn, isBookmarked(verseNum));

    // Initial position (will be refined after paint)
    el.classList.remove('hidden');

    requestAnimationFrame(() => {
      const numRect = numEl.getBoundingClientRect();
      const popH    = el.offsetHeight;
      const popW    = el.offsetWidth;

      // Verse number is right-aligned in its box; center popover on the right edge
      const numCenter = numRect.right;
      let l = numCenter - popW / 2;
      let t = numRect.top - popH - 6;

      // Clamp to viewport
      if (l < 4) l = 4;
      if (l + popW > window.innerWidth - 4) l = window.innerWidth - popW - 4;
      if (t < 4) t = numRect.bottom + 6; // flip below if no room above

      el.style.top  = `${t}px`;
      el.style.left = `${l}px`;
    });
  }

  function close() {
    el.classList.add('hidden');
    activeVerse = null;
  }

  function scheduleClose() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(close, GRACE_MS);
  }

  function cancelClose() {
    clearTimeout(hideTimer);
  }

  /* -- hover persistence -------------------------------------------- */

  el.addEventListener('mouseenter', cancelClose);
  el.addEventListener('mouseleave', scheduleClose);

  /* -- button actions ----------------------------------------------- */

  noteBtn.addEventListener('click', () => {
    const v = activeVerse;
    close();
    if (v !== null) onNote(v);
  });

  bookmarkBtn.addEventListener('click', () => {
    const v = activeVerse;
    if (v === null) return;
    onBookmark(v);
    setBookmarkIcon(bookmarkBtn, isBookmarked(v));
  });

  copyBtn.addEventListener('click', async () => {
    const v = activeVerse;
    close();
    if (v !== null) await onCopy(v);
  });

  linkBtn.addEventListener('click', async () => {
    const v = activeVerse;
    close();
    if (v !== null) await onLink(v);
  });

  readBtn.addEventListener('click', () => {
    const v = activeVerse;
    close();
    if (v !== null && onRead) onRead(v);
  });

  /* -- outside click dismiss ---------------------------------------- */

  document.addEventListener('click', (e) => {
    if (!el.classList.contains('hidden') &&
        !el.contains(e.target) &&
        !e.target.closest('.verse-num')) {
      close();
    }
  }, true);

  /* -- global Escape ------------------------------------------------ */

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.classList.contains('hidden')) {
      close();
    }
  });

  /* -- delegation on $.verses --------------------------------------- */

  $.verses.addEventListener('click', (e) => {
    const numEl = e.target.closest('.verse-num');
    if (!numEl) return;
    const verseNum = parseInt(numEl.dataset.verse, 10);
    if (activeVerse === verseNum && !el.classList.contains('hidden')) {
      close();
    } else {
      open(verseNum, numEl);
    }
  });

  $.verses.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const numEl = e.target.closest('.verse-num');
    if (!numEl) return;
    e.preventDefault();
    const verseNum = parseInt(numEl.dataset.verse, 10);
    open(verseNum, numEl);
  });

  /* -- hover to open on verse-num ----------------------------------- */

  $.verses.addEventListener('mouseenter', (e) => {
    const numEl = e.target.closest('.verse-num');
    if (!numEl) return;
    const verseNum = parseInt(numEl.dataset.verse, 10);
    if (activeVerse === verseNum && !el.classList.contains('hidden')) {
      cancelClose();
    } else {
      open(verseNum, numEl);
    }
  }, true);

  $.verses.addEventListener('mouseleave', (e) => {
    if (e.target.closest('.verse-num')) {
      scheduleClose();
    }
  }, true);
}
