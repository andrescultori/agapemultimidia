# Ágape Multimidia — Claude context

## What this is
Website and landing pages for Ágape Multimidia (live-streaming courses and consulting for churches). Client project (AMS). Client contact: Fábio. The repo holds two pages for the course "Transmissão Pro 2.0" and a client admin panel (`/admin/`, see ADMIN.md): `/pro/` (regular sales page, blue, 12x R$ 12,40 or R$ 119,90, no dates; the home, `/transmissao-ao-vivo-pro` and `/cursos` redirect here for now; `/cursos` is reserved for a future catalog page; `/consultoria` redirects to `https://pro.quaddro.com.br/agapemultimidia`) and `/black/` (Black November 2026 LP, kept as is for future use). Redirects: `vercel.json` (Vercel) and `hostgator/root-redirect.htaccess` (paste into `public_html/.htaccess`); both are temporary 302s.

## Stack
- Frontend: static HTML + inline CSS + a little inline JS, no framework. `/pro/` loads `shared/site-settings.js`, which swaps prices, buy link, KPIs, videos, hero image and links with the values published in the admin (the HTML keeps the same values as fallback). Build step only for Cloudflare (`npm run build:cf` → `dist/`).
- Admin (see ADMIN.md): handlers in `api/`, run as a Cloudflare Worker (`src/worker.js`) or as Vercel Functions, Supabase (schema `agape_admin` + bucket `site-images`), Resend. Stores admin emails (protected owners in `ADMIN_EMAILS` plus the `agape_admin.admins` table managed in `/admin/` → Administradores), login codes (hashed), sessions and settings versions. The public pages collect no visitor data.
- Checkout: Kiwify (external link `pay.kiwify.com.br`).
- Video: YouTube embeds through `youtube-nocookie.com`.
- Hosting: Vercel project `agapemultimidia` (team AMS, `ams-de94`) auto-deploys `main` and builds a preview per PR. The official domain still serves from HostGator (manual upload). Target: Cloudflare Workers with static assets (client's Cloudflare account). DNS stays at Registro.br nameservers → Cloudflare. HostGator/WordPress goes away at the cutover; the `hostgator/` redirect file is obsolete after that. See ADMIN.md for the cutover steps.
- Domain: `agapemultimidia.com.br`, registered at Registro.br (client's).

## Commands
```bash
npm install
npm run dev    # site + admin on http://127.0.0.1:8765/pro/ and /admin/ (in-memory DB, login code printed in the terminal)
npm test       # backend tests (Node test runner + in-memory Postgres)
npm run test:worker   # same flow inside the real Cloudflare Workers runtime
```
Pages themselves are still plain static files; `python3 -m http.server 8765` serves them without the admin.

## Conventions
- UI copy: pt-BR. Docs, comments and commit messages: English (older commits are in Portuguese).
- Paths are absolute from the domain root (`/pro/assets/...`, `/black/assets/...`), so the folder layout must mirror the final URL.
- Fonts are self-hosted in `<page>/assets/fonts/` (Archivo, Roboto). Do not add font CDNs.
- Redirects live in three places that must stay in sync: `vercel.json`, `scripts/build-cf.mjs` (Cloudflare `_redirects`) and `hostgator/root-redirect.htaccess`.
- One page = one folder with `index.html` + `assets/`.

## Rules for Claude
- Diagnose before changing; wait for André's confirmation on judgment calls (client name, prices, dates, what to publish).
- Prices, dates, guarantee terms and lesson counts come from the client. Never change or invent them. Prices on `/pro/` are edited by the client in the admin; the HTML keeps the last agreed values as a fallback, so update the fallback and `PAGES.pro.defaults` together only when the client confirms.
- Never add fabricated testimonials, names or quotes. Testimonials are the client's real videos.
- No trackers (Meta Pixel, GA, GTM) without a decision from André: adding one triggers the LGPD items in SECURITY.md.
- The main video autoplays muted; other videos never autoplay.
- Changes go through PRs from a branch off `main`; give André the link. Merging deploys to Vercel only; the official domain (HostGator) needs André's manual upload until the DNS cutover. The admin and `/api/*` do not run on HostGator.
- Never commit secrets. Admin secrets live only in the host's environment variables (Cloudflare Secrets / Vercel) (`.env.example` lists them).
- Prefer the lowest operating cost.

## Model and context
- Main session: Sonnet. Subagents default to Haiku; `Explore` runs on Haiku.
- Opus only for audits or security reviews.
- Read only what the task needs; filter command output to errors.

## Skills installed
Project scope (travels with the repo, in `.claude/skills/`):

| Skill | Source | Use |
|---|---|---|
| impeccable | https://github.com/pbakaus/impeccable (Apache-2.0) | Design audit, polish, critique on the LP. Run `/impeccable init` once to set the design context. First run downloads its engine binary (checksum-verified). |

Already available (no install):

| Skill | Use |
|---|---|
| `/security-review` (built in) | Before each merge |
| token-budget | Model routing and context hygiene |
| lgpd-web | Before adding Meta/Google pixels: cookie notice, PT-BR privacy notice |
| design-critique + accessibility-review | Gate before delivery |
| seo-ai-visibility | SEO pass before publishing |
| webapp-testing | Playwright check at mobile widths |

Deliberately not installed: style skills (hallmark/taste-skill), security-audit, supabase, vercel, claude-seo.

## Docs
DESIGN.md · SECURITY.md · GUIDELINES.md · ADMIN.md

## Open TODOs
- TODO(André): what `/black` shows after the offer ends on 30/11/2026 (waiting on Fábio).
- TODO(André): Cloudflare cutover (Worker deploy, Registro.br nameservers, custom domain); steps in ADMIN.md.
- TODO(André): decide what to do with the admin (keep and trim, or replace with something simpler); review in SECURITY.md "Open items".
- TODO(André): blue hero image and share image for `/pro/` (client); confirm the footnote wording with Fábio.
- TODO(André): delete merged branches on GitHub; check `perf/lp-quieter-motion` and `feat/hero-foto-titulo` first (list in GUIDELINES.md).
- TODO(André): where the Remotion lesson-cover project (`remotion-capas`) is versioned; it is not in this repo.
