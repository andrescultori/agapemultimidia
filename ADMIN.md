# Admin panel (`/admin/`)

Lets the client edit prices, the buy link, KPIs, videos, hero image and general links of a page without touching code. Currently controls `/pro/`; `/black/` and the home are added the same way (see "Adding a page").

## How it works
- The pages keep their original text in the HTML. When they open, `shared/site-settings.js` asks `GET /api/settings?page=pro` and replaces the marked values (`data-b`, `data-buy`, `data-kpi`, `data-link`, `data-video`, `data-hero-img`). If the request fails, the original text stays.
- Login: allow-listed email → 6-digit code (Resend) → 8-hour session cookie (HttpOnly, Secure, SameSite=Strict).
- Editing: **save draft → preview (`/pro/?preview=draft`) → publish**. Publishing shows a diff and highlights price changes. Every publish is a row in `settings_versions` (who, when, changed fields); "Restaurar" copies an old version back into the draft.
- Public reads are cached 60 s at the edge, so a publish is live within about a minute.
- Not editable here (static in the HTML): `<title>`, meta description and share-preview (og) tags. Search and WhatsApp previews keep the original text. The page `<title>` is updated in the browser only for the discount %.

## Stack
- **Hosting: Cloudflare Workers with static assets** (target; the site is still on Vercel until DNS is switched). One Worker (`src/worker.js`) serves `/api/*`; every other request is served straight from the static files in `dist/` (built by `npm run build:cf`, which also writes `_redirects` and `_headers`). `wrangler.toml` holds the config.
- **Database and images: Supabase** (tables in schema `agape_admin` via the restricted role `agape_admin_app`; images in a public bucket). Used for testing now; for production decide between a dedicated Supabase project (the free tier pauses after about a week idle) and Cloudflare D1/R2.
- **Email:** Resend.
- `api/` holds the handlers (plain Node-style). `src/adapter.js` runs them in the Worker; on Vercel they run as Vercel Functions. The same code works on both, so the Vercel files (`vercel.json`, `.vercelignore`) stay until the cutover is done.

## Setup checklist (once)
1. **Supabase:** run `db/schema.sql`, then `db/app-role.sql`, then set the role password in the SQL editor: `alter role agape_admin_app with password '<long random password>';` (letters and digits only). Create a **public** bucket (the test project uses `fabio-site-images`).
2. **Resend:** for tests set `RESEND_FROM=onboarding@resend.dev` and put only your own Resend-account email in `ADMIN_EMAILS`. For Fábio: verify `agapemultimidia.com.br` (SPF/DKIM records in Cloudflare DNS, DNS only), then use `no-reply@agapemultimidia.com.br`. API key with *sending access* only.
3. **Cloudflare Worker** (client's account, André as member): Workers & Pages → Create → **Import a repository** (GitHub) → this repo, branch `main`. Build command `npm run build:cf`, deploy command `npx wrangler deploy`. After the first deploy, open the `*.workers.dev` URL and test `/pro/` and `/admin/`.
4. **Hyperdrive (database access from the Worker).** Workers do not trust Supabase's private CA, so a direct connection to the pooler fails with `TLS_HANDSHAKE_FAILED`. Create a Hyperdrive config instead: Cloudflare dashboard → Workers & Pages → **Hyperdrive** → Create configuration. Use the Supabase **Direct connection** values (host `db.<project-ref>.supabase.co`, port `5432`, database `postgres`), user `agape_admin_app` and its password. Turn **Query caching off** (a published change must show right away). Copy the config ID into the `[[hyperdrive]]` block of `wrangler.toml`. The Worker reads the database only through this binding, so it needs no `DATABASE_URL`. On Vercel/Node `DATABASE_URL` (Transaction pooler string, user `agape_admin_app.<project-ref>`) is still used.
5. **Variables and Secrets** (Worker → Settings → **Runtime** variables and secrets, not the "Builds" section; the Builds list is build-time only and the running Worker never sees it): secrets `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`, `RESEND_API_KEY`; plain `SUPABASE_URL`, `SUPABASE_BUCKET`, `ADMIN_EMAILS`, `RESEND_FROM`. See `.env.example` for what each is.
6. **Logs:** stored logs are on via `wrangler.toml` (`[observability.logs]`). Read them in the Worker → **Observability** → Logs (or **Live** for a real-time stream). Login failures are logged as "otp request failed: …"; the login screen always says "code sent" on purpose.
7. Log in at `/admin/`, press "Publicar…" once with no changes to confirm the round trip.

### Domain cutover (Cloudflare, domain registered at Registro.br)
1. Add the site in Cloudflare (Connect a domain, Free plan) and review the imported DNS records. Keep verification TXT records; delete the old HostGator records.
2. Registro.br: if DNSSEC is on, remove the DS record first; then set the two Cloudflare nameservers. Wait for **Active**.
3. Delete any leftover `@` / `www` A or CNAME records. Worker → Settings → Domains & Routes → **Add custom domain** `agapemultimidia.com.br` (Cloudflare creates the DNS record). Optional: a Redirect Rule `www` → apex.
4. Test `/`, `/transmissao-ao-vivo-pro`, `/cursos` (all redirect to `/pro/`), `/pro/`, `/admin/`.
5. Rollback: put the old nameservers back at Registro.br.
6. After the site is stable, remove the domain and project from Vercel and delete `vercel.json` and `.vercelignore` in a cleanup PR.

### Limits to know
- The public settings are cached 60 s at the Cloudflare edge, so a publish shows up within about a minute.
- Workers Free allows 100,000 dynamic requests per day (static files are not counted) and 10 ms CPU per request. Waiting on the database does not count as CPU, but if you ever see "exceeded CPU limit" errors, the Workers Paid plan ($5/month) raises it.
- Tested locally in the real Workers runtime (`npm run test:worker`), but not yet against the real Supabase from Cloudflare.

## Local preview (no accounts)
```bash
npm install
npm run dev     # http://127.0.0.1:8765/pro/  and  /admin/  (login code is printed in the terminal)
npm test              # validation, login, publish flow; includes the real postgres.js driver against an in-memory Postgres
npm run test:worker   # the same flow inside the real Cloudflare Workers runtime (wrangler/workerd)
```

## Rules enforced on the server
- Prices: cash < original; discount % equals the computed value (floor or round); installments × value ≥ cash; "menos de R$ X por mês" must be above the installment.
- Buy link: https on `kiwify.com.br` only. Social links: https on the matching site only. Videos: valid YouTube id or URL. Image: JPG/PNG/WebP (checked by file signature), ≤ 4 MB, stored in the Supabase bucket; only URLs of that bucket are accepted.
- Login: unknown emails get the same answer as allowed ones; max 3 codes per email per 15 min and 10 per IP per hour; a code lives 10 min, is single-use and locks after 5 wrong tries.

## Adding a page (`/black/`, home)
1. Add an entry to `PAGES` in `api/_lib/settings.js` with its defaults (identical to the HTML).
2. In the page: `data-page="<slug>"` on `<html>`, mark values like `/pro/index.html` does, load `/shared/site-settings.js`.
3. Add the slug to the admin tests. Prices on `/black/` are separate fields from `/pro/`.
