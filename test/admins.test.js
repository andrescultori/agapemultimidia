import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, mailbox, call, login } from './helpers.js';
import admin from '../api/admin/[action].js';

const A = (action, o = {}) => call(admin, { url: `/api/admin/${action}`, query: { action }, ...o });
const get = (cookie, action) => A(action, { headers: { cookie } });
const send = (cookie, action, method, body, extra = {}) => A(action, { method, headers: { cookie, ...extra }, body });
const add = (c, email, name) => send(c, 'admins-add', 'POST', { email, name });
const OWNERS = ['fabio@example.com', 'andre@example.com'];

test('list: owners come from ADMIN_EMAILS (normalized) and the table starts empty', async () => {
  await freshDb(); const sent = mailbox();
  const c = await login(admin, sent);
  const r = await get(c, 'admins-list');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.owners, OWNERS);
  assert.deepEqual(r.json.admins, []);
  assert.equal(r.json.me, 'fabio@example.com');
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('add, edit and remove: any logged-in admin can manage the others', async () => {
  await freshDb(); const sent = mailbox();
  const owner = await login(admin, sent);

  const a1 = await add(owner, '  Novo@Example.COM ', '  Fábio, cliente  ');
  assert.equal(a1.status, 200);
  assert.equal(a1.json.admin.email, 'novo@example.com');
  assert.equal(a1.json.admin.name, 'Fábio, cliente');
  assert.equal(a1.json.admin.createdBy, 'fabio@example.com');
  assert.equal(a1.json.admins.length, 1);

  // the new admin logs in with an emailed code and manages the others
  const novo = await login(admin, sent, 'novo@example.com');
  assert.equal((await get(novo, 'me')).json.email, 'novo@example.com');
  const b = await add(novo, 'outro@example.com', null);
  assert.equal(b.status, 200); assert.equal(b.json.admin.name, null);
  const id = b.json.admin.id;

  const up = await send(novo, 'admins-update', 'PUT', { id, name: 'Outra pessoa', email: 'trocado@example.com' });
  assert.equal(up.status, 200);
  const row = up.json.admins.find((x) => x.id === id);
  assert.equal(row.email, 'trocado@example.com'); assert.equal(row.name, 'Outra pessoa');

  const rm = await send(owner, 'admins-remove', 'POST', { id });
  assert.equal(rm.status, 200);
  assert.equal(rm.json.admins.some((x) => x.id === id), false);
});

test('owners are protected: cannot be added again, and are always listed and allowed', async () => {
  const pg = await freshDb(); const sent = mailbox();
  const c = await login(admin, sent);
  const dup = await add(c, 'ANDRE@example.com', 'Outro nome');
  assert.equal(dup.status, 409); assert.match(dup.json.message, /protegido/);
  const x = await add(c, 'x@example.com', 'X'); assert.equal(x.status, 200);

  // renaming an admin to an owner address is refused too
  const up = await send(c, 'admins-update', 'PUT', { id: x.json.admin.id, email: 'fabio@example.com' });
  assert.equal(up.status, 409);

  // even with the whole table wiped, owners can still log in and are still listed
  await pg.exec('delete from agape_admin.admins');
  const again = await login(admin, sent, 'andre@example.com');
  assert.deepEqual((await get(again, 'admins-list')).json.owners, OWNERS);
});

test('validation and duplicates', async () => {
  await freshDb(); const sent = mailbox();
  const c = await login(admin, sent);
  for (const bad of ['', 'sem-arroba', 'a@b', 'a b@c.com', 'a@b.com, c@d.com', '<x>@y.com', 'a'.repeat(250) + '@x.com', 123, null]) {
    const r = await add(c, bad, 'x');
    assert.equal(r.status, 422, String(bad));
    assert.equal(r.json.field, 'email');
  }
  assert.equal((await add(c, 'ok@example.com', 'n'.repeat(81))).status, 422);
  assert.equal((await add(c, 'ok@example.com', 'n'.repeat(80))).status, 200);
  assert.equal((await add(c, 'OK@example.com', 'again')).status, 409, 'duplicates ignore case');
  const second = await add(c, 'second@example.com', '');
  assert.equal(second.status, 200); assert.equal(second.json.admin.name, null, 'empty name becomes null');
  const clash = await send(c, 'admins-update', 'PUT', { id: second.json.admin.id, email: 'ok@example.com' });
  assert.equal(clash.status, 409);
  assert.equal((await send(c, 'admins-update', 'PUT', { id: 99999, name: 'x' })).status, 404);
  assert.equal((await send(c, 'admins-update', 'PUT', { id: second.json.admin.id })).status, 422, 'nothing to change');
  assert.equal((await send(c, 'admins-remove', 'POST', { id: 99999 })).status, 404);
  assert.equal((await send(c, 'admins-remove', 'POST', { id: 'abc' })).status, 404);
});

test('self-protection: no self-remove and no own-email change, own name is fine', async () => {
  await freshDb(); const sent = mailbox();
  const owner = await login(admin, sent);
  const me = (await add(owner, 'eu@example.com', 'Eu')).json.admin;
  const mine = await login(admin, sent, 'eu@example.com');

  const rm = await send(mine, 'admins-remove', 'POST', { id: me.id });
  assert.equal(rm.status, 403); assert.match(rm.json.message, /si mesmo/);
  const mail = await send(mine, 'admins-update', 'PUT', { id: me.id, email: 'novo-eu@example.com' });
  assert.equal(mail.status, 403);
  assert.equal((await get(mine, 'me')).status, 200, 'session untouched');
  const nm = await send(mine, 'admins-update', 'PUT', { id: me.id, name: 'Meu novo nome' });
  assert.equal(nm.status, 200);
  assert.equal(nm.json.admins.find((x) => x.id === me.id).name, 'Meu novo nome');
  // same email re-sent with a different case is not a change of email
  assert.equal((await send(mine, 'admins-update', 'PUT', { id: me.id, email: 'EU@example.com', name: 'Ainda eu' })).status, 200);
});

test('removing an admin or changing the email ends their sessions at once', async () => {
  const pg = await freshDb(); const sent = mailbox();
  const rows = async (email) => (await pg.query('select (select count(*)::int from agape_admin.sessions where email = $1) as s, (select count(*)::int from agape_admin.otp_codes where email = $1) as o', [email])).rows[0];
  const owner = await login(admin, sent);
  const b = (await add(owner, 'b@example.com', 'B')).json.admin;
  const cookieB = await login(admin, sent, 'b@example.com');
  assert.equal((await get(cookieB, 'me')).status, 200);

  // email change: old session dies, old address cannot log in, new address can
  assert.deepEqual(await rows('b@example.com'), { s: 1, o: 1 });
  assert.equal((await send(owner, 'admins-update', 'PUT', { id: b.id, email: 'b2@example.com' })).status, 200);
  assert.equal((await get(cookieB, 'me')).status, 401);
  assert.deepEqual(await rows('b@example.com'), { s: 0, o: 0 }, 'session and code rows of the old address are deleted');
  const before = sent.length;
  await A('otp-request', { method: 'POST', body: { email: 'b@example.com' } });
  assert.equal(sent.length, before, 'old address gets no code');
  const cookieB2 = await login(admin, sent, 'b2@example.com');
  assert.equal((await get(cookieB2, 'me')).status, 200);

  // removal: session dies and no new code is sent
  assert.deepEqual(await rows('b2@example.com'), { s: 1, o: 1 });
  assert.equal((await send(owner, 'admins-remove', 'POST', { id: b.id })).status, 200);
  assert.equal((await get(cookieB2, 'me')).status, 401);
  assert.deepEqual(await rows('b2@example.com'), { s: 0, o: 0 }, 'session and code rows are deleted on removal');
  const n = sent.length;
  await A('otp-request', { method: 'POST', body: { email: 'b2@example.com' } });
  assert.equal(sent.length, n);

  // adding the same address again must not bring the old session back to life
  assert.equal((await add(owner, 'b2@example.com', 'B de novo')).status, 200);
  assert.equal((await get(cookieB2, 'me')).status, 401, 'old session stays dead after re-adding the address');
});

test('login: a DB admin gets a code, a stranger does not, and the answer looks the same', async () => {
  await freshDb(); const sent = mailbox();
  const owner = await login(admin, sent);
  await add(owner, 'ok@example.com', 'Ok');
  const stranger = await A('otp-request', { method: 'POST', body: { email: 'estranho@example.com' } });
  const n = sent.length;
  assert.equal(stranger.status, 200); assert.equal(sent.length, n);
  const allowed = await A('otp-request', { method: 'POST', body: { email: 'ok@example.com' } });
  assert.equal(allowed.status, 200); assert.equal(sent.length, n + 1); assert.equal(sent.at(-1).to, 'ok@example.com');
  assert.deepEqual(allowed.json, stranger.json);
  // a code issued for an address that is no longer allowed cannot be redeemed
  const code = sent.at(-1).code;
  await send(owner, 'admins-remove', 'POST', { id: (await get(owner, 'admins-list')).json.admins[0].id });
  assert.equal((await A('otp-verify', { method: 'POST', body: { email: 'ok@example.com', code } })).status, 401);
});

test('needs a session and a same-origin request', async () => {
  await freshDb(); const sent = mailbox();
  assert.equal((await A('admins-list')).status, 401);
  assert.equal((await A('admins-add', { method: 'POST', body: { email: 'a@b.com' } })).status, 401);
  const c = await login(admin, sent);
  assert.equal((await send(c, 'admins-add', 'POST', { email: 'a@b.com' }, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await send(c, 'admins-add', 'POST', { email: 'a@b.com' }, { origin: undefined })).status, 403);
  assert.equal((await send(c, 'admins-remove', 'POST', { id: 1 }, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await send(c, 'admins-list', 'POST', {})).status, 405);
  assert.equal((await get(c, 'admins-nope')).status, 404);
});

test('fallback: without the admins table, owners still work, the failure is logged, the screen says it is off', async () => {
  const pg = await freshDb(); const sent = mailbox();
  const c = await login(admin, sent);
  await pg.exec('drop table agape_admin.admins');
  const logged = []; const orig = console.error; console.error = (...a) => logged.push(a.join(' '));
  try {
    const owner2 = await login(admin, sent, 'andre@example.com'); // owner login keeps working
    assert.equal((await get(owner2, 'me')).status, 200);
    const list = await get(c, 'admins-list');
    assert.equal(list.status, 200); assert.equal(list.json.unavailable, true); assert.deepEqual(list.json.admins, []); assert.deepEqual(list.json.owners, OWNERS);
    const addRes = await add(c, 'x@example.com', 'X');
    assert.equal(addRes.status, 503); assert.match(addRes.json.message, /migração/);
    const n = sent.length;
    await A('otp-request', { method: 'POST', body: { email: 'x@example.com' } });
    assert.equal(sent.length, n, 'a non-owner gets nothing while the table is missing');
  } finally { console.error = orig; }
  assert.ok(logged.some((l) => l.includes('admins lookup failed')), 'lookup failure is logged');
});
