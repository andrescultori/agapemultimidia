// Public endpoint read by the landing pages. Returns the published settings (or built-in defaults).
// With ?draft=1 and a valid admin session it returns the draft instead (for the admin preview), never cached.
import { query } from './_lib/db.js';
import { send } from './_lib/http.js';
import { PAGES, isPage } from './_lib/settings.js';
import { sessionEmail } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
  const url = new URL(req.url, 'http://x');
  const page = url.searchParams.get('page');
  if (!isPage(page)) return send(res, 400, { error: 'unknown_page' });
  const fallback = { page, version: 0, data: PAGES[page].defaults };

  try {
    if (url.searchParams.get('draft') === '1' && (await sessionEmail(req))) {
      const [draft] = await query(`select id, data from settings_versions where page = $1 and status = 'draft'`, [page]);
      if (draft) return send(res, 200, { page, version: Number(draft.id), draft: true, data: draft.data }, { 'Cache-Control': 'no-store' });
    }
    const [pub] = await query(`select id, data from settings_versions where page = $1 and status = 'published' order by id desc limit 1`, [page]);
    const body = pub ? { page, version: Number(pub.id), data: pub.data } : fallback;
    return send(res, 200, body, { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' });
  } catch {
    // Database down: the pages keep working with the built-in values.
    return send(res, 200, fallback, { 'Cache-Control': 'public, s-maxage=10' });
  }
}
