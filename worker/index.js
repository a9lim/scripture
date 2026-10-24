// Routing and SSR. Every page is the same index.html shell; for the index,
// work, and chapter routes the Worker rewrites its head and pre-renders
// #breadcrumb and #verses for crawlers, and the client replaces both on its
// first render. Manifests are bundled at build time (.build/corpus.generated.mjs),
// so only chapter text is fetched per request.
import { WORKS, MANIFESTS } from '../.build/corpus.generated.mjs';
import { ORIGIN } from '../site.config.mjs';
import { secure } from './http.js';
import { WORK_SCHEMA, WORK_MENTIONS } from './works.js';

const LICENSE = 'https://creativecommons.org/licenses/by-sa/4.0/';
const AUTHOR = { '@type': 'Person', name: 'a9lim', url: 'https://a9l.im/', '@id': 'https://a9l.im/#person' };
const SEP = '<span aria-hidden="true">›</span>';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function translatorSchema(ws) {
  if (ws.translators) {
    return ws.translators.map(t => ({
      '@type': 'Person',
      name: t.name,
      ...(t.wikidata && { '@id': `https://www.wikidata.org/wiki/${t.wikidata}` }),
    }));
  }
  return ws.translator
    ? { '@type': 'Person', name: ws.translator, ...(ws.translatorWikidata && { '@id': `https://www.wikidata.org/wiki/${ws.translatorWikidata}` }) }
    : undefined;
}

function workCredit(ws) {
  const translatorNames = ws.translators?.map(t => t.name).join(' & ') || ws.translator;
  if (translatorNames) return `${translatorNames} translation${ws.year ? `, ${ws.year}` : ''}`;
  if (ws.edition) return `${ws.edition}${ws.year ? `, ${ws.year}` : ''}`;
  return ws.year ? String(ws.year) : '';
}

function bookSchema(workId) {
  const ws = WORK_SCHEMA[workId] || {};
  const translator = translatorSchema(ws);
  return {
    '@type': 'Book',
    '@id': `${ORIGIN}/${workId}`,
    name: MANIFESTS[workId].title,
    url: `${ORIGIN}/${workId}`,
    inLanguage: ws.lang || 'en',
    ...(ws.description && { description: ws.description }),
    ...(ws.sameAs && { sameAs: ws.sameAs }),
    ...(ws.wikidata && { translationOfWork: { '@type': 'Book', '@id': `https://www.wikidata.org/wiki/${ws.wikidata}` } }),
    ...(translator && { translator }),
    ...(ws.author && { author: ws.author }),
    ...(ws.year && { datePublished: String(ws.year) }),
    ...(WORK_MENTIONS[workId] && { mentions: WORK_MENTIONS[workId] }),
  };
}

// Head fields are rewritten only when meta sets them, so the index keeps the
// title and description the build copied in from about.md.
function rewriteHTML(response, meta) {
  const attr = (name, value) => ({ element(el) { if (value) el.setAttribute(name, value); } });
  return new HTMLRewriter()
    .on('title', { element(el) { if (meta.title) el.setInnerContent(meta.title); } })
    .on('meta[name="description"]', attr('content', meta.desc))
    .on('meta[property="og:description"]', attr('content', meta.desc))
    .on('meta[name="twitter:description"]', attr('content', meta.desc))
    .on('meta[property="og:title"]', attr('content', meta.title))
    .on('meta[name="twitter:title"]', attr('content', meta.title))
    .on('meta[property="og:type"]', attr('content', meta.ogType))
    .on('meta[property="og:url"]', attr('content', meta.canonical))
    .on('link[rel="canonical"]', attr('href', meta.canonical))
    .on('link[rel="alternate"][hreflang]', attr('href', meta.canonical))
    .on('head', {
      element(el) {
        // \u003c keeps verse text from closing the script element.
        if (meta.jsonLd) el.append(`<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>`, { html: true });
        if (meta.prevUrl) el.append(`<link rel="prev" href="${meta.prevUrl}">`, { html: true });
        if (meta.nextUrl) el.append(`<link rel="next" href="${meta.nextUrl}">`, { html: true });
      },
    })
    .on('#breadcrumb', {
      element(el) {
        if (meta.ssrBreadcrumb) {
          el.setInnerContent(meta.ssrBreadcrumb, { html: true });
          el.removeAttribute('hidden');
        }
      },
    })
    .on('#verses', {
      element(el) { if (meta.ssrVerses) el.setInnerContent(meta.ssrVerses, { html: true }); },
    })
    .transform(response);
}

function breadcrumbList(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Scripture', item: `${ORIGIN}/` }, ...items]
      .map((it, i) => ({ '@type': 'ListItem', position: i + 1, ...it })),
  };
}

function indexMeta() {
  const listing = WORKS.map(id => {
    const detail = workCredit(WORK_SCHEMA[id] || {});
    return `<a href="/${id}" class="work-link"><strong>${esc(MANIFESTS[id].title)}</strong>${detail ? ` <span>(${esc(detail)})</span>` : ''}</a>`;
  }).join('\n');
  return {
    canonical: `${ORIGIN}/`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          '@id': `${ORIGIN}/`,
          name: 'Scripture',
          url: `${ORIGIN}/`,
          description: 'A browser-based reader for sixteen sacred texts.',
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: WORKS.map((id, i) => ({
              '@type': 'ListItem', position: i + 1, name: MANIFESTS[id].title, url: `${ORIGIN}/${id}`,
            })),
          },
        },
        {
          '@type': 'Dataset',
          name: 'Sacred Text Corpus — 16 Works',
          description: 'A corpus of sixteen sacred texts spanning Abrahamic, East Asian, Zoroastrian, Buddhist, Finnish, and Norse traditions, in English translation.',
          url: `${ORIGIN}/`,
          creator: AUTHOR,
          license: LICENSE,
          inLanguage: 'en',
          temporalCoverage: '1611/1936',
          spatialCoverage: [
            { '@type': 'Place', name: 'Middle East', '@id': 'https://www.wikidata.org/wiki/Q7204' },
            { '@type': 'Place', name: 'East Asia', '@id': 'https://www.wikidata.org/wiki/Q27231' },
            { '@type': 'Place', name: 'South Asia', '@id': 'https://www.wikidata.org/wiki/Q771405' },
            { '@type': 'Place', name: 'Scandinavia', '@id': 'https://www.wikidata.org/wiki/Q21195' },
            { '@type': 'Place', name: 'Finland', '@id': 'https://www.wikidata.org/wiki/Q33' },
            { '@type': 'Place', name: 'Iran', '@id': 'https://www.wikidata.org/wiki/Q794' },
          ],
          keywords: 'sacred texts, religion, scripture, Bible, Quran, Book of Mormon, Tao Te Ching, Kojiki, Kalevala, Poetic Edda',
        },
      ],
    },
    ssrVerses: `<h1>Sacred Texts</h1><nav class="work-listing">${listing}</nav>`,
  };
}

function workMeta(workId) {
  const manifest = MANIFESTS[workId];
  const workTitle = manifest.title;
  const ws = WORK_SCHEMA[workId] || {};
  const credit = workCredit(ws);
  const url = `${ORIGIN}/${workId}`;
  const bookList = manifest.books.map(b => {
    const start = b.start ?? 1;
    const chLinks = Array.from({ length: b.chapters }, (_, i) =>
      `<a href="/${workId}/${b.id}-${start + i}">${start + i}</a>`
    ).join(' ');
    return `<div class="book-entry"><strong><a href="/${workId}/${b.id}-${start}">${esc(b.name)}</a></strong> <span class="ch-links">${chLinks}</span></div>`;
  }).join('');
  const descHtml = ws.description ? `<p>${esc(ws.description)}</p>` : '';
  return {
    title: `${workTitle} | Scripture`,
    desc: `Read the ${workTitle}${credit ? ' (' + credit + ')' : ''} — full-text search, concordance, verse notes, and cross-tradition comparisons.`,
    canonical: url,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumbList([{ name: workTitle, item: url }]),
        {
          ...bookSchema(workId),
          potentialAction: [
            { '@type': 'ReadAction', target: url },
            { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${ORIGIN}/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
          ],
          license: LICENSE,
          contentRating: 'General',
        },
        {
          '@type': 'Dataset',
          name: `${workTitle} — Full Text`,
          description: ws.description || `Complete text of the ${workTitle}`,
          url,
          license: LICENSE,
          inLanguage: ws.lang || 'en',
          ...((translatorSchema(ws) || ws.author) && { creator: translatorSchema(ws) || ws.author }),
          distribution: {
            '@type': 'DataDownload',
            encodingFormat: 'application/json',
            contentUrl: `${ORIGIN}/data/${workId}/manifest.json`,
          },
        },
      ],
    },
    ssrBreadcrumb: `<a href="/">Scripture</a> ${SEP} <span>${esc(workTitle)}</span>`,
    ssrVerses: `<h1>${esc(workTitle)}</h1>${descHtml}<nav class="book-listing">${bookList}</nav>`,
  };
}

// Returns null when the book or chapter number isn't in the work's manifest.
function chapterMeta(workId, bookId, chapterNum, verseNum) {
  const manifest = MANIFESTS[workId];
  const bookIdx = manifest.books.findIndex(b => b.id === bookId);
  if (bookIdx === -1) return null;
  const book = manifest.books[bookIdx];
  const start = book.start ?? 1;
  const n = parseInt(chapterNum, 10);
  if (n < start || n > start + book.chapters - 1) return null;

  let prevUrl, nextUrl;
  if (n > start) {
    prevUrl = `${ORIGIN}/${workId}/${bookId}-${n - 1}`;
  } else if (bookIdx > 0) {
    const prevBook = manifest.books[bookIdx - 1];
    prevUrl = `${ORIGIN}/${workId}/${prevBook.id}-${(prevBook.start ?? 1) + prevBook.chapters - 1}`;
  }
  if (n < start + book.chapters - 1) {
    nextUrl = `${ORIGIN}/${workId}/${bookId}-${n + 1}`;
  } else if (bookIdx < manifest.books.length - 1) {
    const nextBook = manifest.books[bookIdx + 1];
    nextUrl = `${ORIGIN}/${workId}/${nextBook.id}-${nextBook.start ?? 1}`;
  }

  const workTitle = manifest.title;
  const ws = WORK_SCHEMA[workId] || {};
  const translator = translatorSchema(ws);
  const chapterLabel = `${book.name} ${n}`;
  const chapterUrl = `${ORIGIN}/${workId}/${bookId}-${n}`;
  const verse = verseNum ? parseInt(verseNum, 10) : null;
  const canonical = verse ? `${chapterUrl}:${verse}` : chapterUrl;
  const crumbs = [{ name: workTitle, item: `${ORIGIN}/${workId}` }, { name: chapterLabel, item: chapterUrl }];
  const graph = [
    breadcrumbList(crumbs),
    {
      '@type': 'Chapter',
      '@id': chapterUrl,
      name: chapterLabel,
      url: chapterUrl,
      position: n,
      inLanguage: ws.lang || 'en',
      isPartOf: { ...bookSchema(workId), potentialAction: { '@type': 'ReadAction', target: `${ORIGIN}/${workId}` } },
      audience: { '@type': 'Audience', audienceType: 'Students, scholars, readers of sacred texts' },
      ...(translator && { translator }),
    },
  ];
  const quotation = (url, text, position) => ({
    '@type': 'Quotation',
    '@id': url,
    url,
    text,
    inLanguage: ws.lang || 'en',
    position,
    ...(translator && { translator }),
    isPartOf: { '@type': 'CreativeWork', name: chapterLabel, url: chapterUrl, isPartOf: { '@type': 'Book', name: workTitle, '@id': `${ORIGIN}/${workId}` } },
  });
  const title = `${chapterLabel} | ${workTitle} | Scripture`;
  return {
    title,
    desc: manifest.books.length === 1
      ? `Read ${chapterLabel} — full-text search, concordance, verse notes, and cross-tradition comparisons.`
      : `Read ${chapterLabel} (${workTitle}) — full-text search, concordance, verse notes, and cross-tradition comparisons.`,
    canonical,
    ogType: 'article',
    prevUrl,
    nextUrl,
    ssrBreadcrumb: `<a href="/">Scripture</a> ${SEP} <a href="/${workId}">${esc(workTitle)}</a> ${SEP} <span>${esc(chapterLabel)}</span>`,
    jsonLd: { '@context': 'https://schema.org', '@graph': graph },

    // Fills in the verse text, a verse-specific title and description, and
    // Quotation JSON-LD from the chapter's records.
    addChapter(chapter) {
      const allVerses = chapter.sections.flatMap(s => s.verses);
      if (verse) {
        // Flattened index: agrees with the client only when numbering starts
        // at 1 and never restarts within the chapter.
        const verseText = verse <= allVerses.length ? allVerses[verse - 1] : null;
        if (!verseText) return;
        this.title = `${chapterLabel}:${verse} | ${workTitle} | Scripture`;
        this.desc = verseText.length > 160 ? verseText.slice(0, verseText.lastIndexOf(' ', 160)) + '…' : verseText;
        this.ssrVerses = `<p><b>${verse}.</b> ${esc(verseText)}</p>`;
        crumbs.push({ name: `Verse ${verse}`, item: canonical });
        graph[0] = breadcrumbList(crumbs);
        const q = quotation(canonical, verseText, verse);
        if (WORK_MENTIONS[workId]) q.mentions = WORK_MENTIONS[workId];
        graph.push(q);
        return;
      }
      const maxVerses = 25;
      let rendered = 0;
      let html = '';
      for (let si = 0; si < chapter.sections.length && rendered < maxVerses; si++) {
        const sec = chapter.sections[si];
        if (chapter.sections.length > 1) {
          html += `<span class="section-heading" aria-label="Section ${si + 1}">${si + 1}</span>`;
        }
        for (let vi = 0; vi < sec.verses.length && rendered < maxVerses; vi++) {
          html += `<p><b>${rendered + 1}.</b> ${esc(sec.verses[vi])}</p>`;
          rendered++;
        }
      }
      this.ssrVerses = html + (allVerses.length > maxVerses ? `<p><em>${allVerses.length - maxVerses} more verses…</em></p>` : '');
      if (allVerses.length > 0) graph.push(quotation(`${chapterUrl}:1`, allVerses[0], 1));
    },
  };
}

async function notFound(env, origin) {
  const page = await env.ASSETS.fetch(new URL('/404.html', origin));
  return secure(new Response(page.body, { status: 404, headers: page.headers }), { 'X-Robots-Tag': 'noindex, nofollow' });
}

export default {
  async fetch(request, env) {
    const { pathname, origin } = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const shell = () => env.ASSETS.fetch(new URL('/', origin));

    if (pathname === '/') return secure(rewriteHTML(await shell(), indexMeta()));

    // /{workId} or /{workId}/
    const workMatch = pathname.match(/^\/([a-z]+)\/?$/);
    if (workMatch && MANIFESTS[workMatch[1]]) {
      return secure(rewriteHTML(await shell(), workMeta(workMatch[1])));
    }

    // /{workId}/{bookId}-{chapter}[:verse]
    const chapterMatch = pathname.match(/^\/([a-z]+)\/(.+)-(\d+)(?::(\d+))?$/);
    if (chapterMatch && MANIFESTS[chapterMatch[1]]) {
      const [, workId, bookId, chapterNum, verseNum] = chapterMatch;
      const meta = chapterMeta(workId, bookId, chapterNum, verseNum);
      if (meta) {
        try {
          const res = await Promise.race([
            env.ASSETS.fetch(new URL(`/data/${workId}/chapters/${bookId}-${parseInt(chapterNum, 10)}.json`, origin)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
          ]);
          if (res.ok) meta.addChapter(await res.json());
        } catch (_) { /* verse SSR failed — client JS will hydrate */ }
        return secure(rewriteHTML(await shell(), meta));
      }
    }

    return notFound(env, origin);
  },
};
