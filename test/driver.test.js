// Runs the real postgres.js driver (the one used in production against Supabase) through the full admin flow,
// talking to an in-memory Postgres over the wire protocol.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

process.env.SESSION_SECRET = 'y'.repeat(40);
process.env.ADMIN_EMAILS = 'fabio@example.com';
process.env.SUPABASE_URL = 'https://abc.supabase.co';
process.env.DATABASE_SSL = 'disable';
const port = 55000 + Math.floor(Math.random() * 4000);

const pg = new PGlite();
await pg.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
const server = new PGLiteSocketServer({ db: pg, port, host: '127.0.0.1' });
await server.start();
process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;

const { mailbox, call, login } = await import('./helpers.js');
const { default: admin } = await import('../api/admin/[action].js');
const { default: settings } = await import('../api/settings.js');
const { setDb } = await import('../api/_lib/db.js');
setDb(null); // helpers.js installs an in-memory override; this file wants the real driver
const { PAGES } = await import('../api/_lib/settings.js');

test('real driver: login, draft, publish, public read, history', async () => {
  const sent = mailbox();
  const cookie = await login(admin, sent);
  const next = structuredClone(PAGES.pro.defaults);
  next.kpis[1] = '+25 milhões';
  const d = await call(admin, { method: 'PUT', url: '/api/admin/draft', query: { action: 'draft' }, headers: { cookie }, body: { data: next } });
  assert.equal(d.status, 200, JSON.stringify(d.json).slice(0,300));
  const p = await call(admin, { method: 'POST', url: '/api/admin/publish', query: { action: 'publish' }, headers: { cookie }, body: {} });
  assert.equal(p.status, 200, JSON.stringify(p.json));
  const pub = await call(settings, { url: '/api/settings?page=pro' });
  assert.equal(pub.json.data.kpis[1], '+25 milhões');
  assert.ok(pub.json.version > 0);
  const st = await call(admin, { url: '/api/admin/state', query: { action: 'state' }, headers: { cookie } });
  assert.equal(st.json.history.length, 1);
  assert.equal(typeof st.json.history[0].id, 'number');
  const [raw] = await pg.query(`select jsonb_typeof(data) as t from agape_admin.settings_versions where status = 'published'`).then((r) => r.rows);
  assert.equal(raw.t, 'object', 'settings are stored as a JSON object, not a JSON string');
});

test.after(async () => { await server.stop(); await pg.close(); setTimeout(() => process.exit(0), 50); });
