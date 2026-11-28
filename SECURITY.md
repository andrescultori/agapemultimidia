# Ágape Multimidia — Security

## Data handled
| Data | Where | Personal (LGPD)? | Who can read |
|---|---|---|---|
| None collected by the public pages | n/a | n/a | n/a |
| Admin emails (allow list) | Vercel env var `ADMIN_EMAILS`; copied to `otp_codes`/`sessions` rows | Yes (2 people) | André; the admins themselves |
| Login codes (HMAC-hashed, 10 min) and sessions (hashed token, 8 h) | Supabase Postgres | No clear-text codes or tokens stored | André (database owner) |
| Settings versions: prices, links, KPIs, video ids, image URL; who changed what | Supabase Postgres | Editor email only | André |
| Hero image | Supabase Storage bucket `site-images` (public URL) | No | Public |
| Purchase and customer data | Kiwify (client's account) | Yes | Client; not accessible from this project |

The public pages have no forms, no cookies set by us, no analytics or pixels. They read `GET /api/settings` (no personal data sent). The admin sets one session cookie (`ams_admin`, HttpOnly) after login, only for allow-listed admins.

## Third parties loaded by the page
- Vercel (hosting, functions), Supabase (database, image bucket), Resend (login emails).
- `youtube-nocookie.com` iframes (1 main video with muted autoplay, 3 testimonials).
- Links out to Kiwify checkout, YouTube, Instagram, Facebook.

## Database
Supabase Postgres, reached only from Vercel functions with the server-side `DATABASE_URL`. `db/schema.sql` puts everything in its own schema `agape_admin`, enables RLS on every table with no policies and revokes privileges from the Supabase `anon`/`authenticated` roles, so nothing is reachable through the Supabase REST API. The admin API connects as the restricted role `agape_admin_app` (`db/app-role.sql`): usage on that schema only, explicit RLS policies on the three tables, no access to `public`, `auth` or `storage` tables, not a superuser. The admin API is the only writer. Currently the test data lives in André's own Supabase project (shared with other apps); move it to a dedicated project before real use.

## Secrets
None in the repo or its history (checked 2026-11-13). Admin secrets are host environment variables only (Cloudflare Secrets, Vercel): `SESSION_SECRET`, `ADMIN_EMAILS`, `RESEND_API_KEY`, `DATABASE_URL`, `SUPABASE_SERVICE_KEY`. Rotate `SESSION_SECRET` to log everyone out. HostGator/cPanel credentials live with André and the client, never in the repo.

## Access
| Account | Owner | André's access | Revoke at handoff? |
|---|---|---|---|
| Domain (Registro.br) | Client | TODO(André): confirm | TODO(André) |
| HostGator / cPanel | Client | cPanel/FTP | TODO(André) |
| Kiwify | Client | TODO(André): confirm | TODO(André) |
| GitHub repo | André (`andrescultori`) | Owner | TODO(André): transfer or keep |

## LGPD (details: lgpd-web skill)
- Today: no personal data processed by the pages, so no consent banner is needed.
- Not present: privacy notice link in the footer. Required before adding any tracker, pixel or form.
- TODO(André): controller (client) / operator (AMS) clause in the written scope.

## Incident contact
TODO(André): who to call at the client, and the first step (replace `public_html/black/` with the last good version from `main`).

## Checks before launch
- [x] No secrets in repo history
- [x] No trackers before consent (none at all)
- [ ] Privacy notice linked (needed once tracking or forms are added)
- [ ] Rate limiting / captcha on public forms (no forms today)
