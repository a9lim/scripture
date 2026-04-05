/* ===================================================================
   popover.js - Verse action popover (Note, Bookmark, Copy, Link).
   Shows on verse-num click, repositioned per verse.
   =================================================================== */

const GRACE_MS = 150;

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

  // _ICON strings are hardcoded SVG markup, safe for innerHTML
  const S = 16;
  noteBtn.innerHTML     = _ICON.at('document', S);
  bookmarkBtn.innerHTML = _ICON.at('bookmark', S);
  copyBtn.innerHTML     = _ICON.at('copy', S);
  linkBtn.innerHTML     = _ICON.at('link', S);
  readBtn.innerHTML     = _ICON.at('speaker', S);

  el.append(noteBtn, bookmarkBtn, sep, copyBtn, linkBtn, readBtn);

  return { el, noteBtn, bookmarkBtn, copyBtn, linkBtn, readBtn };
}

function setBookmarkIcon(btn, filled) {
  btn.innerHTML = _ICON.at(filled ? 'bookmarkFilled' : 'bookmark', 16);
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
