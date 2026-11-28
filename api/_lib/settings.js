import { isOwnImage } from './storage.js';

// Editable settings per page: defaults (identical to the fallback text in each HTML page), validation, diff.

export const PAGES = {
  pro: {
    label: '/pro (Transmissão Pro 2.0)',
    defaults: {
      buyUrl: 'https://pay.kiwify.com.br/PcjL2H6',
      price: { original: 297, installments: 12, installmentValue: 12.4, cash: 119.9, discountPct: 59, monthlyCap: 13 },
      kpis: ['182 mil', '+20 milhões', '+6.000', '+17 anos'],
      kpiLabels: ['inscritos no YouTube', 'de visualizações', 'alunos nos cursos', 'de experiência'],
      videos: { hero: 'o4bE450_-A4', testimonials: ['PATUs5WPTnY', '_PCCs8fhNlI', 'JgsGDkYGwhc'] },
      heroImage: null,
      links: {
        youtube: 'https://www.youtube.com/@agapemultimidia',
        instagram: 'https://www.instagram.com/agapemultimidia/',
        facebook: 'https://www.facebook.com/agapemultimidia/',
      },
    },
  },
};

export function isPage(p) {
  return typeof p === 'string' && Object.prototype.hasOwnProperty.call(PAGES, p);
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function money(v) {
  if (typeof v === 'string') {
    v = v.trim();
    // "1.234,50" and "12,40" are pt-BR; "12.40" is a plain decimal. Never read a lone dot as a thousands separator.
    v = Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v);
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
}

function hostOk(u, hosts) {
  return hosts.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
}

function httpsUrl(v, hosts) {
  if (typeof v !== 'string' || v.length > 300) return null;
  let u;
  try {
    u = new URL(v.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || !hostOk(u, hosts)) return null;
  return u.toString();
}

export function youtubeId(v) {
  if (typeof v !== 'string') return null;
  v = v.trim();
  if (YT_ID.test(v)) return v;
  let u;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  let id = null;
  if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
  else if (hostOk(u, ['youtube.com', 'youtube-nocookie.com'])) {
    id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/) || [])[1];
  }
  return id && YT_ID.test(id) ? id : null;
}

/** Returns { ok, data, errors: [{ field, message }] }. `data` is the normalized object when ok. */
export function validate(page, input) {
  const errors = [];
  const err = (field, message) => errors.push({ field, message });
  const base = PAGES[page].defaults;
  const i = input && typeof input === 'object' ? input : {};
  const p = i.price && typeof i.price === 'object' ? i.price : {};

  const price = {
    original: money(p.original),
    installments: Number(p.installments),
    installmentValue: money(p.installmentValue),
    cash: money(p.cash),
    discountPct: Number(p.discountPct),
    monthlyCap: money(p.monthlyCap),
  };
  for (const k of ['original', 'installmentValue', 'cash', 'monthlyCap']) {
    if (price[k] === null || price[k] <= 0 || price[k] > 100000) err(`price.${k}`, 'Informe um valor em reais maior que zero.');
  }
  if (!Number.isInteger(price.installments) || price.installments < 1 || price.installments > 24) err('price.installments', 'Parcelas: número inteiro de 1 a 24.');
  if (!Number.isInteger(price.discountPct) || price.discountPct < 1 || price.discountPct > 95) err('price.discountPct', 'Desconto: número inteiro de 1 a 95.');

  if (!errors.length) {
    if (price.cash >= price.original) err('price.cash', 'O preço à vista deve ser menor que o preço original.');
    const real = (1 - price.cash / price.original) * 100;
    if (price.discountPct !== Math.floor(real) && price.discountPct !== Math.round(real)) {
      err('price.discountPct', `O desconto não bate com os preços: ${price.cash.toFixed(2).replace('.', ',')} sobre ${price.original.toFixed(2).replace('.', ',')} dá ${real.toFixed(1).replace('.', ',')}%.`);
    }
    if (Math.round(price.installmentValue * price.installments * 100) < Math.round(price.cash * 100)) {
      err('price.installmentValue', 'O total parcelado não pode ser menor que o preço à vista.');
    }
    if (price.monthlyCap <= price.installmentValue) err('price.monthlyCap', 'O texto "menos de R$ X por mês" precisa de um valor maior que a parcela.');
  }

  const buyUrl = httpsUrl(i.buyUrl, ['kiwify.com.br']);
  if (!buyUrl) err('buyUrl', 'Use um link https do checkout da Kiwify (pay.kiwify.com.br/...).');

  const kpis = Array.isArray(i.kpis) ? i.kpis.map((k) => (typeof k === 'string' ? k.trim() : '')) : [];
  if (kpis.length !== 4 || kpis.some((k) => !k || k.length > 24)) err('kpis', 'Informe os 4 números (até 24 caracteres cada).');

  const v = i.videos && typeof i.videos === 'object' ? i.videos : {};
  const hero = youtubeId(v.hero);
  if (!hero) err('videos.hero', 'Link ou código de vídeo do YouTube inválido.');
  const tList = Array.isArray(v.testimonials) ? v.testimonials : [];
  const testimonials = tList.map(youtubeId);
  if (testimonials.length !== 3 || testimonials.some((t) => !t)) err('videos.testimonials', 'Informe 3 links de vídeo do YouTube válidos para os depoimentos.');

  let heroImage = null;
  if (i.heroImage !== null && i.heroImage !== undefined && i.heroImage !== '') {
    heroImage = isOwnImage(i.heroImage) ? String(i.heroImage) : null;
    // Local dev server only (scripts/dev-server.mjs keeps uploads in memory); never true in production.
    if (!heroImage && process.env.NODE_ENV === 'development' && /^http:\/\/127\.0\.0\.1:\d+\/__img\/hero\/[\w.-]+$/.test(String(i.heroImage))) heroImage = String(i.heroImage);
    if (!heroImage) err('heroImage', 'Imagem inválida: envie o arquivo pelo painel.');
  }

  const l = i.links && typeof i.links === 'object' ? i.links : {};
  const links = {
    youtube: httpsUrl(l.youtube, ['youtube.com', 'youtu.be']),
    instagram: httpsUrl(l.instagram, ['instagram.com']),
    facebook: httpsUrl(l.facebook, ['facebook.com', 'fb.com']),
  };
  for (const k of Object.keys(links)) if (!links[k]) err(`links.${k}`, `Link do ${k} inválido (precisa ser https e do próprio site).`);

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], data: { buyUrl, price, kpis, kpiLabels: base.kpiLabels, videos: { hero, testimonials }, heroImage, links } };
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

/** List of changed fields between two settings objects. */
export function diff(prev, next) {
  const a = flatten(prev);
  const b = flatten(next);
  const changes = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === 'kpiLabels') continue;
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changes.push({ field: key, from: a[key] ?? null, to: b[key] ?? null, isPrice: key.startsWith('price.') });
  }
  return changes;
}
