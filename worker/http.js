// Security policy for Worker-generated responses. static/_headers carries the
// matching policy for responses served directly by Workers Static Assets.
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self'; base-uri 'self'; frame-ancestors 'self'",
  'Content-Language': 'en',
};

export function secure(response, extra) {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
  // Public URLs are stable rather than content-hashed, so browsers revalidate.
  secured.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  secured.headers.set('Vary', 'Accept-Encoding');
  if (extra) {
    for (const [name, value] of Object.entries(extra)) secured.headers.set(name, value);
  }
  return secured;
}
