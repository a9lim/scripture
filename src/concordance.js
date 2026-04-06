import { loadSearchIndex, parseRef, getManifest, getWorkIds, formatRef } from './chapters.js';

let _concordance = null;
let _searchIndex = null;
let _popover = null;

async function loadConcordance() {
  if (_concordance) return _concordance;
  const res = await fetch('/scripture/data/concordance.json');
  if (!res.ok) throw new Error(`concordance: ${res.status}`);
  _concordance = await res.json();
  return _concordance;
}

async function ensureSearchIndex() {
  if (_searchIndex) return _searchIndex;
  _searchIndex = await loadSearchIndex();
  return _searchIndex;
}

function getVerseText(ref) {
  if (!_searchIndex) return null;
  const entry = _searchIndex.find(e => e.ref === ref);
  return entry ? entry.text : null;
}

function showPopover(word, anchorEl, pane, navigateFn) {
  const clean = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!clean || !_concordance || !_concordance[clean]) {
    _popover.hidden = true;
    return;
  }

  const refs = _concordance[clean];
  _popover.replaceChildren();
  _popover.hidden = false;

  const rect = anchorEl.getBoundingClientRect();
  const paneRect = pane.getBoundingClientRect();
  _popover.style.top = `${rect.bottom - paneRect.top + pane.scrollTop + 4}px`;
  _popover.style.left = `${rect.left - paneRect.left}px`;

  const header = document.createElement('div');
  header.className = 'conc-pop-header';
  header.innerHTML = `<strong>${escapeHtml(clean)}</strong> <span class="conc-pop-count">${refs.length} occurrence${refs.length !== 1 ? 's' : ''}</span>`;
  _popover.appendChild(header);

  for (const ref of refs.slice(0, 5)) {
    const parsed = parseRef(ref);
    const row = document.createElement('div');
    row.className = 'conc-pop-row';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    const refEl = document.createElement('span');
    refEl.className = 'conc-pop-ref';
    refEl.textContent = formatRef(parsed.chapterId, parsed.verse);
    row.appendChild(refEl);

    const text = getVerseText(ref);
    if (text) {
      const textEl = document.createElement('span');
      textEl.className = 'conc-pop-text';
      textEl.textContent = text;
      row.appendChild(textEl);
    }

    const nav = () => { navigateFn(parsed.workId, parsed.chapterId, parsed.verse); _popover.hidden = true; };
    row.addEventListener('click', nav);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(); }
    });
    _popover.appendChild(row);
  }

  if (refs.length > 5) {
    const seeAll = document.createElement('div');
    seeAll.className = 'conc-pop-seeall';
    seeAll.textContent = `See all ${refs.length} occurrences`;
    seeAll.setAttribute('role', 'button');
    seeAll.setAttribute('tabindex', '0');
    seeAll.addEventListener('click', () => { _popover.hidden = true; openOverlay(clean, navigateFn); });
    _popover.appendChild(seeAll);
  }
}

let _overlayInited = false;
let _overlayNavigateFn = null;
let _trapCleanup = null;

function closeOverlay() {
  const overlay = document.getElementById('concordance-overlay');
  overlay.classList.add('hidden');
  if (_trapCleanup) { _trapCleanup(); _trapCleanup = null; }
}

function openOverlay(word, navigateFn) {
  _overlayNavigateFn = navigateFn;
  const overlay = document.getElementById('concordance-overlay');
  const input = document.getElementById('concordance-input');
  const results = document.getElementById('concordance-results');

  if (!_overlayInited) {
    _overlayInited = true;
    const closeBtn = document.getElementById('concordance-close');
    closeBtn.addEventListener('click', closeOverlay);
    initOverlayDismiss(overlay, closeBtn, closeOverlay);

    input.addEventListener('input', debounce(() => {
      const q = input.value.trim().toLowerCase().replace(/[^a-z']/g, '');
      renderOverlayResults(q, results, _overlayNavigateFn);
    }, 250));
  }

  overlay.classList.remove('hidden');
  input.value = word || '';
  _trapCleanup = trapFocus(overlay);

  if (word) renderOverlayResults(word, results, navigateFn);
  input.focus();
}

function renderOverlayResults(word, container, navigateFn) {
  container.replaceChildren();
  if (!word || !_concordance || !_concordance[word]) {
    if (word) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'No occurrences found.';
      container.appendChild(p);
    }
    return;
  }

  const refs = _concordance[word];
  const groups = new Map();
  for (const ref of refs) {
    const parsed = parseRef(ref);
    if (!groups.has(parsed.workId)) groups.set(parsed.workId, []);
    groups.get(parsed.workId).push(parsed);
  }

  for (const wId of getWorkIds()) {
    if (!groups.has(wId)) continue;
    const manifest = getManifest(wId);
    const groupEl = document.createElement('div');
    groupEl.className = 'search-work-group';

    const heading = document.createElement('h3');
    heading.textContent = manifest ? manifest.title : wId;
    groupEl.appendChild(heading);

    for (const parsed of groups.get(wId)) {
      const row = document.createElement('div');
      row.className = 'search-result';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');

      const refLabel = document.createElement('div');
      refLabel.className = 'search-ref-label';
      refLabel.textContent = formatRef(parsed.chapterId, parsed.verse);
      row.appendChild(refLabel);

      const text = getVerseText(`${parsed.workId}:${parsed.chapterId}:${parsed.verse}`);
      if (text) {
        const textEl = document.createElement('div');
        highlightWord(textEl, text, word);
        row.appendChild(textEl);
      }

      const nav = () => navigateFn(parsed.workId, parsed.chapterId, parsed.verse);
      row.addEventListener('click', nav);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(); }
      });
      groupEl.appendChild(row);
    }
    container.appendChild(groupEl);
  }
}

function highlightWord(el, text, word) {
  const re = new RegExp(`\\b${word}\\b`, 'gi');
  let lastIdx = 0, match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) el.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(match.index, match.index + word.length);
    el.appendChild(mark);
    lastIdx = match.index + word.length;
  }
  if (lastIdx < text.length) el.appendChild(document.createTextNode(text.slice(lastIdx)));
  if (lastIdx === 0) el.textContent = text;
}

function markWords(conc) {
  for (const el of document.querySelectorAll('.word:not(.conc-word)')) {
    const w = el.textContent.toLowerCase().replace(/[^a-z']/g, '');
    if (w && conc[w]) el.classList.add('conc-word');
  }
}

export function initConcordance($, navigateFn) {
  _popover = document.createElement('div');
  _popover.className = 'conc-popover';
  _popover.hidden = true;
  $.readingPane.appendChild(_popover);

  // Preload concordance and mark words on current + future chapter renders
  loadConcordance().then(conc => {
    markWords(conc);
    // Re-mark after each chapter render via MutationObserver on #verses
    let markTimer;
    new MutationObserver(() => {
      clearTimeout(markTimer);
      markTimer = setTimeout(() => markWords(conc), 50);
    }).observe($.verses, { childList: true });
  }).catch(() => {});

  $.verses.addEventListener('click', async (e) => {
    const wordEl = e.target.closest('.word');
    if (!wordEl || e.target.closest('.verse-num')) return;
    try {
      await loadConcordance();
      await ensureSearchIndex();
      showPopover(wordEl.textContent, wordEl, $.readingPane, navigateFn);
    } catch { showToast('Failed to load concordance'); }
  });

  document.addEventListener('click', (e) => {
    if (_popover.hidden) return;
    if (e.target.closest('.conc-popover') || e.target.closest('.word')) return;
    _popover.hidden = true;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !_popover.hidden) _popover.hidden = true;
  });
}
