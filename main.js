/* ===================================================================
   main.js — Scripture reader entry point.
   DOM cache, routing, module initialization.
   =================================================================== */

import { loadManifests, getManifest, loadChapter, getAdjacentChapters, loadSearchIndex, parseRef, getWorkIds, formatRef, chapterIdAt } from './src/chapters.js';
import { initNav, syncNav } from './src/nav.js';
import { renderChapter, highlightVerse } from './src/reader.js';
import { initNotes, renderNotes, openNote, toggleBookmark, isBookmarked, renderBookmarks } from './src/notes.js';
import { initSearch } from './src/search.js';
import { initPopover } from './src/popover.js';
import { initDisplay } from './src/display.js';
import { savePosition, getLastPosition, renderProgress, initResume } from './src/history.js';
import { renderRelated } from './src/related.js';
import { initConcordance } from './src/concordance.js';
import { initTTS, startTTS, stopTTS, isTTSActive } from './src/tts.js';
import { exportData, promptImport } from './src/data-io.js';

/* ── DOM cache ─────────────────────────────────────────────────────── */

const $ = {
  toolbar:          document.getElementById('toolbar'),
  workSelect:       document.getElementById('work-select'),
  bookSelect:       document.getElementById('book-select'),
  chapterSelect:    document.getElementById('chapter-select'),
  readingPane:      document.getElementById('reading-pane'),
  chapterTitle:     document.getElementById('chapter-title'),
  chapterSubtitle:  document.getElementById('chapter-subtitle'),
  chapterIntro:     document.getElementById('chapter-intro'),
  verses:           document.getElementById('verses'),
  prevChapter:      document.getElementById('prev-chapter'),
  nextChapter:      document.getElementById('next-chapter'),
  notesToggle:      document.getElementById('notes-toggle'),
  notesSidebar:     document.getElementById('notes-sidebar'),
  notesClose:       document.getElementById('notes-close'),
  notesContent:     document.getElementById('notes-content'),
  bookmarksContent: document.getElementById('bookmarks-content'),
  randomBtn:        document.getElementById('random-btn'),
  resumeBtn:        document.getElementById('resume-btn'),
  downloadBtn:      document.getElementById('download-btn'),
  searchBtn:        document.getElementById('search-btn'),
  searchOverlay:    document.getElementById('search-overlay'),
  searchInput:      document.getElementById('search-input'),
  searchClose:      document.getElementById('search-close'),
  searchResults:    document.getElementById('search-results'),
  searchWork:       document.getElementById('search-work'),
  searchBook:       document.getElementById('search-book'),
  searchChapter:    document.getElementById('search-chapter'),
  themeBtn:         document.getElementById('theme-btn'),
  aboutBtn:         document.getElementById('about-btn'),
  ttsBtn:           document.getElementById('tts-btn'),
  exportBtn:        document.getElementById('export-btn'),
  importBtn:        document.getElementById('import-btn'),
  appLayout:        document.getElementById('app-layout')
};

/* ── state ─────────────────────────────────────────────────────────── */

let currentWork = null;
let currentChapter = null;
let tabBookmarks = null;

/* ── navigation ────────────────────────────────────────────────────── */

/**
 * Navigate to a specific chapter and optionally highlight a verse.
 * Updates the URL path, loads data, and renders.
 */
async function navigate(workId, chapterId, verse) {
  const bc = document.getElementById('breadcrumb');
  if (bc) bc.textContent = '';

  const path = verse
    ? `/scripture/${workId}/${chapterId}:${verse}`
    : `/scripture/${workId}/${chapterId}`;
  if (location.pathname !== path) {
    history.replaceState(null, '', path);
  }

  currentWork = workId;
  currentChapter = chapterId;
  syncNav($, workId, chapterId);

  try {
    const chapter = await loadChapter(workId, chapterId);
    renderChapter($, chapter, (verse) => isBookmarked(workId, chapterId, verse));
    renderNotes($, workId, chapterId);
    savePosition(workId, chapterId);
    renderProgress($, workId, chapterId);
    renderRelated($, workId, chapterId, navigate);
    if (tabBookmarks && tabBookmarks.classList.contains('active')) {
      const activeScope = tabBookmarks.querySelector('.mode-btn.active');
      const scope = activeScope ? activeScope.dataset.scope : 'chapter';
      renderBookmarks($, workId, chapterId, scope, navigate);
    }

    // Update prev/next links
    const { prev, next } = getAdjacentChapters(workId, chapterId);
    updateNavLink($.prevChapter, workId, prev);
    updateNavLink($.nextChapter, workId, next);

    // Highlight verse if specified
    if (verse) {
      requestAnimationFrame(() => highlightVerse(verse));
    }
  } catch (err) {
    $.chapterTitle.textContent = 'Error';
    $.chapterSubtitle.textContent = '';
    $.chapterIntro.textContent = '';
    $.chapterIntro.classList.add('hidden');
    const container = $.verses;
    container.replaceChildren();
    const msg = document.createElement('p');
    msg.className = 'empty-state';
    msg.textContent = `Failed to load chapter: ${err.message}`;
    container.appendChild(msg);
  }
}

/**
 * Update a prev/next navigation link.
 */
function updateNavLink(el, workId, adjacent) {
  if (adjacent) {
    el.href = `/scripture/${workId}/${adjacent.id}`;
    el.style.visibility = 'visible';
  } else {
    el.href = '/scripture/';
    el.style.visibility = 'hidden';
  }
}

/* ── path routing ─────────────────────────────────────────────────── */

function routeFromPath() {
  // Strip /scripture/ prefix, e.g. "/scripture/bom/1-ne-1:26" → "bom/1-ne-1:26"
  const raw = location.pathname.replace(/^\/scripture\/?/, '');

  if (!raw) {
    const last = getLastPosition();
    if (last) { navigate(last.workId, last.chapterId); return; }
    const manifest = getManifest('bom');
    if (!manifest || !manifest.books.length) return;
    const firstBook = manifest.books[0];
    navigate('bom', chapterIdAt(firstBook.id, 0, firstBook.start));
    return;
  }

  const slashIdx = raw.indexOf('/');
  if (slashIdx === -1) return;

  const workId = raw.slice(0, slashIdx);
  let rest = raw.slice(slashIdx + 1);
  let verse = null;

  const colonIdx = rest.lastIndexOf(':');
  if (colonIdx !== -1) {
    const maybeVerse = parseInt(rest.slice(colonIdx + 1), 10);
    if (!isNaN(maybeVerse)) {
      verse = maybeVerse;
      rest = rest.slice(0, colonIdx);
    }
  }

  navigate(workId, rest, verse);
}

/* ── download ─────────────────────────────────────────────────────── */

async function downloadText() {
  if (!currentWork) return;
  try {
    const res = await fetch(`text/${currentWork}.txt`);
    if (!res.ok) throw new Error(res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentWork}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${currentWork}.txt`);
  } catch {
    showToast('Download failed');
  }
}

/* ── initialization ────────────────────────────────────────────────── */

async function init() {
  // Theme
  _toolbar.initTheme('scripture-theme');
  $.themeBtn.addEventListener('click', () => _toolbar.toggleTheme('scripture-theme'));

  // Load manifests
  await loadManifests();

  // Display settings (after manifests so shared defer scripts are loaded)
  initDisplay($);

  // Text-to-speech
  initTTS($);
  $.ttsBtn.addEventListener('click', () => {
    if (isTTSActive()) stopTTS();
    else startTTS($.verses);
  });

  // Navigation dropdowns
  initNav($, (workId, chapterId) => navigate(workId, chapterId));

  // Path routing
  window.addEventListener('popstate', routeFromPath);
  routeFromPath();

  // Intercept prev/next chapter link clicks for SPA navigation
  for (const el of [$.prevChapter, $.nextChapter]) {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (el.style.visibility === 'hidden') return;
      history.pushState(null, '', el.getAttribute('href'));
      routeFromPath();
    });
  }

  // Search
  const search = initSearch($, (workId, chapterId, verse) => {
    $.searchOverlay.classList.add('hidden');
    navigate(workId, chapterId, verse);
  });

  // Auto-open search from ?q= parameter
  const searchParam = new URLSearchParams(location.search).get('q');
  if (searchParam) {
    await search.open();
    $.searchInput.value = searchParam;
    $.searchInput.dispatchEvent(new Event('input'));
  }

  // Notes
  initNotes($);
  _toolbar.initSidebar($.notesToggle, $.notesSidebar, $.notesClose);

  // Resume dropdown
  initResume($, navigate);

  // Sidebar tabs (wired by shared-tabs.js; hook bookmarks refresh)
  tabBookmarks = document.getElementById('tab-bookmarks');
  document.querySelector('.sidebar-tabs .tab-btn[data-tab="bookmarks"]')
    ?.addEventListener('click', () => {
      renderBookmarks($, currentWork, currentChapter, 'chapter', navigate);
    });
  document.querySelector('.sidebar-tabs .tab-btn[data-tab="notes"]')
    ?.addEventListener('click', () => {
      renderNotes($, currentWork, currentChapter);
    });

  // Verse action popover
  initPopover($, {
    onNote: (verse) => openNote(verse),
    onBookmark: (verse) => {
      toggleBookmark(currentWork, currentChapter, verse);
      // Update verse indicators
      const row = document.getElementById(`v${verse}`)?.closest('.verse-row');
      const num = row?.querySelector('.verse-num');
      if (row && num) {
        const on = isBookmarked(currentWork, currentChapter, verse);
        row.classList.toggle('bookmarked', on);
        num.classList.toggle('bookmarked', on);
      }
      // Update bookmarks tab if visible
      if (tabBookmarks && tabBookmarks.classList.contains('active')) {
        const activeScope = tabBookmarks.querySelector('.mode-btn.active');
        renderBookmarks($, currentWork, currentChapter, activeScope?.dataset.scope || 'chapter', navigate);
      }
    },
    onCopy: async (verse) => {
      const el = document.getElementById(`v${verse}`);
      if (!el) return;
      const text = el.textContent.trim();
      const ref = formatRef(currentChapter, verse);
      await navigator.clipboard.writeText(`${text} \u2014 ${ref}`);
      showToast('Copied to clipboard');
    },
    onLink: async (verse) => {
      const url = `${location.origin}/scripture/${currentWork}/${currentChapter}:${verse}`;
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    },
    onRead: (verse) => {
      startTTS($.verses, verse);
    },
    isBookmarked: (verse) => isBookmarked(currentWork, currentChapter, verse)
  });

  // Concordance
  initConcordance($, (workId, chapterId, verse) => navigate(workId, chapterId, verse));

  // Random verse
  let randomDropdown = null;

  async function goRandom(filterWork) {
    const index = await loadSearchIndex();
    if (!index.length) return;
    if (!index[0]._workId) {
      for (const entry of index) {
        const p = parseRef(entry.ref);
        entry._workId = p.workId;
        entry._chapterId = p.chapterId;
      }
    }
    let pool = filterWork ? index.filter(e => e._workId === filterWork) : index;
    if (!pool.length) return;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    const p = parseRef(entry.ref);
    navigate(p.workId, p.chapterId, p.verse);
    if (randomDropdown) randomDropdown.hidden = true;
  }

  $.randomBtn.addEventListener('click', (e) => {
    if (e.shiftKey) showRandomFilter();
    else goRandom(null);
  });

  let pressTimer = null;
  $.randomBtn.addEventListener('pointerdown', () => {
    pressTimer = setTimeout(() => showRandomFilter(), 500);
  });
  $.randomBtn.addEventListener('pointerup', () => clearTimeout(pressTimer));
  $.randomBtn.addEventListener('pointerleave', () => clearTimeout(pressTimer));

  function showRandomFilter() {
    if (!randomDropdown) {
      randomDropdown = document.createElement('div');
      randomDropdown.className = 'random-dropdown glass';
      document.body.appendChild(randomDropdown);
      document.addEventListener('click', (e) => {
        if (randomDropdown.hidden) return;
        if (e.target.closest('.random-dropdown') || e.target.closest('#random-btn')) return;
        randomDropdown.hidden = true;
      });
    }
    randomDropdown.replaceChildren();
    for (const id of getWorkIds()) {
      const m = getManifest(id);
      if (!m) continue;
      const row = document.createElement('div');
      row.className = 'random-work-row';
      row.textContent = m.title;
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.addEventListener('click', () => goRandom(id));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goRandom(id); }
      });
      randomDropdown.appendChild(row);
    }
    const rect = $.randomBtn.getBoundingClientRect();
    randomDropdown.style.top = `${rect.bottom + 4}px`;
    randomDropdown.style.left = `${rect.left}px`;
    randomDropdown.hidden = false;
  }

  // Export / Import
  $.exportBtn.addEventListener('click', exportData);
  $.importBtn.addEventListener('click', promptImport);

  // Download
  $.downloadBtn.addEventListener('click', downloadText);

  // Keyboard shortcuts
  initShortcuts([
    {
      key: '/',
      label: 'Open search',
      group: 'Navigation',
      action: () => search.open()
    },
    {
      key: 'Escape',
      label: 'Close search',
      group: 'Navigation',
      action: () => {
        if (!$.searchOverlay.classList.contains('hidden')) search.close();
      }
    },
    {
      key: 'ArrowLeft',
      label: 'Previous chapter',
      group: 'Navigation',
      action: () => {
        if ($.prevChapter.style.visibility !== 'hidden') {
          history.pushState(null, '', $.prevChapter.getAttribute('href'));
          routeFromPath();
        }
      },
      when: () => {
        const el = document.activeElement;
        return !el || (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA');
      }
    },
    {
      key: 'ArrowRight',
      label: 'Next chapter',
      group: 'Navigation',
      action: () => {
        if ($.nextChapter.style.visibility !== 'hidden') {
          history.pushState(null, '', $.nextChapter.getAttribute('href'));
          routeFromPath();
        }
      },
      when: () => {
        const el = document.activeElement;
        return !el || (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA');
      }
    },
    {
      key: 'r',
      label: 'Random verse',
      group: 'Navigation',
      action: () => goRandom(null),
      when: () => {
        const el = document.activeElement;
        return !el || (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA');
      }
    }
  ]);

  // About panel
  const about = initAboutPanel({
    title: 'Scripture',
    lastUpdated: '2026-04-05',
    description: 'Read and annotate sacred texts from sixteen works across multiple traditions, with full-text search and personal notes.',
    controls: [
      { label: 'Work / Book / Chapter', value: 'Toolbar dropdowns to navigate' },
      { label: 'Verse actions', value: 'Click verse number for note, bookmark, copy, link' },
      { label: 'Concordance', value: 'Click any word to see all occurrences' },
      { label: 'Display', value: 'Adjust font, size, spacing, and width' },
      { label: 'Download', value: 'Download current work as text file' }
    ],
    shortcuts: [
      { key: '/', label: 'Open search', group: 'Navigation' },
      { key: '?', label: 'About / help', group: 'Navigation' },
      { key: 'ArrowLeft', label: 'Previous chapter', group: 'Navigation' },
      { key: 'ArrowRight', label: 'Next chapter', group: 'Navigation' },
      { key: 'r', label: 'Random verse', group: 'Navigation' },
      { key: 'Escape', label: 'Close overlay', group: 'Navigation' }
    ],
    credits: [
      { label: 'Quran, Four Books, Tao Te Ching, Kojiki, Bundahis, Lotus Sutra', value: 'sacred-texts.com', url: 'https://sacred-texts.com' },
      { label: 'KJV Apocrypha', value: 'Project Gutenberg', url: 'https://www.gutenberg.org' },
      { label: 'LDS Quad (KJV OT/NT, BoM, D&C, PoGP)', value: 'churchofjesuschrist.org', url: 'https://www.churchofjesuschrist.org' }
    ],
    repo: 'https://github.com/a9lim/a9lim.github.io'
  });
  $.aboutBtn.addEventListener('click', () => about.show());

  // Signal that app is ready
  document.body.classList.add('app-ready');
}

init();
