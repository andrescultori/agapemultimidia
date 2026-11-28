import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, mailbox, call, login } from './helpers.js';
import admin from '../api/admin/[action].js';
import { setStorage } from '../api/_lib/storage.js';
import settings from '../api/settings.js';
import { PAGES } from '../api/_lib/settings.js';

const A = (action, o = {}) => call(admin, { url: `/api/admin/${action}`, query: { action }, ...o });
const base = () => structuredClone(PAGES.pro.defaults);

test('otp: silent for unknown emails, 3 codes per 15 min, wrong codes lock the code, single use', async () => {
  await freshDb(); const sent = mailbox();
  const r1 = await A('otp-request', { method: 'POST', body: { email: 'stranger@example.com' } });
  assert.equal(r1.status, 200); assert.equal(sent.length, 0);
  for (let i = 0; i < 4; i++) await A('otp-request', { method: 'POST', body: { email: 'Fabio@Example.com' } });
  assert.equal(sent.length, 3);
  const code = sent.at(-1).code; const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await A('otp-verify', { method: 'POST', body: { email: 'fabio@example.com', code: wrong } })).status, 401);
  assert.equal((await A('otp-verify', { method: 'POST', body: { email: 'fabio@example.com', code } })).status, 401, 'locked after 5 tries');
});

test('otp: good code logs in once, cookie flags, logout ends the session', async () => {
  await freshDb(); const sent = mailbox();
  await A('otp-request', { method: 'POST', body: { email: 'fabio@example.com' } });
  const code = sent[0].code;
  const ok = await A('otp-verify', { method: 'POST', body: { email: 'fabio@example.com', code } });
  assert.equal(ok.status, 200);
  const cookie = ok.headers['set-cookie'];
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Secure/);
  assert.equal((await A('otp-verify', { method: 'POST', body: { email: 'fabio@example.com', code } })).status, 401, 'code is single use');
  const c = cookie.split(';')[0];
  assert.equal((await A('me', { headers: { cookie: c } })).json.email, 'fabio@example.com');
  await A('logout', { method: 'POST', headers: { cookie: c } });
  assert.equal((await A('me', { headers: { cookie: c } })).status, 401);
});

test('api needs a session and a same-origin request', async () => {
  await freshDb(); const sent = mailbox();
  assert.equal((await A('state')).status, 401);
  const c = await login(admin, sent);
  assert.equal((await A('draft', { method: 'PUT', headers: { cookie: c, origin: 'https://evil.test' }, body: { data: base() } })).status, 403);
  assert.equal((await A('draft', { method: 'PUT', headers: { cookie: c, origin: undefined }, body: { data: base() } })).status, 403);
});

test('draft -> preview -> publish -> public read, with history and restore', async () => {
  await freshDb(); const sent = mailbox();
  const c = await login(admin, sent);
  const S = (q = '', h = {}) => call(settings, { url: `/api/settings?page=pro${q}`, headers: h });

  assert.equal((await S()).json.version, 0, 'defaults before any publish');
  const bad = base(); bad.price.discountPct = 10;
  assert.equal((await A('draft', { method: 'PUT', headers: { cookie: c }, body: { data: bad } })).status, 422);

  const next = base(); next.price.cash = 99.9; next.price.discountPct = 66; next.price.installmentValue = 10.4; next.price.monthlyCap = 11; next.kpis[0] = '190 mil';
  assert.equal((await A('draft', { method: 'PUT', headers: { cookie: c }, body: { data: next } })).status, 200);

  assert.equal((await S()).json.data.kpis[0], '182 mil', 'public still shows the old values');
  assert.equal((await S('&draft=1')).json.data.kpis[0], '182 mil', 'draft hidden without a session');
  const prev = await S('&draft=1', { cookie: c });
  assert.equal(prev.json.data.kpis[0], '190 mil'); assert.equal(prev.headers['cache-control'], 'no-store');

  const pub = await A('publish', { method: 'POST', headers: { cookie: c }, body: {} });
  assert.equal(pub.status, 200);
  assert.ok(pub.json.changes.some((x) => x.field === 'price.cash' && x.isPrice));
  const live = await S();
  assert.equal(live.json.data.price.cash, 99.9); assert.match(live.headers['cache-control'], /s-maxage=60/);
  assert.equal((await A('publish', { method: 'POST', headers: { cookie: c }, body: {} })).status, 409, 'nothing left to publish');

  const st = (await A('state', { headers: { cookie: c } })).json;
  assert.equal(st.history.length, 1); assert.equal(st.draft, null);
  const rest = await A('restore', { method: 'POST', headers: { cookie: c }, body: { versionId: st.history[0].id } });
  assert.equal(rest.json.draft.data.price.cash, 99.9);
  assert.equal((await S()).json.data.price.cash, 99.9, 'restore only creates a draft');
});

test('upload: type sniffing, size limit, storage url', async () => {
  await freshDb(); const sent = mailbox();
  const c = await login(admin, sent);
  setStorage(async (name) => `https://abc.supabase.co/storage/v1/object/public/site-images/${name}`);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const ok = await A('upload', { method: 'POST', headers: { cookie: c }, body: png });
  assert.equal(ok.status, 200); assert.match(ok.json.url, /hero\/[0-9a-f]{12}\.png$/);
  assert.equal((await A('upload', { method: 'POST', headers: { cookie: c }, body: Buffer.from('<svg onload=alert(1)>') })).status, 415);
  assert.equal((await A('upload', { method: 'POST', headers: { cookie: c }, body: Buffer.alloc(5 * 1024 * 1024) })).status, 413);
});

test('public settings fall back to defaults if the database fails', async () => {
  const { setDb } = await import('../api/_lib/db.js');
  setDb(async () => { throw new Error('down'); });
  const r = await call(settings, { url: '/api/settings?page=pro' });
  assert.equal(r.status, 200); assert.equal(r.json.version, 0);
  assert.equal((await call(settings, { url: '/api/settings?page=nope' })).status, 400);
});
