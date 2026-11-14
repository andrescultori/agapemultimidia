# Ágape Multimidia — Claude context

## What this is
Website and landing pages for Ágape Multimidia (live-streaming courses and consulting for churches). Client project (AMS). Client contact: Fábio. Today the repo holds one page: the Black November 2026 LP for the course "Transmissão Pro 2.0".

## Stack
- Frontend: static HTML + inline CSS + a little inline JS. No build step, no framework.
- Backend/DB: none. No forms, no personal data collected.
- Checkout: Kiwify (external link `pay.kiwify.com.br`).
- Video: YouTube embeds through `youtube-nocookie.com`.
- Hosting: the client's HostGator account (WordPress site on the same domain). `black/` is uploaded by hand to `public_html/black/`. Planned: move the site to Cloudflare.
- Domain: `agapemultimidia.com.br`, registered at Registro.br (client's).

## Commands
```bash
python3 -m http.server 8765   # then open http://127.0.0.1:8765/black/
```
There is no install, build or test command.

## Conventions
- UI copy: pt-BR. Docs, comments and commit messages: English (older commits are in Portuguese).
- Paths are absolute from the domain root (`/black/assets/...`), so the folder layout must mirror the final URL.
- Fonts are self-hosted in `black/assets/fonts/` (Archivo, Roboto). Do not add font CDNs.
- One page = one folder with `index.html` + `assets/`.

## Rules for Claude
- Diagnose before changing; wait for André's confirmation on judgment calls (client name, prices, dates, what to publish).
- Prices, dates, guarantee terms and lesson counts come from the client. Never change or invent them.
- Never add fabricated testimonials, names or quotes. Testimonials are the client's real videos.
- No trackers (Meta Pixel, GA, GTM) without a decision from André: adding one triggers the LGPD items in SECURITY.md.
- The main video autoplays muted; other videos never autoplay.
- Changes go through PRs from a branch off `main`; give André the link. Merging does not deploy: André uploads `black/` to HostGator.
- Never commit secrets. This project has none today.
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
DESIGN.md · SECURITY.md · GUIDELINES.md

## Open TODOs
- TODO(André): what `/black` shows after the offer ends on 30/11/2026 (waiting on Fábio).
- TODO(André): Cloudflare migration plan and date.
- TODO(André): where the Remotion lesson-cover project (`remotion-capas`) is versioned; it is not in this repo.
