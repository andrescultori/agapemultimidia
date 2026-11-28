# Ágape Multimidia — Security

## Data handled
| Data | Where | Personal (LGPD)? | Who can read |
|---|---|---|---|
| None collected by the public pages | n/a | n/a | n/a |
| Admin emails (allow list) | Host env var `ADMIN_EMAILS` (Vercel / Cloudflare); copied to `otp_codes`/`sessions` rows | Yes (2 people) | André; the admins themselves |
| Login codes (HMAC-hashed, 10 min) and sessions (hashed token, 8 h) | Supabase Postgres | No clear-text codes or tokens stored | André (database owner) |
| Settings versions: prices, links, KPIs, video ids, image URL; who changed what | Supabase Postgres | Editor email only | André |
| Hero image | Supabase Storage bucket `site-images` (public URL) | No | Public |
| Purchase and customer data | Kiwify (client's account) | Yes | Client; not accessible from this project |

The public pages have no forms, no cookies set by us, no analytics or pixels. They read `GET /api/settings` (no personal data sent). The admin sets one session cookie (`ams_admin`, HttpOnly) after login, only for allow-listed admins.

## Third parties loaded by the page
- Vercel (hosting, functions; Cloudflare after the cutover), Supabase (database, image bucket), Resend (login emails).
- `youtube-nocookie.com` iframes (1 main video with muted autoplay, 3 testimonials).
- Links out to Kiwify checkout, YouTube, Instagram, Facebook.

## Database
Supabase Postgres, reached only from the server-side handlers (Vercel functions or the Cloudflare Worker) with `DATABASE_URL`. `db/schema.sql` puts everything in its own schema `agape_admin`, enables RLS on every table with no policies and revokes privileges from the Supabase `anon`/`authenticated` roles, so nothing is reachable through the Supabase REST API. The admin API connects as the restricted role `agape_admin_app` (`db/app-role.sql`): usage on that schema only, explicit RLS policies on the three tables, no access to `public`, `auth` or `storage` tables, not a superuser. The admin API is the only writer. Currently the test data lives in André's own Supabase project (shared with other apps); move it to a dedicated project before real use.

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
TODO(André): who to call at the client. First step for a bad page: revert the PR on `main` (Vercel redeploys in about a minute) and, if the domain is still on HostGator, re-upload the last good folder from `main`. For a suspected admin compromise: rotate `SESSION_SECRET` (logs everyone out), then `RESEND_API_KEY` and `SUPABASE_SERVICE_KEY`.

## Checks before launch
- [x] No secrets in repo history
- [x] No trackers before consent (none at all)
- [ ] Privacy notice linked (needed once tracking or forms are added)
- [ ] Rate limiting / captcha on public forms (no forms today)

## Open items (admin review, 2026-11-28)
Backend tests pass (20/20). No sign of any of this being abused; these are decisions or hardening for André.
1. **Service key blast radius.** `SUPABASE_SERVICE_KEY` can do anything in its Supabase project, and the test project is shared with other apps. It is used only to upload one image. Use a dedicated project, or Cloudflare R2 (no secret needed from a Worker binding), before real use.
2. **Page and Kiwify can disagree.** The admin changes the price shown on the page; the real price is in Kiwify. A mismatch would show one price and charge another. Needs a written rule (change Kiwify first) or a check.
3. **Login lockout.** Anyone who knows an admin email can request 3 codes and block that admin from getting a code for 15 minutes (the limit is per email). Low risk, easy to hit.
4. **Code attempts are counted without a lock.** `verifyOtp` reads the attempt count, then increments it; parallel requests can exceed the 5-try limit. Fix with a single atomic `update ... returning`.
5. **Rate limit by IP shares one bucket** when no IP is present (`unknown`). Fine behind Cloudflare/Vercel, wrong elsewhere.
6. **Values load after the page.** Prices swap in after a fetch, so a changed price can flash the old one, and crawlers/WhatsApp previews read the HTML fallback. Server-side injection (Worker HTMLRewriter) would fix both.
7. **Defaults live in three places** (HTML, `PAGES.pro.defaults`, tests) and can drift.
8. **Two hosts to keep in sync** (Vercel files and Cloudflare files); remove Vercel after the cutover.
