// Builds dist/: only the public static folders (source, docs and tests are never published) plus _redirects/_headers.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const d of ['pro', 'black', 'admin', 'shared']) cpSync(d, `dist/${d}`, { recursive: true });
// Redirects and headers for Cloudflare (same rules as vercel.json).
import { writeFileSync } from 'node:fs';
// Each short link needs the bare, trailing-slash and sub-path forms; /cursos is reserved for a future catalog page.
writeFileSync('dist/_redirects', [
  '/ /pro/ 302',
  '/transmissao-ao-vivo-pro /pro/ 302', '/transmissao-ao-vivo-pro/ /pro/ 302', '/transmissao-ao-vivo-pro/* /pro/ 302',
  '/cursos /pro/ 302', '/cursos/ /pro/ 302', '/cursos/* /pro/ 302',
  '/admin /admin/ 302', '',
].join('\n'));
writeFileSync('dist/_headers', [
  '/admin/*', '  Cache-Control: no-store', '  X-Robots-Tag: noindex, nofollow', '  X-Frame-Options: DENY', '  Referrer-Policy: no-referrer',
  "  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  '/shared/*', '  Cache-Control: public, max-age=300', '',
].join('\n'));
console.log('dist/ ready');
