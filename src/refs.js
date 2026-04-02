/* ===================================================================
   refs.js — Book ID map and reference formatting.
   Single source of truth for book IDs and display abbreviations.
   =================================================================== */

/**
 * bookId → { work: workId, abbrev: display abbreviation }
 *
 * Book IDs are abbreviated slugs that double as the chapter-ID prefix:
 * chapter "gen-1" = book "gen", chapter 1.  This eliminates the need
 * for a separate chapterPrefix field or a reverse-lookup map.
 */
const BOOKS = {
  // Old Testament
  'gen':   { work: 'ot', abbrev: 'Gen.' },
  'ex':    { work: 'ot', abbrev: 'Ex.' },
  'lev':   { work: 'ot', abbrev: 'Lev.' },
  'num':   { work: 'ot', abbrev: 'Num.' },
  'deut':  { work: 'ot', abbrev: 'Deut.' },
  'josh':  { work: 'ot', abbrev: 'Josh.' },
  'judg':  { work: 'ot', abbrev: 'Judg.' },
  'ruth':  { work: 'ot', abbrev: 'Ruth' },
  '1-sam': { work: 'ot', abbrev: '1 Sam.' },
  '2-sam': { work: 'ot', abbrev: '2 Sam.' },
  '1-kgs': { work: 'ot', abbrev: '1 Kgs.' },
  '2-kgs': { work: 'ot', abbrev: '2 Kgs.' },
  '1-chr': { work: 'ot', abbrev: '1 Chr.' },
  '2-chr': { work: 'ot', abbrev: '2 Chr.' },
  'ezra':  { work: 'ot', abbrev: 'Ezra' },
  'neh':   { work: 'ot', abbrev: 'Neh.' },
  'esth':  { work: 'ot', abbrev: 'Esth.' },
  'job':   { work: 'ot', abbrev: 'Job' },
  'ps':    { work: 'ot', abbrev: 'Ps.' },
  'prov':  { work: 'ot', abbrev: 'Prov.' },
  'eccl':  { work: 'ot', abbrev: 'Eccl.' },
  'song':  { work: 'ot', abbrev: 'Song' },
  'isa':   { work: 'ot', abbrev: 'Isa.' },
  'jer':   { work: 'ot', abbrev: 'Jer.' },
  'lam':   { work: 'ot', abbrev: 'Lam.' },
  'ezek':  { work: 'ot', abbrev: 'Ezek.' },
  'dan':   { work: 'ot', abbrev: 'Dan.' },
  'hosea': { work: 'ot', abbrev: 'Hosea' },
  'joel':  { work: 'ot', abbrev: 'Joel' },
  'amos':  { work: 'ot', abbrev: 'Amos' },
  'obad':  { work: 'ot', abbrev: 'Obad.' },
  'jonah': { work: 'ot', abbrev: 'Jonah' },
  'micah': { work: 'ot', abbrev: 'Micah' },
  'nahum': { work: 'ot', abbrev: 'Nahum' },
  'hab':   { work: 'ot', abbrev: 'Hab.' },
  'zeph':  { work: 'ot', abbrev: 'Zeph.' },
  'hag':   { work: 'ot', abbrev: 'Hag.' },
  'zech':  { work: 'ot', abbrev: 'Zech.' },
  'mal':   { work: 'ot', abbrev: 'Mal.' },

  // New Testament
  'matt':   { work: 'nt', abbrev: 'Matt.' },
  'mark':   { work: 'nt', abbrev: 'Mark' },
  'luke':   { work: 'nt', abbrev: 'Luke' },
  'john':   { work: 'nt', abbrev: 'John' },
  'acts':   { work: 'nt', abbrev: 'Acts' },
  'rom':    { work: 'nt', abbrev: 'Rom.' },
  '1-cor':  { work: 'nt', abbrev: '1 Cor.' },
  '2-cor':  { work: 'nt', abbrev: '2 Cor.' },
  'gal':    { work: 'nt', abbrev: 'Gal.' },
  'eph':    { work: 'nt', abbrev: 'Eph.' },
  'philip': { work: 'nt', abbrev: 'Philip.' },
  'col':    { work: 'nt', abbrev: 'Col.' },
  '1-thes': { work: 'nt', abbrev: '1 Thes.' },
  '2-thes': { work: 'nt', abbrev: '2 Thes.' },
  '1-tim':  { work: 'nt', abbrev: '1 Tim.' },
  '2-tim':  { work: 'nt', abbrev: '2 Tim.' },
  'titus':  { work: 'nt', abbrev: 'Titus' },
  'philem': { work: 'nt', abbrev: 'Philem.' },
  'heb':    { work: 'nt', abbrev: 'Heb.' },
  'james':  { work: 'nt', abbrev: 'James' },
  '1-pet':  { work: 'nt', abbrev: '1 Pet.' },
  '2-pet':  { work: 'nt', abbrev: '2 Pet.' },
  '1-jn':   { work: 'nt', abbrev: '1 Jn.' },
  '2-jn':   { work: 'nt', abbrev: '2 Jn.' },
  '3-jn':   { work: 'nt', abbrev: '3 Jn.' },
  'jude':   { work: 'nt', abbrev: 'Jude' },
  'rev':    { work: 'nt', abbrev: 'Rev.' },

  // Book of Mormon
  '1-ne':   { work: 'bom', abbrev: '1 Ne.' },
  '2-ne':   { work: 'bom', abbrev: '2 Ne.' },
  'jacob':  { work: 'bom', abbrev: 'Jacob' },
  'enos':   { work: 'bom', abbrev: 'Enos' },
  'jarom':  { work: 'bom', abbrev: 'Jarom' },
  'omni':   { work: 'bom', abbrev: 'Omni' },
  'w-of-m': { work: 'bom', abbrev: 'W of M' },
  'mosiah': { work: 'bom', abbrev: 'Mosiah' },
  'alma':   { work: 'bom', abbrev: 'Alma' },
  'hel':    { work: 'bom', abbrev: 'Hel.' },
  '3-ne':   { work: 'bom', abbrev: '3 Ne.' },
  '4-ne':   { work: 'bom', abbrev: '4 Ne.' },
  'morm':   { work: 'bom', abbrev: 'Morm.' },
  'ether':  { work: 'bom', abbrev: 'Ether' },
  'moro':   { work: 'bom', abbrev: 'Moro.' },

  // Doctrine and Covenants
  'dc': { work: 'dc', abbrev: 'D&C' },
  'od': { work: 'dc', abbrev: 'OD' },

  // Pearl of Great Price
  'moses': { work: 'pgp', abbrev: 'Moses' },
  'abr':   { work: 'pgp', abbrev: 'Abr.' },
  'js-m':  { work: 'pgp', abbrev: 'JS\u2014M' },
  'js-h':  { work: 'pgp', abbrev: 'JS\u2014H' },
  'a-of-f': { work: 'pgp', abbrev: 'A of F' },

  // Quran
  'quran': { work: 'quran', abbrev: 'Quran' },

  // Apocrypha
  'tobit':    { work: 'apoc', abbrev: 'Tobit' },
  'judith':   { work: 'apoc', abbrev: 'Judith' },
  'add-esth': { work: 'apoc', abbrev: 'Add. Esth.' },
  'wis':      { work: 'apoc', abbrev: 'Wis.' },
  'sir':      { work: 'apoc', abbrev: 'Sir.' },
  'bar':      { work: 'apoc', abbrev: 'Bar.' },
  'pr-azar':  { work: 'apoc', abbrev: 'Pr. Azar.' },
  'sus':      { work: 'apoc', abbrev: 'Sus.' },
  'bel':      { work: 'apoc', abbrev: 'Bel' },
  '1-macc':   { work: 'apoc', abbrev: '1 Macc.' },
  '2-macc':   { work: 'apoc', abbrev: '2 Macc.' },
  '1-esd':    { work: 'apoc', abbrev: '1 Esd.' },
  'pr-man':   { work: 'apoc', abbrev: 'Pr. Man.' },
  '2-esd':    { work: 'apoc', abbrev: '2 Esd.' },

  // The Four Books
  'gl':       { work: 'fourbooks', abbrev: 'G.L.' },
  'dom':      { work: 'fourbooks', abbrev: 'D.M.' },
  'analects': { work: 'fourbooks', abbrev: 'Analects' },
  'mencius':  { work: 'fourbooks', abbrev: 'Mencius' },

  // Tao Te Ching
  'ttc': { work: 'ttc', abbrev: 'T.T.C.' },

  // Kojiki
  'kjk': { work: 'kj', abbrev: 'Kami.' },
  'kjn': { work: 'kj', abbrev: 'Naka.' },
  'kjs': { work: 'kj', abbrev: 'Shimo.' },

  // Bundahis
  'bund': { work: 'bund', abbrev: 'Bund.' },

  // Lotus Sutra
  'lotus': { work: 'lotus', abbrev: 'Lotus' }
};

/**
 * Format a chapter reference for display.
 * e.g. formatRef('gen-1', 26) → 'Gen. 1:26'
 */
export function formatRef(chapterId, verse) {
  const i = chapterId.lastIndexOf('-');
  if (i > 0) {
    const bookId = chapterId.slice(0, i);
    const chNum = chapterId.slice(i + 1);
    if (BOOKS[bookId]) return `${BOOKS[bookId].abbrev} ${chNum}:${verse}`;
  }
  return `${chapterId}:${verse}`;
}
