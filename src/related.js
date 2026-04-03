import { getManifest, chapterNum, findBookForChapter } from './chapters.js';

let _similarity = null;

async function loadSimilarity() {
  if (_similarity) return _similarity;
  const res = await fetch('data/similarity.json');
  if (!res.ok) throw new Error(`similarity: ${res.status}`);
  _similarity = await res.json();
  return _similarity;
}

function getChapterTitle(workId, chapterId) {
  const manifest = getManifest(workId);
  if (!manifest) return chapterId;
  const bookId = findBookForChapter(workId, chapterId);
  if (!bookId) return chapterId;
  const book = manifest.books.find(b => b.id === bookId);
  if (!book) return chapterId;
  if (book.chapters === 1) return book.name;
  if (manifest.books.length === 1) return `${manifest.title} ${chapterNum(chapterId)}`;
  return `${book.name} ${chapterNum(chapterId)}`;
}

export function renderRelated($, workId, chapterId, navigateFn) {
  const container = document.getElementById('related-container');
  const toggle = document.getElementById('related-toggle');
  const list = document.getElementById('related-list');
  if (!container || !toggle || !list) return;

  container.classList.add('hidden');
  list.classList.add('hidden');
  list.replaceChildren();
  // Reset toggle state
  toggle.classList.remove('expanded');

  loadSimilarity().then(sim => {
    const matches = sim[chapterId];
    if (!matches || !matches.length) return;

    container.classList.remove('hidden');

    // Remove previous listener if any, then add new one
    if (toggle._relatedHandler) toggle.removeEventListener('click', toggle._relatedHandler);
    toggle._relatedHandler = () => {
      const wasHidden = list.classList.contains('hidden');
      list.classList.toggle('hidden');
      toggle.classList.toggle('expanded', wasHidden);
      if (wasHidden && !list.children.length) renderList(list, matches, navigateFn);
    };
    toggle.addEventListener('click', toggle._relatedHandler);
  }).catch(() => { /* graceful no-op */ });
}

function renderList(list, matches, navigateFn) {
  const groups = new Map();
  for (const match of matches) {
    const [workId, chapterId] = match.ref.split(':');
    if (!groups.has(workId)) groups.set(workId, []);
    groups.get(workId).push({ workId, chapterId, score: match.score });
  }

  const sorted = [...groups.entries()].sort((a, b) => {
    const ma = getManifest(a[0]);
    const mb = getManifest(b[0]);
    return (ma?.title || a[0]).localeCompare(mb?.title || b[0]);
  });

  for (const [wId, entries] of sorted) {
    const manifest = getManifest(wId);
    const groupEl = document.createElement('div');
    groupEl.className = 'related-work-group';

    const heading = document.createElement('h4');
    heading.textContent = manifest ? manifest.title : wId;
    groupEl.appendChild(heading);

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'related-row';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.style.opacity = 0.5 + entry.score * 0.5;

      const title = document.createElement('span');
      title.textContent = getChapterTitle(entry.workId, entry.chapterId);
      row.appendChild(title);

      const nav = () => navigateFn(entry.workId, entry.chapterId);
      row.addEventListener('click', nav);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(); }
      });
      groupEl.appendChild(row);
    }
    list.appendChild(groupEl);
  }
}
