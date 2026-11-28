// Cloudflare Pages Functions adapter: runs the same handlers as api/ (written for Node-style req/res) on Workers.
// Needs the `nodejs_compat` compatibility flag (see wrangler.toml). Secrets are set under Settings > Variables and Secrets.
import { Buffer } from 'node:buffer';

export async function run(handler, context, extraQuery = {}) {
  const { request, env } = context;
  for (const [k, v] of Object.entries(env || {})) if (typeof v === 'string') process.env[k] = v;

  const url = new URL(request.url);
  const headers = {};
  for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;
  headers['x-forwarded-for'] = request.headers.get('cf-connecting-ip') || headers['x-forwarded-for'] || '';

  let body;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const buf = Buffer.from(await request.arrayBuffer());
    if ((headers['content-type'] || '').includes('json')) {
      try {
        body = buf.length ? JSON.parse(buf.toString('utf8')) : {};
      } catch {
        body = null;
      }
    } else body = buf;
  }

  const req = { method: request.method, url: url.pathname + url.search, headers, body, query: extraQuery, socket: {} };
  return new Promise((resolve, reject) => {
    const out = new Headers();
    const res = {
      statusCode: 200,
      setHeader: (k, v) => out.set(k, v),
      end: (payload) => resolve(new Response(payload ?? null, { status: res.statusCode, headers: out })),
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}
