// Runs the real Cloudflare Worker locally (workerd via wrangler) against an in-memory Postgres and a fake Resend,
// then walks the admin flow over HTTP. Usage: npm run test:worker   (builds dist/ first)
import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

execSync('npm run build:cf', { stdio: 'ignore' });
const rnd = (a) => a + Math.floor(Math.random() * 3000);
const [dbPort, mailPort, workerPort] = [rnd(55000), rnd(58000), rnd(8800)];

const pg = new PGlite();
await pg.exec(readFileSync('db/schema.sql', 'utf8'));
const dbServer = new PGLiteSocketServer({ db: pg, port: dbPort, host: '127.0.0.1' });
await dbServer.start();

const mails = [];
const mailServer = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { mails.push(JSON.parse(b)); res.end('{"id":"x"}'); });
}).listen(mailPort, '127.0.0.1');

const vars = {
  DATABASE_URL: `postgres://postgres:x@127.0.0.1:${dbPort}/postgres`, DATABASE_SSL: 'disable',
  SESSION_SECRET: 'w'.repeat(40), ADMIN_EMAILS: 'fabio@example.com', RESEND_API_KEY: 'test', RESEND_FROM: 'a@b.c',
  RESEND_API_URL: `http://127.0.0.1:${mailPort}/emails`, SUPABASE_URL: 'https://abc.supabase.co',
};
const args = ['wrangler', 'dev', '--local', '--port', String(workerPort), '--ip', '127.0.0.1', ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])];
const worker = spawn('npx', args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
let log = '';
worker.stdout.on('data', (d) => (log += d)); worker.stderr.on('data', (d) => (log += d));

const base = `http://127.0.0.1:${workerPort}`;
const stop = async () => { worker.kill('SIGTERM'); mailServer.close(); await dbServer.stop(); await pg.close(); };
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/pro/`)).ok) break; } catch {}
    if (i > 90) throw new Error('worker did not start:\n' + log.slice(-1500));
    await new Promise((r) => setTimeout(r, 1000));
  }
  const post = (path, body, cookie) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  const put = (path, body, cookie) => fetch(base + path, { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: base, cookie }, body: JSON.stringify(body) });
  const check = (name, ok) => console.log(ok ? '  ok  ' : '  FAIL', name);

  // static assets, redirects, headers (served from dist/ without running the Worker)
  const root = await fetch(base + '/', { redirect: 'manual' });
  check('/ redirects to /pro/', root.status === 302 && root.headers.get('location').endsWith('/pro/'));
  const cursos = await fetch(base + '/cursos', { redirect: 'manual' });
  check('/cursos redirects to /pro/', cursos.status === 302 && cursos.headers.get('location').endsWith('/pro/'));
  const admin = await fetch(base + '/admin/');
  check('/admin/ has CSP + no-store', /default-src/.test(admin.headers.get('content-security-policy') || '') && /no-store/.test(admin.headers.get('cache-control') || ''));
  check('docs are not published', (await fetch(base + '/CLAUDE.md')).status === 404 && (await fetch(base + '/db/schema.sql')).status === 404);

  // login with the real postgres.js on workerd
  assert.equal((await post('/api/admin/otp-request', { email: 'stranger@example.com' })).status, 200);
  assert.equal(mails.length, 0, 'no mail for strangers');
  assert.equal((await post('/api/admin/otp-request', { email: 'fabio@example.com' })).status, 200);
  check('otp email sent to the allow-listed address', mails.length === 1 && mails[0].to[0] === 'fabio@example.com');
  const code = /\b(\d{6})\b/.exec(mails[0].text)[1];
  const v = await post('/api/admin/otp-verify', { email: 'fabio@example.com', code });
  check('otp verify sets a secure session cookie', v.status === 200 && /HttpOnly/.test(v.headers.get('set-cookie')));
  const cookie = v.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(base + '/api/admin/me', { headers: { cookie } })).json();
  check('session works', me.email === 'fabio@example.com');

  // draft -> publish -> public read through the edge cache
  const st = await (await fetch(base + '/api/admin/state?page=pro', { headers: { cookie } })).json();
  const next = structuredClone(st.defaults); next.kpis[0] = '190 mil';
  check('draft saved', (await put('/api/admin/draft', { page: 'pro', data: next }, cookie)).status === 200);
  check('publish ok', (await post('/api/admin/publish', { page: 'pro' }, cookie)).status === 200);
  const s1 = await fetch(base + '/api/settings?page=pro'); const j1 = await s1.json();
  check('public settings show the published value', j1.data.kpis[0] === '190 mil' && j1.version > 0);
  const s2 = await fetch(base + '/api/settings?page=pro');
  check('second read comes from the edge cache', s2.headers.get('x-cache') === 'HIT');
  const dr = await (await fetch(base + '/api/settings?page=pro&draft=1')).json();
  check('draft flag without a session returns published data', dr.data.kpis[0] === '190 mil' && !dr.draft);
  check('unauthenticated admin call is rejected', (await fetch(base + '/api/admin/state')).status === 401);
  console.log('worker flow passed');
} catch (e) {
  console.error('FAILED:', e.message, '\n--- worker log tail ---\n' + log.slice(-2500));
  process.exitCode = 1;
} finally {
  await stop(); setTimeout(() => process.exit(process.exitCode || 0), 100);
}
