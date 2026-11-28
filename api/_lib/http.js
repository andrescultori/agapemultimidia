export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export function header(req, name) {
  const v = req.headers?.[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

export function clientIp(req) {
  const fwd = header(req, 'x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.socket?.remoteAddress || '').trim() || 'unknown';
}

/** Mutating requests must come from our own origin (defense in depth on top of SameSite=Strict). */
export function sameOrigin(req) {
  const origin = header(req, 'origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === header(req, 'host');
  } catch {
    return false;
  }
}

export function jsonBody(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return null;
    }
  }
  return null;
}

export async function rawBody(req, limit) {
  if (Buffer.isBuffer(req.body)) return req.body.length <= limit ? req.body : null;
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) return null;
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
