import test from 'node:test';
import assert from 'node:assert/strict';
import { blackEnded, BLACK_ENDS } from '../src/black.js';
import worker from '../src/worker.js';

const BRT = (s) => Date.parse(`${s}-03:00`);

test('the offer ends at midnight Brasília time on 01/12/2026', () => {
  assert.equal(blackEnded(BRT('2026-11-30T23:59:59'), BLACK_ENDS), false);
  assert.equal(blackEnded(BRT('2026-12-01T00:00:00'), BLACK_ENDS), true);
  assert.equal(blackEnded(BRT('2027-01-01T00:00:00'), BLACK_ENDS), true);
});

test('an unreadable end date never redirects', () => {
  assert.equal(blackEnded(Date.now(), 'not a date'), false);
});

const assets = () => { const calls = []; return { calls, ASSETS: { fetch: async (r) => { calls.push(new URL(r.url).pathname); return new Response('black page'); } } }; };

test('/black redirects to /pro/?from=black once the offer is over (302, never cached)', async () => {
  for (const path of ['/black', '/black/']) {
    const a = assets();
    const res = await worker.fetch(new Request(`https://site.test${path}`), { ...a, BLACK_ENDS: '2000-01-01T00:00:00-03:00' }, {});
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/pro/?from=black');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(a.calls, []);
  }
});

test('/black is served normally before the offer ends', async () => {
  const a = assets();
  const res = await worker.fetch(new Request('https://site.test/black/'), { ...a, BLACK_ENDS: '2999-01-01T00:00:00-03:00' }, {});
  assert.equal(res.status, 200);
  assert.deepEqual(a.calls, ['/black/']);
});

test('only the /black page is redirected, not its assets', async () => {
  const a = assets();
  const res = await worker.fetch(new Request('https://site.test/black/assets/x.webp'), { ...a, BLACK_ENDS: '2000-01-01T00:00:00-03:00' }, {});
  assert.equal(res.status, 200);
  assert.deepEqual(a.calls, ['/black/assets/x.webp']);
});
