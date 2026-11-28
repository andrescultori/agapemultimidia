// Cloudflare Worker: serves /api/* (same handlers as api/) and hands every other request to the static assets in dist/.
import settings from '../api/settings.js';
import admin from '../api/admin/[action].js';
import { run } from './adapter.js';

// The public settings are read on every page view, so keep them in Cloudflare's edge cache for 60 s.
async function publicSettings(request, env, ctx) {
  const url = new URL(request.url);
  const cacheable = request.method === 'GET' && url.searchParams.get('draft') !== '1';
  const key = new Request(`${url.origin}/api/settings?page=${encodeURIComponent(url.searchParams.get('page') || '')}`);
  if (cacheable) {
    const hit = await caches.default.match(key);
    if (hit) {
      const out = new Response(hit.body, hit);
      out.headers.set('X-Cache', 'HIT');
      return out;
    }
  }
  const res = await run(settings, request, env);
  if (cacheable && res.status === 200 && /s-maxage=60/.test(res.headers.get('cache-control') || '')) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set('Cache-Control', 'public, max-age=60');
    ctx.waitUntil(caches.default.put(key, copy));
  }
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/settings') return publicSettings(request, env, ctx);
    const m = /^\/api\/admin\/([\w-]+)$/.exec(pathname);
    if (m) return run(admin, request, env, { action: m[1] });
    if (pathname.startsWith('/api/')) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return env.ASSETS.fetch(request);
  },
};
