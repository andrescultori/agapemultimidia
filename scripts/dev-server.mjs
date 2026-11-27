// Local preview of the site + admin with an in-memory database. No accounts needed.
//   npm run dev     ->  http://127.0.0.1:8765/pro/   and   http://127.0.0.1:8765/admin/
// The login code is printed in this terminal instead of being emailed; image uploads are kept in memory.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { setDb } from '../api/_lib/db.js';
import { setMailer } from '../api/_lib/mail.js';

process.env.SESSION_SECRET ||= 'local-dev-secret-local-dev-secret-0000';
process.env.ADMIN_EMAILS ||= 'dev@example.com';
process.env.NODE_ENV = 'development';
const port = Number(process.env.PORT || 8765);
const root = new URL('..', import.meta.url).pathname;

const pg = new PGlite();
await pg.exec(readFileSync(join(root, 'db/schema.sql'), 'utf8'));
setDb(async (t, p) => (await pg.query(t, p)).rows);
setMailer(async (to, code) => console.log(`\n  [dev] login code for ${to}: ${code}\n`));

const { default: settings } = await import('../api/settings.js');
const { default: admin, setBlob } = await import('../api/admin/[action].js');
const uploads = new Map();
setBlob(async (name, buf, o) => { uploads.set('/__blob/' + name, { buf, type: o.contentType }); return { url: `http://127.0.0.1:${port}/__blob/${name}` }; });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const chunks = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/settings') return settings(req, res);
    const m = /^\/api\/admin\/([\w-]+)$/.exec(url.pathname);
    if (m) {
      req.query = { action: m[1] };
      const buf = await chunks(req);
      const ct = req.headers['content-type'] || '';
      req.body = ct.includes('json') ? (buf.length ? JSON.parse(buf) : {}) : buf;
      return admin(req, res);
    }
    if (uploads.has(url.pathname)) { const u = uploads.get(url.pathname); res.setHeader('Content-Type', u.type); return res.end(u.buf); }
    let f = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!f.startsWith(root) || f.includes('/node_modules/') || f.includes('/.git/')) { res.statusCode = 403; return res.end(); }
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f)) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', types[extname(f)] || 'application/octet-stream');
    res.end(readFileSync(f));
  } catch (e) { console.error(e); res.statusCode = 500; res.end('error'); }
}).listen(port, '127.0.0.1', () => console.log(`Local site: http://127.0.0.1:${port}/pro/  admin: http://127.0.0.1:${port}/admin/  (allowed email: ${process.env.ADMIN_EMAILS})`));
