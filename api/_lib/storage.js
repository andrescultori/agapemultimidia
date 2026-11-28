// Image storage: Supabase Storage (public bucket, written with the server-side service key).
let override = null;

/** Tests and the local dev server inject a fake uploader here: (path, buffer, contentType) => public URL. */
export function setStorage(fn) {
  override = fn;
}

export const bucket = () => process.env.SUPABASE_BUCKET || 'site-images';

export async function putImage(path, buf, contentType) {
  if (override) return override(path, buf, contentType);
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY are not set');
  const res = await fetch(`${base}/storage/v1/object/${bucket()}/${path}`, {
    method: 'POST',
    // New-style keys (sb_secret_...) go in `apikey` only; legacy service_role JWTs also go in Authorization.
    headers: { apikey: key, ...(key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }), 'Content-Type': contentType, 'x-upsert': 'true' },
    body: buf,
  });
  if (!res.ok) throw new Error(`Storage responded ${res.status}`);
  return `${base}/storage/v1/object/public/${bucket()}/${path}`;
}

/** True only for public URLs of our own bucket (hero/ folder). */
export function isOwnImage(value) {
  const base = process.env.SUPABASE_URL;
  if (!base) return false;
  let u, b;
  try {
    u = new URL(value);
    b = new URL(base);
  } catch {
    return false;
  }
  return u.protocol === 'https:' && !u.username && !u.password && u.host === b.host && u.pathname.startsWith(`/storage/v1/object/public/${bucket()}/hero/`);
}
