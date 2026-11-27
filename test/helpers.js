import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { setDb } from '../api/_lib/db.js';
import { setMailer } from '../api/_lib/mail.js';

process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.ADMIN_EMAILS = 'fabio@example.com, Andre@Example.com';

export async function freshDb() {
  const pg = new PGlite();
  await pg.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  setDb(async (text, params) => (await pg.query(text, params)).rows);
  return pg;
}

export function mailbox() {
  const sent = [];
  setMailer(async (to, code) => sent.push({ to, code }));
  return sent;
}

export function call(handler, { method = 'GET', url = '/', headers = {}, body, query } = {}) {
  const req = { method, url, headers: { host: 'site.test', origin: 'https://site.test', ...headers }, body, query, socket: { remoteAddress: '1.1.1.1' } };
  return new Promise((resolve, reject) => {
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { resolve({ status: this.statusCode, headers: this.headers, json: b ? JSON.parse(b) : null }); } };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

export async function login(admin, sent, email = 'fabio@example.com') {
  await call(admin, { method: 'POST', query: { action: 'otp-request' }, url: '/api/admin/otp-request', body: { email } });
  const code = sent.at(-1).code;
  const r = await call(admin, { method: 'POST', query: { action: 'otp-verify' }, url: '/api/admin/otp-verify', body: { email, code } });
  return r.headers['set-cookie'].split(';')[0];
}
