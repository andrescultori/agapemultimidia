import { createHash } from 'node:crypto';
import { query } from '../_lib/db.js';
import { send, jsonBody, rawBody, sameOrigin, clientIp } from '../_lib/http.js';
import { PAGES, isPage, validate, diff } from '../_lib/settings.js';
import { requestOtp, verifyOtp, sessionEmail, endSession, sessionCookie, clearCookie } from '../_lib/auth.js';

let blobPut = null;
/** Tests inject a fake Blob uploader here. */
export function setBlob(fn) {
  blobPut = fn;
}

const IMAGE_LIMIT = 4 * 1024 * 1024;

function imageType(b) {
  if (b.length > 12 && b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return ['image/jpeg', 'jpg'];
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ['image/png', 'png'];
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return ['image/webp', 'webp'];
  return null;
}

const row = (r) => (r ? { id: Number(r.id), data: r.data, createdBy: r.created_by, createdAt: r.created_at } : null);

async function state(page) {
  const [pub] = await query(`select * from settings_versions where page = $1 and status = 'published' order by id desc limit 1`, [page]);
  const [draft] = await query(`select * from settings_versions where page = $1 and status = 'draft'`, [page]);
  const history = await query(`select id, created_by, created_at, note from settings_versions where page = $1 and status = 'published' order by id desc limit 15`, [page]);
  return {
    page,
    pages: Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, v.label])),
    defaults: PAGES[page].defaults,
    published: row(pub),
    draft: row(draft),
    history: history.map((h) => ({ id: Number(h.id), createdBy: h.created_by, createdAt: h.created_at, note: h.note })),
  };
}

export default async function handler(req, res) {
  const action = req.query?.action ?? new URL(req.url, 'http://x').pathname.split('/').pop();
  const noStore = { 'Cache-Control': 'no-store' };
  try {
    // ---- public (login) actions ----
    if (action === 'otp-request' || action === 'otp-verify' || action === 'logout') {
      if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' }, { ...noStore, Allow: 'POST' });
      if (!sameOrigin(req)) return send(res, 403, { error: 'bad_origin' }, noStore);
      const body = jsonBody(req) || {};
      if (action === 'otp-request') {
        await requestOtp(body.email, clientIp(req)).catch((e) => console.error('otp request failed:', e?.message));
        return send(res, 200, { ok: true }, noStore); // same answer whether or not the address is allowed
      }
      if (action === 'otp-verify') {
        const token = await verifyOtp(body.email, body.code);
        if (!token) return send(res, 401, { error: 'invalid_code' }, noStore);
        return send(res, 200, { ok: true }, { ...noStore, 'Set-Cookie': sessionCookie(token) });
      }
      await endSession(req);
      return send(res, 200, { ok: true }, { ...noStore, 'Set-Cookie': clearCookie() });
    }

    // ---- everything below needs a session ----
    const email = await sessionEmail(req);
    if (!email) return send(res, 401, { error: 'unauthorized' }, noStore);
    const mutating = req.method !== 'GET';
    if (mutating && !sameOrigin(req)) return send(res, 403, { error: 'bad_origin' }, noStore);
    const url = new URL(req.url, 'http://x');

    if (action === 'me' && req.method === 'GET') return send(res, 200, { email }, noStore);

    if (action === 'state' && req.method === 'GET') {
      const page = url.searchParams.get('page') || 'pro';
      if (!isPage(page)) return send(res, 400, { error: 'unknown_page' }, noStore);
      return send(res, 200, await state(page), noStore);
    }

    if (action === 'upload' && req.method === 'POST') {
      const buf = await rawBody(req, IMAGE_LIMIT);
      if (!buf) return send(res, 413, { error: 'too_large', message: 'A imagem deve ter até 4 MB.' }, noStore);
      const type = imageType(buf);
      if (!type) return send(res, 415, { error: 'bad_type', message: 'Use uma imagem JPG, PNG ou WebP.' }, noStore);
      const put = blobPut || (await import('@vercel/blob')).put;
      const name = `hero/${createHash('sha256').update(buf).digest('hex').slice(0, 12)}.${type[1]}`;
      const blob = await put(name, buf, { access: 'public', contentType: type[0], addRandomSuffix: false, allowOverwrite: true });
      return send(res, 200, { url: blob.url }, noStore);
    }

    const body = jsonBody(req) || {};
    const page = body.page || 'pro';
    if (!isPage(page)) return send(res, 400, { error: 'unknown_page' }, noStore);

    if (action === 'draft' && req.method === 'PUT') {
      const v = validate(page, body.data);
      if (!v.ok) return send(res, 422, { error: 'invalid', errors: v.errors }, noStore);
      await query(`delete from settings_versions where page = $1 and status = 'draft'`, [page]);
      await query(`insert into settings_versions (page, status, data, created_by) values ($1, 'draft', $2::jsonb, $3)`, [page, JSON.stringify(v.data), email]);
      return send(res, 200, { ok: true, ...(await state(page)) }, noStore);
    }

    if (action === 'publish' && req.method === 'POST') {
      const [draft] = await query(`select * from settings_versions where page = $1 and status = 'draft'`, [page]);
      if (!draft) return send(res, 409, { error: 'no_draft', message: 'Salve um rascunho antes de publicar.' }, noStore);
      const v = validate(page, draft.data);
      if (!v.ok) return send(res, 422, { error: 'invalid', errors: v.errors }, noStore);
      const [pub] = await query(`select data from settings_versions where page = $1 and status = 'published' order by id desc limit 1`, [page]);
      const changes = diff(pub ? pub.data : PAGES[page].defaults, v.data);
      await query(`insert into settings_versions (page, status, data, created_by, note) values ($1, 'published', $2::jsonb, $3, $4)`, [
        page, JSON.stringify(v.data), email, changes.map((c) => c.field).join(', ').slice(0, 300) || 'sem alterações',
      ]);
      await query(`delete from settings_versions where page = $1 and status = 'draft'`, [page]);
      return send(res, 200, { ok: true, changes, ...(await state(page)) }, noStore);
    }

    if (action === 'restore' && req.method === 'POST') {
      // Copies an old published version into the draft; the admin still previews and publishes it.
      const [old] = await query(`select data from settings_versions where id = $1 and page = $2 and status = 'published'`, [Number(body.versionId), page]);
      if (!old) return send(res, 404, { error: 'not_found' }, noStore);
      const v = validate(page, old.data);
      if (!v.ok) return send(res, 422, { error: 'invalid', errors: v.errors }, noStore);
      await query(`delete from settings_versions where page = $1 and status = 'draft'`, [page]);
      await query(`insert into settings_versions (page, status, data, created_by, note) values ($1, 'draft', $2::jsonb, $3, $4)`, [page, JSON.stringify(v.data), email, `restaurado da versão ${Number(body.versionId)}`]);
      return send(res, 200, { ok: true, ...(await state(page)) }, noStore);
    }

    return send(res, 404, { error: 'not_found' }, noStore);
  } catch (e) {
    console.error('admin error', action, e?.message);
    return send(res, 500, { error: 'server_error' }, noStore);
  }
}
