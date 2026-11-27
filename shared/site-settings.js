// Fills a landing page with the settings published in the admin. The HTML keeps its own copy of every value,
// so the page is complete without this script (or if the request fails). All values are written with
// textContent / setAttribute after the server has validated them; nothing is inserted as HTML.
(function () {
  var page = document.documentElement.getAttribute('data-page');
  if (!page) return;
  var preview = /[?&]preview=draft\b/.test(location.search);
  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var money = function (n) { return brl.format(n).replace(/ /g, ' '); };

  function text(sel, value) {
    document.querySelectorAll(sel).forEach(function (el) { if (el.textContent !== value) el.textContent = value; });
  }
  function attr(sel, name, value) {
    if (name === 'href' && !/^https:\/\//.test(value)) return; // links must be https
    document.querySelectorAll(sel).forEach(function (el) { if (el.getAttribute(name) !== value) el.setAttribute(name, value); });
  }

  function apply(d) {
    var p = d.price;
    text('[data-b="orig"]', money(p.original));
    text('[data-b="inst"]', money(p.installmentValue));
    text('[data-b="cash"]', money(p.cash));
    text('[data-b="monthly"]', money(p.monthlyCap));
    text('[data-b="disc"]', p.discountPct + '%');
    text('[data-b="n"]', p.installments + 'x');
    attr('a[data-buy]', 'href', d.buyUrl);
    d.kpis.forEach(function (v, i) { text('[data-kpi="' + i + '"]', v); });
    ['youtube', 'instagram', 'facebook'].forEach(function (k) { attr('a[data-link="' + k + '"]', 'href', d.links[k]); });

    var ids = { hero: d.videos.hero, t0: d.videos.testimonials[0], t1: d.videos.testimonials[1], t2: d.videos.testimonials[2] };
    document.querySelectorAll('iframe[data-video]').forEach(function (f) {
      var id = ids[f.getAttribute('data-video')];
      var m = /^(https:\/\/www\.youtube-nocookie\.com\/embed\/)([\w-]{11})(\?.*)?$/.exec(f.getAttribute('src') || '');
      if (id && m && m[2] !== id) f.setAttribute('src', m[1] + id + (m[3] || ''));
    });

    if (d.heroImage) {
      document.querySelectorAll('picture[data-hero-img]').forEach(function (pic) {
        pic.querySelectorAll('source').forEach(function (s) { s.remove(); });
        var img = pic.querySelector('img');
        if (img && img.getAttribute('src') !== d.heroImage) { img.removeAttribute('srcset'); img.setAttribute('src', d.heroImage); }
      });
    }
    // Title only: crawlers and share previews read the static <title>/<meta> in the HTML.
    document.title = document.title
      .replace(/\d+%/, p.discountPct + '%');
  }

  if (preview) {
    var bar = document.createElement('div');
    bar.textContent = 'Pré-visualização do rascunho (não publicado)';
    bar.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:99;background:#FF4D4D;color:#0A0A0A;font:700 14px Roboto,sans-serif;text-align:center;padding:8px');
    document.body.appendChild(bar);
  }

  fetch('/api/settings?page=' + encodeURIComponent(page) + (preview ? '&draft=1' : ''), { credentials: preview ? 'include' : 'omit' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (j && j.data) apply(j.data); })
    .catch(function () { /* keep the built-in values */ });
})();
