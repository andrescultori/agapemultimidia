# Ágape Multimidia — Guidelines

## Branches and PRs
- `main` = what should be live. Work on `feat/…`, `fix/…`, `docs/…`, `chore/…`, always branched from the current `main`.
- Every change via PR. Check that an earlier PR from the same branch was not already merged before pushing more commits to it.

## Environments
| Env | URL | Deploy |
|---|---|---|
| Local | http://127.0.0.1:8765/black/ | `python3 -m http.server 8765` |
| Production | https://agapemultimidia.com.br/black/ | manual upload (below) |

There is no preview environment and no automatic deploy.

## Deploy (manual, HostGator)
1. Merge the PR into `main`.
2. Upload the whole `black/` folder to `public_html/black/` (cPanel File Manager or FTP), replacing existing files.
3. Open the live URL in a private window, on a phone too. Check: main video autoplays muted, testimonials load, CTAs open the Kiwify checkout.
4. No WordPress page may use the `/black` address.

Merging does not publish. Production can differ from `main` until step 2 is done.

## Adding a page
1. Task in the Hub → branch → new folder mirroring the URL (`<path>/index.html` + `assets/`) → PR → merge → upload → check production.
2. Reuse the tokens and components in DESIGN.md.

## Content changes
- Prices, dates, guarantee and lesson counts: only with the client's confirmation.
- Share image (`og-black.jpg`): after changing it, WhatsApp may keep the old preview for a while.

## Automations
None (no Make.com scenarios).

## Releases and support
- TODO(André): fixes window and support terms.
- Planned: migration of the site to Cloudflare; this section changes when that happens.
