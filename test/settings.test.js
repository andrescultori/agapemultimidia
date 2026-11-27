import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, validate, youtubeId, diff } from '../api/_lib/settings.js';

const base = () => structuredClone(PAGES.pro.defaults);
const fields = (r) => r.errors.map((e) => e.field);

test('defaults are valid and unchanged by validation', () => {
  const r = validate('pro', base());
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.price, base().price);
});

test('discount must match the prices', () => {
  const d = base(); d.price.discountPct = 70;
  assert.deepEqual(fields(validate('pro', d)), ['price.discountPct']);
});

test('installments total cannot be below the cash price; cash below original; monthly cap above installment', () => {
  let d = base(); d.price.installmentValue = 5;
  assert.ok(fields(validate('pro', d)).includes('price.installmentValue'));
  d = base(); d.price.cash = 400;
  assert.ok(fields(validate('pro', d)).includes('price.cash'));
  d = base(); d.price.monthlyCap = 12;
  assert.ok(fields(validate('pro', d)).includes('price.monthlyCap'));
});

test('accepts pt-BR decimal strings', () => {
  const d = base(); d.price.installmentValue = '12,40'; d.price.cash = '119,90';
  assert.equal(validate('pro', d).ok, true);
});

test('a lone dot is a decimal, not a thousands separator', () => {
  const d = base(); d.price.installmentValue = '12.40'; d.price.cash = '119.90'; d.price.original = '1.234,50';
  const r = validate('pro', d);
  assert.deepEqual(fields(r), ['price.discountPct']); // 119,90 on 1234,50 is not 59%: proves 12.40 was read as 12.4 and 1.234,50 as 1234.5
});

test('buy link must be https Kiwify', () => {
  for (const bad of ['http://pay.kiwify.com.br/x', 'https://evil.com/x', 'https://pay.kiwify.com.br.evil.com/x', 'javascript:alert(1)', 'https://u:p@pay.kiwify.com.br/x']) {
    const d = base(); d.buyUrl = bad;
    assert.deepEqual(fields(validate('pro', d)), ['buyUrl'], bad);
  }
});

test('youtube ids from urls', () => {
  assert.equal(youtubeId('https://youtu.be/PATUs5WPTnY'), 'PATUs5WPTnY');
  assert.equal(youtubeId('https://www.youtube.com/watch?v=PATUs5WPTnY&t=3'), 'PATUs5WPTnY');
  assert.equal(youtubeId('https://www.youtube.com/embed/PATUs5WPTnY'), 'PATUs5WPTnY');
  assert.equal(youtubeId('https://evil.com/watch?v=PATUs5WPTnY'), null);
  assert.equal(youtubeId('"><script>'), null);
});

test('social links and image host are restricted', () => {
  const d = base(); d.links.instagram = 'https://evil.com/x'; d.heroImage = 'https://evil.com/a.jpg';
  assert.deepEqual(fields(validate('pro', d)).sort(), ['heroImage', 'links.instagram']);
  const ok = base(); ok.heroImage = 'https://abc123.public.blob.vercel-storage.com/hero/a.webp';
  assert.equal(validate('pro', ok).ok, true);
});

test('kpis need 4 short values', () => {
  const d = base(); d.kpis = ['1', '2', '3'];
  assert.deepEqual(fields(validate('pro', d)), ['kpis']);
});

test('diff flags price changes', () => {
  const next = base(); next.price.cash = 99.9; next.price.discountPct = 66;
  const c = diff(base(), next);
  assert.deepEqual(c.map((x) => x.field).sort(), ['price.cash', 'price.discountPct']);
  assert.ok(c.every((x) => x.isPrice));
});
