// The public origin, set in one place. tools/build.mjs writes it into the
// staged HTML, sitemap, robots.txt, and OpenSearch description; the Worker
// uses it for canonical URLs and JSON-LD.
export const ORIGIN = 'https://scripture.a9l.im';
