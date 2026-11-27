# Admin panel (`/admin/`)

Lets the client edit prices, the buy link, KPIs, videos, hero image and general links of a page without touching code. Currently controls `/pro/`; `/black/` and the home are added the same way (see "Adding a page").

## How it works
- The pages keep their original text in the HTML. When they open, `shared/site-settings.js` asks `GET /api/settings?page=pro` and replaces the marked values (`data-b`, `data-buy`, `data-kpi`, `data-link`, `data-video`, `data-hero-img`). If the request fails, the original text stays.
- Login: allow-listed email → 6-digit code (Resend) → 8-hour session cookie (HttpOnly, Secure, SameSite=Strict).
- Editing: **save draft → preview (`/pro/?preview=draft`) → publish**. Publishing shows a diff and highlights price changes. Every publish is a row in `settings_versions` (who, when, changed fields); "Restaurar" copies an old version back into the draft.
- Public reads are cached 60 s at the edge, so a publish is live within about a minute.
- Not editable here (static in the HTML): `<title>`, meta description and share-preview (og) tags. Search and WhatsApp previews keep the original text. The page `<title>` is updated in the browser only for the discount %.

## Stack (all on Vercel)
Vercel Functions (`api/`) · Neon Postgres (Vercel Marketplace) · Vercel Blob (hero image) · Resend (email).

## Setup checklist (once)
1. **Neon:** Vercel project → Storage → add **Neon** (sets `DATABASE_URL`). Open its SQL editor and run `db/schema.sql`.
2. **Blob:** Vercel project → Storage → create a **Blob** store (sets `BLOB_READ_WRITE_TOKEN`).
3. **Resend:** add the domain `agapemultimidia.com.br`, create the DNS records Resend shows (SPF/DKIM) where the domain's DNS is managed, wait for "Verified", then create an API key with *sending access* only.
4. **Environment variables** (Vercel → Settings → Environment Variables, Production): `SESSION_SECRET` (`openssl rand -base64 32`), `ADMIN_EMAILS` (comma-separated allow list), `RESEND_API_KEY`, optionally `RESEND_FROM`. See `.env.example`.
5. **Plan:** Vercel's Hobby plan is for non-commercial use. A client business site should be on Pro. Resend free tier: 100 emails/day, 3,000/month, shared across domains.
6. Deploy, open `/admin/`, log in, change nothing, press "Publicar…" once to confirm the round trip.

## Local preview (no accounts)
```bash
npm install
npm run dev     # http://127.0.0.1:8765/pro/  and  /admin/  (login code is printed in the terminal)
npm test        # validation, login, publish flow against an in-memory Postgres
```

## Rules enforced on the server
- Prices: cash < original; discount % equals the computed value (floor or round); installments × value ≥ cash; "menos de R$ X por mês" must be above the installment.
- Buy link: https on `kiwify.com.br` only. Social links: https on the matching site only. Videos: valid YouTube id or URL. Image: JPG/PNG/WebP (checked by file signature), ≤ 4 MB, stored in Blob.
- Login: unknown emails get the same answer as allowed ones; max 3 codes per email per 15 min and 10 per IP per hour; a code lives 10 min, is single-use and locks after 5 wrong tries.

## Adding a page (`/black/`, home)
1. Add an entry to `PAGES` in `api/_lib/settings.js` with its defaults (identical to the HTML).
2. In the page: `data-page="<slug>"` on `<html>`, mark values like `/pro/index.html` does, load `/shared/site-settings.js`.
3. Add the slug to the admin tests. Prices on `/black/` are separate fields from `/pro/`.
