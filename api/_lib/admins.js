// Managing who can log in (besides the owners in ADMIN_EMAILS). Each function returns { status, body }.
import { query } from './db.js';
import { normEmail, ownerEmails, isOwner } from './auth.js';

const EMAIL_RE = /^[^\s@,;<>"()[\]\\]+@[^\s@,;<>"()[\]\\]+\.[^\s@,;<>"()[\]\\]+$/;

export const isMissingTable = (e) => e?.code === '42P01' || /relation .* does not exist/i.test(e?.message || '');

const UNAVAILABLE = {
  status: 503,
  body: { error: 'admins_unavailable', message: 'A lista de administradores ainda não foi ativada no banco de dados. Peça para aplicar a migração.' },
};
const invalid = (field, message) => ({ status: 422, body: { error: 'invalid', field, message } });
const conflict = (message) => ({ status: 409, body: { error: 'duplicate', field: 'email', message } });
const forbidden = (message) => ({ status: 403, body: { error: 'forbidden', message } });
const notFound = { status: 404, body: { error: 'not_found', message: 'Administrador não encontrado.' } };

function parseEmail(raw) {
  if (typeof raw !== 'string' || raw.trim().length > 254) return null;
  const e = normEmail(raw);
  return EMAIL_RE.test(e) ? e : null;
}

function parseName(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false };
  const v = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return v.length > 80 ? { ok: false } : { ok: true, value: v || null };
}

const view = (r) => ({ id: Number(r.id), email: r.email, name: r.name, createdBy: r.created_by, createdAt: r.created_at });
const COLS = 'id, email, name, created_by, created_at';

export async function listAdmins(me) {
  let rows = [];
  let unavailable = false;
  try {
    rows = await query(`select ${COLS} from agape_admin.admins order by lower(coalesce(name, email)), id`);
  } catch (e) {
    if (!isMissingTable(e)) throw e;
    unavailable = true;
    console.error('admins list: table agape_admin.admins is missing (migration not applied)');
  }
  return { me, owners: ownerEmails(), admins: rows.map(view), ...(unavailable ? { unavailable: true } : {}) };
}

/** Ends every open session and pending login code of an address (after removal or an email change). */
async function revokeAccess(email) {
  const e = normEmail(email);
  if (!e || isOwner(e)) return; // an owner keeps access even if a stale row existed
  await query(`delete from agape_admin.sessions where lower(email) = $1`, [e]);
  await query(`delete from agape_admin.otp_codes where lower(email) = $1`, [e]);
}

async function fresh(me, extra = {}) {
  return { status: 200, body: { ok: true, ...extra, ...(await listAdmins(me)) } };
}

export async function addAdmin(me, body) {
  const email = parseEmail(body.email);
  if (!email) return invalid('email', 'Informe um e-mail válido.');
  const name = parseName(body.name);
  if (!name.ok) return invalid('name', 'O nome pode ter até 80 caracteres.');
  if (isOwner(email)) return conflict('Este e-mail já é de um administrador protegido.');
  try {
    const [row] = await query(`insert into agape_admin.admins (email, name, created_by) values ($1, $2, $3) returning ${COLS}`, [email, name.value, me]);
    return fresh(me, { admin: view(row) });
  } catch (e) {
    if (isMissingTable(e)) return UNAVAILABLE;
    if (e?.code === '23505') return conflict('Este e-mail já é administrador.');
    throw e;
  }
}

export async function updateAdmin(me, body) {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return notFound;
  const hasEmail = body.email !== undefined;
  const hasName = body.name !== undefined;
  if (!hasEmail && !hasName) return invalid('email', 'Informe o novo e-mail ou o novo nome.');
  try {
    const [row] = await query(`select ${COLS} from agape_admin.admins where id = $1`, [id]);
    if (!row) return notFound;
    let email = normEmail(row.email);
    let name = row.name;
    if (hasEmail) {
      const e = parseEmail(body.email);
      if (!e) return invalid('email', 'Informe um e-mail válido.');
      email = e;
    }
    if (hasName) {
      const n = parseName(body.name);
      if (!n.ok) return invalid('name', 'O nome pode ter até 80 caracteres.');
      name = n.value;
    }
    const emailChanged = email !== normEmail(row.email);
    if (emailChanged) {
      if (normEmail(row.email) === normEmail(me)) return forbidden('Você não pode alterar o seu próprio e-mail, pois isso encerraria a sua sessão. Peça a outro administrador.');
      if (isOwner(email)) return conflict('Este e-mail já é de um administrador protegido.');
    }
    await query(`update agape_admin.admins set email = $2, name = $3 where id = $1`, [id, email, name]);
    if (emailChanged) await revokeAccess(row.email);
    return fresh(me);
  } catch (e) {
    if (isMissingTable(e)) return UNAVAILABLE;
    if (e?.code === '23505') return conflict('Este e-mail já é administrador.');
    throw e;
  }
}

export async function removeAdmin(me, body) {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return notFound;
  try {
    const [row] = await query(`select ${COLS} from agape_admin.admins where id = $1`, [id]);
    if (!row) return notFound;
    if (normEmail(row.email) === normEmail(me)) return forbidden('Você não pode remover a si mesmo.');
    await query(`delete from agape_admin.admins where id = $1`, [id]);
    await revokeAccess(row.email);
    return fresh(me);
  } catch (e) {
    if (isMissingTable(e)) return UNAVAILABLE;
    throw e;
  }
}
