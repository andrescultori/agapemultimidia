# Ágape Multimidia — Guidelines

## Branches and PRs
- `main` = what should be live. Work on `feat/…`, `fix/…`, `docs/…`, `chore/…`, always branched from the current `main`.
- Every change via PR. Check that an earlier PR from the same branch was not already merged before pushing more commits to it.

## Environments
| Env | URL | Deploy |
|---|---|---|
| Local | http://127.0.0.1:8765/pro/ | `npm run dev` (site + admin) or `python3 -m http.server 8765` (pages only) |
| Vercel preview | one URL per PR, in the Vercel bot comment | automatic on every PR push |
| Vercel production | `agapemultimidia.vercel.app` | automatic on merge to `main` |
| Official domain | https://agapemultimidia.com.br | manual upload to HostGator (below) until the DNS cutover |
| Cloudflare (target) | not live yet | see ADMIN.md |

Merging deploys to Vercel only. The official domain can differ from `main` until the manual upload is done.

## Deploy to the official domain (manual, HostGator)
1. Merge the PR into `main` and check the Vercel preview/production first.
2. Upload the changed page folders (`pro/`, `black/`) to `public_html/<folder>/` (cPanel File Manager or FTP), replacing existing files.
3. If redirects changed, paste `hostgator/root-redirect.htaccess` at the top of `public_html/.htaccess`, above the WordPress block.
4. Open the live URL in a private window, on a phone too. Check: main video autoplays muted, testimonials load, CTAs open the Kiwify checkout.
5. No WordPress page may use the `/pro` or `/black` addresses.

The admin (`/admin/`) and `/api/*` do not run on HostGator: prices edited there only show on Vercel/Cloudflare.

## Adding a page
1. Task in the Hub → branch → new folder mirroring the URL (`<path>/index.html` + `assets/`) → add it to `scripts/build-cf.mjs` (page list) → PR → merge → upload → check production.
2. Reuse the tokens and components in DESIGN.md.

## Content changes
- Prices, dates, guarantee and lesson counts: only with the client's confirmation.
- Share images (`og-black.jpg`, `og-pro.jpg`): after changing one, WhatsApp may keep the old preview for a while.
- Prices on `/pro/` are edited by the client in the admin; the HTML keeps the last agreed values as fallback (update fallback and `PAGES.pro.defaults` in `api/_lib/settings.js` together, only when the client confirms). The price in Kiwify itself is separate and must be changed there too.

## Automations
None (no Make.com scenarios).

## Cleanup
Remote branches fully merged into `main` (safe to delete on GitHub): `claude/affectionate-noether-ce8f8f`, `docs/project-docs`, `feat/cursos-page`, `feat/lp-black-november`, `feat/lp-video-depoimentos`, `fix/lp-a11y-polish`, `perf/hero-webp-sticky-cta`. Not merged, check before deleting: `perf/lp-quieter-motion`, `feat/hero-foto-titulo`.

## Releases and support
- TODO(André): fixes window and support terms.
- Planned: migration of the site to Cloudflare (steps in ADMIN.md); the HostGator sections here go away when it happens.
