import test from 'node:test';
import assert from 'node:assert/strict';
import { putImage, isOwnImage } from '../api/_lib/storage.js';

process.env.SUPABASE_URL = 'https://abc.supabase.co';
process.env.SUPABASE_BUCKET = 'fabio-site-images';

async function upload(key) {
  process.env.SUPABASE_SERVICE_KEY = key;
  let seen;
  globalThis.fetch = async (url, init) => { seen = { url, init }; return new Response('{}', { status: 200 }); };
  const url = await putImage('hero/a.webp', Buffer.from('x'), 'image/webp');
  return { seen, url };
}

test('new sb_secret_ keys are sent in apikey only; legacy JWT keys in both headers', async () => {
  const a = await upload('sb_secret_abc');
  assert.equal(a.seen.init.headers.apikey, 'sb_secret_abc');
  assert.equal(a.seen.init.headers.Authorization, undefined);
  const b = await upload('eyJhbGciOi.legacy.jwt');
  assert.equal(b.seen.init.headers.Authorization, 'Bearer eyJhbGciOi.legacy.jwt');
});

test('upload goes to the configured bucket and returns its public url; only that bucket is accepted', async () => {
  const { seen, url } = await upload('sb_secret_abc');
  assert.equal(seen.url, 'https://abc.supabase.co/storage/v1/object/fabio-site-images/hero/a.webp');
  assert.equal(url, 'https://abc.supabase.co/storage/v1/object/public/fabio-site-images/hero/a.webp');
  assert.equal(isOwnImage(url), true);
  assert.equal(isOwnImage('https://abc.supabase.co/storage/v1/object/public/site-images/hero/a.webp'), false);
});
