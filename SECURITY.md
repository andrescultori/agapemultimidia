# Ágape Multimidia — Security

## Data handled
| Data | Where | Personal (LGPD)? | Who can read |
|---|---|---|---|
| None collected by this repo's pages | n/a | n/a | n/a |
| Purchase and customer data | Kiwify (client's account) | Yes | Client; not accessible from this project |

The pages are static: no forms, no database, no cookies set by us, no analytics or pixels.

## Third parties loaded by the page
- `youtube-nocookie.com` iframes (1 main video with muted autoplay, 3 testimonials).
- Links out to Kiwify checkout, YouTube, Instagram, Facebook.

## Database
None. If a database is ever added, every table gets RLS with explicit policies in the same migration.

## Secrets
None in the repo or its history (checked 2026-11-13). HostGator/cPanel credentials live with André and the client, never in the repo.

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
