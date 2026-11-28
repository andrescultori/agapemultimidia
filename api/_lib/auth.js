import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { query } from './db.js';
import { sendOtpEmail } from './mail.js';
import { header } from './http.js';

export const COOKIE = 'ams_admin';
export const OTP_TTL_MIN = 10;
export const SESSION_TTL_H = 8;
const MAX_ATTEMPTS = 5;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ chars)');
  return s;
}

export const hash = (v) => createHmac('sha256', secret()).update(String(v)).digest('hex');

export function normEmail(e) {
  return typeof e === 'string' ? e.trim().toLowerCase().slice(0, 254) : '';
}

/** Owners: the ADMIN_EMAILS variable. Always allowed to log in and never editable from the admin screen. */
export function ownerEmails() {
  return (process.env.ADMIN_EMAILS || '').split(',').map(normEmail).filter(Boolean);
}

export const isOwner = (email) => ownerEmails().includes(normEmail(email));

/**
 * Allowed to log in = an owner (env) OR a row in agape_admin.admins. If the table cannot be read (for example the
 * migration was not applied yet) the failure is logged and only the owners are allowed, so nobody gets locked out.
 */
export async function isAllowed(emailRaw) {
  const email = normEmail(emailRaw);
  if (!email) return false;
  if (isOwner(email)) return true;
  try {
    const rows = await query(`select 1 as ok from agape_admin.admins where lower(email) = $1 limit 1`, [email]);
    return rows.length > 0;
  } catch (e) {
    console.error('admins lookup failed, using ADMIN_EMAILS only:', e?.message);
    return false;
  }
}

/**
 * Always resolves the same way for the caller (no account enumeration). Sends a code only to allowed
 * addresses (owners or admins), at most 3 per address per 15 min and 10 per IP per hour.
 */
export async function requestOtp(emailRaw, ip) {
  const email = normEmail(emailRaw);
  if (!email || !(await isAllowed(email))) return false;
  const [byEmail] = await query(`select count(*)::int as n from agape_admin.otp_codes where email = $1 and created_at > now() - interval '15 minutes'`, [email]);
  const [byIp] = await query(`select count(*)::int as n from agape_admin.otp_codes where ip_hash = $1 and created_at > now() - interval '1 hour'`, [hash(ip)]);
  if (byEmail.n >= 3 || byIp.n >= 10) return false;
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await query(
    `insert into agape_admin.otp_codes (email, code_hash, ip_hash, expires_at) values ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [email, hash(`${email}:${code}`), hash(ip), String(OTP_TTL_MIN)],
  );
  await sendOtpEmail(email, code);
  return true;
}

const safeEq = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Returns a session token on success, otherwise null. A code is single-use and dies after 5 wrong tries. */
export async function verifyOtp(emailRaw, codeRaw) {
  const email = normEmail(emailRaw);
  const code = typeof codeRaw === 'string' ? codeRaw.replace(/\s/g, '') : '';
  if (!email || !/^\d{6}$/.test(code) || !(await isAllowed(email))) return null;
  const [row] = await query(
    `select id, code_hash, attempts from agape_admin.otp_codes where email = $1 and used_at is null and expires_at > now() order by id desc limit 1`,
    [email],
  );
  if (!row || row.attempts >= MAX_ATTEMPTS) return null;
  await query(`update agape_admin.otp_codes set attempts = attempts + 1 where id = $1`, [row.id]);
  if (!safeEq(row.code_hash, hash(`${email}:${code}`))) return null;
  await query(`update agape_admin.otp_codes set used_at = now() where id = $1`, [row.id]);
  const token = randomBytes(32).toString('base64url');
  await query(`insert into agape_admin.sessions (token_hash, email, expires_at) values ($1, $2, now() + ($3 || ' hours')::interval)`, [hash(token), email, String(SESSION_TTL_H)]);
  await query(`delete from agape_admin.sessions where expires_at < now()`);
  await query(`delete from agape_admin.otp_codes where created_at < now() - interval '1 day'`);
  return token;
}

function cookieToken(req) {
  const raw = header(req, 'cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

/** Email of the logged-in admin, or null. */
export async function sessionEmail(req) {
  const token = cookieToken(req);
  if (!token) return null;
  const [row] = await query(`select email from agape_admin.sessions where token_hash = $1 and expires_at > now()`, [hash(token)]);
  return row && (await isAllowed(row.email)) ? row.email : null;
}

export async function endSession(req) {
  const token = cookieToken(req);
  if (token) await query(`delete from agape_admin.sessions where token_hash = $1`, [hash(token)]);
}

const secure = () => (process.env.NODE_ENV === 'development' ? '' : '; Secure');
export const sessionCookie = (token) => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_H * 3600}${secure()}`;
export const clearCookie = () => `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure()}`;
